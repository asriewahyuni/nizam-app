-- ============================================================
-- MIGRATION 1206: EDU training scoreboard
-- Menyediakan event pelatihan, tim peserta, dan skor per soal.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.training_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  question_count INTEGER NOT NULL DEFAULT 15,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT training_events_slug_key UNIQUE (slug),
  CONSTRAINT training_events_question_count_check CHECK (question_count > 0)
);

CREATE INDEX IF NOT EXISTS idx_training_events_active
  ON public.training_events(is_active, created_at DESC);

DROP TRIGGER IF EXISTS trg_training_events_updated_at ON public.training_events;
CREATE TRIGGER trg_training_events_updated_at
BEFORE UPDATE ON public.training_events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.training_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.training_events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  elapsed_minutes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT training_teams_status_check CHECK (status IN ('ACTIVE', 'COMPLETED', 'ARCHIVED')),
  CONSTRAINT training_teams_elapsed_minutes_check CHECK (elapsed_minutes >= 0)
);

CREATE INDEX IF NOT EXISTS idx_training_teams_event
  ON public.training_teams(event_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_training_teams_event_name_ci
  ON public.training_teams(event_id, LOWER(name));

DROP TRIGGER IF EXISTS trg_training_teams_updated_at ON public.training_teams;
CREATE TRIGGER trg_training_teams_updated_at
BEFORE UPDATE ON public.training_teams
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.training_team_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.training_teams(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL,
  transaction_ok BOOLEAN NOT NULL DEFAULT FALSE,
  context_ok BOOLEAN NOT NULL DEFAULT FALSE,
  evidence_ok BOOLEAN NOT NULL DEFAULT FALSE,
  note TEXT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT training_team_scores_unique UNIQUE (team_id, question_id),
  CONSTRAINT training_team_scores_question_id_check CHECK (question_id BETWEEN 1 AND 15)
);

CREATE INDEX IF NOT EXISTS idx_training_team_scores_team
  ON public.training_team_scores(team_id, question_id);

DROP TRIGGER IF EXISTS trg_training_team_scores_updated_at ON public.training_team_scores;
CREATE TRIGGER trg_training_team_scores_updated_at
BEFORE UPDATE ON public.training_team_scores
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
