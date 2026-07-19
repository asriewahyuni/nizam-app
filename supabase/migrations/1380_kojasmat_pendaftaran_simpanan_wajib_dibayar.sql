-- 1380: Kolom simpanan wajib yang dibayar saat pendaftaran (bagian dari SPK)

ALTER TABLE kojasmat_pendaftaran
  ADD COLUMN simpanan_wajib_dibayar NUMERIC(18,2);
