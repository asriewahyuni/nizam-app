-- ============================================================
-- MIGRATION 1422: Scope internal_auth_users by provider
-- ============================================================

-- 1. Add provider column with a default value of 'platform'
ALTER TABLE public.internal_auth_users 
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'platform';

-- 2. Drop the existing global UNIQUE constraints on email and NIK
ALTER TABLE public.internal_auth_users 
  DROP CONSTRAINT IF EXISTS internal_auth_users_login_email_key;

ALTER TABLE public.internal_auth_users 
  DROP CONSTRAINT IF EXISTS internal_auth_users_login_nik_key;

-- 3. Add composite UNIQUE constraints scoped by (column, provider)
ALTER TABLE public.internal_auth_users 
  ADD CONSTRAINT internal_auth_users_email_provider_unique 
  UNIQUE (login_email, provider);

ALTER TABLE public.internal_auth_users 
  ADD CONSTRAINT internal_auth_users_nik_provider_unique 
  UNIQUE (login_nik, provider);
