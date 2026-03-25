-- ============================================================
-- MIGRATION 018: Fix Draft Balance Leak
-- Description: Corrects the account_balances view to ensure 
-- that DRAFT journal entries do NOT affect financial report totals.
-- Only entries with status 'POSTED' should be calculated.
-- ============================================================

CREATE OR REPLACE VIEW account_balances AS
SELECT
  a.org_id,
  a.id AS account_id,
  a.code,
  a.name,
  a.type,
  a.normal_balance,
  COALESCE(SUM(jl.debit), 0)  AS total_debit,
  COALESCE(SUM(jl.credit), 0) AS total_credit,
  CASE
    WHEN a.normal_balance = 'DEBIT'
      THEN COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0)
    ELSE
      COALESCE(SUM(jl.credit), 0) - COALESCE(SUM(jl.debit), 0)
  END AS balance
FROM accounts a
LEFT JOIN (
  -- Subquery to filter only POSTED journal lines
  -- This ensures DRAFT items never leak into report totals
  SELECT lines.* 
  FROM journal_lines lines
  JOIN journal_entries entries ON entries.id = lines.entry_id
  WHERE entries.status = 'POSTED'
) jl ON jl.account_id = a.id
WHERE a.is_active = TRUE
GROUP BY a.org_id, a.id, a.code, a.name, a.type, a.normal_balance;

-- ============================================================
-- Add Delete Draft Policy
-- Allow users to hard-delete DRAFT journals they have access to
-- ============================================================

CREATE POLICY "members_can_delete_draft_journal"
  ON journal_entries FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager', 'staff')
        AND is_active = TRUE
    )
    AND status = 'DRAFT'
  );
