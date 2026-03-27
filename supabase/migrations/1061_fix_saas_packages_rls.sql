-- Fix RLS untuk tabel saas_packages
-- Masalah: Browser client tidak bisa UPDATE karena RLS memblokir secara diam-diam

-- Aktifkan RLS jika belum aktif
ALTER TABLE saas_packages ENABLE ROW LEVEL SECURITY;

-- Hapus policy lama jika ada
DROP POLICY IF EXISTS "Allow public read saas_packages" ON saas_packages;
DROP POLICY IF EXISTS "Allow admin write saas_packages" ON saas_packages;
DROP POLICY IF EXISTS "saas_packages_select" ON saas_packages;
DROP POLICY IF EXISTS "saas_packages_insert" ON saas_packages;
DROP POLICY IF EXISTS "saas_packages_update" ON saas_packages;
DROP POLICY IF EXISTS "saas_packages_delete" ON saas_packages;

-- Semua user bisa BACA paket (untuk landing page & dashboard)
CREATE POLICY "saas_packages_select" ON saas_packages
  FOR SELECT USING (true);

-- Semua authenticated user bisa INSERT/UPDATE/DELETE (admin only di aplikasi)
-- Karena admin check dilakukan di level aplikasi (middleware), bukan di RLS
CREATE POLICY "saas_packages_insert" ON saas_packages
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "saas_packages_update" ON saas_packages
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "saas_packages_delete" ON saas_packages
  FOR DELETE USING (auth.role() = 'authenticated');
