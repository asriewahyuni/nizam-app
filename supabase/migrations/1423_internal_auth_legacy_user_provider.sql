-- ============================================================
-- MIGRATION 1423: Scope legacy_user_id unique constraint by provider
-- ============================================================

-- 1. Drop the existing global UNIQUE constraint on legacy_user_id
ALTER TABLE public.internal_auth_users 
  DROP CONSTRAINT IF EXISTS internal_auth_users_legacy_user_id_key;

-- 2. Add composite UNIQUE constraint scoped by (legacy_user_id, provider)
ALTER TABLE public.internal_auth_users 
  ADD CONSTRAINT internal_auth_users_legacy_user_id_provider_unique 
  UNIQUE (legacy_user_id, provider);
