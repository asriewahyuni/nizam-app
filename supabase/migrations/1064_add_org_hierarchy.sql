-- Pondasi Konsolidasi: Menambahkan relasi Parent-Child ke Organisasi
-- Agar Holding bisa membaca data anak-anak perusahaannya secara resmi

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS parent_org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- Indeks untuk kecepatan query laporan konsolidasi
CREATE INDEX IF NOT EXISTS idx_org_parent ON organizations(parent_org_id);
