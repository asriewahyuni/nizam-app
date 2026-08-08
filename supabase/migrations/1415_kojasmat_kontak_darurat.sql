-- Tambah data kontak darurat calon anggota di form pendaftaran publik Kojasmat.
-- Disimpan di kojasmat_pendaftaran saat pendaftar mengisi wizard, lalu disalin
-- ke kojasmat_anggota saat pendaftaran disetujui (createAnggotaFromPendaftaran)
-- supaya datanya tidak hilang setelah anggota aktif.
ALTER TABLE public.kojasmat_pendaftaran ADD COLUMN IF NOT EXISTS kontak_darurat_nama VARCHAR(150);
ALTER TABLE public.kojasmat_pendaftaran ADD COLUMN IF NOT EXISTS kontak_darurat_hubungan VARCHAR(50);
ALTER TABLE public.kojasmat_pendaftaran ADD COLUMN IF NOT EXISTS kontak_darurat_phone VARCHAR(30);
ALTER TABLE public.kojasmat_pendaftaran ADD COLUMN IF NOT EXISTS kontak_darurat_alamat TEXT;

ALTER TABLE public.kojasmat_anggota ADD COLUMN IF NOT EXISTS kontak_darurat_nama VARCHAR(150);
ALTER TABLE public.kojasmat_anggota ADD COLUMN IF NOT EXISTS kontak_darurat_hubungan VARCHAR(50);
ALTER TABLE public.kojasmat_anggota ADD COLUMN IF NOT EXISTS kontak_darurat_phone VARCHAR(30);
ALTER TABLE public.kojasmat_anggota ADD COLUMN IF NOT EXISTS kontak_darurat_alamat TEXT;
