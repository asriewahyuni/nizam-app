-- =============================================================================
-- 1431_klinik_pratama_journal_reference_type.sql
-- Modul Klinik Pratama — FIX: journal_entries.reference_type adalah ENUM
-- Postgres (journal_reference_type), bukan TEXT bebas seperti yang tersirat
-- dari types/database.types.ts (JournalReferenceType = string, hanya tipe
-- TypeScript longgar, tidak merefleksikan constraint DB sesungguhnya).
--
-- Tanpa migration ini, setiap query/insert journal_entries dengan
-- reference_type='KLINIK_DISPENSING'/'KLINIK_PEMBAYARAN'/'KLINIK_VOID'/
-- 'KLINIK_VOID_HPP' gagal dengan error "invalid input value for enum
-- journal_reference_type" — inilah penyebab /klinik crash dengan
-- global-error.tsx di production (getUnpostedKlinikTransactions dipanggil
-- tanpa syarat di setiap page load).
--
-- Pola ini konsisten dengan modul lain (lihat KOJASMAT_*, WORKSHOP di daftar
-- enum existing) — tiap modul yang butuh reference_type baru wajib
-- menambahkannya lewat migration ALTER TYPE, bukan asumsi kolom TEXT bebas.
--
-- ALTER TYPE ... ADD VALUE aman dijalankan di dalam transaksi migration
-- runner ini (PostgreSQL 12+) selama nilai barunya TIDAK dipakai di
-- statement lain dalam migration yang sama — file ini hanya menambah nilai.
-- =============================================================================

ALTER TYPE public.journal_reference_type ADD VALUE IF NOT EXISTS 'KLINIK_DISPENSING';
ALTER TYPE public.journal_reference_type ADD VALUE IF NOT EXISTS 'KLINIK_PEMBAYARAN';
ALTER TYPE public.journal_reference_type ADD VALUE IF NOT EXISTS 'KLINIK_VOID';
ALTER TYPE public.journal_reference_type ADD VALUE IF NOT EXISTS 'KLINIK_VOID_HPP';
