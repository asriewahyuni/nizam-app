-- Migration: 1243_syirkah_profit_sharing_core_posting.sql
-- Description: Hubungkan posting bagi hasil syirkah ke jurnal Core accounting.

DO $$
BEGIN
  ALTER TYPE public.journal_reference_type
    ADD VALUE IF NOT EXISTS 'SYIRKAH_PROFIT_SHARING';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.syirkah_contracts
  ADD COLUMN IF NOT EXISTS profit_sharing_cash_account_id UUID NULL REFERENCES public.accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS profit_sharing_journal_entry_id UUID NULL REFERENCES public.journal_entries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_syirkah_contracts_profit_sharing_cash_account_id
  ON public.syirkah_contracts(profit_sharing_cash_account_id)
  WHERE profit_sharing_cash_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_syirkah_contracts_profit_sharing_journal_entry_id
  ON public.syirkah_contracts(profit_sharing_journal_entry_id)
  WHERE profit_sharing_journal_entry_id IS NOT NULL;

COMMENT ON COLUMN public.syirkah_contracts.profit_sharing_cash_account_id IS
  'Akun kas/bank Core yang dipakai untuk pembayaran bagi hasil syirkah.';

COMMENT ON COLUMN public.syirkah_contracts.profit_sharing_journal_entry_id IS
  'Jurnal Core terakhir yang merepresentasikan posting bagi hasil syirkah.';
