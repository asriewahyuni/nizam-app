-- =====================================================================
-- Migration 1239: Tambah SAAS_SALE dan SAAS_CASH_IN ke enum journal_reference_type
-- Diperlukan agar transaksi SaaS Operator dapat dicatat di GL core finance
-- =====================================================================

-- ALTER TYPE ... ADD VALUE harus dijalankan di luar transaksi (tidak bisa dalam DO block)
ALTER TYPE journal_reference_type ADD VALUE IF NOT EXISTS 'SAAS_SALE';
ALTER TYPE journal_reference_type ADD VALUE IF NOT EXISTS 'SAAS_CASH_IN';
