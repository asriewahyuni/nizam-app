-- ============================================================
-- MIGRATION 1175: Internal Auth Foundation (Railway-first path)
-- ============================================================
-- Purpose:
-- Menyiapkan tabel autentikasi internal agar staging bisa migrasi bertahap
-- dari Supabase Auth ke session/password berbasis PostgreSQL (Railway).
--
-- Notes:
-- - Tabel ini tidak menggantikan Supabase Auth secara instan.
-- - Dipakai sebagai fondasi safe cutover bertahap.

CREATE TABLE IF NOT EXISTS public.internal_auth_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  legacy_user_id UUID UNIQUE,
  login_email TEXT UNIQUE,
  login_nik TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  user_type TEXT NOT NULL DEFAULT 'staff'
    CHECK (user_type IN ('owner', 'staff', 'admin')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT internal_auth_users_email_or_nik_required
    CHECK (
      COALESCE(NULLIF(trim(login_email), ''), NULL) IS NOT NULL
      OR COALESCE(NULLIF(trim(login_nik), ''), NULL) IS NOT NULL
    )
);

CREATE TABLE IF NOT EXISTS public.internal_auth_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.internal_auth_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_internal_auth_users_email
  ON public.internal_auth_users (lower(login_email))
  WHERE login_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_internal_auth_users_nik
  ON public.internal_auth_users (upper(login_nik))
  WHERE login_nik IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_internal_auth_users_legacy_user
  ON public.internal_auth_users (legacy_user_id)
  WHERE legacy_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_internal_auth_sessions_user
  ON public.internal_auth_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_internal_auth_sessions_expires
  ON public.internal_auth_sessions (expires_at);

CREATE OR REPLACE FUNCTION public.touch_internal_auth_users_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_internal_auth_users_updated_at
  ON public.internal_auth_users;

CREATE TRIGGER trg_touch_internal_auth_users_updated_at
BEFORE UPDATE ON public.internal_auth_users
FOR EACH ROW
EXECUTE FUNCTION public.touch_internal_auth_users_updated_at();

