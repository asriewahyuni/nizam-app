-- ============================================================
-- MIGRATION 1007: Shariah Transaction Modes
-- Adds shariah_mode to purchases and sales
-- ============================================================

CREATE TYPE shariah_mode AS ENUM ('CASH', 'SALAM', 'ISTISHNA');

ALTER TABLE purchases ADD COLUMN IF NOT EXISTS shariah_mode shariah_mode DEFAULT 'CASH';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS shariah_mode shariah_mode DEFAULT 'CASH';

-- Add comments for documentation
COMMENT ON COLUMN purchases.shariah_mode IS 'Tipe transaksi Syariah: CASH (Langsung), SALAM (Pesan & Bayar Depan), ISTISHNA (Pesanan/Manufaktur)';
COMMENT ON COLUMN sales.shariah_mode IS 'Tipe transaksi Syariah: CASH (Langsung), SALAM (Pesan & Bayar Depan), ISTISHNA (Pesanan/Manufaktur)';
