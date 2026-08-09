-- Dua langkah baru di wizard pendaftaran publik, sebelum tahap bayar:
-- "Layanan Yang Diinginkan" (minat calon anggota, opsional multi-pilih) dan
-- "Komitmen" (pemahaman akad + persetujuan syariah, wajib dicentang semua
-- sebelum lanjut — komitmen_disetujui_at jadi bukti waktu persetujuan).
ALTER TABLE public.kojasmat_pendaftaran ADD COLUMN IF NOT EXISTS layanan_diinginkan TEXT[];
ALTER TABLE public.kojasmat_pendaftaran ADD COLUMN IF NOT EXISTS komitmen_disetujui_at TIMESTAMPTZ;

ALTER TABLE public.kojasmat_anggota ADD COLUMN IF NOT EXISTS layanan_diinginkan TEXT[];
