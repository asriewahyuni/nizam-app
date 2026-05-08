CREATE TABLE IF NOT EXISTS public.scheduled_task_runs (
  id BIGSERIAL PRIMARY KEY,
  task_name TEXT NOT NULL,
  schedule_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  summary TEXT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT scheduled_task_runs_status_check
    CHECK (status IN ('running', 'success', 'failed')),
  CONSTRAINT scheduled_task_runs_task_name_schedule_key_unique
    UNIQUE (task_name, schedule_key)
);

CREATE INDEX IF NOT EXISTS idx_scheduled_task_runs_task_name_started_at
  ON public.scheduled_task_runs (task_name, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_scheduled_task_runs_status_started_at
  ON public.scheduled_task_runs (status, started_at DESC);

COMMENT ON TABLE public.scheduled_task_runs IS
  'Log eksekusi scheduler ala Laravel untuk mencegah task mingguan terkirim dobel.';
