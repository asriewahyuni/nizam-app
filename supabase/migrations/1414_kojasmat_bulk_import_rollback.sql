-- Tambah kolom pelacakan batch bulk import Kojasmat supaya sebuah eksekusi
-- import (anggota + simpanan awal + proyek) bisa di-rollback secara presisi
-- kalau ada kesalahan (mis. salah upload file, salah pemetaan NIK), tanpa
-- menyentuh data anggota/transaksi lain yang tidak terkait batch tersebut.
--
-- import_batch_id: UUID yang sama untuk semua baris yang dibuat dalam satu
-- eksekusi executeKojasmatBulkImport. NULL untuk semua data yang dibuat lewat
-- alur manual (bukan bulk import).
--
-- journal_entry_id di kojasmat_simpanan_mutasi: menyimpan id jurnal akuntansi
-- yang dibuat untuk setoran tsb (dari jurnalSetorSimpanan), supaya rollback
-- bisa memanggil voidJournalEntry() yang sudah ada — bukan raw DELETE ke
-- journal_entries — agar tetap sesuai alur void resmi (cek periode tutup buku,
-- audit trail voided_by/voided_at, dll).

ALTER TABLE kojasmat_anggota ADD COLUMN IF NOT EXISTS import_batch_id uuid;
ALTER TABLE kojasmat_simpanan_mutasi ADD COLUMN IF NOT EXISTS import_batch_id uuid;
ALTER TABLE kojasmat_simpanan_mutasi ADD COLUMN IF NOT EXISTS journal_entry_id uuid;
ALTER TABLE kojasmat_proyek ADD COLUMN IF NOT EXISTS import_batch_id uuid;

CREATE INDEX IF NOT EXISTS idx_kojasmat_anggota_import_batch
  ON kojasmat_anggota(import_batch_id) WHERE import_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_kojasmat_simpanan_mutasi_import_batch
  ON kojasmat_simpanan_mutasi(import_batch_id) WHERE import_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_kojasmat_proyek_import_batch
  ON kojasmat_proyek(import_batch_id) WHERE import_batch_id IS NOT NULL;
