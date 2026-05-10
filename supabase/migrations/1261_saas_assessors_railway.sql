-- ============================================================
-- MIGRATION 1261: Create saas_assessors for Railway PostgreSQL
-- Re-creates table from 1237 without Supabase-specific auth.users FK and RLS policies
-- ============================================================

CREATE TABLE IF NOT EXISTS public.saas_assessors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT saas_assessors_email_normalized_check CHECK (email = lower(trim(email))),
  CONSTRAINT saas_assessors_email_shape_check CHECK (position('@' in email) > 1)
);

CREATE INDEX IF NOT EXISTS idx_saas_assessors_active_email
  ON public.saas_assessors(is_active, email);

DROP TRIGGER IF EXISTS trg_saas_assessors_updated_at ON public.saas_assessors;
CREATE TRIGGER trg_saas_assessors_updated_at
BEFORE UPDATE ON public.saas_assessors
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.saas_assessors IS
  'Daftar assessor global yang dikelola SaaS. Tenant tidak boleh membuat atau memberi role assessor sendiri.';
