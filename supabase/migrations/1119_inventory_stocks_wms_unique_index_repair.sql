-- ============================================================
-- MIGRATION 1119: Inventory Stocks WMS Unique Index Repair
-- ============================================================
-- Ensures ON CONFLICT target used by WMS/manufacturing SQL functions
-- has a matching unique index.
--
-- Steps:
-- 1) Merge duplicate rows by normalized WMS key
--    (product, warehouse, coalesce(batch), coalesce(bin)).
-- 2) Remove legacy unique constraint that does not include bin.
-- 3) Create/replace WMS unique expression index.

DO $$
DECLARE
  v_zero_uuid CONSTANT UUID := '00000000-0000-0000-0000-000000000000'::uuid;
BEGIN
  -- Merge duplicate rows to avoid index creation failure.
  WITH dupes AS (
    SELECT
      product_id,
      warehouse_id,
      COALESCE(batch_number, '') AS batch_key,
      COALESCE(bin_id, v_zero_uuid) AS bin_key,
      ARRAY_AGG(id ORDER BY created_at ASC NULLS LAST, id ASC) AS ids,
      SUM(COALESCE(quantity, 0)) AS total_quantity
    FROM public.inventory_stocks
    GROUP BY
      product_id,
      warehouse_id,
      COALESCE(batch_number, ''),
      COALESCE(bin_id, v_zero_uuid)
    HAVING COUNT(*) > 1
  ), keepers AS (
    SELECT
      ids[1] AS keep_id,
      total_quantity,
      ids[2:array_length(ids, 1)] AS delete_ids
    FROM dupes
  )
  UPDATE public.inventory_stocks s
  SET quantity = k.total_quantity,
      updated_at = NOW()
  FROM keepers k
  WHERE s.id = k.keep_id;

  WITH dupes AS (
    SELECT
      ARRAY_AGG(id ORDER BY created_at ASC NULLS LAST, id ASC) AS ids
    FROM public.inventory_stocks
    GROUP BY
      product_id,
      warehouse_id,
      COALESCE(batch_number, ''),
      COALESCE(bin_id, v_zero_uuid)
    HAVING COUNT(*) > 1
  )
  DELETE FROM public.inventory_stocks s
  USING dupes d
  WHERE s.id = ANY(d.ids[2:array_length(d.ids, 1)]);

END;
$$;

ALTER TABLE public.inventory_stocks
  DROP CONSTRAINT IF EXISTS inventory_stocks_product_id_warehouse_id_batch_number_key;

DROP INDEX IF EXISTS public.idx_inv_stocks_unique_wms;

CREATE UNIQUE INDEX idx_inv_stocks_unique_wms
  ON public.inventory_stocks (
    product_id,
    warehouse_id,
    COALESCE(batch_number, ''),
    COALESCE(bin_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

NOTIFY pgrst, 'reload schema';
