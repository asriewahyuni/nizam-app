-- ============================================================
-- MIGRATION 1090: Default Branch Bootstrap
-- Ensure every organization has at least one active branch so
-- branch-aware flows work for legacy tenants.
-- ============================================================

INSERT INTO public.branches (org_id, name, code, address, is_active)
SELECT
  o.id,
  'Unit Utama',
  'MAIN',
  NULL,
  TRUE
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1
  FROM public.branches b
  WHERE b.org_id = o.id
);

WITH zero_active_branch_orgs AS (
  SELECT DISTINCT ON (b.org_id)
    b.id
  FROM public.branches b
  JOIN (
    SELECT org_id
    FROM public.branches
    GROUP BY org_id
    HAVING COUNT(*) FILTER (WHERE is_active = TRUE) = 0
  ) target_orgs ON target_orgs.org_id = b.org_id
  ORDER BY b.org_id, b.created_at ASC, b.id ASC
)
UPDATE public.branches b
SET
  is_active = TRUE,
  updated_at = NOW()
FROM zero_active_branch_orgs z
WHERE b.id = z.id;

UPDATE public.warehouses w
SET branch_id = public.resolve_single_active_branch(w.org_id)
WHERE w.branch_id IS NULL
  AND public.resolve_single_active_branch(w.org_id) IS NOT NULL;

UPDATE public.purchases p
SET branch_id = public.resolve_single_active_branch(p.org_id)
WHERE p.branch_id IS NULL
  AND public.resolve_single_active_branch(p.org_id) IS NOT NULL;

UPDATE public.stock_movements sm
SET branch_id = public.resolve_stock_movement_branch_id(
  sm.reference_type,
  sm.reference_id,
  NULL,
  sm.org_id
)
WHERE sm.branch_id IS NULL;

NOTIFY pgrst, 'reload schema';
