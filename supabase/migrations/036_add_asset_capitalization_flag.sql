-- ==========================================
-- MIGRATION 036: Add Capitalization Toggle
-- ==========================================

ALTER TABLE fixed_assets 
ADD COLUMN IF NOT EXISTS should_capitalize_tax BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN fixed_assets.should_capitalize_tax IS 'Flag to determine if tax amount should be added to asset purchase price (capitalize) instead of recording as separate expense/tax account.';
