#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

CONTAINER_NAME="${1:-supabase_db_nizam-app}"

docker exec "$CONTAINER_NAME" sh -lc "psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name text,
  email text UNIQUE,
  email_verified timestamptz,
  image text,
  password text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.oauth_accounts (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  provider text NOT NULL,
  provider_account_id text NOT NULL,
  refresh_token text,
  access_token text,
  expires_at integer,
  token_type text,
  scope text,
  id_token text,
  session_state text,
  UNIQUE(provider, provider_account_id)
);

CREATE TABLE IF NOT EXISTS public.sessions (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  session_token text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  expires timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS public.verification_tokens (
  identifier text NOT NULL,
  token text NOT NULL UNIQUE,
  expires timestamptz NOT NULL,
  PRIMARY KEY(identifier, token)
);

INSERT INTO public.users (id, name, email, email_verified, image, password, created_at, updated_at)
SELECT
  au.id,
  COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
  au.email,
  COALESCE(au.email_confirmed_at, au.confirmed_at),
  NULL,
  au.encrypted_password,
  au.created_at,
  au.updated_at
FROM auth.users au
WHERE au.deleted_at IS NULL
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  email_verified = EXCLUDED.email_verified,
  password = EXCLUDED.password,
  updated_at = GREATEST(public.users.updated_at, EXCLUDED.updated_at);
SQL"

echo "Auth runtime sync complete for container: $CONTAINER_NAME"
