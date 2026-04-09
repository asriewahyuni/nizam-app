-- ============================================================
-- MIGRATION 1164: Reclass historical factory raw-material lines
-- ============================================================
-- Why:
-- Some historical production-completion journal lines still credited
-- 1301 (Persediaan Barang Dagangan) for raw-material consumption.
-- This happened before category-aware inventory segmentation fully
-- replaced the legacy generic inventory account on product masters.
--
-- Result:
-- - 1301 can go negative even though no merchandise inventory exists
-- - 1303 / 1302 do not reflect the actual raw-material / semi-finished
--   inventory that was consumed by production
--
-- This migration:
-- 1. ensures segmented inventory accounts exist for affected orgs,
-- 2. remaps production raw-material credit lines from 1301 to the
--    component product's expected inventory account.
-- ============================================================

DO $$
DECLARE
  v_org RECORD;
BEGIN
  FOR v_org IN
    SELECT DISTINCT wo.org_id
    FROM public.journal_lines jl
    JOIN public.journal_entries je ON je.id = jl.entry_id
    JOIN public.production_work_orders wo ON wo.id = je.reference_id
    JOIN public.accounts acc
      ON acc.id = jl.account_id
     AND acc.org_id = wo.org_id
    WHERE je.reference_type = 'PRODUCTION'
      AND jl.credit > 0
      AND COALESCE(jl.memo, '') ILIKE 'Bahan Baku:%'
      AND acc.code = '1301'
  LOOP
    PERFORM public.ensure_inventory_segment_accounts(v_org.org_id);
  END LOOP;
END;
$$;

WITH candidate_lines AS (
  SELECT
    jl.id AS journal_line_id,
    wo.org_id,
    wo.bom_id,
    BTRIM(REGEXP_REPLACE(COALESCE(jl.memo, ''), '^Bahan Baku:\s*', '', 'i')) AS product_name
  FROM public.journal_lines jl
  JOIN public.journal_entries je ON je.id = jl.entry_id
  JOIN public.production_work_orders wo ON wo.id = je.reference_id
  JOIN public.accounts acc
    ON acc.id = jl.account_id
   AND acc.org_id = wo.org_id
  WHERE je.reference_type = 'PRODUCTION'
    AND jl.credit > 0
    AND COALESCE(jl.memo, '') ILIKE 'Bahan Baku:%'
    AND acc.code = '1301'
),
matched_products AS (
  SELECT
    cl.journal_line_id,
    ARRAY_AGG(DISTINCT p.id) AS matched_product_ids,
    ARRAY_AGG(DISTINCT target_acc.id) AS expected_account_ids
  FROM candidate_lines cl
  JOIN public.production_bom_items bi
    ON bi.bom_id = cl.bom_id
  JOIN public.products p
    ON p.id = bi.product_id
   AND p.org_id = cl.org_id
  JOIN public.accounts target_acc
    ON target_acc.org_id = cl.org_id
   AND target_acc.code = CASE
     WHEN p.category = 'Setengah Jadi' THEN '1302'
     WHEN p.category IN ('Bahan', 'Pelengkap') THEN '1303'
     WHEN p.category = 'Siap Jual' THEN '1304'
     WHEN EXISTS (
       SELECT 1
       FROM public.production_boms b2
       WHERE b2.org_id = cl.org_id
         AND b2.product_id = p.id
     ) THEN '1302'
     ELSE '1303'
   END
  WHERE p.name = cl.product_name
  GROUP BY cl.journal_line_id
),
misposted_rm_lines AS (
  SELECT
    journal_line_id,
    expected_account_ids[1] AS expected_account_id
  FROM matched_products
  WHERE ARRAY_LENGTH(matched_product_ids, 1) = 1
    AND ARRAY_LENGTH(expected_account_ids, 1) = 1
    AND expected_account_ids[1] IS NOT NULL
)
UPDATE public.journal_lines jl
SET account_id = m.expected_account_id
FROM misposted_rm_lines m
WHERE jl.id = m.journal_line_id
  AND jl.account_id IS DISTINCT FROM m.expected_account_id;

NOTIFY pgrst, 'reload schema';
