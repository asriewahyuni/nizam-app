-- ============================================================
-- MIGRATION 1177: Internal Auth Password Resets
-- ============================================================
-- Purpose:
-- Native password reset management for internal_auth_users.

CREATE TABLE IF NOT EXISTS public.internal_auth_password_resets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.internal_auth_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_internal_password_resets_user
  ON public.internal_auth_password_resets (user_id);

CREATE INDEX IF NOT EXISTS idx_internal_password_resets_hash
  ON public.internal_auth_password_resets (token_hash)
  WHERE used_at IS NULL;
