-- ============================================================
-- MIGRATION 1099: Legacy Branch Scope Fix
-- Ensure legacy tenants always have one active default branch and
-- bootstrap single-branch staff access when unit assignments are empty.
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

WITH single_active_branch_orgs AS (
  SELECT DISTINCT ON (b.org_id)
    b.org_id,
    b.id AS branch_id
  FROM public.branches b
  JOIN (
    SELECT org_id
    FROM public.branches
    WHERE is_active = TRUE
    GROUP BY org_id
    HAVING COUNT(*) = 1
  ) single_orgs ON single_orgs.org_id = b.org_id
  WHERE b.is_active = TRUE
  ORDER BY b.org_id, b.created_at ASC, b.id ASC
)
INSERT INTO public.org_member_units (org_member_id, org_id, branch_id)
SELECT
  om.id,
  om.org_id,
  single_active_branch_orgs.branch_id
FROM public.org_members om
JOIN single_active_branch_orgs
  ON single_active_branch_orgs.org_id = om.org_id
WHERE om.is_active = TRUE
  AND om.role NOT IN ('owner', 'admin')
  AND NOT EXISTS (
    SELECT 1
    FROM public.org_member_units omu
    WHERE omu.org_member_id = om.id
  )
ON CONFLICT (org_member_id, branch_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.bootstrap_single_branch_member_units()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_single_branch_id UUID;
  v_active_branch_count INTEGER;
BEGIN
  IF COALESCE(NEW.is_active, FALSE) IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO v_active_branch_count
  FROM public.branches
  WHERE org_id = NEW.org_id
    AND is_active = TRUE;

  IF v_active_branch_count <> 1 THEN
    RETURN NEW;
  END IF;

  SELECT b.id
  INTO v_single_branch_id
  FROM public.branches b
  WHERE b.org_id = NEW.org_id
    AND b.is_active = TRUE
  ORDER BY b.created_at ASC, b.id ASC
  LIMIT 1;

  IF v_single_branch_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.org_member_units (org_member_id, org_id, branch_id)
  SELECT
    om.id,
    om.org_id,
    v_single_branch_id
  FROM public.org_members om
  WHERE om.org_id = NEW.org_id
    AND om.is_active = TRUE
    AND om.role NOT IN ('owner', 'admin')
    AND NOT EXISTS (
      SELECT 1
      FROM public.org_member_units omu
      WHERE omu.org_member_id = om.id
    )
  ON CONFLICT (org_member_id, branch_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bootstrap_single_branch_member_units ON public.branches;
CREATE TRIGGER trg_bootstrap_single_branch_member_units
  AFTER INSERT OR UPDATE OF is_active
  ON public.branches
  FOR EACH ROW
  EXECUTE FUNCTION public.bootstrap_single_branch_member_units();

NOTIFY pgrst, 'reload schema';
