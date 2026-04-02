-- ============================================================
-- MIGRATION 1092: Reimbursement Branch Context
-- Make reimbursements aware of active branch/unit.
-- ============================================================

ALTER TABLE public.reimbursements
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reimbursements_org_branch_status_date
  ON public.reimbursements(org_id, branch_id, status, created_at DESC);

UPDATE public.reimbursements r
SET branch_id = public.resolve_single_active_branch(r.org_id)
WHERE r.branch_id IS NULL;

UPDATE public.approval_requests ar
SET branch_id = r.branch_id
FROM public.reimbursements r
WHERE ar.source_type = 'REIMBURSEMENT'
  AND ar.source_id = r.id
  AND ar.branch_id IS NULL
  AND r.branch_id IS NOT NULL;

UPDATE public.journal_entries je
SET branch_id = r.branch_id
FROM public.reimbursements r
WHERE je.reference_type = 'CASH_OUT'
  AND je.reference_id = r.id
  AND je.branch_id IS NULL
  AND r.branch_id IS NOT NULL;

CREATE OR REPLACE VIEW public.reimbursement_branch_backfill_audit AS
SELECT
  org_id,
  COUNT(*) AS unresolved_count
FROM public.reimbursements
WHERE branch_id IS NULL
GROUP BY org_id
ORDER BY unresolved_count DESC, org_id;

NOTIFY pgrst, 'reload schema';
