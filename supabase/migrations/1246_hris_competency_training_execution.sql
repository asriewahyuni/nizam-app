-- MIGRATION 1246: HRIS competency training execution
-- Menambahkan peserta, sesi, dan evaluasi per pelatihan agar HR dapat
-- menjalankan program kompetensi internal end-to-end.

CREATE TABLE IF NOT EXISTS public.hris_competency_training_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id UUID NOT NULL REFERENCES public.hris_competency_trainings(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'ASSIGNED',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID NULL,
  completed_at TIMESTAMPTZ NULL,
  note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hris_competency_training_participants_status_check CHECK (status IN ('ASSIGNED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  CONSTRAINT hris_competency_training_participants_unique UNIQUE (training_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_hris_competency_training_participants_training
  ON public.hris_competency_training_participants(training_id, status, created_at DESC);

DROP TRIGGER IF EXISTS trg_hris_competency_training_participants_updated_at ON public.hris_competency_training_participants;
CREATE TRIGGER trg_hris_competency_training_participants_updated_at
BEFORE UPDATE ON public.hris_competency_training_participants
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.hris_competency_training_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_view_hris_competency_training_participants" ON public.hris_competency_training_participants;
CREATE POLICY "members_view_hris_competency_training_participants"
ON public.hris_competency_training_participants
FOR SELECT
USING (
  org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid()
      AND is_active = TRUE
  )
);

DROP POLICY IF EXISTS "admins_manage_hris_competency_training_participants" ON public.hris_competency_training_participants;
CREATE POLICY "admins_manage_hris_competency_training_participants"
ON public.hris_competency_training_participants
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

CREATE TABLE IF NOT EXISTS public.hris_competency_training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id UUID NOT NULL REFERENCES public.hris_competency_trainings(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id UUID NULL REFERENCES public.branches(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  session_date DATE NULL,
  start_time TIME NULL,
  end_time TIME NULL,
  location TEXT NULL,
  facilitator_name TEXT NULL,
  status TEXT NOT NULL DEFAULT 'SCHEDULED',
  note TEXT NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hris_competency_training_sessions_title_check CHECK (char_length(trim(title)) >= 3),
  CONSTRAINT hris_competency_training_sessions_status_check CHECK (status IN ('SCHEDULED', 'DONE', 'CANCELLED'))
);

CREATE INDEX IF NOT EXISTS idx_hris_competency_training_sessions_training
  ON public.hris_competency_training_sessions(training_id, session_date, created_at DESC);

DROP TRIGGER IF EXISTS trg_hris_competency_training_sessions_updated_at ON public.hris_competency_training_sessions;
CREATE TRIGGER trg_hris_competency_training_sessions_updated_at
BEFORE UPDATE ON public.hris_competency_training_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.hris_competency_training_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_view_hris_competency_training_sessions" ON public.hris_competency_training_sessions;
CREATE POLICY "members_view_hris_competency_training_sessions"
ON public.hris_competency_training_sessions
FOR SELECT
USING (
  org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid()
      AND is_active = TRUE
  )
);

DROP POLICY IF EXISTS "admins_manage_hris_competency_training_sessions" ON public.hris_competency_training_sessions;
CREATE POLICY "admins_manage_hris_competency_training_sessions"
ON public.hris_competency_training_sessions
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

CREATE TABLE IF NOT EXISTS public.hris_competency_training_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id UUID NOT NULL REFERENCES public.hris_competency_trainings(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.hris_competency_training_participants(id) ON DELETE CASCADE,
  session_id UUID NULL REFERENCES public.hris_competency_training_sessions(id) ON DELETE SET NULL,
  evaluator_name TEXT NOT NULL,
  evaluation_type TEXT NOT NULL DEFAULT 'ASSESSMENT',
  result_status TEXT NOT NULL DEFAULT 'OBSERVED',
  score NUMERIC(5,2) NULL,
  note TEXT NULL,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NULL,
  updated_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hris_competency_training_evaluations_evaluator_name_check CHECK (char_length(trim(evaluator_name)) >= 2),
  CONSTRAINT hris_competency_training_evaluations_evaluation_type_check CHECK (evaluation_type IN ('PRETEST', 'POSTTEST', 'OBSERVATION', 'ASSESSMENT', 'CERTIFICATION')),
  CONSTRAINT hris_competency_training_evaluations_result_status_check CHECK (result_status IN ('OBSERVED', 'PASS', 'REMEDIAL', 'FAIL')),
  CONSTRAINT hris_competency_training_evaluations_score_check CHECK (score IS NULL OR (score >= 0 AND score <= 100))
);

CREATE INDEX IF NOT EXISTS idx_hris_competency_training_evaluations_training
  ON public.hris_competency_training_evaluations(training_id, evaluated_at DESC);

CREATE INDEX IF NOT EXISTS idx_hris_competency_training_evaluations_participant
  ON public.hris_competency_training_evaluations(participant_id, evaluated_at DESC);

DROP TRIGGER IF EXISTS trg_hris_competency_training_evaluations_updated_at ON public.hris_competency_training_evaluations;
CREATE TRIGGER trg_hris_competency_training_evaluations_updated_at
BEFORE UPDATE ON public.hris_competency_training_evaluations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.hris_competency_training_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_view_hris_competency_training_evaluations" ON public.hris_competency_training_evaluations;
CREATE POLICY "members_view_hris_competency_training_evaluations"
ON public.hris_competency_training_evaluations
FOR SELECT
USING (
  org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid()
      AND is_active = TRUE
  )
);

DROP POLICY IF EXISTS "admins_manage_hris_competency_training_evaluations" ON public.hris_competency_training_evaluations;
CREATE POLICY "admins_manage_hris_competency_training_evaluations"
ON public.hris_competency_training_evaluations
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
