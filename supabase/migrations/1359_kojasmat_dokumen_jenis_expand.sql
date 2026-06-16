-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 1359: Tambah jenis dokumen proyek: KELAYAKAN_USAHA, PROPOSAL, PENAWARAN_HARGA
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c FROM pg_constraint
  WHERE conrelid='public.kojasmat_dokumen'::regclass AND contype='c'
  AND pg_get_constraintdef(oid) LIKE '%jenis_dokumen%';
  IF c IS NOT NULL THEN EXECUTE 'ALTER TABLE public.kojasmat_dokumen DROP CONSTRAINT ' || quote_ident(c); END IF;
END $$;

ALTER TABLE public.kojasmat_dokumen
  ADD CONSTRAINT kojasmat_dokumen_jenis_check
  CHECK (jenis_dokumen IN (
    'KTP','PASSPORT','SURAT_USAHA','FOTO_USAHA',
    'PROYEKSI_KEUANGAN','ANALISA_BISNIS','PENAWARAN_SYIRKAH',
    'LAPORAN_MINGGUAN','AKAD','LAINNYA',
    'KELAYAKAN_USAHA','PROPOSAL','PENAWARAN_HARGA'
  ));
