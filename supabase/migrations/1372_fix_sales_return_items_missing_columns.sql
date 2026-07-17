-- Lanjutan perbaikan 1371: process_sales_return_atomic() juga meng-INSERT ke
-- sales_return_items memakai kolom yang sudah tidak ada di skema live
-- (`sale_item_id`, `total_price`) dan tidak mengisi `org_id` yang sebenarnya NOT NULL.
-- Skema nyata sales_return_items: id, org_id*, return_id*, product_id, description,
-- quantity*, unit_price*, tax_amount, total_amount (GENERATED ALWAYS AS quantity*unit_price+tax_amount),
-- created_at — total_amount tidak boleh diisi manual karena kolom generated.

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
SET search_path = public
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
    v_sale_branch_id UUID;
    v_sale_warehouse_id UUID;
    v_requires_inventory_sync BOOLEAN;
    v_item_inventory_account UUID;
    v_inventory_debit_by_account JSONB := '{}'::JSONB;
    v_inventory_line RECORD;
    v_inventory_amount NUMERIC;
    acc_piutang UUID;
    acc_retur_penjualan UUID;
    acc_ppn_keluaran UUID;
    acc_hpp UUID;
    v_target_credit_account UUID;
    v_product_type TEXT;
    v_notes TEXT;
BEGIN
    SELECT id INTO acc_piutang FROM public.accounts WHERE code = '1201' AND org_id = p_org_id;
    SELECT id INTO acc_retur_penjualan FROM public.accounts WHERE code = '4003' AND org_id = p_org_id;
    SELECT id INTO acc_ppn_keluaran FROM public.accounts WHERE code = '2201' AND org_id = p_org_id;
    SELECT id INTO acc_hpp FROM public.accounts WHERE code = '5001' AND org_id = p_org_id;

    SELECT branch_id, warehouse_id
    INTO v_sale_branch_id, v_sale_warehouse_id
    FROM public.sales
    WHERE id = p_sale_id
      AND org_id = p_org_id;

    v_sale_warehouse_id := COALESCE(
      v_sale_warehouse_id,
      public.resolve_single_active_warehouse(p_org_id, v_sale_branch_id)
    );

    SELECT EXISTS (
      SELECT 1
      FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity DECIMAL, unit_price DECIMAL, sale_item_id UUID)
      JOIN public.products p ON p.id = x.product_id
      WHERE COALESCE(p.type, 'INVENTORY') = 'INVENTORY'
    )
    INTO v_requires_inventory_sync;

    IF v_requires_inventory_sync AND v_sale_warehouse_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Gudang asal penjualan tidak ditemukan. Tidak bisa mengembalikan stok fisik.');
    END IF;

    IF acc_piutang IS NULL OR acc_retur_penjualan IS NULL OR acc_ppn_keluaran IS NULL OR acc_hpp IS NULL THEN
         RETURN jsonb_build_object('success', FALSE, 'error', 'Akun Pembukuan (1201, 4003, 2201, 5001) belum lengkap di COA.');
    END IF;

    v_target_credit_account := COALESCE(p_refund_account_id, acc_piutang);

    v_notes := NULLIF(TRIM(BOTH FROM COALESCE(p_nota_retur, '')), '');
    IF v_notes IS NOT NULL THEN
        v_notes := 'Nota Retur: ' || v_notes;
    END IF;

    INSERT INTO public.sales_returns (org_id, branch_id, sale_id, return_number, notes, created_by, status)
    VALUES (p_org_id, v_sale_branch_id, p_sale_id, p_return_number, v_notes, p_user_id, 'COMPLETED')
    RETURNING id INTO v_return_id;

    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity DECIMAL, unit_price DECIMAL, sale_item_id UUID)
    LOOP
        INSERT INTO public.sales_return_items (org_id, return_id, product_id, quantity, unit_price)
        VALUES (p_org_id, v_return_id, v_item.product_id, v_item.quantity, v_item.unit_price);

        SELECT COALESCE(average_cost, 0), type, asset_account_id
        INTO v_avg_cost, v_product_type, v_item_inventory_account
        FROM public.products
        WHERE id = v_item.product_id;

        IF COALESCE(v_product_type, 'INVENTORY') = 'INVENTORY' THEN
            v_item_inventory_account := COALESCE(
              v_item_inventory_account,
              public.resolve_inventory_asset_account(p_org_id, v_item.product_id, '1301')
            );

            IF v_item_inventory_account IS NULL THEN
              RETURN jsonb_build_object('success', FALSE, 'error', 'Akun persediaan produk retur belum diatur.');
            END IF;

            v_inventory_amount := v_avg_cost * v_item.quantity;
            v_hpp_total := v_hpp_total + v_inventory_amount;

            v_inventory_debit_by_account := jsonb_set(
              v_inventory_debit_by_account,
              ARRAY[v_item_inventory_account::TEXT],
              to_jsonb(COALESCE((v_inventory_debit_by_account ->> v_item_inventory_account::TEXT)::NUMERIC, 0) + v_inventory_amount),
              TRUE
            );

            INSERT INTO public.stock_movements (
              org_id, product_id, quantity, unit_price, reference_type, reference_id, notes, branch_id
            )
            VALUES (
              p_org_id, v_item.product_id, v_item.quantity, v_avg_cost, 'SALES_RETURN', v_return_id,
              'Retur dr ' || p_return_number, v_sale_branch_id
            );

            PERFORM public.adjust_inventory_stock(
              p_org_id,
              v_item.product_id,
              v_sale_warehouse_id,
              v_item.quantity,
              NULL,
              NULL
            );
        END IF;

        v_total_net := v_total_net + (v_item.quantity * v_item.unit_price);
    END LOOP;

    v_total_tax := v_total_net * 0.11;
    v_total_return := v_total_net + v_total_tax;

    UPDATE public.sales_returns SET grand_total = v_total_return, tax_amount = v_total_tax, total_amount = v_total_net WHERE id = v_return_id;

    INSERT INTO public.journal_entries (org_id, branch_id, entry_date, description, reference_type, reference_id, status)
    VALUES (p_org_id, v_sale_branch_id, NOW(), 'Retur Penjualan ' || p_return_number, 'SALES_RETURN', v_return_id, 'POSTED')
    RETURNING id INTO v_je_id;

    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, acc_retur_penjualan, v_total_net, 0);
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, acc_ppn_keluaran, v_total_tax, 0);
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, v_target_credit_account, 0, v_total_return);

    IF v_hpp_total > 0 THEN
      FOR v_inventory_line IN
        SELECT key, value
        FROM jsonb_each_text(v_inventory_debit_by_account)
      LOOP
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
        VALUES (v_je_id, v_inventory_line.key::UUID, v_inventory_line.value::NUMERIC, 0);
      END LOOP;

      INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
      VALUES (v_je_id, acc_hpp, 0, v_hpp_total);
    END IF;

    RETURN jsonb_build_object('success', TRUE, 'return_id', v_return_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;
