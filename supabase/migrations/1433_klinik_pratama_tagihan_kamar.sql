-- =============================================================================
-- 1433_klinik_pratama_tagihan_kamar.sql
-- Klinik Pratama — kolom total_kamar di klinik_tagihan, mirror total_layanan/
-- total_obat yang sudah ada, untuk baris tagihan jenis='kamar' (rawat inap,
-- lihat 1432_klinik_pratama_rawat_inap.sql).
-- =============================================================================

ALTER TABLE public.klinik_tagihan
  ADD COLUMN IF NOT EXISTS total_kamar NUMERIC(15, 2) NOT NULL DEFAULT 0;
