-- =============================================================================
-- 1427_klinik_pratama_rekam_medis.sql
-- Modul Klinik Pratama — Fase 2c (Rekam Medis): 1 baris rekam medis per
-- kunjungan + riwayat append-only. Mirror consulting_session_history
-- (supabase/migrations/1390_consulting_360.sql) — rekam medis wajib telusur
-- secara hukum, edit tanpa jejak tidak boleh terjadi. Setelah status FINAL,
-- field klinis (anamnesis/diagnosis/terapi) terkunci; koreksi lanjutan wajib
-- lewat addendum (baris history baru + append ke catatan), bukan overwrite.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.klinik_rekam_medis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kunjungan_id UUID NOT NULL UNIQUE REFERENCES public.klinik_kunjungan(id) ON DELETE CASCADE,
  staf_medis_id UUID REFERENCES public.klinik_staf_medis(id) ON DELETE SET NULL,
  anamnesis TEXT,
  diagnosis_icd10 TEXT,
  diagnosis_text TEXT,
  terapi TEXT,
  catatan TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'FINAL')),
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_klinik_rekam_medis_org ON public.klinik_rekam_medis (org_id);

CREATE TABLE IF NOT EXISTS public.klinik_rekam_medis_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rekam_medis_id UUID NOT NULL REFERENCES public.klinik_rekam_medis(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('CREATED', 'UPDATED', 'FINALIZED', 'ADDENDUM')),
  actor_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  before JSONB,
  after JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_klinik_rekam_medis_history_rm ON public.klinik_rekam_medis_history (rekam_medis_id, created_at ASC);
