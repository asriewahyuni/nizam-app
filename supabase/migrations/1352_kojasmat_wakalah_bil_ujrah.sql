-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 1352: Kojasmat — koreksi akad ke Wakalah bil Ujrah
-- Koperasi bukan penerima nisbah, melainkan penerima Ujrah (fee agen).
-- Semua profit proyek adalah hak pemodal sepenuhnya.
-- ─────────────────────────────────────────────────────────────────────────────

-- kojasmat_proyek: ganti nisbah menjadi ujrah
ALTER TABLE public.kojasmat_proyek
  RENAME COLUMN nisbah_koperasi TO ujrah_pct;

ALTER TABLE public.kojasmat_proyek
  DROP COLUMN IF EXISTS nisbah_pemodal;

COMMENT ON COLUMN public.kojasmat_proyek.ujrah_pct IS
  'Fee wakalah koperasi (% dari total modal), bukan nisbah bagi hasil';

-- kojasmat_bagi_hasil: hak_koperasi → ujrah_koperasi
ALTER TABLE public.kojasmat_bagi_hasil
  RENAME COLUMN hak_koperasi TO ujrah_koperasi;

COMMENT ON COLUMN public.kojasmat_bagi_hasil.ujrah_koperasi IS
  'Ujrah koperasi = modal_pemodal × ujrah_pct (bukan dari keuntungan)';

-- porsi_pct di bagi_hasil tetap — dipakai untuk distribusi profit ke pemodal
-- hak_pemodal = laba_proyek × porsi_pct/100 (100% profit ke pemodal)
