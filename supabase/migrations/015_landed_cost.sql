-- ============================================================
-- MIGRATION 015: Landed Cost & Fixed Asset Payment Logic
-- ============================================================

-- 1. Support Shipping in Purchases (Landed Cost)
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS shipping_amount DECIMAL(19,4) DEFAULT 0;

-- 2. Enhance Asset Capitalization (Just in case we need to track payment splits in DB)
-- For now we'll handle splits in the Journal Entry generation logic.
