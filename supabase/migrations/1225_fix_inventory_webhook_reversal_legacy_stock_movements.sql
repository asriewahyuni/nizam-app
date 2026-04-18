-- ============================================================
-- MIGRATION 1225: Fix Inventory Webhook Reversal Legacy Schema
-- ============================================================
-- Some production databases still expose stock_movements without warehouse_id.
-- The reversal function introduced in 1224 must remain compatible with both
-- schemas, because void sale/purchase still need to generate compensating
-- stock_movements and webhook outbox rows.

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
  v_has_warehouse_column BOOLEAN := FALSE;
  v_reversal_reference_type TEXT;
  v_reversal_note TEXT;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'stock_movements'
      AND column_name = 'warehouse_id'
  )
  INTO v_has_warehouse_column;

  v_reversal_reference_type := CASE UPPER(COALESCE(p_reference_type, ''))
    WHEN 'SALE' THEN 'SALE_VOID'
    WHEN 'PURCHASE' THEN 'PURCHASE_VOID'
    ELSE UPPER(COALESCE(p_reference_type, '')) || '_REVERSAL'
  END;

  IF v_has_warehouse_column THEN
    FOR v_move IN
      SELECT
        sm.branch_id,
        sm.warehouse_id,
        sm.product_id,
        sm.quantity,
        sm.unit_price,
        sm.notes
      FROM public.stock_movements sm
      WHERE sm.org_id = p_org_id
        AND sm.reference_type = p_reference_type
        AND sm.reference_id = p_reference_id
      ORDER BY sm.created_at, sm.movement_date, sm.id
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
        -(v_move.quantity),
        NULL,
        NULL
      );

      v_reversal_note := CASE
        WHEN NULLIF(TRIM(COALESCE(v_move.notes, '')), '') IS NOT NULL
          THEN FORMAT('Reversal %s %s | %s', UPPER(COALESCE(p_reference_type, '')), p_reference_id::TEXT, v_move.notes)
        ELSE FORMAT('Reversal %s %s', UPPER(COALESCE(p_reference_type, '')), p_reference_id::TEXT)
      END;

      INSERT INTO public.stock_movements (
        org_id,
        branch_id,
        warehouse_id,
        product_id,
        movement_date,
        quantity,
        unit_price,
        reference_type,
        reference_id,
        notes
      )
      VALUES (
        p_org_id,
        v_move.branch_id,
        COALESCE(v_move.warehouse_id, p_warehouse_id),
        v_move.product_id,
        NOW(),
        -(v_move.quantity),
        COALESCE(v_move.unit_price, 0),
        v_reversal_reference_type,
        p_reference_id,
        v_reversal_note
      );
    END LOOP;
  ELSE
    FOR v_move IN
      SELECT
        sm.branch_id,
        sm.product_id,
        sm.quantity,
        sm.unit_price,
        sm.notes
      FROM public.stock_movements sm
      WHERE sm.org_id = p_org_id
        AND sm.reference_type = p_reference_type
        AND sm.reference_id = p_reference_id
      ORDER BY sm.created_at, sm.movement_date, sm.id
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
        -(v_move.quantity),
        NULL,
        NULL
      );

      v_reversal_note := CASE
        WHEN NULLIF(TRIM(COALESCE(v_move.notes, '')), '') IS NOT NULL
          THEN FORMAT('Reversal %s %s | %s', UPPER(COALESCE(p_reference_type, '')), p_reference_id::TEXT, v_move.notes)
        ELSE FORMAT('Reversal %s %s', UPPER(COALESCE(p_reference_type, '')), p_reference_id::TEXT)
      END;

      INSERT INTO public.stock_movements (
        org_id,
        branch_id,
        product_id,
        movement_date,
        quantity,
        unit_price,
        reference_type,
        reference_id,
        notes
      )
      VALUES (
        p_org_id,
        v_move.branch_id,
        v_move.product_id,
        NOW(),
        -(v_move.quantity),
        COALESCE(v_move.unit_price, 0),
        v_reversal_reference_type,
        p_reference_id,
        v_reversal_note
      );
    END LOOP;
  END IF;

  IF NOT v_has_rows THEN
    RETURN;
  END IF;
END;
$$;
