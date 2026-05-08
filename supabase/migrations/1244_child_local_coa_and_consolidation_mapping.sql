-- ==============================================================================================
-- MIGRATION 1244: Child-local CoA + group consolidation mapping
-- ==============================================================================================
-- Goals:
-- 1. Allow a child organization to manage its own CoA locally (`LOCAL`) instead of inheriting
--    directly from the holding (`INHERITED`).
-- 2. Preserve consolidated reporting by mapping child-local accounts to holding/group accounts.

ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS coa_management_mode TEXT NOT NULL DEFAULT 'INHERITED';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organizations_coa_management_mode_check'
  ) THEN
    ALTER TABLE public.organizations
    ADD CONSTRAINT organizations_coa_management_mode_check
    CHECK (coa_management_mode IN ('INHERITED', 'LOCAL'));
  END IF;
END $$;

COMMENT ON COLUMN public.organizations.coa_management_mode IS
  'Mode pengelolaan CoA organisasi: INHERITED mengikuti parent/holding, LOCAL mengelola CoA sendiri.';

CREATE TABLE IF NOT EXISTS public.coa_consolidation_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  child_org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  local_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  group_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(parent_org_id, child_org_id, local_account_id)
);

COMMENT ON TABLE public.coa_consolidation_mappings IS
  'Mapping akun lokal child ke akun grup/holding untuk laporan konsolidasi.';

CREATE INDEX IF NOT EXISTS idx_coa_consolidation_mappings_parent_child
ON public.coa_consolidation_mappings(parent_org_id, child_org_id);

CREATE INDEX IF NOT EXISTS idx_coa_consolidation_mappings_local_account
ON public.coa_consolidation_mappings(local_account_id);

CREATE INDEX IF NOT EXISTS idx_coa_consolidation_mappings_group_account
ON public.coa_consolidation_mappings(group_account_id);

DROP TRIGGER IF EXISTS trg_coa_consolidation_mappings_updated_at ON public.coa_consolidation_mappings;
CREATE TRIGGER trg_coa_consolidation_mappings_updated_at
  BEFORE UPDATE ON public.coa_consolidation_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.coa_consolidation_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_can_view_coa_consolidation_mappings" ON public.coa_consolidation_mappings;
CREATE POLICY "members_can_view_coa_consolidation_mappings"
  ON public.coa_consolidation_mappings
  FOR SELECT
  USING (
    parent_org_id IN (
      SELECT org_id
      FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
    OR child_org_id IN (
      SELECT org_id
      FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

DROP POLICY IF EXISTS "admins_can_manage_coa_consolidation_mappings" ON public.coa_consolidation_mappings;
CREATE POLICY "admins_can_manage_coa_consolidation_mappings"
  ON public.coa_consolidation_mappings
  FOR ALL
  USING (
    parent_org_id IN (
      SELECT org_id
      FROM public.org_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager') AND is_active = TRUE
    )
    OR child_org_id IN (
      SELECT org_id
      FROM public.org_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager') AND is_active = TRUE
    )
  )
  WITH CHECK (
    parent_org_id IN (
      SELECT org_id
      FROM public.org_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager') AND is_active = TRUE
    )
    OR child_org_id IN (
      SELECT org_id
      FROM public.org_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager') AND is_active = TRUE
    )
  );

CREATE OR REPLACE FUNCTION public.get_org_coa_management_mode(p_org_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(o.coa_management_mode, 'INHERITED')
  FROM public.organizations o
  WHERE o.id = p_org_id
  LIMIT 1
$$;

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
  v_parent_org_id         UUID;
  v_coa_management_mode   TEXT := 'INHERITED';
BEGIN
  IF p_org_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN TRUE;
  END IF;

  SELECT
    o.parent_org_id,
    COALESCE(o.coa_management_mode, 'INHERITED')
  INTO
    v_parent_org_id,
    v_coa_management_mode
  FROM public.organizations o
  WHERE o.id = p_org_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_parent_org_id IS NOT NULL AND v_coa_management_mode <> 'LOCAL' THEN
    RETURN FALSE;
  END IF;

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

INSERT INTO public.coa_consolidation_mappings (
  parent_org_id,
  child_org_id,
  local_account_id,
  group_account_id,
  is_active
)
SELECT
  child_org.parent_org_id,
  child_org.id,
  child_account.id,
  parent_account.id,
  TRUE
FROM public.organizations child_org
JOIN public.accounts child_account
  ON child_account.org_id = child_org.id
JOIN public.accounts parent_account
  ON parent_account.org_id = child_org.parent_org_id
 AND parent_account.code = child_account.code
WHERE child_org.parent_org_id IS NOT NULL
ON CONFLICT (parent_org_id, child_org_id, local_account_id)
DO UPDATE
SET
  group_account_id = EXCLUDED.group_account_id,
  is_active = TRUE,
  updated_at = NOW();

GRANT EXECUTE ON FUNCTION public.get_org_coa_management_mode(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_finance_master(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
