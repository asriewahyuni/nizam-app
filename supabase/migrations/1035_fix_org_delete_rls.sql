-- ==========================================
-- MIGRATION 1035: Fix Organization RLS
-- Allows owners to delete their organizations
-- ==========================================

-- Add DELETE policy for organizations (crucial for demo reset)
DROP POLICY IF EXISTS "owners_can_delete_org" ON public.organizations;
CREATE POLICY "owners_can_delete_org"
  ON public.organizations
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_members.org_id = public.organizations.id
        AND org_members.user_id = auth.uid()
        AND org_members.role = 'owner'
        AND org_members.is_active = TRUE
    )
  );

-- Ensure users can delete their own memberships (usually cascades but let's be explicit)
DROP POLICY IF EXISTS "owners_can_delete_own_membership" ON public.org_members;
CREATE POLICY "owners_can_delete_own_membership"
ON public.org_members
FOR DELETE
USING (user_id = auth.uid());
