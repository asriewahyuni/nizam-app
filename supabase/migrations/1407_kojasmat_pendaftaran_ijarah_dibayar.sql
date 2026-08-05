-- Kojasmat — catat komponen ijarah siklus pertama + top-up sukarela opsional
-- yang dibayar di halaman bayar pendaftaran.
ALTER TABLE kojasmat_pendaftaran
  ADD COLUMN ijarah_fee_dibayar NUMERIC(18,2),
  ADD COLUMN simpanan_sukarela_dibayar NUMERIC(18,2);
