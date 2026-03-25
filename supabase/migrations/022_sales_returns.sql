-- ============================================================
-- MIGRATION 022: Sales Returns (CASE 04)
-- ============================================================

-- 1. Sales Returns Table
CREATE TABLE IF NOT EXISTS public.sales_returns (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sale_id             UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  return_number       TEXT NOT NULL UNIQUE,
  return_date         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  nota_retur_number   TEXT, -- Untuk sinkronisasi e-Faktur
  notes               TEXT,
  total_amount        DECIMAL(15,2) NOT NULL DEFAULT 0, -- Total nominal retur (Net + Tax)
  tax_amount          DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID REFERENCES auth.users(id)
);

-- 2. Sales Return Items Table
CREATE TABLE IF NOT EXISTS public.sales_return_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id           UUID NOT NULL REFERENCES public.sales_returns(id) ON DELETE CASCADE,
  sale_item_id        UUID NOT NULL REFERENCES public.sales_items(id) ON DELETE CASCADE,
  product_id          UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity            DECIMAL(15,2) NOT NULL,
  unit_price          DECIMAL(15,2) NOT NULL, -- Harga jual saat transaksi
  total_price         DECIMAL(15,2) NOT NULL
);

-- 3. ATOMIC PROCESS: sales_return_atomic
CREATE OR REPLACE FUNCTION public.process_sales_return_atomic(
    p_org_id UUID,
    p_sale_id UUID,
    p_return_number TEXT,
    p_nota_retur TEXT,
    p_items JSONB, -- Array of {product_id, quantity, unit_price, sale_item_id}
    p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_return_id UUID;
    v_item RECORD;
    v_total_net DECIMAL(15,2) := 0;
    v_total_tax DECIMAL(15,2) := 0;
    v_item_tax DECIMAL(15,2) := 0;
    v_total_return DECIMAL(15,2) := 0;
    v_hpp_total DECIMAL(15,2) := 0;
    v_avg_cost DECIMAL(15,2);
    v_je_id UUID;
    
    -- Account IDs (Hanya contoh, di produksi harus diambil dari settings/chart)
    acc_piutang UUID;
    acc_retur_penjualan UUID;
    acc_ppn_keluaran UUID;
    acc_persediaan UUID;
    acc_hpp UUID;
BEGIN
    -- A. AMBIL AKUN (Mapping Standar)
    SELECT id INTO acc_piutang FROM public.accounts WHERE code = '1201' AND org_id = p_org_id;
    SELECT id INTO acc_retur_penjualan FROM public.accounts WHERE code = '4102' AND org_id = p_org_id; -- Retur Penjualan
    SELECT id INTO acc_ppn_keluaran FROM public.accounts WHERE code = '2201' AND org_id = p_org_id;
    SELECT id INTO acc_persediaan FROM public.accounts WHERE code = '1301' AND org_id = p_org_id;
    SELECT id INTO acc_hpp FROM public.accounts WHERE code = '5001' AND org_id = p_org_id;

    -- B. INSERT HEADER RETUR
    INSERT INTO public.sales_returns (org_id, sale_id, return_number, nota_retur_number, created_by)
    VALUES (p_org_id, p_sale_id, p_return_number, p_nota_retur, p_user_id)
    RETURNING id INTO v_return_id;

    -- C. PROCESS ITEMS
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity DECIMAL, unit_price DECIMAL, sale_item_id UUID)
    LOOP
        -- 1. Insert Item Retur
        INSERT INTO public.sales_return_items (return_id, sale_item_id, product_id, quantity, unit_price, total_price)
        VALUES (v_return_id, v_item.sale_item_id, v_item.product_id, v_item.quantity, v_item.unit_price, v_item.quantity * v_item.unit_price);

        -- 2. Update Stok (Kembali ke Gudang)
        -- Ambil HPP produk saat ini (Average Cost)
        SELECT COALESCE(average_cost, 0) INTO v_avg_cost FROM public.products WHERE id = v_item.product_id;
        v_hpp_total := v_hpp_total + (v_avg_cost * v_item.quantity);

        INSERT INTO public.stock_movements (org_id, product_id, quantity, unit_price, reference_type, reference_id, notes)
        VALUES (p_org_id, v_item.product_id, v_item.quantity, v_avg_cost, 'SALES_RETURN', v_return_id, 'Retur dr ' || p_return_number);

        -- 3. Accumulate Totals
        v_total_net := v_total_net + (v_item.quantity * v_item.unit_price);
    END LOOP;

    -- D. HITUNG PAJAK (Asumsi 11% PPN)
    v_total_tax := v_total_net * 0.11;
    v_total_return := v_total_net + v_total_tax;

    -- E. UPDATE TOTAL HEADER
    UPDATE public.sales_returns SET total_amount = v_total_return, tax_amount = v_total_tax WHERE id = v_return_id;

    -- F. JURNAL BALIK (Accounting Integration)
    -- 1. Create Journal Entry
    INSERT INTO public.journal_entries (org_id, entry_date, description, reference_type, reference_id, status)
    VALUES (p_org_id, NOW(), 'Retur Penjualan ' || p_return_number, 'SALES_RETURN', v_return_id, 'POSTED')
    RETURNING id INTO v_je_id;

    -- 2. Lines:
    -- DEBIT: Retur Penjualan (Mengurangi Revenue)
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, acc_retur_penjualan, v_total_net, 0);
    -- DEBIT: PPN Keluaran (Mengurangi Hutang Pajak)
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, acc_ppn_keluaran, v_total_tax, 0);
    -- CREDIT: Piutang Usaha (Mengurangi Tagihan PT Maju Jaya)
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, acc_piutang, 0, v_total_return);

    -- 3. COGS REVERSAL (Back to Inventory)
    -- DEBIT: Persediaan
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, acc_persediaan, v_hpp_total, 0);
    -- CREDIT: HPP
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, acc_hpp, 0, v_hpp_total);

    RETURN jsonb_build_object('success', TRUE, 'return_id', v_return_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;
