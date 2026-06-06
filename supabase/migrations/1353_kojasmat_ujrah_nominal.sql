-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 1353: Kojasmat — ujrah koperasi adalah nominal tetap (bukan persen)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.kojasmat_proyek
  RENAME COLUMN ujrah_pct TO ujrah_nominal;

ALTER TABLE public.kojasmat_proyek
  ALTER COLUMN ujrah_nominal SET DEFAULT 0;

COMMENT ON COLUMN public.kojasmat_proyek.ujrah_nominal IS
  'Fee wakalah koperasi — nominal tetap (Rupiah), bukan persentase';
