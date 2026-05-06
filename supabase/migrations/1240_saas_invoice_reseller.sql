-- =====================================================================
-- Migration 1240: Tambah kolom reseller_id ke saas_invoices
-- Reseller mengacu ke tabel sales_resellers milik org operator
-- =====================================================================

ALTER TABLE saas_invoices
  ADD COLUMN IF NOT EXISTS reseller_id UUID REFERENCES sales_resellers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_saas_invoices_reseller_id ON saas_invoices(reseller_id);

COMMENT ON COLUMN saas_invoices.reseller_id IS
  'Reseller yang mereferensikan tenant ini ke operator SaaS. Mengacu ke sales_resellers milik org operator.';
