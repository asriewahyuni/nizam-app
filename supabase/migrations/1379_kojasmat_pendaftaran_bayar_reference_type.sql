-- 1379: Reference type baru untuk jurnal biaya admin pendaftaran Kojasmat
-- CATATAN: ALTER TYPE ADD VALUE tidak bisa dalam transaksi yang sama dengan DML lain.

ALTER TYPE journal_reference_type ADD VALUE IF NOT EXISTS 'KOJASMAT_PENDAFTARAN_BAYAR';
