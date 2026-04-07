-- ============================================================
-- MIGRATION 1154: Allow System CoA Delete on Organization Cascade
-- ============================================================
-- Problem:
-- - Deleting an inactive tenant (organization) fails because accounts delete
--   trigger blocks system CoA rows with:
--   "Akun sistem tidak dapat dihapus."
--
-- Goal:
-- - Keep manual system-account deletion blocked.
-- - Allow system-account deletion only when it is part of organization
--   deletion cascade (org row already being removed).

CREATE OR REPLACE FUNCTION public.enforce_accounts_delete_governance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_still_exists BOOLEAN := FALSE;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.organizations o
    WHERE o.id = OLD.org_id
  )
  INTO v_org_still_exists;

  -- Organization already being deleted: this DELETE comes from
  -- ON DELETE CASCADE. Allow cleanup including system accounts.
  IF NOT v_org_still_exists THEN
    RETURN OLD;
  END IF;

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

NOTIFY pgrst, 'reload schema';
