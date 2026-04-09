-- ============================================================
-- MIGRATION 1160: Consolidated Posted Account Balances RPC
-- Adds a parent/holding scoped balance RPC for cash pages that
-- need posted-account balances across the full consolidation
-- tree (parent + descendants) without relying on snapshots.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_consolidated_posted_account_balances(
  p_parent_org_id UUID,
  p_target_org_id UUID DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL,
  p_account_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  org_id UUID,
  account_id UUID,
  balance NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch_org_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_parent_org_id IS NULL THEN
    RAISE EXCEPTION 'Parent organization is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.org_members om
    WHERE om.org_id = p_parent_org_id
      AND om.user_id = auth.uid()
      AND om.is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Access denied for organization %', p_parent_org_id;
  END IF;

  IF NOT public.is_main_organization(p_parent_org_id) THEN
    RAISE EXCEPTION 'Organization % is not a parent/holding organization', p_parent_org_id;
  END IF;

  IF NOT public.can_manage_finance_master(p_parent_org_id) THEN
    RAISE EXCEPTION 'Access denied for consolidated balances on organization %', p_parent_org_id;
  END IF;

  IF p_target_org_id IS NOT NULL
     AND NOT public.is_org_in_consolidation_tree(p_target_org_id, p_parent_org_id) THEN
    RAISE EXCEPTION 'Organization % is outside consolidation tree of %', p_target_org_id, p_parent_org_id;
  END IF;

  IF p_branch_id IS NOT NULL THEN
    SELECT b.org_id
    INTO v_branch_org_id
    FROM public.branches b
    WHERE b.id = p_branch_id
    LIMIT 1;

    IF v_branch_org_id IS NULL THEN
      RAISE EXCEPTION 'Branch % not found', p_branch_id;
    END IF;

    IF NOT public.is_org_in_consolidation_tree(v_branch_org_id, p_parent_org_id) THEN
      RAISE EXCEPTION 'Branch % is outside consolidation tree of %', p_branch_id, p_parent_org_id;
    END IF;

    IF p_target_org_id IS NOT NULL
       AND v_branch_org_id IS DISTINCT FROM p_target_org_id THEN
      RAISE EXCEPTION 'Branch % does not belong to organization %', p_branch_id, p_target_org_id;
    END IF;
  END IF;

  RETURN QUERY
  WITH scoped_org_ids AS (
    SELECT tree.org_id
    FROM public.get_consolidated_org_ids(p_parent_org_id) AS tree
    WHERE p_target_org_id IS NULL
       OR tree.org_id = p_target_org_id
  )
  SELECT
    a.org_id,
    a.id AS account_id,
    CASE
      WHEN a.normal_balance = 'DEBIT'
        THEN COALESCE(SUM(scoped_lines.debit), 0) - COALESCE(SUM(scoped_lines.credit), 0)
      ELSE
        COALESCE(SUM(scoped_lines.credit), 0) - COALESCE(SUM(scoped_lines.debit), 0)
    END AS balance
  FROM public.accounts a
  JOIN scoped_org_ids so
    ON so.org_id = a.org_id
  LEFT JOIN (
    SELECT
      je.org_id,
      jl.account_id,
      jl.debit,
      jl.credit
    FROM public.journal_lines jl
    JOIN public.journal_entries je
      ON je.id = jl.entry_id
    JOIN scoped_org_ids so
      ON so.org_id = je.org_id
    WHERE je.status = 'POSTED'
      AND (p_branch_id IS NULL OR je.branch_id = p_branch_id)
  ) AS scoped_lines
    ON scoped_lines.account_id = a.id
   AND scoped_lines.org_id = a.org_id
  WHERE a.is_active = TRUE
    AND (p_account_ids IS NULL OR a.id = ANY(p_account_ids))
  GROUP BY a.org_id, a.id, a.normal_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_consolidated_posted_account_balances(UUID, UUID, UUID, UUID[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
