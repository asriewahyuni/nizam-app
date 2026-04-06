-- ============================================================
-- MIGRATION 1120: Inventory Account Segmentation Consistency
-- ============================================================
-- Objective:
-- 1) Ensure inventory segment accounts are available (WIP/Raw/Finished)
-- 2) Resolve inventory GL account per product via products.asset_account_id
-- 3) Remove hard-coded 1301 usage in atomic sales/purchase return flows
-- ============================================================

CREATE OR REPLACE FUNCTION public.ensure_inventory_segment_accounts(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_id UUID;
BEGIN
  SELECT id INTO v_parent_id
  FROM public.accounts
  WHERE org_id = p_org_id
    AND code = '1100'
  LIMIT 1;

  IF v_parent_id IS NULL THEN
    SELECT id INTO v_parent_id
    FROM public.accounts
    WHERE org_id = p_org_id
      AND code = '1000'
    LIMIT 1;
  END IF;

  INSERT INTO public.accounts (
    org_id, code, name, type, normal_balance, parent_id, is_system, is_active
  ) VALUES (
    p_org_id, '1302', 'Persediaan Barang Dalam Proses', 'ASSET', 'DEBIT', v_parent_id, TRUE, TRUE
  )
  ON CONFLICT (org_id, code) DO UPDATE
  SET name = EXCLUDED.name,
      type = 'ASSET',
      normal_balance = 'DEBIT',
      parent_id = COALESCE(public.accounts.parent_id, EXCLUDED.parent_id),
      is_system = TRUE,
      is_active = TRUE,
      updated_at = NOW();

  INSERT INTO public.accounts (
    org_id, code, name, type, normal_balance, parent_id, is_system, is_active
  ) VALUES (
    p_org_id, '1303', 'Persediaan Bahan Baku', 'ASSET', 'DEBIT', v_parent_id, TRUE, TRUE
  )
  ON CONFLICT (org_id, code) DO UPDATE
  SET name = EXCLUDED.name,
      type = 'ASSET',
      normal_balance = 'DEBIT',
      parent_id = COALESCE(public.accounts.parent_id, EXCLUDED.parent_id),
      is_system = TRUE,
      is_active = TRUE,
      updated_at = NOW();

  INSERT INTO public.accounts (
    org_id, code, name, type, normal_balance, parent_id, is_system, is_active
  ) VALUES (
    p_org_id, '1304', 'Persediaan Barang Jadi', 'ASSET', 'DEBIT', v_parent_id, TRUE, TRUE
  )
  ON CONFLICT (org_id, code) DO UPDATE
  SET name = EXCLUDED.name,
      type = 'ASSET',
      normal_balance = 'DEBIT',
      parent_id = COALESCE(public.accounts.parent_id, EXCLUDED.parent_id),
      is_system = TRUE,
      is_active = TRUE,
      updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_seed_inventory_segment_accounts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_inventory_segment_accounts(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zz_seed_inventory_accounts_on_org_create ON public.organizations;
CREATE TRIGGER trg_zz_seed_inventory_accounts_on_org_create
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_seed_inventory_segment_accounts();

DO $$
DECLARE
  v_org RECORD;
BEGIN
  FOR v_org IN
    SELECT id FROM public.organizations
  LOOP
    PERFORM public.ensure_inventory_segment_accounts(v_org.id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_inventory_asset_account(
  p_org_id UUID,
  p_product_id UUID,
  p_fallback_code TEXT DEFAULT '1301'
)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_account_id UUID;
  v_fallback_code TEXT := p_fallback_code;
  v_is_bom_component BOOLEAN := FALSE;
  v_is_bom_output BOOLEAN := FALSE;
BEGIN
  SELECT asset_account_id
  INTO v_account_id
  FROM public.products
  WHERE id = p_product_id
    AND org_id = p_org_id
  LIMIT 1;

  IF v_account_id IS NOT NULL THEN
    RETURN v_account_id;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.production_bom_items bi
    JOIN public.production_boms b ON b.id = bi.bom_id
    WHERE bi.product_id = p_product_id
      AND b.org_id = p_org_id
  )
  INTO v_is_bom_component;

  SELECT EXISTS (
    SELECT 1
    FROM public.production_boms b
    WHERE b.org_id = p_org_id
      AND b.product_id = p_product_id
  )
  INTO v_is_bom_output;

  IF v_is_bom_component AND v_is_bom_output THEN
    v_fallback_code := '1302'; -- WIP / setengah jadi
  ELSIF v_is_bom_component THEN
    v_fallback_code := '1303'; -- bahan baku
  ELSIF v_is_bom_output THEN
    v_fallback_code := '1304'; -- barang jadi
  END IF;

  SELECT id
  INTO v_account_id
  FROM public.accounts
  WHERE org_id = p_org_id
    AND code = v_fallback_code
  LIMIT 1;

  IF v_account_id IS NOT NULL THEN
    RETURN v_account_id;
  END IF;

  SELECT id
  INTO v_account_id
  FROM public.accounts
  WHERE org_id = p_org_id
    AND type = 'ASSET'
  ORDER BY code
  LIMIT 1;

  RETURN v_account_id;
END;
$$;

DO $$
DECLARE
  v_org RECORD;
BEGIN
  FOR v_org IN
    SELECT id FROM public.organizations
  LOOP
    UPDATE public.products p
    SET asset_account_id = public.resolve_inventory_asset_account(v_org.id, p.id, '1301')
    WHERE p.org_id = v_org.id
      AND COALESCE(p.type, 'INVENTORY') = 'INVENTORY'
      AND p.asset_account_id IS NULL;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_sales_delivery_atomic(
    p_org_id UUID,
    p_sale_id UUID,
    p_warehouse_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    v_requires_inventory_sync BOOLEAN;
    v_resolved_warehouse_id UUID;
    v_warehouse_branch_id UUID;
    v_warehouse_is_active BOOLEAN;
    v_item_inventory_account UUID;
    v_inventory_credit_by_account JSONB := '{}'::JSONB;
    v_credit_line RECORD;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required'
          USING ERRCODE = '42501';
    END IF;

    IF NOT public.nizam_has_permission('sales:write', p_org_id) THEN
        RAISE EXCEPTION 'Insufficient permission to deliver sales for organization %', p_org_id
          USING ERRCODE = '42501';
    END IF;

    SELECT *
    INTO v_sale
    FROM public.sales
    WHERE id = p_sale_id
      AND org_id = p_org_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sale order not found';
    END IF;

    IF v_sale.branch_id IS NOT NULL
       AND NOT public.can_access_branch(p_org_id, v_sale.branch_id) THEN
        RAISE EXCEPTION 'Branch % is not accessible for current user', v_sale.branch_id
          USING ERRCODE = '42501';
    END IF;

    IF v_sale.status = 'FINISHED' THEN
        RETURN;
    END IF;

    IF v_sale.status = 'VOIDED' THEN
        RAISE EXCEPTION 'Sale order has been voided';
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.sales_items si
      JOIN public.products p ON p.id = si.product_id
      WHERE si.sale_id = p_sale_id
        AND COALESCE(p.type, 'INVENTORY') = 'INVENTORY'
    )
    INTO v_requires_inventory_sync;

    IF v_requires_inventory_sync THEN
        v_resolved_warehouse_id := COALESCE(
          p_warehouse_id,
          v_sale.warehouse_id,
          public.resolve_single_active_warehouse(p_org_id, v_sale.branch_id)
        );

        IF v_resolved_warehouse_id IS NULL THEN
            RAISE EXCEPTION 'Pilih gudang pengiriman terlebih dahulu untuk mengurangi stok fisik.'
              USING ERRCODE = 'P0001';
        END IF;

        SELECT branch_id, is_active
        INTO v_warehouse_branch_id, v_warehouse_is_active
        FROM public.warehouses
        WHERE id = v_resolved_warehouse_id
          AND org_id = p_org_id;

        IF NOT FOUND OR v_warehouse_is_active IS DISTINCT FROM TRUE THEN
            RAISE EXCEPTION 'Gudang pengiriman tidak ditemukan atau tidak aktif.';
        END IF;

        IF v_sale.branch_id IS NOT NULL
           AND v_warehouse_branch_id IS DISTINCT FROM v_sale.branch_id THEN
            RAISE EXCEPTION 'Gudang pengiriman tidak berada pada unit yang sama dengan sales order.';
        END IF;
    END IF;

    SELECT id INTO v_acc_ar
    FROM public.accounts
    WHERE org_id = p_org_id AND code = '1201'
    LIMIT 1;

    SELECT id INTO v_acc_revenue
    FROM public.accounts
    WHERE org_id = p_org_id AND code = '4001'
    LIMIT 1;

    SELECT id INTO v_acc_tax
    FROM public.accounts
    WHERE org_id = p_org_id AND code = '2201'
    LIMIT 1;

    SELECT id INTO v_acc_cogs
    FROM public.accounts
    WHERE org_id = p_org_id AND code = '5001'
    LIMIT 1;

    IF v_acc_ar IS NULL
       OR v_acc_revenue IS NULL
       OR v_acc_tax IS NULL
       OR v_acc_cogs IS NULL THEN
        RAISE EXCEPTION 'Akun pembukuan penjualan (1201, 4001, 2201, 5001) belum lengkap.';
    END IF;

    FOR v_item IN
        SELECT
          si.*,
          p.type AS product_type,
          p.asset_account_id AS asset_account_id
        FROM public.sales_items si
        LEFT JOIN public.products p ON p.id = si.product_id
        WHERE si.sale_id = p_sale_id
    LOOP
        IF v_item.product_id IS NULL OR COALESCE(v_item.product_type, 'INVENTORY') <> 'INVENTORY' THEN
            CONTINUE;
        END IF;

        SELECT COALESCE(average_cost, 0)
        INTO v_hpp
        FROM public.products
        WHERE id = v_item.product_id;

        v_total_hpp := v_total_hpp + (v_hpp * v_item.quantity);

        v_item_inventory_account := COALESCE(
          v_item.asset_account_id,
          public.resolve_inventory_asset_account(p_org_id, v_item.product_id, '1301')
        );

        IF v_item_inventory_account IS NULL THEN
          RAISE EXCEPTION 'Akun persediaan produk % belum diatur.', v_item.product_id;
        END IF;

        v_inventory_credit_by_account := jsonb_set(
          v_inventory_credit_by_account,
          ARRAY[v_item_inventory_account::TEXT],
          to_jsonb(COALESCE((v_inventory_credit_by_account ->> v_item_inventory_account::TEXT)::NUMERIC, 0) + (v_hpp * v_item.quantity)),
          TRUE
        );

        INSERT INTO public.stock_movements (
          org_id,
          product_id,
          quantity,
          unit_price,
          reference_type,
          reference_id,
          notes,
          branch_id
        )
        VALUES (
          p_org_id,
          v_item.product_id,
          -(v_item.quantity),
          v_hpp,
          'SALE',
          p_sale_id,
          'Pengiriman SO ' || v_sale.sale_number,
          COALESCE(v_item.branch_id, v_sale.branch_id)
        );

        PERFORM public.adjust_inventory_stock(
          p_org_id,
          v_item.product_id,
          v_resolved_warehouse_id,
          -(v_item.quantity),
          NULL,
          NULL
        );
    END LOOP;

    UPDATE public.sales
    SET status = 'FINISHED',
        warehouse_id = COALESCE(v_resolved_warehouse_id, warehouse_id),
        updated_at = NOW()
    WHERE id = p_sale_id;

    INSERT INTO public.journal_entries (
      org_id,
      branch_id,
      entry_date,
      description,
      reference_id,
      reference_type,
      status,
      is_auto
    )
    VALUES (
      p_org_id,
      v_sale.branch_id,
      CURRENT_DATE,
      'Pengakuan Laba, Piutang, & PPN atas Penjualan SO ' || v_sale.sale_number,
      p_sale_id,
      'SALE',
      'POSTED',
      TRUE
    )
    RETURNING id INTO v_entry_id;

    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
    VALUES (v_entry_id, v_acc_ar, v_sale.grand_total, 0);

    IF v_sale.tax_amount > 0 THEN
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
        VALUES (v_entry_id, v_acc_tax, 0, v_sale.tax_amount);
    END IF;

    v_revenue := v_sale.total_amount - v_sale.discount_amount;
    IF v_revenue > 0 THEN
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
        VALUES (v_entry_id, v_acc_revenue, 0, v_revenue);
    END IF;

    IF v_total_hpp > 0 THEN
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
        VALUES (v_entry_id, v_acc_cogs, v_total_hpp, 0);

        FOR v_credit_line IN
          SELECT key, value
          FROM jsonb_each_text(v_inventory_credit_by_account)
        LOOP
          INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
          VALUES (v_entry_id, v_credit_line.key::UUID, 0, v_credit_line.value::NUMERIC);
        END LOOP;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_sales_delivery_atomic(
    p_org_id UUID,
    p_sale_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public.process_sales_delivery_atomic(p_org_id, p_sale_id, NULL);
END;
$$;

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

    INSERT INTO public.sales_returns (org_id, branch_id, sale_id, return_number, nota_retur_number, created_by, status)
    VALUES (p_org_id, v_sale_branch_id, p_sale_id, p_return_number, p_nota_retur, p_user_id, 'COMPLETED')
    RETURNING id INTO v_return_id;

    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity DECIMAL, unit_price DECIMAL, sale_item_id UUID)
    LOOP
        INSERT INTO public.sales_return_items (return_id, sale_item_id, product_id, quantity, unit_price, total_price)
        VALUES (v_return_id, v_item.sale_item_id, v_item.product_id, v_item.quantity, v_item.unit_price, v_item.quantity * v_item.unit_price);

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

CREATE OR REPLACE FUNCTION public.process_purchase_return_atomic(
  p_org_id UUID,
  p_purchase_id UUID,
  p_return_number TEXT,
  p_return_date TIMESTAMPTZ,
  p_notes TEXT,
  p_items JSONB,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purchase RECORD;
  v_return_id UUID;
  v_item RECORD;
  v_total_net NUMERIC := 0;
  v_total_tax NUMERIC := 0;
  v_total_return NUMERIC := 0;
  v_je_id UUID;
  v_resolved_warehouse UUID;
  v_item_inventory_account UUID;
  v_inventory_credit_by_account JSONB := '{}'::JSONB;
  v_credit_line RECORD;
  v_inventory_line_amount NUMERIC;
  acc_hutang UUID;
  acc_ppn_masukan UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Authentication required.');
  END IF;

  IF NOT public.nizam_has_permission('purchasing:write', p_org_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Insufficient permission to create purchase return.');
  END IF;

  SELECT *
  INTO v_purchase
  FROM public.purchases
  WHERE id = p_purchase_id
    AND org_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'PO tidak ditemukan.');
  END IF;

  IF v_purchase.branch_id IS NOT NULL
     AND NOT public.can_access_branch(p_org_id, v_purchase.branch_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Anda tidak memiliki akses unit untuk retur PO ini.');
  END IF;

  v_resolved_warehouse := COALESCE(
    v_purchase.warehouse_id,
    public.resolve_single_active_warehouse(p_org_id, v_purchase.branch_id)
  );

  IF v_resolved_warehouse IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Warehouse penerimaan tidak ditemukan sehingga retur tidak bisa sinkron ke stok fisik.'
    );
  END IF;

  SELECT id INTO acc_hutang FROM public.accounts WHERE code = '2101' AND org_id = p_org_id LIMIT 1;
  SELECT id INTO acc_ppn_masukan FROM public.accounts WHERE code = '1401' AND org_id = p_org_id LIMIT 1;

  IF acc_hutang IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Akun hutang (2101) belum lengkap untuk retur pembelian.');
  END IF;

  INSERT INTO public.purchase_returns (
    org_id,
    purchase_id,
    return_number,
    return_date,
    notes,
    created_by,
    branch_id
  )
  VALUES (
    p_org_id,
    p_purchase_id,
    p_return_number,
    p_return_date,
    p_notes,
    p_user_id,
    v_purchase.branch_id
  )
  RETURNING id INTO v_return_id;

  FOR v_item IN
    SELECT *
    FROM jsonb_to_recordset(p_items) AS x(
      product_id UUID,
      quantity NUMERIC,
      unit_price NUMERIC,
      purchase_item_id UUID
    )
  LOOP
    IF COALESCE(v_item.quantity, 0) <= 0 THEN
      RAISE EXCEPTION 'Quantity retur harus lebih besar dari nol.';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.purchase_items pi
      WHERE pi.id = v_item.purchase_item_id
        AND pi.purchase_id = p_purchase_id
        AND pi.org_id = p_org_id
    ) THEN
      RAISE EXCEPTION 'Item retur tidak valid untuk purchase %', p_purchase_id;
    END IF;

    INSERT INTO public.purchase_return_items (
      return_id,
      purchase_item_id,
      product_id,
      quantity,
      unit_price,
      total_price
    )
    VALUES (
      v_return_id,
      v_item.purchase_item_id,
      v_item.product_id,
      v_item.quantity,
      v_item.unit_price,
      v_item.quantity * v_item.unit_price
    );

    INSERT INTO public.stock_movements (
      org_id,
      branch_id,
      product_id,
      quantity,
      unit_price,
      reference_type,
      reference_id,
      notes
    )
    VALUES (
      p_org_id,
      v_purchase.branch_id,
      v_item.product_id,
      -v_item.quantity,
      v_item.unit_price,
      'PURCHASE_RETURN',
      v_return_id,
      'Retur Pembelian ' || COALESCE(p_return_number, '')
    );

    PERFORM public.adjust_inventory_stock(
      p_org_id,
      v_item.product_id,
      v_resolved_warehouse,
      -v_item.quantity,
      NULL,
      NULL
    );

    v_item_inventory_account := public.resolve_inventory_asset_account(p_org_id, v_item.product_id, '1301');
    IF v_item_inventory_account IS NULL THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Akun persediaan produk retur pembelian belum diatur.');
    END IF;

    v_inventory_line_amount := v_item.quantity * v_item.unit_price;

    v_inventory_credit_by_account := jsonb_set(
      v_inventory_credit_by_account,
      ARRAY[v_item_inventory_account::TEXT],
      to_jsonb(COALESCE((v_inventory_credit_by_account ->> v_item_inventory_account::TEXT)::NUMERIC, 0) + v_inventory_line_amount),
      TRUE
    );

    v_total_net := v_total_net + v_inventory_line_amount;
  END LOOP;

  v_total_tax := v_total_net * 0.11;
  v_total_return := v_total_net + v_total_tax;

  UPDATE public.purchase_returns
  SET total_amount = v_total_return,
      tax_amount = v_total_tax
  WHERE id = v_return_id;

  INSERT INTO public.journal_entries (
    org_id,
    branch_id,
    entry_date,
    description,
    reference_type,
    reference_id,
    status,
    is_auto
  )
  VALUES (
    p_org_id,
    v_purchase.branch_id,
    p_return_date,
    'Retur Pembelian ' || COALESCE(p_return_number, ''),
    'PURCHASE_RETURN',
    v_return_id,
    'POSTED',
    TRUE
  )
  RETURNING id INTO v_je_id;

  INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
  VALUES (v_je_id, acc_hutang, v_total_return, 0);

  FOR v_credit_line IN
    SELECT key, value
    FROM jsonb_each_text(v_inventory_credit_by_account)
  LOOP
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
    VALUES (v_je_id, v_credit_line.key::UUID, 0, v_credit_line.value::NUMERIC);
  END LOOP;

  IF v_total_tax > 0 AND acc_ppn_masukan IS NOT NULL THEN
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
    VALUES (v_je_id, acc_ppn_masukan, 0, v_total_tax);
  END IF;

  RETURN jsonb_build_object('success', TRUE, 'return_id', v_return_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_inventory_asset_account(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_sales_delivery_atomic(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_sales_delivery_atomic(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_sales_return_atomic(UUID, UUID, TEXT, TEXT, JSONB, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_purchase_return_atomic(UUID, UUID, TEXT, TIMESTAMPTZ, TEXT, JSONB, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
