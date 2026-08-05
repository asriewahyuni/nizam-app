-- Kojasmat — dukung transfer simpanan sukarela antar anggota (scan QR internal).
-- Menambah dua jenis mutasi baru; transfer selalu instan (status DISETUJUI langsung,
-- tanpa antrian verifikasi pengurus) karena dana tidak keluar dari koperasi.

ALTER TABLE kojasmat_simpanan_mutasi
  DROP CONSTRAINT IF EXISTS kojasmat_simpanan_mutasi_jenis_mutasi_check;

ALTER TABLE kojasmat_simpanan_mutasi
  ADD CONSTRAINT kojasmat_simpanan_mutasi_jenis_mutasi_check
  CHECK (jenis_mutasi = ANY (ARRAY['SETOR','TARIK','BAGI_HASIL','KOREKSI','TRANSFER_MASUK','TRANSFER_KELUAR']));
