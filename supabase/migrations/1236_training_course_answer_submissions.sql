-- ============================================================
-- MIGRATION 1236: Training Center participant answer submissions
-- Menyimpan jawaban teori dan bukti praktik peserta sebelum direview assessor.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.training_course_answer_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  course_slug TEXT NOT NULL,
  assessment_version TEXT NOT NULL,
  participant_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  participant_name TEXT NOT NULL,
  participant_reference TEXT,
  participant_role TEXT,
  theory_answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  practical_answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  general_notes TEXT,
  status TEXT NOT NULL DEFAULT 'SUBMITTED',
  reviewer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_name TEXT,
  reviewer_note TEXT,
  reviewed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT training_course_answer_submissions_course_slug_check CHECK (char_length(trim(course_slug)) > 0),
  CONSTRAINT training_course_answer_submissions_participant_name_check CHECK (char_length(trim(participant_name)) >= 2),
  CONSTRAINT training_course_answer_submissions_status_check CHECK (status IN ('SUBMITTED', 'REVIEWED'))
);

CREATE INDEX IF NOT EXISTS idx_training_course_answer_submissions_org_course_created
  ON public.training_course_answer_submissions(org_id, course_slug, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_training_course_answer_submissions_participant
  ON public.training_course_answer_submissions(participant_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_training_course_answer_submissions_status
  ON public.training_course_answer_submissions(org_id, course_slug, status, created_at DESC);

DROP TRIGGER IF EXISTS trg_training_course_answer_submissions_updated_at ON public.training_course_answer_submissions;
CREATE TRIGGER trg_training_course_answer_submissions_updated_at
BEFORE UPDATE ON public.training_course_answer_submissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
