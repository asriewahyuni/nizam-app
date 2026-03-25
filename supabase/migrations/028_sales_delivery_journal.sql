CREATE OR REPLACE FUNCTION process_sales_delivery_atomic(
    p_org_id UUID,
    p_sale_id UUID
) RETURNS VOID AS $$
DECLARE
    v_sale RECORD;
    v_item RECORD;
    v_hpp NUMERIC;
    v_total_hpp NUMERIC := 0;
    v_entry_id UUID;
    v_revenue NUMERIC;
    
    v_acc_ar UUID;
    v_acc_revenue UUID;
    v_acc_tax UUID;
    v_acc_cogs UUID;
    v_acc_inventory UUID;
BEGIN
    SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id AND org_id = p_org_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Sale order not found'; END IF;
    IF v_sale.status = 'FINISHED' THEN RETURN; END IF;

    -- Tarik Buku Besar Asli
    SELECT id INTO v_acc_ar FROM public.accounts WHERE org_id = p_org_id AND code = '1201' LIMIT 1;
    SELECT id INTO v_acc_revenue FROM public.accounts WHERE org_id = p_org_id AND code = '4001' LIMIT 1;
    SELECT id INTO v_acc_tax FROM public.accounts WHERE org_id = p_org_id AND code = '2201' LIMIT 1;
    SELECT id INTO v_acc_cogs FROM public.accounts WHERE org_id = p_org_id AND code = '5001' LIMIT 1;
    SELECT id INTO v_acc_inventory FROM public.accounts WHERE org_id = p_org_id AND code = '1301' LIMIT 1;

    -- Update Fisik & Hitung Potongan Modal (HPP)
    FOR v_item IN SELECT * FROM public.sales_items WHERE sale_id = p_sale_id LOOP
        SELECT average_cost INTO v_hpp FROM public.products WHERE id = v_item.product_id;
        IF v_hpp IS NULL THEN v_hpp := 0; END IF;
        v_total_hpp := v_total_hpp + (v_hpp * v_item.quantity);
        
        INSERT INTO public.stock_movements (org_id, product_id, quantity, unit_price, reference_type, reference_id, notes) 
        VALUES (p_org_id, v_item.product_id, -(v_item.quantity), v_hpp, 'SALE', p_sale_id, 'Pengiriman SO ' || v_sale.sale_number);
    END LOOP;

    -- Kunci Status 
    UPDATE public.sales SET status = 'FINISHED', updated_at = NOW() WHERE id = p_sale_id;

    -- Cetak Jurnal Penuh Sesuai Sandar Laporan Keuangan
    INSERT INTO public.journal_entries (org_id, entry_date, description, reference_id, reference_type, status, is_auto)
    VALUES (p_org_id, CURRENT_DATE, 'Pengakuan Laba, Piutang, & PPN atas Penjualan SO ' || v_sale.sale_number, p_sale_id, 'SALE', 'POSTED', TRUE)
    RETURNING id INTO v_entry_id;

    -- 1. Tembak Piutang (Menetralkan DP Minus)
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_entry_id, v_acc_ar, v_sale.grand_total, 0);

    -- 2. Tarik Hutang PPN (Keluaran)
    IF v_sale.tax_amount > 0 THEN
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_entry_id, v_acc_tax, 0, v_sale.tax_amount);
    END IF;

    -- 3. Akui Pendapatan Laba Jual
    v_revenue := v_sale.total_amount - v_sale.discount_amount;
    IF v_revenue > 0 THEN
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_entry_id, v_acc_revenue, 0, v_revenue);
    END IF;

    -- 4. Sinkronisasi HPP vs Inventori
    IF v_total_hpp > 0 THEN
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_entry_id, v_acc_cogs, v_total_hpp, 0);
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_entry_id, v_acc_inventory, 0, v_total_hpp);
    END IF;
END;
$$ LANGUAGE plpgsql;
