-- ============================================================
-- MIGRATION 1124: Purchase SALAM Due-Date Guard
-- ============================================================
-- Goals:
-- 1) Enforce SALAM purchase must include planned goods-availability date
-- 2) Guard at DB layer so all clients follow the same rule
-- ============================================================

CREATE OR REPLACE FUNCTION public.process_purchase_atomic(
  p_org_id       UUID,
  p_vendor_id    UUID,
  p_date         TIMESTAMPTZ,
  p_due_date     DATE,
  p_total        NUMERIC,
  p_tax          NUMERIC,
  p_shipping     NUMERIC,
  p_grand_total  NUMERIC,
  p_notes        TEXT,
  p_lines        JSONB,
  p_user_id      UUID,
  p_branch_id    UUID DEFAULT NULL,
  p_shariah_mode TEXT DEFAULT 'CASH'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_purchase_id UUID;
    v_line        RECORD;
    v_branch_exists BOOLEAN;
    v_shariah_mode TEXT;
BEGIN
    v_shariah_mode := UPPER(COALESCE(TRIM(p_shariah_mode), 'CASH'));

    IF v_shariah_mode = 'SALAM' AND p_due_date IS NULL THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Akad SALAM pembelian wajib menetapkan tanggal barang disediakan.'
      );
    END IF;

    IF p_branch_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1
            FROM public.branches
            WHERE id = p_branch_id
              AND org_id = p_org_id
              AND is_active = TRUE
        ) INTO v_branch_exists;

        IF NOT v_branch_exists THEN
            RAISE EXCEPTION 'Branch % is not part of organization %', p_branch_id, p_org_id;
        END IF;
    END IF;

    INSERT INTO public.purchases (
        org_id, branch_id, vendor_id, purchase_date, due_date,
        total_amount, tax_amount, shipping_amount, grand_total,
        status, created_by, notes, shariah_mode
    ) VALUES (
        p_org_id, p_branch_id, p_vendor_id, p_date, p_due_date,
        p_total, p_tax, p_shipping, p_grand_total,
        'ORDERED', p_user_id, p_notes,
        (CASE v_shariah_mode
            WHEN 'SALAM'    THEN 'SALAM'
            WHEN 'ISTISHNA' THEN 'ISTISHNA'
            ELSE                 'CASH'
         END)::shariah_mode
    ) RETURNING id INTO v_purchase_id;

    FOR v_line IN
        SELECT * FROM jsonb_to_recordset(p_lines) AS x(
            product_id      UUID,
            description     TEXT,
            quantity        NUMERIC,
            unit_price      NUMERIC,
            discount_amount NUMERIC,
            tax_amount      NUMERIC
        )
    LOOP
        INSERT INTO public.purchase_items (
            org_id, purchase_id, product_id, description,
            quantity, unit_price, discount_amount, tax_amount
        ) VALUES (
            p_org_id, v_purchase_id, v_line.product_id, v_line.description,
            v_line.quantity, v_line.unit_price,
            COALESCE(v_line.discount_amount, 0),
            COALESCE(v_line.tax_amount, 0)
        );
    END LOOP;

    INSERT INTO public.approval_requests (
        org_id, requester_id, source_type, source_id, status, reason
    ) VALUES (
        p_org_id, p_user_id, 'PURCHASE_ORDER', v_purchase_id, 'PENDING',
        'Atomic Purchase Order (' || v_shariah_mode || ')'
    );

    RETURN jsonb_build_object('success', TRUE, 'purchase_id', v_purchase_id);

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_purchase_atomic(
  UUID, UUID, TIMESTAMPTZ, DATE, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, JSONB, UUID, UUID, TEXT
) TO authenticated;

NOTIFY pgrst, 'reload schema';
