-- ============================================================
-- MIGRATION 1235: Training Center course assessments
-- Menyimpan hasil asesmen online per course untuk assessor/trainer.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.training_course_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  course_slug TEXT NOT NULL,
  assessment_version TEXT NOT NULL,
  participant_name TEXT NOT NULL,
  participant_reference TEXT,
  participant_role TEXT,
  assessor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assessor_name TEXT NOT NULL,
  decision TEXT NOT NULL,
  theory_status TEXT NOT NULL DEFAULT 'UNDERSTOOD',
  practice_status TEXT NOT NULL DEFAULT 'SUCCESS',
  checklist_results JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence_summary TEXT,
  strengths TEXT,
  repeated_errors TEXT,
  follow_up TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT training_course_assessments_course_slug_check CHECK (char_length(trim(course_slug)) > 0),
  CONSTRAINT training_course_assessments_participant_name_check CHECK (char_length(trim(participant_name)) >= 2),
  CONSTRAINT training_course_assessments_assessor_name_check CHECK (char_length(trim(assessor_name)) >= 2),
  CONSTRAINT training_course_assessments_decision_check CHECK (decision IN ('COMPETENT', 'NOT_YET_COMPETENT')),
  CONSTRAINT training_course_assessments_theory_status_check CHECK (theory_status IN ('UNDERSTOOD', 'PARTIAL', 'NOT_YET')),
  CONSTRAINT training_course_assessments_practice_status_check CHECK (practice_status IN ('SUCCESS', 'NEEDS_SUPPORT', 'FAILED'))
);

CREATE INDEX IF NOT EXISTS idx_training_course_assessments_org_course_created
  ON public.training_course_assessments(org_id, course_slug, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_training_course_assessments_assessor
  ON public.training_course_assessments(assessor_user_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_training_course_assessments_updated_at ON public.training_course_assessments;
CREATE TRIGGER trg_training_course_assessments_updated_at
BEFORE UPDATE ON public.training_course_assessments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
