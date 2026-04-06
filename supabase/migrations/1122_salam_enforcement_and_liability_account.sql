-- ============================================================
-- MIGRATION 1122: SALAM Enforcement + Liability Account
-- ============================================================
-- Goals:
-- 1) Enforce SALAM payment semantics (must be fully paid before delivery)
-- 2) Route SALAM journals through liability account (Hutang Salam)
-- 3) Ensure CoA syariah has account 2602 (Hutang Salam)
-- ============================================================

CREATE OR REPLACE FUNCTION public.ensure_salam_liability_account(p_org_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_liability_root_id UUID;
  v_syariah_liability_parent_id UUID;
  v_salam_liability_id UUID;
BEGIN
  SELECT id
  INTO v_liability_root_id
  FROM public.accounts
  WHERE org_id = p_org_id
    AND code = '2000'
  LIMIT 1;

  IF v_liability_root_id IS NULL THEN
    SELECT id
    INTO v_liability_root_id
    FROM public.accounts
    WHERE org_id = p_org_id
      AND type = 'LIABILITY'
    ORDER BY code
    LIMIT 1;
  END IF;

  INSERT INTO public.accounts (
    org_id,
    code,
    name,
    type,
    normal_balance,
    parent_id,
    is_system,
    is_active
  )
  VALUES (
    p_org_id,
    '2600',
    'Kewajiban Syariah',
    'LIABILITY',
    'CREDIT',
    v_liability_root_id,
    FALSE,
    TRUE
  )
  ON CONFLICT (org_id, code)
  DO UPDATE
    SET
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      normal_balance = EXCLUDED.normal_balance,
      parent_id = COALESCE(public.accounts.parent_id, EXCLUDED.parent_id),
      is_active = TRUE
  RETURNING id INTO v_syariah_liability_parent_id;

  IF v_syariah_liability_parent_id IS NULL THEN
    SELECT id
    INTO v_syariah_liability_parent_id
    FROM public.accounts
    WHERE org_id = p_org_id
      AND code = '2600'
    LIMIT 1;
  END IF;

  INSERT INTO public.accounts (
    org_id,
    code,
    name,
    type,
    normal_balance,
    parent_id,
    is_system,
    is_active
  )
  VALUES (
    p_org_id,
    '2602',
    'Hutang Salam',
    'LIABILITY',
    'CREDIT',
    v_syariah_liability_parent_id,
    FALSE,
    TRUE
  )
  ON CONFLICT (org_id, code)
  DO UPDATE
    SET
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      normal_balance = EXCLUDED.normal_balance,
      parent_id = COALESCE(public.accounts.parent_id, EXCLUDED.parent_id),
      is_active = TRUE
  RETURNING id INTO v_salam_liability_id;

  RETURN v_salam_liability_id;
END;
$$;

DO $$
DECLARE
  v_org_id UUID;
BEGIN
  FOR v_org_id IN
    (
      SELECT DISTINCT org_id
      FROM public.sales
      WHERE UPPER(COALESCE(shariah_mode::TEXT, 'CASH')) = 'SALAM'
      UNION
      SELECT DISTINCT org_id
      FROM public.accounts
      WHERE code = '2600'
    )
  LOOP
    PERFORM public.ensure_salam_liability_account(v_org_id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_sales_payment_atomic(
    p_org_id UUID,
    p_sale_id UUID,
    p_account_id UUID,
    p_amount DECIMAL,
    p_discount DECIMAL,
    p_payment_date TIMESTAMPTZ,
    p_notes TEXT,
    p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_payment_id UUID;
    v_payment_number TEXT;
    v_je_id UUID;
    v_total_invoice DECIMAL;
    v_total_returned DECIMAL;
    v_total_paid DECIMAL;
    v_remaining_ar DECIMAL;
    v_count INT;
    v_sale RECORD;
    v_is_salam BOOLEAN := FALSE;
    v_credit_account_id UUID;
    acc_piutang UUID;
    acc_diskon UUID;
BEGIN
    SELECT id INTO acc_piutang FROM public.accounts WHERE code = '1201' AND org_id = p_org_id;
    SELECT id INTO acc_diskon FROM public.accounts WHERE code = '4002' AND org_id = p_org_id;

    SELECT id, branch_id, grand_total, shariah_mode
    INTO v_sale
    FROM public.sales
    WHERE id = p_sale_id
      AND org_id = p_org_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Invoice penjualan tidak ditemukan.');
    END IF;

    v_is_salam := UPPER(COALESCE(v_sale.shariah_mode::TEXT, 'CASH')) = 'SALAM';

    IF v_is_salam THEN
      v_credit_account_id := public.ensure_salam_liability_account(p_org_id);
      IF v_credit_account_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Akun Hutang Salam (2602) belum tersedia di CoA.');
      END IF;
    ELSE
      v_credit_account_id := acc_piutang;
      IF v_credit_account_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Akun Piutang (1201) tidak ditemukan.');
      END IF;
    END IF;

    v_total_invoice := COALESCE(v_sale.grand_total, 0);
    SELECT COALESCE(SUM(grand_total), 0) INTO v_total_returned FROM public.sales_returns WHERE sale_id = p_sale_id;
    SELECT COALESCE(SUM(amount + discount_amount), 0) INTO v_total_paid FROM public.sales_payments WHERE sale_id = p_sale_id;

    v_remaining_ar := v_total_invoice - v_total_returned - v_total_paid;

    IF (p_amount + p_discount) > (v_remaining_ar + 0.01) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Jumlah bayar + diskon melebih sisa tagihan: ' || v_remaining_ar);
    END IF;

    IF v_is_salam AND (p_amount + p_discount) < (v_remaining_ar - 0.01) THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Akad SALAM wajib lunas di awal. Sisa tagihan: ' || v_remaining_ar);
    END IF;

    SELECT COUNT(*) + 1 INTO v_count FROM public.sales_payments WHERE org_id = p_org_id AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
    v_payment_number := 'PAY-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(v_count::TEXT, 6, '0');

    INSERT INTO public.sales_payments (
      org_id, branch_id, sale_id, account_id, amount, discount_amount, payment_date, payment_number, notes, created_by
    )
    VALUES (
      p_org_id, v_sale.branch_id, p_sale_id, p_account_id, p_amount, p_discount, p_payment_date, v_payment_number, p_notes, p_user_id
    )
    RETURNING id INTO v_payment_id;

    INSERT INTO public.journal_entries (
      org_id, branch_id, entry_date, description, reference_type, reference_id, status, is_auto
    )
    VALUES (
      p_org_id,
      v_sale.branch_id,
      p_payment_date,
      CASE WHEN v_is_salam THEN 'Pembayaran SALAM ' || v_payment_number ELSE 'Pembayaran Invoice ' || v_payment_number END,
      'PAYMENT_IN',
      v_payment_id,
      'POSTED',
      TRUE
    )
    RETURNING id INTO v_je_id;

    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, p_account_id, p_amount, 0);

    IF p_discount > 0 THEN
        IF acc_diskon IS NULL THEN
             RETURN jsonb_build_object('success', FALSE, 'error', 'Akun Diskon Penjualan (4002) tidak ditemukan.');
        END IF;
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, acc_diskon, p_discount, 0);
    END IF;

    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
    VALUES (v_je_id, v_credit_account_id, 0, p_amount + p_discount);

    IF (v_total_paid + p_amount + p_discount) >= (v_total_invoice - v_total_returned - 0.01) THEN
        UPDATE public.sales SET payment_status = 'PAID' WHERE id = p_sale_id;
    ELSE
        UPDATE public.sales SET payment_status = 'PARTIAL' WHERE id = p_sale_id;
    END IF;

    RETURN jsonb_build_object('success', TRUE, 'payment_id', v_payment_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
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
    v_acc_hutang_salam UUID;
    v_acc_debit_target UUID;
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
    v_is_salam BOOLEAN := FALSE;
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

    v_is_salam := UPPER(COALESCE(v_sale.shariah_mode::TEXT, 'CASH')) = 'SALAM';

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

    IF v_is_salam AND COALESCE(v_sale.payment_status::TEXT, 'UNPAID') <> 'PAID' THEN
      RAISE EXCEPTION 'Akad SALAM wajib lunas terlebih dahulu sebelum pengiriman barang.';
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

    IF v_is_salam THEN
      v_acc_hutang_salam := public.ensure_salam_liability_account(p_org_id);
      v_acc_debit_target := v_acc_hutang_salam;
    ELSE
      v_acc_debit_target := v_acc_ar;
    END IF;

    IF v_acc_debit_target IS NULL OR v_acc_revenue IS NULL OR v_acc_tax IS NULL OR v_acc_cogs IS NULL THEN
        RAISE EXCEPTION 'Akun pembukuan penjualan belum lengkap (1201/2602, 4001, 2201, 5001).';
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
      CASE WHEN v_is_salam
        THEN 'Pengakuan Pendapatan & PPN atas Delivery SALAM SO ' || v_sale.sale_number
        ELSE 'Pengakuan Laba, Piutang, & PPN atas Penjualan SO ' || v_sale.sale_number
      END,
      p_sale_id,
      'SALE',
      'POSTED',
      TRUE
    )
    RETURNING id INTO v_entry_id;

    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
    VALUES (v_entry_id, v_acc_debit_target, v_sale.grand_total, 0);

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

GRANT EXECUTE ON FUNCTION public.ensure_salam_liability_account(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_sales_payment_atomic(UUID, UUID, UUID, DECIMAL, DECIMAL, TIMESTAMPTZ, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_sales_delivery_atomic(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_sales_delivery_atomic(UUID, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
