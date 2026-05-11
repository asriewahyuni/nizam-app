-- ==========================================
-- MIGRATION 1262: Add acquisition_method and source_account_id to fixed_assets
-- ==========================================

ALTER TABLE public.fixed_assets
  ADD COLUMN IF NOT EXISTS acquisition_method TEXT,          -- LUNAS, KREDIT, atau SPLIT
  ADD COLUMN IF NOT EXISTS source_account_id  UUID REFERENCES public.accounts(id) ON DELETE SET NULL;
