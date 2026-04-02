-- ============================================================
-- MIGRATION 1089: Inventory Branch Backfill Hardening
-- Resolve remaining legacy null branch rows conservatively and
-- prepare strict per-unit inventory reads.
-- ============================================================

CREATE OR REPLACE FUNCTION public.resolve_single_active_branch(
  p_org_id UUID
) RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
  SELECT
    CASE
      WHEN COUNT(*) = 1 THEN MIN(id::text)::UUID
      ELSE NULL
    END
  FROM public.branches
  WHERE org_id = p_org_id
    AND is_active = TRUE;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'purchases'
      AND column_name = 'warehouse_id'
  ) THEN
    WITH purchase_branch_map AS (
      SELECT
        p.warehouse_id,
        MIN(p.branch_id::text)::UUID AS branch_id
      FROM public.purchases p
      WHERE p.warehouse_id IS NOT NULL
        AND p.branch_id IS NOT NULL
      GROUP BY p.warehouse_id
      HAVING COUNT(DISTINCT p.branch_id) = 1
    )
    UPDATE public.warehouses w
    SET branch_id = purchase_branch_map.branch_id
    FROM purchase_branch_map
    WHERE w.id = purchase_branch_map.warehouse_id
      AND w.branch_id IS NULL;
  END IF;
END $$;

WITH single_branch_warehouses AS (
  SELECT
    w.id,
    public.resolve_single_active_branch(w.org_id) AS branch_id
  FROM public.warehouses w
  WHERE w.branch_id IS NULL
)
UPDATE public.warehouses w
SET branch_id = single_branch_warehouses.branch_id
FROM single_branch_warehouses
WHERE w.id = single_branch_warehouses.id
  AND single_branch_warehouses.branch_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'purchases'
      AND column_name = 'warehouse_id'
  ) THEN
    UPDATE public.purchases p
    SET branch_id = w.branch_id
    FROM public.warehouses w
    WHERE p.warehouse_id = w.id
      AND p.branch_id IS NULL
      AND w.branch_id IS NOT NULL;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.resolve_stock_movement_branch_id(TEXT, UUID, UUID);
DROP FUNCTION IF EXISTS public.resolve_stock_movement_branch_id(TEXT, UUID, UUID, UUID);

CREATE OR REPLACE FUNCTION public.resolve_stock_movement_branch_id(
  p_reference_type TEXT,
  p_reference_id UUID,
  p_warehouse_id UUID DEFAULT NULL,
  p_org_id UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_branch_id UUID;
BEGIN
  IF p_warehouse_id IS NOT NULL THEN
    SELECT branch_id INTO v_branch_id
    FROM public.warehouses
    WHERE id = p_warehouse_id;

    IF v_branch_id IS NOT NULL THEN
      RETURN v_branch_id;
    END IF;
  END IF;

  CASE UPPER(COALESCE(p_reference_type, ''))
    WHEN 'PURCHASE' THEN
      SELECT branch_id INTO v_branch_id
      FROM public.purchases
      WHERE id = p_reference_id;

    WHEN 'PURCHASE_RETURN' THEN
      SELECT p.branch_id INTO v_branch_id
      FROM public.purchase_returns pr
      JOIN public.purchases p ON p.id = pr.purchase_id
      WHERE pr.id = p_reference_id;

    WHEN 'SALE' THEN
      SELECT
        CASE
          WHEN COUNT(DISTINCT branch_id) = 1 THEN MIN(branch_id::text)::UUID
          ELSE NULL
        END
      INTO v_branch_id
      FROM public.sales_items
      WHERE sale_id = p_reference_id
        AND branch_id IS NOT NULL;

    WHEN 'SALES_RETURN' THEN
      SELECT
        CASE
          WHEN COUNT(DISTINCT si.branch_id) = 1 THEN MIN(si.branch_id::text)::UUID
          ELSE NULL
        END
      INTO v_branch_id
      FROM public.sales_return_items sri
      JOIN public.sales_items si ON si.id = sri.sale_item_id
      WHERE sri.return_id = p_reference_id
        AND si.branch_id IS NOT NULL;

    WHEN 'ADJUSTMENT' THEN
      SELECT
        CASE
          WHEN COUNT(DISTINCT w.branch_id) = 1 THEN MIN(w.branch_id::text)::UUID
          ELSE NULL
        END
      INTO v_branch_id
      FROM public.inventory_adjustment_items iai
      JOIN public.warehouses w ON w.id = iai.warehouse_id
      WHERE iai.adjustment_id = p_reference_id
        AND w.branch_id IS NOT NULL;

    WHEN 'PRODUCTION_OUTPUT' THEN
      SELECT
        CASE
          WHEN COUNT(DISTINCT branch_id) = 1 THEN MIN(branch_id::text)::UUID
          ELSE NULL
        END
      INTO v_branch_id
      FROM public.stock_movements
      WHERE reference_id = p_reference_id
        AND reference_type IN ('PRODUCTION_OUTPUT', 'PRODUCTION_CONSUMPTION')
        AND branch_id IS NOT NULL;

    WHEN 'PRODUCTION_CONSUMPTION' THEN
      SELECT
        CASE
          WHEN COUNT(DISTINCT branch_id) = 1 THEN MIN(branch_id::text)::UUID
          ELSE NULL
        END
      INTO v_branch_id
      FROM public.stock_movements
      WHERE reference_id = p_reference_id
        AND reference_type IN ('PRODUCTION_OUTPUT', 'PRODUCTION_CONSUMPTION')
        AND branch_id IS NOT NULL;

    ELSE
      v_branch_id := NULL;
  END CASE;

  IF v_branch_id IS NULL AND p_org_id IS NOT NULL THEN
    v_branch_id := public.resolve_single_active_branch(p_org_id);
  END IF;

  RETURN v_branch_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_stock_movement_branch_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.branch_id IS NULL THEN
    NEW.branch_id := public.resolve_stock_movement_branch_id(
      NEW.reference_type,
      NEW.reference_id,
      NULL,
      NEW.org_id
    );
  END IF;

  IF NEW.branch_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.branches
    WHERE id = NEW.branch_id
      AND org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'branch_id % tidak valid untuk organisasi %', NEW.branch_id, NEW.org_id;
  END IF;

  RETURN NEW;
END;
$$;

UPDATE public.stock_movements sm
SET branch_id = public.resolve_stock_movement_branch_id(
  sm.reference_type,
  sm.reference_id,
  NULL,
  sm.org_id
)
WHERE sm.branch_id IS NULL;

CREATE OR REPLACE VIEW public.inventory_branch_backfill_audit AS
SELECT
  'warehouses'::TEXT AS source_table,
  w.org_id,
  NULL::TEXT AS reference_type,
  COUNT(*)::BIGINT AS unresolved_count
FROM public.warehouses w
WHERE w.branch_id IS NULL
GROUP BY w.org_id

UNION ALL

SELECT
  'stock_movements'::TEXT AS source_table,
  sm.org_id,
  sm.reference_type,
  COUNT(*)::BIGINT AS unresolved_count
FROM public.stock_movements sm
WHERE sm.branch_id IS NULL
GROUP BY sm.org_id, sm.reference_type;

NOTIFY pgrst, 'reload schema';
