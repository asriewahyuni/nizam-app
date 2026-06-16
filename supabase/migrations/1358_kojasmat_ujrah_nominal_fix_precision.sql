-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 1358: Fix ujrah_nominal precision
-- ujrah_nominal adalah nominal Rupiah (bukan persentase), sehingga NUMERIC(5,2)
-- overflow saat nilainya di atas 999. Ubah ke NUMERIC(18,2).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.kojasmat_proyek
  ALTER COLUMN ujrah_nominal TYPE NUMERIC(18,2);
