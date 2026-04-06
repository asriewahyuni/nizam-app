-- ============================================================
-- MIGRATION 1150: Rebind Accounts Governance with Branch Ensure
-- ============================================================
-- Why this exists:
-- - Some environments still throw:
--   "Unit Utama organisasi <id> belum tersedia."
-- - Even after 1148/1149, legacy trigger/function bindings may still use an
--   older function body during account seed on org bootstrap.
--
-- Strategy:
-- 1) Add helper to ensure MAIN branch exists for an org
-- 2) Create a new governance function name (v2) that calls helper
-- 3) Rebind trg_accounts_governance to function v2 explicitly

CREATE OR REPLACE FUNCTION public.ensure_main_branch_for_org(p_org_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch_id UUID;
BEGIN
  IF p_org_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF to_regclass('public.branches') IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.branches (org_id, name, code, address, is_active)
  VALUES (p_org_id, 'Unit Utama', 'MAIN', NULL, TRUE)
  ON CONFLICT (org_id, code)
  DO UPDATE
    SET is_active = TRUE,
        updated_at = NOW()
  RETURNING id INTO v_branch_id;

  IF v_branch_id IS NOT NULL THEN
    RETURN v_branch_id;
  END IF;

  SELECT b.id
  INTO v_branch_id
  FROM public.branches b
  WHERE b.org_id = p_org_id
    AND (b.code = 'MAIN' OR b.name = 'Unit Utama')
  ORDER BY
    CASE WHEN b.code = 'MAIN' THEN 0 ELSE 1 END,
    b.created_at ASC,
    b.id ASC
  LIMIT 1;

  RETURN v_branch_id;
EXCEPTION
  WHEN foreign_key_violation THEN
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_accounts_governance_v2()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_default_branch_id UUID;
  v_org_has_members   BOOLEAN := FALSE;
BEGIN
  v_default_branch_id := public.get_default_branch_id(NEW.org_id);

  IF v_default_branch_id IS NULL THEN
    v_default_branch_id := public.ensure_main_branch_for_org(NEW.org_id);
  END IF;

  IF v_default_branch_id IS NULL THEN
    v_default_branch_id := public.get_default_branch_id(NEW.org_id);
  END IF;

  IF v_default_branch_id IS NULL THEN
    RAISE EXCEPTION 'Unit Utama organisasi % belum tersedia.', NEW.org_id;
  END IF;

  IF NEW.managed_branch_id IS NULL THEN
    NEW.managed_branch_id := v_default_branch_id;
  END IF;

  IF NEW.managed_branch_id IS DISTINCT FROM v_default_branch_id THEN
    RAISE EXCEPTION 'Rekening CoA wajib terhubung ke Unit Utama organisasi.';
  END IF;

  IF COALESCE(NEW.is_system, FALSE) = FALSE
     AND NOT public.can_manage_finance_master(NEW.org_id) THEN
    RAISE EXCEPTION
      'Hanya Organisasi Utama pada konteks Unit Utama yang dapat membuat/mengubah rekening CoA.';
  END IF;

  IF COALESCE(NEW.is_system, FALSE) = TRUE
     AND auth.uid() IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.org_members om
      WHERE om.org_id = NEW.org_id
        AND om.is_active = TRUE
    ) INTO v_org_has_members;

    IF v_org_has_members
       AND NOT public.is_org_admin(NEW.org_id) THEN
      RAISE EXCEPTION 'Akun sistem hanya dapat dikelola owner/admin organisasi.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.accounts') IS NULL THEN
    RAISE NOTICE 'Skipping 1150 trigger rebind: table public.accounts does not exist in this database.';
    RETURN;
  END IF;

  EXECUTE 'DROP TRIGGER IF EXISTS trg_accounts_governance ON public.accounts';
  EXECUTE '
    CREATE TRIGGER trg_accounts_governance
      BEFORE INSERT OR UPDATE
      ON public.accounts
      FOR EACH ROW
      EXECUTE FUNCTION public.enforce_accounts_governance_v2()
  ';
END;
$$;

NOTIFY pgrst, 'reload schema';
