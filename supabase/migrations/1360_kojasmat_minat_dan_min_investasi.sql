-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 1360: Ketertarikan anggota ke proyek + min_investasi per proyek
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.kojasmat_proyek
  ADD COLUMN IF NOT EXISTS min_investasi NUMERIC(18,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.kojasmat_proyek.min_investasi IS
  'Minimum kontribusi modal per pemodal (Rupiah). 0 = tidak ada batas minimum.';

CREATE TABLE IF NOT EXISTS public.kojasmat_minat (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  proyek_id    UUID NOT NULL REFERENCES public.kojasmat_proyek(id) ON DELETE CASCADE,
  anggota_id   UUID NOT NULL REFERENCES public.kojasmat_anggota(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(proyek_id, anggota_id)
);

CREATE INDEX IF NOT EXISTS idx_kjm_minat_anggota ON public.kojasmat_minat(anggota_id);
CREATE INDEX IF NOT EXISTS idx_kjm_minat_proyek  ON public.kojasmat_minat(proyek_id);
