-- ============================================================
-- MIGRATION 1149: Bootstrap Main Branch Before Org Account Seeds
-- ============================================================
-- Root issue:
-- Multiple AFTER INSERT triggers on organizations can insert into accounts
-- (CoA seed + inventory segment seed) before a default branch exists.
-- CoA governance requires a valid main branch, causing:
--   "Unit Utama organisasi <id> belum tersedia."
--
-- Fix:
-- Ensure MAIN branch exists immediately on org insert via a trigger that runs
-- before other org seed triggers (lexicographically earlier trigger name).

CREATE OR REPLACE FUNCTION public.bootstrap_main_branch_on_org_create()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.branches (org_id, name, code, address, is_active)
  VALUES (NEW.id, 'Unit Utama', 'MAIN', NULL, TRUE)
  ON CONFLICT (org_id, code)
  DO UPDATE
    SET is_active = TRUE,
        updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_000_bootstrap_main_branch_on_org_create ON public.organizations;
CREATE TRIGGER trg_000_bootstrap_main_branch_on_org_create
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.bootstrap_main_branch_on_org_create();

NOTIFY pgrst, 'reload schema';
