-- =====================================================================
-- Migration 1238: SaaS Invoice Void Support & GL Integration
-- Tujuan:
--   1. Tambahkan status VOIDED ke kolom status di saas_invoices
--   2. Lepas constraint lama yang hanya memperbolehkan UNPAID/PAID/CANCELLED/EXPIRED
--   3. Pasang constraint baru yang juga mencakup VOIDED
-- =====================================================================

-- Lepas constraint lama (jika ada, nama constraint bisa berbeda tergantung DB)
DO $$
BEGIN
  -- Coba drop constraint dengan beberapa kemungkinan nama
  BEGIN
    ALTER TABLE saas_invoices DROP CONSTRAINT IF EXISTS saas_invoices_status_check;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER TABLE saas_invoices DROP CONSTRAINT IF EXISTS "saas_invoices_status_check";
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END;
$$;

-- Pasang constraint baru yang mencakup VOIDED
ALTER TABLE saas_invoices
  ADD CONSTRAINT saas_invoices_status_check
  CHECK (status IN ('UNPAID', 'PAID', 'CANCELLED', 'EXPIRED', 'VOIDED'));

-- Pastikan index status sudah ada (idempotent)
CREATE INDEX IF NOT EXISTS idx_saas_invoices_status ON saas_invoices(status);

-- Komentar untuk dokumentasi
COMMENT ON COLUMN saas_invoices.status IS
  'Status invoice: UNPAID (belum dibayar), PAID (lunas), CANCELLED (dibatalkan oleh sistem/tripay), EXPIRED (kadaluarsa), VOIDED (dibatalkan oleh operator SaaS dengan reversal jurnal GL)';
