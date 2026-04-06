-- ============================================================
-- MIGRATION 1138: Fix CoA Governance Functions (Idempotent Repair)
-- ============================================================
-- Root cause: Migration 1126 may have partially failed.
-- This migration:
--   1. Adds missing columns FIRST (before functions reference them)
--   2. Back-fills managed_branch_id
--   3. Re-creates governance functions safely
--   4. Re-attaches triggers
-- ============================================================


-- ============================================================
-- STEP 1: Schema changes (columns) — MUST come before functions
-- ============================================================

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS parent_org_id UUID
  REFERENCES public.organizations(id) ON DELETE SET NULL;

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS managed_branch_id UUID
  REFERENCES public.branches(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_accounts_org_managed_branch
  ON public.accounts(org_id, managed_branch_id);


-- ============================================================
-- STEP 2: Back-fill managed_branch_id
-- ============================================================

UPDATE public.accounts a
SET managed_branch_id = public.get_default_branch_id(a.org_id)
WHERE a.managed_branch_id IS NULL
  AND public.get_default_branch_id(a.org_id) IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.accounts WHERE managed_branch_id IS NULL) THEN
    RAISE EXCEPTION
      'Ada akun CoA dengan managed_branch_id NULL setelah back-fill. '
      'Pastikan setiap organisasi memiliki default branch.';
  END IF;
END $$;

ALTER TABLE public.accounts
  ALTER COLUMN managed_branch_id SET NOT NULL;


-- ============================================================
-- STEP 3: Functions (columns already exist at this point)
-- ============================================================

-- is_main_organization: TRUE jika org adalah holding (tidak punya parent)
CREATE OR REPLACE FUNCTION public.is_main_organization(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.organizations o
    WHERE o.id = p_org_id
      AND o.parent_org_id IS NULL
  );
END;
$$;

-- can_manage_finance_master: TRUE jika user boleh buat/edit CoA langsung
CREATE OR REPLACE FUNCTION public.can_manage_finance_master(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role                  member_role;
  v_last_active_branch_id UUID;
  v_default_branch_id     UUID;
BEGIN
  IF p_org_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Context DB internal / service role (migrasi, seed) selalu diizinkan
  IF auth.uid() IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Hanya Main/Holding org (tanpa parent) yang boleh manage CoA langsung
  IF NOT public.is_main_organization(p_org_id) THEN
    RETURN FALSE;
  END IF;

  -- Ambil role & last active branch user di org ini
  SELECT om.role, om.last_active_branch_id
  INTO   v_role, v_last_active_branch_id
  FROM   public.org_members om
  WHERE  om.org_id    = p_org_id
    AND  om.user_id   = auth.uid()
    AND  om.is_active = TRUE
  ORDER BY om.joined_at ASC
  LIMIT 1;

  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;

  v_default_branch_id := public.get_default_branch_id(p_org_id);
  IF v_default_branch_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- User harus di konteks branch utama (NULL = semua branch = OK)
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


-- ============================================================
-- STEP 4: Trigger functions
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_accounts_governance()
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

  IF COALESCE(NEW.is_system, FALSE) = TRUE AND auth.uid() IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = NEW.org_id AND om.is_active = TRUE
    ) INTO v_org_has_members;

    IF v_org_has_members AND NOT public.is_org_admin(NEW.org_id) THEN
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


-- ============================================================
-- STEP 5: Re-attach triggers
-- ============================================================

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
