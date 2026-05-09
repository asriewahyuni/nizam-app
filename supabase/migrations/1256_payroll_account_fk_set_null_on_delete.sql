-- ============================================================
-- MIGRATION 1256: Payroll Account FKs Should Not Block Org Delete
-- ============================================================
-- Problem:
-- - Deleting an inactive tenant can cascade-delete its CoA accounts first.
-- - Payroll tables still reference those accounts with RESTRICT semantics,
--   especially payslip_lines.account_id, and the org deletion fails.
--
-- Goal:
-- - Preserve payroll history while the tenant still exists.
-- - When an account is deleted as part of tenant cleanup, nullable payroll
--   references should automatically become NULL instead of blocking delete.

ALTER TABLE IF EXISTS public.payroll_components
  DROP CONSTRAINT IF EXISTS payroll_components_account_id_fkey;

ALTER TABLE IF EXISTS public.payroll_components
  ADD CONSTRAINT payroll_components_account_id_fkey
  FOREIGN KEY (account_id)
  REFERENCES public.accounts(id)
  ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.payslip_lines
  DROP CONSTRAINT IF EXISTS payslip_lines_account_id_fkey;

ALTER TABLE IF EXISTS public.payslip_lines
  ADD CONSTRAINT payslip_lines_account_id_fkey
  FOREIGN KEY (account_id)
  REFERENCES public.accounts(id)
  ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.payroll_runs
  DROP CONSTRAINT IF EXISTS payroll_runs_disbursement_account_id_fkey;

ALTER TABLE IF EXISTS public.payroll_runs
  ADD CONSTRAINT payroll_runs_disbursement_account_id_fkey
  FOREIGN KEY (disbursement_account_id)
  REFERENCES public.accounts(id)
  ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
