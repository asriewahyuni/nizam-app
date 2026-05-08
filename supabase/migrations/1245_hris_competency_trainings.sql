-- MIGRATION 1245: HRIS competency trainings
-- Menyediakan katalog pelatihan internal agar parent, child, dan unit
-- dapat membuat program peningkatan kompetensi sendiri dari modul HRIS.

CREATE TABLE IF NOT EXISTS public.hris_competency_trainings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id UUID NULL REFERENCES public.branches(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  skill_category TEXT NOT NULL DEFAULT 'General Business Skill',
  target_role TEXT NULL,
  training_type TEXT NOT NULL DEFAULT 'INTERNAL',
  delivery_mode TEXT NOT NULL DEFAULT 'CLASSROOM',
  scope_type TEXT NOT NULL DEFAULT 'ORG',
  status TEXT NOT NULL DEFAULT 'DRAFT',
  facilitator_name TEXT NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  duration_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
  objective TEXT NULL,
  notes TEXT NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hris_competency_trainings_title_check CHECK (char_length(trim(title)) >= 3),
  CONSTRAINT hris_competency_trainings_skill_category_check CHECK (char_length(trim(skill_category)) >= 2),
  CONSTRAINT hris_competency_trainings_training_type_check CHECK (training_type IN ('INTERNAL', 'EXTERNAL', 'CERTIFICATION', 'COACHING')),
  CONSTRAINT hris_competency_trainings_delivery_mode_check CHECK (delivery_mode IN ('CLASSROOM', 'ONLINE', 'HYBRID', 'ON_THE_JOB')),
  CONSTRAINT hris_competency_trainings_scope_type_check CHECK (scope_type IN ('ORG', 'BRANCH')),
  CONSTRAINT hris_competency_trainings_status_check CHECK (status IN ('DRAFT', 'PLANNED', 'ONGOING', 'COMPLETED', 'ARCHIVED')),
  CONSTRAINT hris_competency_trainings_duration_hours_check CHECK (duration_hours >= 0),
  CONSTRAINT hris_competency_trainings_date_order_check CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_hris_competency_trainings_org_status
  ON public.hris_competency_trainings(org_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hris_competency_trainings_org_branch
  ON public.hris_competency_trainings(org_id, branch_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_hris_competency_trainings_updated_at ON public.hris_competency_trainings;
CREATE TRIGGER trg_hris_competency_trainings_updated_at
BEFORE UPDATE ON public.hris_competency_trainings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.hris_competency_trainings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_view_hris_competency_trainings" ON public.hris_competency_trainings;
CREATE POLICY "members_view_hris_competency_trainings"
ON public.hris_competency_trainings
FOR SELECT
USING (
  org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid()
      AND is_active = TRUE
  )
);

DROP POLICY IF EXISTS "admins_manage_hris_competency_trainings" ON public.hris_competency_trainings;
CREATE POLICY "admins_manage_hris_competency_trainings"
ON public.hris_competency_trainings
FOR ALL
USING (
  org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid()
      AND is_active = TRUE
      AND role IN ('owner', 'admin', 'hr')
  )
)
WITH CHECK (
  org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid()
      AND is_active = TRUE
      AND role IN ('owner', 'admin', 'hr')
  )
);
