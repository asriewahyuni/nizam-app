-- ==========================================
-- MIGRATION 041: Accurate Reporting - Cash Flow Mapping
-- ==========================================

-- 1. Tambah kolom di accounts
ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS cash_flow_category TEXT CHECK (cash_flow_category IN ('OPERATING', 'INVESTING', 'FINANCING'));

COMMENT ON COLUMN accounts.cash_flow_category IS 'Pemetaan akun ke kategori Laporan Arus Kas.';

-- 2. Seed Default Mapping (Heuristic but persistence)
UPDATE accounts SET cash_flow_category = 'OPERATING' 
WHERE (code LIKE '4%' OR code LIKE '5%' OR code LIKE '6%');

UPDATE accounts SET cash_flow_category = 'OPERATING'
WHERE (code LIKE '12%' OR code LIKE '13%' OR code LIKE '14%' OR code LIKE '21%' OR code LIKE '22%' OR code LIKE '23%' OR code LIKE '24%');

UPDATE accounts SET cash_flow_category = 'INVESTING'
WHERE (code LIKE '15%' OR code LIKE '16%');

UPDATE accounts SET cash_flow_category = 'FINANCING'
WHERE (code LIKE '25%' OR code LIKE '26%' OR code LIKE '3%');

-- 3. Exception: Kas/Bank Accounts do not have CF categories (they are the target)
UPDATE accounts SET cash_flow_category = NULL
WHERE code LIKE '11%';
