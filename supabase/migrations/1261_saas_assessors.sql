-- Migration: buat tabel saas_assessors untuk fitur penilaian/assessment SaaS
-- Tabel ini menyimpan daftar email assessor yang berhak mengakses fitur assessment

CREATE TABLE IF NOT EXISTS public.saas_assessors (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  display_name text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT saas_assessors_email_unique UNIQUE (email),
  CONSTRAINT saas_assessors_email_not_empty CHECK (char_length(trim(email)) > 0)
);

-- Index untuk lookup cepat berdasarkan email dan status aktif
CREATE INDEX IF NOT EXISTS saas_assessors_email_idx
  ON public.saas_assessors (lower(email));

CREATE INDEX IF NOT EXISTS saas_assessors_active_idx
  ON public.saas_assessors (is_active)
  WHERE is_active = true;

-- Komentar tabel
COMMENT ON TABLE public.saas_assessors IS
  'Daftar assessor yang berwenang mengakses fitur assessment di platform SaaS.';
