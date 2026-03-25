-- ============================================================
-- MIGRATION 1020: Allow Bank Transaction Deletion
-- Enables users with appropriate roles to update or delete 
-- incorrect bank transactions. RLS was previously preventing this.
-- ============================================================

CREATE POLICY "managers_can_delete_bank_transactions"
  ON public.bank_transactions FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager') AND is_active = TRUE
    )
  );

CREATE POLICY "managers_can_update_bank_transactions"
  ON public.bank_transactions FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager') AND is_active = TRUE
    )
  );

-- Also add logic to void rather than delete if preferred:
-- However, currently the Bank actions `deleteBankTransaction` uses DELETE
-- which handles voiding the journal entry as well.
