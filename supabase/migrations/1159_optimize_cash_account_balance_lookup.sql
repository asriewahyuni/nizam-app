-- ============================================================
-- MIGRATION 1159: Optimize Cash Account Balance Lookup
-- Push scoped bank/account balance aggregation into Postgres so
-- the app no longer has to pull posted journal IDs/lines and
-- aggregate them in Node for branch-aware cash pages.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_journal_entries_org_branch_posted_id
  ON public.journal_entries(org_id, branch_id, id)
  WHERE status = 'POSTED';

CREATE OR REPLACE FUNCTION public.get_posted_account_balances(
  p_org_id UUID,
  p_branch_id UUID DEFAULT NULL,
  p_account_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  account_id UUID,
  balance NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.org_members om
    WHERE om.org_id = p_org_id
      AND om.user_id = auth.uid()
      AND om.is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Access denied for organization %', p_org_id;
  END IF;

  IF p_branch_id IS NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.branches b
      WHERE b.org_id = p_org_id
        AND b.is_active = TRUE
        AND NOT public.can_access_branch(p_org_id, b.id)
    ) THEN
      RAISE EXCEPTION 'Access denied for all-branch balances on organization %', p_org_id;
    END IF;
  ELSIF NOT public.can_access_branch(p_org_id, p_branch_id) THEN
    RAISE EXCEPTION 'Access denied for branch % on organization %', p_branch_id, p_org_id;
  END IF;

  RETURN QUERY
  SELECT
    a.id AS account_id,
    CASE
      WHEN a.normal_balance = 'DEBIT'
        THEN COALESCE(SUM(scoped_lines.debit), 0) - COALESCE(SUM(scoped_lines.credit), 0)
      ELSE
        COALESCE(SUM(scoped_lines.credit), 0) - COALESCE(SUM(scoped_lines.debit), 0)
    END AS balance
  FROM public.accounts a
  LEFT JOIN (
    SELECT
      jl.account_id,
      jl.debit,
      jl.credit
    FROM public.journal_lines jl
    JOIN public.journal_entries je
      ON je.id = jl.entry_id
    WHERE je.org_id = p_org_id
      AND je.status = 'POSTED'
      AND (p_branch_id IS NULL OR je.branch_id = p_branch_id)
  ) AS scoped_lines
    ON scoped_lines.account_id = a.id
  WHERE a.org_id = p_org_id
    AND a.is_active = TRUE
    AND (p_account_ids IS NULL OR a.id = ANY(p_account_ids))
  GROUP BY a.id, a.normal_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_posted_account_balances(UUID, UUID, UUID[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
