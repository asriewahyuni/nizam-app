-- ============================================================
-- MIGRATION 1118: adjust_inventory_stock Signature Compatibility
-- ============================================================
-- Ensures both legacy (4 args) and current (6 args) signatures
-- are available so stock sync calls remain backward-compatible.

CREATE OR REPLACE FUNCTION public.adjust_inventory_stock(
    p_org_id UUID,
    p_product_id UUID,
    p_warehouse_id UUID,
    p_diff NUMERIC,
    p_batch_number TEXT DEFAULT NULL,
    p_bin_id UUID DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_stock_id UUID;
BEGIN
    SELECT id
    INTO v_stock_id
    FROM public.inventory_stocks
    WHERE org_id = p_org_id
      AND product_id = p_product_id
      AND warehouse_id = p_warehouse_id
      AND batch_number IS NOT DISTINCT FROM p_batch_number
      AND bin_id IS NOT DISTINCT FROM p_bin_id
    ORDER BY created_at ASC NULLS LAST, id ASC
    LIMIT 1
    FOR UPDATE;

    IF v_stock_id IS NOT NULL THEN
      UPDATE public.inventory_stocks
      SET quantity = quantity + p_diff,
          updated_at = NOW()
      WHERE id = v_stock_id;
      RETURN;
    END IF;

    INSERT INTO public.inventory_stocks (
      org_id,
      product_id,
      warehouse_id,
      quantity,
      batch_number,
      bin_id
    )
    VALUES (
      p_org_id,
      p_product_id,
      p_warehouse_id,
      p_diff,
      p_batch_number,
      p_bin_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.adjust_inventory_stock(
    p_org_id UUID,
    p_product_id UUID,
    p_warehouse_id UUID,
    p_diff NUMERIC
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public.adjust_inventory_stock(
      p_org_id,
      p_product_id,
      p_warehouse_id,
      p_diff,
      NULL::TEXT,
      NULL::UUID
    );
END;
$$;

NOTIFY pgrst, 'reload schema';
