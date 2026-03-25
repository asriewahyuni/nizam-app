-- ============================================================
-- MIGRATION 023: Fix Products Schema & Sales Returns Logic
-- ============================================================

-- 1. Add average_cost as a column for better COGS tracking
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS average_cost DECIMAL(15,2) DEFAULT 0;

-- 2. Update existing average_cost with purchase_price if available
UPDATE public.products SET average_cost = purchase_price WHERE average_cost = 0 OR average_cost IS NULL;

-- 3. Fix process_sales_return_atomic to use the updated column
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
    v_total_return DECIMAL(15,2) := 0;
    v_hpp_total DECIMAL(15,2) := 0;
    v_avg_cost DECIMAL(15,2);
    v_je_id UUID;
    v_customer_id UUID;
    
    -- Account IDs
    acc_piutang UUID;
    acc_retur_penjualan UUID;
    acc_ppn_keluaran UUID;
    acc_persediaan UUID;
    acc_hpp UUID;
BEGIN
    -- Get related customer info
    SELECT customer_id INTO v_customer_id FROM public.sales WHERE id = p_sale_id;

    -- A. TAKE ACCOUNTS
    SELECT id INTO acc_piutang FROM public.accounts WHERE code = '1201' AND org_id = p_org_id;
    SELECT id INTO acc_retur_penjualan FROM public.accounts WHERE code = '4003' AND org_id = p_org_id; 
    SELECT id INTO acc_ppn_keluaran FROM public.accounts WHERE code = '2201' AND org_id = p_org_id;
    SELECT id INTO acc_persediaan FROM public.accounts WHERE code = '1301' AND org_id = p_org_id;
    SELECT id INTO acc_hpp FROM public.accounts WHERE code = '5001' AND org_id = p_org_id;

    -- Default fallback if account not found
    IF acc_piutang IS NULL OR acc_retur_penjualan IS NULL OR acc_ppn_keluaran IS NULL OR acc_persediaan IS NULL OR acc_hpp IS NULL THEN
         RETURN jsonb_build_object('success', FALSE, 'error', 'Salah satu akun (Piutang 1201, Retur 4003, PPN 2201, Persediaan 1301, HPP 5001) belum dikonfigurasi.');
    END IF;

    -- B. INSERT HEADER RETUR
    INSERT INTO public.sales_returns (org_id, sale_id, return_number, total_amount, created_by, status)
    VALUES (p_org_id, p_sale_id, p_return_number, 0, p_user_id, 'COMPLETED')
    RETURNING id INTO v_return_id;

    -- Update 016 schema compatible notes if needed
    UPDATE public.sales_returns SET notes = 'Nota Retur: ' || COALESCE(p_nota_retur, '-') WHERE id = v_return_id;

    -- C. PROCESS ITEMS
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity DECIMAL, unit_price DECIMAL, sale_item_id UUID)
    LOOP
        -- 1. Insert Item Retur
        INSERT INTO public.sales_return_items (org_id, return_id, product_id, quantity, unit_price, description)
        VALUES (p_org_id, v_return_id, v_item.product_id, v_item.quantity, v_item.unit_price, 'Retur dari SO ' || p_sale_id);

        -- 2. Update Stok (Kembali ke Gudang)
        SELECT COALESCE(average_cost, 0) INTO v_avg_cost FROM public.products WHERE id = v_item.product_id;
        v_hpp_total := v_hpp_total + (v_avg_cost * v_item.quantity);

        INSERT INTO public.stock_movements (org_id, product_id, quantity, unit_price, reference_type, reference_id, notes)
        VALUES (p_org_id, v_item.product_id, v_item.quantity, v_avg_cost, 'SALES_RETURN', v_return_id, 'Retur dr ' || p_return_number);

        -- 3. Accumulate Totals
        v_total_net := v_total_net + (v_item.quantity * v_item.unit_price);
    END LOOP;

    -- D. CALCULATE TAX (11% PPN)
    v_total_tax := v_total_net * 0.11;
    v_total_return := v_total_net + v_total_tax;

    -- E. UPDATE TOTAL HEADER
    UPDATE public.sales_returns SET grand_total = v_total_return, tax_amount = v_total_tax, total_amount = v_total_net WHERE id = v_return_id;

    -- F. JOURNAL ENTRIES
    INSERT INTO public.journal_entries (org_id, entry_date, description, reference_type, reference_id, status)
    VALUES (p_org_id, NOW(), 'Retur Penjualan ' || p_return_number, 'SALES_RETURN', v_return_id, 'POSTED')
    RETURNING id INTO v_je_id;

    -- Debit: Sales Return (4102) - Reduces Revenue
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, acc_retur_penjualan, v_total_net, 0);
    -- Debit: VAT Output (2201) - Reduces Tax Liability
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, acc_ppn_keluaran, v_total_tax, 0);
    -- Credit: AR (1201) - Reduces customer debt
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, acc_piutang, 0, v_total_return);

    -- G. COGS REVERSAL
    -- Debit: Inventory (1301)
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, acc_persediaan, v_hpp_total, 0);
    -- Credit: COGS (5001)
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, acc_hpp, 0, v_hpp_total);

    RETURN jsonb_build_object('success', TRUE, 'return_id', v_return_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;
