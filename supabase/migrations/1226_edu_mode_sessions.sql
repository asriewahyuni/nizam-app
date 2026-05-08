-- ============================================================
-- MIGRATION 1226: EDU realtime session mode
-- Menambahkan session latihan aktif, step per soal, dan event log.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.training_events(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.training_teams(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  active_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  current_question_id INTEGER NOT NULL DEFAULT 1,
  started_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deadline_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  total_paused_seconds INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  last_validated_at TIMESTAMPTZ,
  last_heartbeat_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT training_sessions_status_check CHECK (status IN ('ACTIVE', 'PAUSED', 'COMPLETED', 'EXPIRED', 'ABANDONED')),
  CONSTRAINT training_sessions_current_question_check CHECK (current_question_id BETWEEN 1 AND 15),
  CONSTRAINT training_sessions_total_paused_seconds_check CHECK (total_paused_seconds >= 0)
);

CREATE INDEX IF NOT EXISTS idx_training_sessions_team_status
  ON public.training_sessions(team_id, status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_training_sessions_org_status
  ON public.training_sessions(org_id, status, started_at DESC);

DROP TRIGGER IF EXISTS trg_training_sessions_updated_at ON public.training_sessions;
CREATE TRIGGER trg_training_sessions_updated_at
BEFORE UPDATE ON public.training_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.training_session_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'LOCKED',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  deadline_at TIMESTAMPTZ,
  elapsed_seconds INTEGER NOT NULL DEFAULT 0,
  transaction_ok BOOLEAN NOT NULL DEFAULT FALSE,
  context_ok BOOLEAN NOT NULL DEFAULT FALSE,
  evidence_ok BOOLEAN NOT NULL DEFAULT FALSE,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  matched_record_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  matched_tables JSONB NOT NULL DEFAULT '[]'::jsonb,
  validator_version TEXT,
  trainer_note TEXT,
  system_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT training_session_steps_unique UNIQUE (session_id, question_id),
  CONSTRAINT training_session_steps_question_check CHECK (question_id BETWEEN 1 AND 15),
  CONSTRAINT training_session_steps_status_check CHECK (status IN ('LOCKED', 'ACTIVE', 'VALIDATING', 'PASSED', 'NEEDS_REVIEW', 'TIMED_OUT')),
  CONSTRAINT training_session_steps_elapsed_seconds_check CHECK (elapsed_seconds >= 0),
  CONSTRAINT training_session_steps_points_awarded_check CHECK (points_awarded BETWEEN 0 AND 3)
);

CREATE INDEX IF NOT EXISTS idx_training_session_steps_session
  ON public.training_session_steps(session_id, question_id);

DROP TRIGGER IF EXISTS trg_training_session_steps_updated_at ON public.training_session_steps;
CREATE TRIGGER trg_training_session_steps_updated_at
BEFORE UPDATE ON public.training_session_steps
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.training_progress_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  question_id INTEGER,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  source_module TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT training_progress_events_question_check CHECK (question_id IS NULL OR question_id BETWEEN 1 AND 15),
  CONSTRAINT training_progress_events_severity_check CHECK (severity IN ('info', 'success', 'warning', 'error'))
);

CREATE INDEX IF NOT EXISTS idx_training_progress_events_session
  ON public.training_progress_events(session_id, created_at DESC);
