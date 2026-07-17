-- resolve_stock_movement_branch_id() masih menjoin sales_return_items.sale_item_id ke
-- sales_items — kolom itu sudah tidak ada di sales_return_items (lihat 1372), sehingga
-- retur penjualan gagal saat trigger set_stock_movement_branch_id jalan pada INSERT
-- stock_movements. sales_returns sendiri sudah punya branch_id yang benar (diisi saat
-- retur dibuat), jadi ambil langsung dari situ tanpa perlu join ke sales_return_items.

CREATE OR REPLACE FUNCTION public.resolve_stock_movement_branch_id(
  p_reference_type text,
  p_reference_id uuid,
  p_warehouse_id uuid DEFAULT NULL::uuid,
  p_org_id uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $function$
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
      SELECT branch_id INTO v_branch_id
      FROM public.sales_returns
      WHERE id = p_reference_id;

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
      SELECT branch_id INTO v_branch_id
      FROM public.production_work_orders
      WHERE id = p_reference_id;

      IF v_branch_id IS NULL THEN
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
      END IF;

    WHEN 'PRODUCTION_CONSUMPTION' THEN
      SELECT branch_id INTO v_branch_id
      FROM public.production_work_orders
      WHERE id = p_reference_id;

      IF v_branch_id IS NULL THEN
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
      END IF;

    ELSE
      v_branch_id := NULL;
  END CASE;

  IF v_branch_id IS NULL AND p_org_id IS NOT NULL THEN
    v_branch_id := public.resolve_single_active_branch(p_org_id);
  END IF;

  RETURN v_branch_id;
END;
$function$
