-- ============================================================
-- MIGRATION 1087: Purchasing Branch Context
-- Adds unit scope to purchase requests and purchase orders.
-- ============================================================

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

ALTER TABLE public.purchase_requests
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_purchases_org_branch_date
  ON public.purchases(org_id, branch_id, purchase_date DESC);

CREATE INDEX IF NOT EXISTS idx_purchase_requests_org_branch_status
  ON public.purchase_requests(org_id, branch_id, status, created_at DESC);

DROP FUNCTION IF EXISTS public.process_purchase_atomic(
  UUID, UUID, TIMESTAMPTZ, DATE, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, JSONB, UUID, TEXT
);

DROP FUNCTION IF EXISTS public.process_purchase_atomic(
  UUID, UUID, TIMESTAMPTZ, DATE, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, JSONB, UUID, UUID, TEXT
);

DROP FUNCTION IF EXISTS public.process_purchase_atomic(
  UUID, UUID, TIMESTAMPTZ, DATE, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, JSONB, UUID
);

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
AS $$
DECLARE
    v_purchase_id UUID;
    v_line        RECORD;
    v_branch_exists BOOLEAN;
BEGIN
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
        (CASE p_shariah_mode
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
        'Atomic Purchase Order (' || p_shariah_mode || ')'
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
