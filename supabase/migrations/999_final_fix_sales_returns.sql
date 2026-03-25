-- ============================================================
-- FINAL CLEANUP: Sales Returns (CASE 04)
-- ============================================================

-- 1. Ensure Table Products exists and has average_cost
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS average_cost DECIMAL(15,2) DEFAULT 0;
UPDATE public.products SET average_cost = purchase_price WHERE average_cost = 0 OR average_cost IS NULL;

-- 2. Clean up conflicting return tables to ensure fresh start
DROP TABLE IF EXISTS public.sales_return_items CASCADE;
DROP TABLE IF EXISTS public.sales_returns CASCADE;

-- 3. Create Fresh Sales Returns Table
CREATE TABLE public.sales_returns (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sale_id             UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  return_number       TEXT NOT NULL UNIQUE,
  return_date         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  nota_retur_number   TEXT, 
  status              TEXT NOT NULL DEFAULT 'COMPLETED',
  notes               TEXT,
  total_amount        DECIMAL(15,2) NOT NULL DEFAULT 0, -- Net
  tax_amount          DECIMAL(15,2) NOT NULL DEFAULT 0, -- PPN
  grand_total         DECIMAL(15,2) NOT NULL DEFAULT 0, -- Net + PPN
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID REFERENCES auth.users(id)
);

CREATE TABLE public.sales_return_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id           UUID NOT NULL REFERENCES public.sales_returns(id) ON DELETE CASCADE,
  sale_item_id        UUID REFERENCES public.sales_items(id) ON DELETE SET NULL,
  product_id          UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity            DECIMAL(15,2) NOT NULL,
  unit_price          DECIMAL(15,2) NOT NULL,
  total_price         DECIMAL(15,2) NOT NULL
);

-- 4. Clean and Replace Atomic Function
-- We drop explicitly with both 6 and 7 param signatures to ensure no conflicts
DROP FUNCTION IF EXISTS public.process_sales_return_atomic(UUID, UUID, TEXT, TEXT, JSONB, UUID);
DROP FUNCTION IF EXISTS public.process_sales_return_atomic(UUID, UUID, TEXT, TEXT, JSONB, UUID, UUID);
DROP FUNCTION IF EXISTS public.process_sales_return_atomic;

CREATE OR REPLACE FUNCTION public.process_sales_return_atomic(
    p_org_id UUID,
    p_sale_id UUID,
    p_return_number TEXT,
    p_nota_retur TEXT,
    p_items JSONB, 
    p_user_id UUID,
    p_refund_account_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_return_id UUID;
    v_item RECORD;
    v_total_net DECIMAL(15,2) := 0;
    v_total_tax DECIMAL(15,2) := 0;
    v_total_return DECIMAL(15,2) := 0;
    v_hpp_total DECIMAL(15,2) := 0;
    v_avg_cost DECIMAL(15,2);
    v_je_id UUID;
    
    -- Account IDs
    acc_piutang UUID;
    acc_retur_penjualan UUID;
    acc_ppn_keluaran UUID;
    acc_persediaan UUID;
    acc_hpp UUID;
    v_target_credit_account UUID;
BEGIN
    -- TAKE ACCOUNTS
    SELECT id INTO acc_piutang FROM public.accounts WHERE code = '1201' AND org_id = p_org_id;
    SELECT id INTO acc_retur_penjualan FROM public.accounts WHERE code = '4003' AND org_id = p_org_id; 
    SELECT id INTO acc_ppn_keluaran FROM public.accounts WHERE code = '2201' AND org_id = p_org_id;
    SELECT id INTO acc_persediaan FROM public.accounts WHERE code = '1301' AND org_id = p_org_id;
    SELECT id INTO acc_hpp FROM public.accounts WHERE code = '5001' AND org_id = p_org_id;

    IF acc_piutang IS NULL OR acc_retur_penjualan IS NULL OR acc_ppn_keluaran IS NULL OR acc_persediaan IS NULL OR acc_hpp IS NULL THEN
         RETURN jsonb_build_object('success', FALSE, 'error', 'Akun Pembukuan (1201, 4003, 2201, 1301, 5001) belum lengkap di COA.');
    END IF;

    -- Set target credit account (Refund Cash or Reduce AR)
    v_target_credit_account := COALESCE(p_refund_account_id, acc_piutang);

    -- INSERT HEADER
    INSERT INTO public.sales_returns (org_id, sale_id, return_number, nota_retur_number, created_by, status)
    VALUES (p_org_id, p_sale_id, p_return_number, p_nota_retur, p_user_id, 'COMPLETED')
    RETURNING id INTO v_return_id;

    -- PROCESS ITEMS
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity DECIMAL, unit_price DECIMAL, sale_item_id UUID)
    LOOP
        INSERT INTO public.sales_return_items (return_id, sale_item_id, product_id, quantity, unit_price, total_price)
        VALUES (v_return_id, v_item.sale_item_id, v_item.product_id, v_item.quantity, v_item.unit_price, v_item.quantity * v_item.unit_price);

        -- Update Stock with Current Average Cost (COGS reversal)
        SELECT COALESCE(average_cost, 0) INTO v_avg_cost FROM public.products WHERE id = v_item.product_id;
        v_hpp_total := v_hpp_total + (v_avg_cost * v_item.quantity);

        INSERT INTO public.stock_movements (org_id, product_id, quantity, unit_price, reference_type, reference_id, notes)
        VALUES (p_org_id, v_item.product_id, v_item.quantity, v_avg_cost, 'SALES_RETURN', v_return_id, 'Retur dr ' || p_return_number);

        -- Accumulate Net
        v_total_net := v_total_net + (v_item.quantity * v_item.unit_price);
    END LOOP;

    -- PPN 11%
    v_total_tax := v_total_net * 0.11;
    v_total_return := v_total_net + v_total_tax;

    -- Update Totals
    UPDATE public.sales_returns SET grand_total = v_total_return, tax_amount = v_total_tax, total_amount = v_total_net WHERE id = v_return_id;

    -- Accounting Jurnal
    INSERT INTO public.journal_entries (org_id, entry_date, description, reference_type, reference_id, status)
    VALUES (p_org_id, NOW(), 'Retur Penjualan ' || p_return_number, 'SALES_RETURN', v_return_id, 'POSTED')
    RETURNING id INTO v_je_id;

    -- Debit: Retur Penjualan (4003)
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, acc_retur_penjualan, v_total_net, 0);
    -- Debit: PPN Keluaran (2201)
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, acc_ppn_keluaran, v_total_tax, 0);
    -- Credit: Refund Account (Cash/Bank) OR AR (1201)
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, v_target_credit_account, 0, v_total_return);
    
    -- Inventory Reversal
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, acc_persediaan, v_hpp_total, 0);
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, acc_hpp, 0, v_hpp_total);

    RETURN jsonb_build_object('success', TRUE, 'return_id', v_return_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;

-- RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
