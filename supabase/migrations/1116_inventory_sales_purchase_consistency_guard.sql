-- ============================================================
-- MIGRATION 1116: Inventory/Sales/Purchase Consistency Guard
-- ============================================================
-- Hardens synchronization between stock_movements and inventory_stocks
-- for:
-- - void_sale_atomic
-- - void_purchase_atomic
-- - process_purchase_return_atomic
-- ============================================================

CREATE OR REPLACE FUNCTION public.reverse_inventory_from_stock_movements(
  p_org_id UUID,
  p_reference_type TEXT,
  p_reference_id UUID,
  p_warehouse_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_move RECORD;
  v_has_rows BOOLEAN := FALSE;
BEGIN
  FOR v_move IN
    SELECT product_id, SUM(quantity) AS quantity_sum
    FROM public.stock_movements
    WHERE org_id = p_org_id
      AND reference_type = p_reference_type
      AND reference_id = p_reference_id
    GROUP BY product_id
  LOOP
    v_has_rows := TRUE;

    IF p_warehouse_id IS NULL THEN
      RAISE EXCEPTION 'Warehouse context is required to reverse stock movements (%:%).',
        p_reference_type, p_reference_id;
    END IF;

    PERFORM public.adjust_inventory_stock(
      p_org_id,
      v_move.product_id,
      p_warehouse_id,
      -(v_move.quantity_sum),
      NULL,
      NULL
    );
  END LOOP;

  IF NOT v_has_rows THEN
    RETURN;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.void_sale_atomic(
  p_org_id UUID,
  p_sale_id UUID,
  p_user_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale RECORD;
  v_has_movements BOOLEAN;
  v_resolved_warehouse UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Authentication required.');
  END IF;

  IF NOT public.nizam_has_permission('sales:write', p_org_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Insufficient permission to void sales.');
  END IF;

  SELECT *
  INTO v_sale
  FROM public.sales
  WHERE id = p_sale_id
    AND org_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Sales order tidak ditemukan.');
  END IF;

  IF v_sale.branch_id IS NOT NULL
     AND NOT public.can_access_branch(p_org_id, v_sale.branch_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Anda tidak memiliki akses unit untuk sales ini.');
  END IF;

  IF v_sale.status = 'VOIDED' THEN
    RETURN jsonb_build_object('success', TRUE, 'already_voided', TRUE);
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.stock_movements
    WHERE org_id = p_org_id
      AND reference_type = 'SALE'
      AND reference_id = p_sale_id
  )
  INTO v_has_movements;

  v_resolved_warehouse := COALESCE(
    v_sale.warehouse_id,
    public.resolve_single_active_warehouse(p_org_id, v_sale.branch_id)
  );

  IF v_has_movements AND v_resolved_warehouse IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Warehouse sales tidak ditemukan sehingga stok tidak bisa dipulihkan.'
    );
  END IF;

  PERFORM public.reverse_inventory_from_stock_movements(
    p_org_id,
    'SALE',
    p_sale_id,
    v_resolved_warehouse
  );

  DELETE FROM public.stock_movements
  WHERE org_id = p_org_id
    AND reference_type = 'SALE'
    AND reference_id = p_sale_id;

  UPDATE public.journal_entries
  SET status = 'VOIDED',
      voided_at = NOW(),
      voided_by = p_user_id,
      void_reason = COALESCE(NULLIF(TRIM(p_reason), ''), 'Void sales via consistency guard')
  WHERE org_id = p_org_id
    AND reference_type = 'SALE'
    AND reference_id = p_sale_id
    AND status = 'POSTED';

  UPDATE public.sales
  SET status = 'VOIDED',
      warehouse_id = COALESCE(warehouse_id, v_resolved_warehouse),
      updated_at = NOW()
  WHERE id = p_sale_id
    AND org_id = p_org_id;

  RETURN jsonb_build_object('success', TRUE);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.void_purchase_atomic(
  p_org_id UUID,
  p_purchase_id UUID,
  p_user_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purchase RECORD;
  v_has_movements BOOLEAN;
  v_resolved_warehouse UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Authentication required.');
  END IF;

  IF NOT public.nizam_has_permission('purchasing:write', p_org_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Insufficient permission to void purchase.');
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
    RETURN jsonb_build_object('success', FALSE, 'error', 'Anda tidak memiliki akses unit untuk PO ini.');
  END IF;

  IF v_purchase.status = 'VOIDED' THEN
    RETURN jsonb_build_object('success', TRUE, 'already_voided', TRUE);
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.stock_movements
    WHERE org_id = p_org_id
      AND reference_type = 'PURCHASE'
      AND reference_id = p_purchase_id
  )
  INTO v_has_movements;

  v_resolved_warehouse := COALESCE(
    v_purchase.warehouse_id,
    public.resolve_single_active_warehouse(p_org_id, v_purchase.branch_id)
  );

  IF v_has_movements AND v_resolved_warehouse IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Warehouse penerimaan tidak ditemukan sehingga stok tidak bisa dipulihkan.'
    );
  END IF;

  PERFORM public.reverse_inventory_from_stock_movements(
    p_org_id,
    'PURCHASE',
    p_purchase_id,
    v_resolved_warehouse
  );

  DELETE FROM public.stock_movements
  WHERE org_id = p_org_id
    AND reference_type = 'PURCHASE'
    AND reference_id = p_purchase_id;

  UPDATE public.journal_entries
  SET status = 'VOIDED',
      voided_at = NOW(),
      voided_by = p_user_id,
      void_reason = COALESCE(NULLIF(TRIM(p_reason), ''), 'Void purchase via consistency guard')
  WHERE org_id = p_org_id
    AND reference_type = 'PURCHASE'
    AND reference_id = p_purchase_id
    AND status = 'POSTED';

  UPDATE public.purchases
  SET status = 'VOIDED',
      warehouse_id = COALESCE(warehouse_id, v_resolved_warehouse),
      updated_at = NOW()
  WHERE id = p_purchase_id
    AND org_id = p_org_id;

  RETURN jsonb_build_object('success', TRUE);
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
  acc_hutang UUID;
  acc_persediaan UUID;
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
  SELECT id INTO acc_persediaan FROM public.accounts WHERE code = '1301' AND org_id = p_org_id LIMIT 1;
  SELECT id INTO acc_ppn_masukan FROM public.accounts WHERE code = '1401' AND org_id = p_org_id LIMIT 1;

  IF acc_hutang IS NULL OR acc_persediaan IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Akun hutang/persediaan belum lengkap untuk retur pembelian.');
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

    v_total_net := v_total_net + (v_item.quantity * v_item.unit_price);
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

  INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
  VALUES (v_je_id, acc_persediaan, 0, v_total_net);

  IF v_total_tax > 0 AND acc_ppn_masukan IS NOT NULL THEN
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
    VALUES (v_je_id, acc_ppn_masukan, 0, v_total_tax);
  END IF;

  RETURN jsonb_build_object('success', TRUE, 'return_id', v_return_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;

NOTIFY pgrst, 'reload schema';
