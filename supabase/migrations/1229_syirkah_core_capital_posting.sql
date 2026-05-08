-- Migration: 1229_syirkah_core_capital_posting.sql
-- Description: Hubungkan modal syirkah ke jurnal Core accounting.

DO $$
BEGIN
  ALTER TYPE public.journal_reference_type
    ADD VALUE IF NOT EXISTS 'SYIRKAH_CAPITAL';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.syirkah_contracts
  ADD COLUMN IF NOT EXISTS core_cash_account_id UUID NULL REFERENCES public.accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS core_equity_account_id UUID NULL REFERENCES public.accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS core_journal_entry_id UUID NULL REFERENCES public.journal_entries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_syirkah_contracts_core_cash_account_id
  ON public.syirkah_contracts(core_cash_account_id)
  WHERE core_cash_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_syirkah_contracts_core_equity_account_id
  ON public.syirkah_contracts(core_equity_account_id)
  WHERE core_equity_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_syirkah_contracts_core_journal_entry_id
  ON public.syirkah_contracts(core_journal_entry_id)
  WHERE core_journal_entry_id IS NOT NULL;

COMMENT ON COLUMN public.syirkah_contracts.core_cash_account_id IS
  'Akun kas/bank Core yang menerima setoran modal syirkah.';

COMMENT ON COLUMN public.syirkah_contracts.core_equity_account_id IS
  'Akun modal syirkah pada CoA Core.';

COMMENT ON COLUMN public.syirkah_contracts.core_journal_entry_id IS
  'Jurnal Core terakhir yang merepresentasikan total modal syirkah aktif.';
