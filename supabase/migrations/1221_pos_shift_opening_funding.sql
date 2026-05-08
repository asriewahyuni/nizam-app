-- ============================================================
-- MIGRATION 1221: POS Shift Opening Funding Metadata
-- Simpan akun sumber modal awal dan jurnal pembuka shift POS.
-- ============================================================

ALTER TABLE public.pos_shift_sessions
  ADD COLUMN IF NOT EXISTS opening_source_account_id UUID NULL REFERENCES public.accounts(id) ON DELETE SET NULL;

ALTER TABLE public.pos_shift_sessions
  ADD COLUMN IF NOT EXISTS opening_journal_entry_id UUID NULL REFERENCES public.journal_entries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pos_shift_sessions_opening_source_account
  ON public.pos_shift_sessions(org_id, opening_source_account_id);

CREATE INDEX IF NOT EXISTS idx_pos_shift_sessions_opening_journal_entry
  ON public.pos_shift_sessions(org_id, opening_journal_entry_id);
