-- ============================================================
-- MIGRATION 1148: Fix CoA Seed Bootstrap vs Default Branch
-- ============================================================
-- Root issue:
-- - CoA system account seeding can run right after organization insert.
-- - Governance requires get_default_branch_id(org_id) to exist.
-- - In some environments, Unit Utama is inserted after CoA seed and causes:
--   "Unit Utama organisasi <id> belum tersedia."
--
-- Resolution:
-- - Allow system account bootstrap to auto-ensure Unit Utama branch exists
--   when missing, then continue governance checks safely.

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

  -- Bootstrap safety: when any account seed runs before branch setup,
  -- ensure "Unit Utama/MAIN" exists so governance can proceed.
  IF v_default_branch_id IS NULL THEN
    INSERT INTO public.branches (org_id, name, code, address, is_active)
    VALUES (NEW.org_id, 'Unit Utama', 'MAIN', NULL, TRUE)
    ON CONFLICT (org_id, code)
    DO UPDATE
      SET is_active = TRUE,
          updated_at = NOW()
    RETURNING id INTO v_default_branch_id;

    IF v_default_branch_id IS NULL THEN
      SELECT b.id
      INTO v_default_branch_id
      FROM public.branches b
      WHERE b.org_id = NEW.org_id
        AND (b.code = 'MAIN' OR b.name = 'Unit Utama')
      ORDER BY
        CASE WHEN b.code = 'MAIN' THEN 0 ELSE 1 END,
        b.created_at ASC,
        b.id ASC
      LIMIT 1;
    END IF;
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

NOTIFY pgrst, 'reload schema';
