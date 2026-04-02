-- ============================================================
-- MIGRATION 1004: Multi Branch Infrastructure
-- Adds the missing branch foundation referenced by later modules.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, name),
  UNIQUE(org_id, code)
);

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_can_view_branches" ON public.branches;
CREATE POLICY "members_can_view_branches"
  ON public.branches FOR SELECT
  USING (
    org_id IN (
      SELECT org_id
      FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

DROP POLICY IF EXISTS "admins_manage_branches" ON public.branches;
CREATE POLICY "admins_manage_branches"
  ON public.branches FOR ALL
  USING (
    org_id IN (
      SELECT org_id
      FROM public.org_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager') AND is_active = TRUE
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id
      FROM public.org_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager') AND is_active = TRUE
    )
  );

ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

ALTER TABLE public.sales_items
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_branches_org_active ON public.branches(org_id, is_active);
CREATE INDEX IF NOT EXISTS idx_journal_entries_branch_id ON public.journal_entries(branch_id) WHERE branch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_items_branch_id ON public.sales_items(branch_id) WHERE branch_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
