-- Tambah durasi hari sebagai pelengkap durasi_bulan pada pengajuan proyek Kojasmat,
-- untuk proyek jangka pendek yang butuh presisi lebih halus dari satuan bulan.
ALTER TABLE public.kojasmat_proyek ADD COLUMN IF NOT EXISTS durasi_hari INTEGER NOT NULL DEFAULT 0;
