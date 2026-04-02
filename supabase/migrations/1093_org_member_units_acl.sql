-- ============================================================
-- MIGRATION 1093: Staff Per-Unit Access Control
-- Adds explicit unit assignments for non-owner/admin members.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.org_member_units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_member_id UUID NOT NULL REFERENCES public.org_members(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_member_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_org_member_units_member ON public.org_member_units(org_member_id);
CREATE INDEX IF NOT EXISTS idx_org_member_units_org_branch ON public.org_member_units(org_id, branch_id);

CREATE OR REPLACE FUNCTION public.can_access_branch(p_org_id UUID, p_branch_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_members om
    WHERE om.org_id = p_org_id
      AND om.user_id = auth.uid()
      AND om.is_active = TRUE
      AND om.role IN ('owner', 'admin')
  )
  OR EXISTS (
    SELECT 1
    FROM public.org_members om
    JOIN public.org_member_units omu ON omu.org_member_id = om.id
    WHERE om.org_id = p_org_id
      AND om.user_id = auth.uid()
      AND om.is_active = TRUE
      AND omu.branch_id = p_branch_id
  );
$$;

ALTER TABLE public.org_member_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_can_view_org_member_units" ON public.org_member_units;
CREATE POLICY "members_can_view_org_member_units"
  ON public.org_member_units FOR SELECT
  USING (
    org_id IN (SELECT get_my_org_ids())
  );

DROP POLICY IF EXISTS "admins_can_manage_org_member_units" ON public.org_member_units;
CREATE POLICY "admins_can_manage_org_member_units"
  ON public.org_member_units FOR ALL
  USING (is_org_admin(org_id))
  WITH CHECK (is_org_admin(org_id));

DROP POLICY IF EXISTS "members_can_view_branches" ON public.branches;
CREATE POLICY "members_can_view_branches"
  ON public.branches FOR SELECT
  USING (
    public.can_access_branch(org_id, id)
  );

INSERT INTO public.org_member_units (org_member_id, org_id, branch_id)
SELECT om.id, om.org_id, b.id
FROM public.org_members om
JOIN public.branches b
  ON b.org_id = om.org_id
 AND b.is_active = TRUE
WHERE om.is_active = TRUE
  AND om.role NOT IN ('owner', 'admin')
ON CONFLICT (org_member_id, branch_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.bootstrap_org_member_units()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  IF NEW.role IN ('owner', 'admin') THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.org_member_units (org_member_id, org_id, branch_id)
  SELECT NEW.id, NEW.org_id, b.id
  FROM public.branches b
  WHERE b.org_id = NEW.org_id
    AND b.is_active = TRUE
  ON CONFLICT (org_member_id, branch_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bootstrap_org_member_units ON public.org_members;
CREATE TRIGGER trg_bootstrap_org_member_units
  AFTER INSERT OR UPDATE OF role, is_active
  ON public.org_members
  FOR EACH ROW
  EXECUTE FUNCTION public.bootstrap_org_member_units();

NOTIFY pgrst, 'reload schema';
