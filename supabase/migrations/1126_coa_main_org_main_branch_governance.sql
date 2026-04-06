-- ============================================================
-- MIGRATION 1126: CoA Main Org + Main Branch Governance
-- ============================================================
-- Goals:
-- 1) Link CoA account master to a branch context (managed_branch_id)
-- 2) Restrict custom CoA write/delete to Main Organization + Main Branch context
-- 3) Keep system bootstrap/seed flows working safely
-- ============================================================

ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS parent_org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS managed_branch_id UUID REFERENCES public.branches(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_accounts_org_managed_branch
ON public.accounts(org_id, managed_branch_id);

CREATE OR REPLACE FUNCTION public.is_main_organization(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organizations o
    WHERE o.id = p_org_id
      AND o.parent_org_id IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_finance_master(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role member_role;
  v_last_active_branch_id UUID;
  v_default_branch_id UUID;
BEGIN
  IF p_org_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Allow internal DB/system contexts (migrations, seed, service role).
  IF auth.uid() IS NULL THEN
    RETURN TRUE;
  END IF;

  IF NOT public.is_main_organization(p_org_id) THEN
    RETURN FALSE;
  END IF;

  SELECT om.role, om.last_active_branch_id
  INTO v_role, v_last_active_branch_id
  FROM public.org_members om
  WHERE om.org_id = p_org_id
    AND om.user_id = auth.uid()
    AND om.is_active = TRUE
  ORDER BY om.joined_at ASC
  LIMIT 1;

  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;

  v_default_branch_id := public.get_default_branch_id(p_org_id);
  IF v_default_branch_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- User must be on MAIN branch context (or all-branch/null context).
  IF v_last_active_branch_id IS NOT NULL
     AND v_last_active_branch_id IS DISTINCT FROM v_default_branch_id THEN
    RETURN FALSE;
  END IF;

  IF v_role IN ('owner', 'admin') THEN
    RETURN TRUE;
  END IF;

  IF public.nizam_has_permission('coa:write', p_org_id)
     OR public.nizam_has_permission('accounting:write', p_org_id) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

UPDATE public.accounts a
SET managed_branch_id = public.get_default_branch_id(a.org_id)
WHERE a.managed_branch_id IS NULL
  AND public.get_default_branch_id(a.org_id) IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.accounts
    WHERE managed_branch_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Unresolved managed_branch_id remains on accounts.';
  END IF;
END $$;

ALTER TABLE public.accounts
ALTER COLUMN managed_branch_id SET NOT NULL;

CREATE OR REPLACE FUNCTION public.enforce_accounts_governance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_default_branch_id UUID;
  v_org_has_members BOOLEAN := FALSE;
BEGIN
  v_default_branch_id := public.get_default_branch_id(NEW.org_id);

  IF v_default_branch_id IS NULL THEN
    RAISE EXCEPTION 'Unit Utama organisasi % belum tersedia.', NEW.org_id;
  END IF;

  IF NEW.managed_branch_id IS NULL THEN
    NEW.managed_branch_id := v_default_branch_id;
  END IF;

  IF NEW.managed_branch_id IS DISTINCT FROM v_default_branch_id THEN
    RAISE EXCEPTION 'Rekening CoA wajib terhubung ke Unit Utama organisasi.';
  END IF;

  -- Protect custom accounts: only main-org/main-branch finance authority can mutate.
  IF COALESCE(NEW.is_system, FALSE) = FALSE
     AND NOT public.can_manage_finance_master(NEW.org_id) THEN
    RAISE EXCEPTION
      'Hanya Organisasi Utama pada konteks Unit Utama yang dapat membuat/mengubah rekening CoA.';
  END IF;

  -- Protect system accounts from arbitrary manual inserts/edits once memberships exist.
  IF COALESCE(NEW.is_system, FALSE) = TRUE
     AND auth.uid() IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.org_members om
      WHERE om.org_id = NEW.org_id
        AND om.is_active = TRUE
    )
    INTO v_org_has_members;

    IF v_org_has_members
       AND NOT public.is_org_admin(NEW.org_id) THEN
      RAISE EXCEPTION 'Akun sistem hanya dapat dikelola owner/admin organisasi.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_accounts_delete_governance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(OLD.is_system, FALSE) = TRUE THEN
    RAISE EXCEPTION 'Akun sistem tidak dapat dihapus.';
  END IF;

  IF NOT public.can_manage_finance_master(OLD.org_id) THEN
    RAISE EXCEPTION
      'Hanya Organisasi Utama pada konteks Unit Utama yang dapat menghapus rekening CoA.';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_accounts_governance ON public.accounts;
CREATE TRIGGER trg_accounts_governance
  BEFORE INSERT OR UPDATE
  ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_accounts_governance();

DROP TRIGGER IF EXISTS trg_accounts_delete_governance ON public.accounts;
CREATE TRIGGER trg_accounts_delete_governance
  BEFORE DELETE
  ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_accounts_delete_governance();

NOTIFY pgrst, 'reload schema';
