-- Kojasmat — bedakan bank soal test masuk (pendaftaran) dari bank soal test
-- kedua (upgrade ke Sahabat), supaya admin bisa kelola materi terpisah.
ALTER TABLE kojasmat_bank_soal
  ADD COLUMN jenis TEXT NOT NULL DEFAULT 'MASUK' CHECK (jenis IN ('MASUK', 'SAHABAT'));
