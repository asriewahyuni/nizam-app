-- 1262: add acquisition_method and source_account_id to fixed_assets
ALTER TABLE fixed_assets
  ADD COLUMN IF NOT EXISTS acquisition_method text NOT NULL DEFAULT 'LUNAS',
  ADD COLUMN IF NOT EXISTS source_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL;
