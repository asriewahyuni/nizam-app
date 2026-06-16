-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 1362: Pilihan kehadiran presentasi & penandatanganan akad saat
-- pemodal membiayai proyek — dihadiri sendiri atau diwakilkan koperasi (berujrah)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.kojasmat_proyek
  ADD COLUMN IF NOT EXISTS ujrah_wakalah_akad NUMERIC(18,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.kojasmat_proyek.ujrah_wakalah_akad IS
  'Ujrah yang ditentukan koperasi jika pemodal memilih diwakilkan saat presentasi/penandatanganan akad';

ALTER TABLE public.kojasmat_pembiayaan
  ADD COLUMN IF NOT EXISTS kehadiran_akad TEXT NOT NULL DEFAULT 'SENDIRI'
    CHECK (kehadiran_akad IN ('SENDIRI', 'DIWAKILKAN')),
  ADD COLUMN IF NOT EXISTS ujrah_diwakilkan NUMERIC(18,2) NOT NULL DEFAULT 0;
