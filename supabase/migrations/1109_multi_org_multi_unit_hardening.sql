-- ============================================================
-- MIGRATION 1109: Multi-Org / Multi-Unit Hardening
-- Lock down org membership bootstrap, reduce roster visibility,
-- and align branch management privileges with the app layer.
-- ============================================================

-- org_members: users may read their own memberships, while only
-- org admins can read or mutate the full roster. Self-join must go
-- through trusted server code using the service role.
DROP POLICY IF EXISTS "members_can_view_org_members" ON public.org_members;
DROP POLICY IF EXISTS "users_can_insert_own_membership" ON public.org_members;
DROP POLICY IF EXISTS "admins_can_manage_members" ON public.org_members;

CREATE POLICY "users_can_view_own_membership"
  ON public.org_members FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "admins_can_view_org_members"
  ON public.org_members FOR SELECT
  USING (is_org_admin(org_id));

CREATE POLICY "admins_can_manage_members"
  ON public.org_members FOR ALL
  USING (is_org_admin(org_id))
  WITH CHECK (is_org_admin(org_id));

-- org_member_units: members may inspect their own unit assignments,
-- while org admins can inspect and manage the full assignment matrix.
DROP POLICY IF EXISTS "members_can_view_org_member_units" ON public.org_member_units;
DROP POLICY IF EXISTS "admins_can_manage_org_member_units" ON public.org_member_units;

CREATE POLICY "members_can_view_own_org_member_units"
  ON public.org_member_units FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.org_members om
      WHERE om.id = public.org_member_units.org_member_id
        AND om.user_id = auth.uid()
        AND om.is_active = TRUE
    )
  );

CREATE POLICY "admins_can_view_org_member_units"
  ON public.org_member_units FOR SELECT
  USING (is_org_admin(org_id));

CREATE POLICY "admins_can_manage_org_member_units"
  ON public.org_member_units FOR ALL
  USING (is_org_admin(org_id))
  WITH CHECK (is_org_admin(org_id));

-- Branch administration is restricted to owner/admin to match the
-- server helpers and settings actions.
DROP POLICY IF EXISTS "admins_manage_branches" ON public.branches;
CREATE POLICY "admins_manage_branches"
  ON public.branches FOR ALL
  USING (
    org_id IN (
      SELECT org_id
      FROM public.org_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND is_active = TRUE
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id
      FROM public.org_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND is_active = TRUE
    )
  );

NOTIFY pgrst, 'reload schema';
