-- ============================================================
-- MIGRATION 1018: Fix process_purchase_atomic Function Overload Conflict
-- ============================================================
-- ROOT CAUSE: PostgreSQL has 3 overloads of this function (from migrations 017, 020, 1008)
-- PostgREST cannot resolve which overload to use → "schema cache" error.
-- FIX: DROP all old overloads, create one definitive version.
-- NOTE: All shariah_mode type references are guarded (enum may not exist in all envs)
-- ============================================================

-- 1. Ensure shariah_mode enum exists (idempotent)
DO $$ BEGIN
  CREATE TYPE shariah_mode AS ENUM ('CASH', 'SALAM', 'ISTISHNA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Ensure purchases table has shariah_mode column (idempotent)
DO $$ BEGIN
  ALTER TABLE public.purchases ADD COLUMN shariah_mode shariah_mode NOT NULL DEFAULT 'CASH';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 3. DROP old overloads (10-param from migration 017)
DROP FUNCTION IF EXISTS public.process_purchase_atomic(
  UUID, UUID, TIMESTAMPTZ, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, JSONB, UUID
);

-- 4. DROP old overload (11-param from migration 020)
DROP FUNCTION IF EXISTS public.process_purchase_atomic(
  UUID, UUID, TIMESTAMPTZ, DATE, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, JSONB, UUID
);

-- 5. DROP 12-param shariah_mode enum version (from migration 1008)
--    Use CASCADE so dependent views/rules don't block the drop
DO $$ BEGIN
  DROP FUNCTION IF EXISTS public.process_purchase_atomic(
    UUID, UUID, TIMESTAMPTZ, DATE, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, JSONB, UUID, shariah_mode
  ) CASCADE;
EXCEPTION WHEN OTHERS THEN NULL; -- safe if enum version never existed
END $$;

-- 6. CREATE the single definitive version
--    p_shariah_mode is TEXT to avoid enum resolution issues in PostgREST
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
  p_shariah_mode TEXT DEFAULT 'CASH'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_purchase_id UUID;
    v_line        RECORD;
BEGIN
    -- A. Insert Purchase Header
    INSERT INTO public.purchases (
        org_id, vendor_id, purchase_date, due_date,
        total_amount, tax_amount, shipping_amount, grand_total,
        status, created_by, notes, shariah_mode
    ) VALUES (
        p_org_id, p_vendor_id, p_date, p_due_date,
        p_total, p_tax, p_shipping, p_grand_total,
        'ORDERED', p_user_id, p_notes,
        (CASE p_shariah_mode
            WHEN 'SALAM'    THEN 'SALAM'
            WHEN 'ISTISHNA' THEN 'ISTISHNA'
            ELSE                 'CASH'
         END)::shariah_mode
    ) RETURNING id INTO v_purchase_id;

    -- B. Insert Line Items
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

    -- C. Create Approval Request
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

-- 7. Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.process_purchase_atomic(
  UUID, UUID, TIMESTAMPTZ, DATE, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, JSONB, UUID, TEXT
) TO authenticated;

-- 8. Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
