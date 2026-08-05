-- Akad butuh 2 saksi (lazim dalam praktik penandatanganan akad syariah) —
-- tabel kojasmat_akad sebelumnya hanya punya satu kolom saksi_nama.

ALTER TABLE public.kojasmat_akad
  ADD COLUMN IF NOT EXISTS saksi_2_nama TEXT;
