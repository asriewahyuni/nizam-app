-- ============================================================
-- MIGRATION 1103: Budget Branch Context
-- Make budgeting branch-aware for new entries while preserving
-- unresolved legacy org-wide budgets for controlled cleanup.
-- ============================================================

ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_budgets_org_branch_period
  ON public.budgets(org_id, branch_id, period DESC);

UPDATE public.budgets b
SET branch_id = public.resolve_single_active_branch(b.org_id)
WHERE b.branch_id IS NULL
  AND public.resolve_single_active_branch(b.org_id) IS NOT NULL;

ALTER TABLE public.budgets
  DROP CONSTRAINT IF EXISTS uq_budget_account_period;

DROP INDEX IF EXISTS public.uq_budget_account_period;

CREATE UNIQUE INDEX IF NOT EXISTS uq_budget_account_period_per_branch
  ON public.budgets(org_id, branch_id, account_id, period)
  WHERE branch_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_budget_account_period_shared
  ON public.budgets(org_id, account_id, period)
  WHERE branch_id IS NULL;

CREATE OR REPLACE FUNCTION public.set_budget_branch_context()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_resolved_branch_id UUID;
BEGIN
  IF NEW.branch_id IS NULL THEN
    v_resolved_branch_id := public.resolve_single_active_branch(NEW.org_id);

    IF v_resolved_branch_id IS NOT NULL THEN
      NEW.branch_id := v_resolved_branch_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_budget_branch_context ON public.budgets;
CREATE TRIGGER trg_budget_branch_context
  BEFORE INSERT OR UPDATE OF org_id, branch_id
  ON public.budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_budget_branch_context();

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_can_manage_budgets" ON public.budgets;
DROP POLICY IF EXISTS "members_can_view_budgets" ON public.budgets;

CREATE POLICY "members_can_view_budgets"
  ON public.budgets FOR SELECT
  USING (
    org_id IN (SELECT get_my_org_ids())
    AND (
      branch_id IS NULL
      OR public.can_access_branch(org_id, branch_id)
    )
  );

CREATE POLICY "members_can_manage_budgets"
  ON public.budgets FOR ALL
  USING (
    org_id IN (SELECT get_my_org_ids())
    AND COALESCE(branch_id, public.resolve_single_active_branch(org_id)) IS NOT NULL
    AND public.can_access_branch(
      org_id,
      COALESCE(branch_id, public.resolve_single_active_branch(org_id))
    )
  )
  WITH CHECK (
    org_id IN (SELECT get_my_org_ids())
    AND COALESCE(branch_id, public.resolve_single_active_branch(org_id)) IS NOT NULL
    AND public.can_access_branch(
      org_id,
      COALESCE(branch_id, public.resolve_single_active_branch(org_id))
    )
  );

CREATE OR REPLACE VIEW public.budget_branch_backfill_audit AS
WITH active_branch_counts AS (
  SELECT
    b.org_id,
    COUNT(*) FILTER (WHERE b.is_active = TRUE) AS active_branch_count
  FROM public.branches b
  GROUP BY b.org_id
)
SELECT
  bud.org_id,
  org.name AS org_name,
  COALESCE(abc.active_branch_count, 0) AS active_branch_count,
  COUNT(*) AS unresolved_budget_count
FROM public.budgets bud
LEFT JOIN public.organizations org ON org.id = bud.org_id
LEFT JOIN active_branch_counts abc ON abc.org_id = bud.org_id
WHERE bud.branch_id IS NULL
GROUP BY bud.org_id, org.name, abc.active_branch_count
ORDER BY unresolved_budget_count DESC, org.name;

NOTIFY pgrst, 'reload schema';
