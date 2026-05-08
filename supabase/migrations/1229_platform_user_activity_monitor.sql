-- ============================================================
-- MIGRATION 1229: Platform User Activity Monitor
-- ============================================================
-- Purpose:
-- Menyediakan log aktivitas route lintas tenant untuk kebutuhan
-- monitoring platform admin, khususnya untuk memantau user aktif
-- dan halaman yang sedang/baru dipakai.

CREATE TABLE IF NOT EXISTS public.user_activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL
    CHECK (event_type IN ('route_view', 'heartbeat', 'login')),
  actor_user_id UUID,
  internal_user_id UUID REFERENCES public.internal_auth_users(id) ON DELETE SET NULL,
  session_id UUID REFERENCES public.internal_auth_sessions(id) ON DELETE SET NULL,
  email TEXT,
  display_name TEXT,
  org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  role TEXT,
  route_path TEXT,
  route_query TEXT,
  route_full TEXT,
  user_agent TEXT,
  ip_address TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_activity_logs_occurred_at
  ON public.user_activity_logs (occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_activity_logs_event_type_occurred_at
  ON public.user_activity_logs (event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_activity_logs_actor_user
  ON public.user_activity_logs (actor_user_id, occurred_at DESC)
  WHERE actor_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_activity_logs_internal_user
  ON public.user_activity_logs (internal_user_id, occurred_at DESC)
  WHERE internal_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_activity_logs_session_route
  ON public.user_activity_logs (session_id, route_full, occurred_at DESC)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_activity_logs_route_path
  ON public.user_activity_logs (route_path, occurred_at DESC)
  WHERE route_path IS NOT NULL;

COMMENT ON TABLE public.user_activity_logs IS
  'Log aktivitas user lintas tenant untuk monitor platform admin, terutama akses route dan heartbeat aktivitas.';
