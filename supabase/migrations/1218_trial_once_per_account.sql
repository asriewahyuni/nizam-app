-- ============================================================
-- MIGRATION 1218: 3-day Trial + one-time Trial claim tracking
-- ============================================================
-- Goal:
-- - Trial berlaku 3 hari.
-- - Satu akun hanya boleh klaim Trial sekali, walau tenant Trial lama dihapus.

UPDATE public.saas_packages
SET duration_days = 3,
    updated_at = NOW()
WHERE name = 'Trial';

CREATE TABLE IF NOT EXISTS public.saas_trial_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT,
  first_org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT saas_trial_claims_identity_required
    CHECK (
      auth_user_id IS NOT NULL
      OR COALESCE(NULLIF(trim(email), ''), NULL) IS NOT NULL
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_saas_trial_claims_auth_user
  ON public.saas_trial_claims (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_saas_trial_claims_email
  ON public.saas_trial_claims (lower(email))
  WHERE email IS NOT NULL;

ALTER TABLE public.saas_trial_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_can_view_own_trial_claims" ON public.saas_trial_claims;
CREATE POLICY "users_can_view_own_trial_claims"
  ON public.saas_trial_claims
  FOR SELECT
  USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "users_can_insert_own_trial_claims" ON public.saas_trial_claims;
CREATE POLICY "users_can_insert_own_trial_claims"
  ON public.saas_trial_claims
  FOR INSERT
  WITH CHECK (auth_user_id = auth.uid());

INSERT INTO public.saas_trial_claims (
  auth_user_id,
  email,
  first_org_id,
  claimed_at,
  created_at
)
SELECT DISTINCT ON (COALESCE(om.user_id::text, lower(NULLIF(trim(o.owner_email), ''))))
  om.user_id,
  lower(NULLIF(trim(o.owner_email), '')) AS email,
  o.id,
  COALESCE(o.created_at, NOW()) AS claimed_at,
  NOW() AS created_at
FROM public.organizations o
LEFT JOIN public.org_members om
  ON om.org_id = o.id
 AND om.role = 'owner'
WHERE o.parent_org_id IS NULL
  AND COALESCE(o.is_demo, FALSE) = FALSE
  AND lower(COALESCE(o.settings->>'plan', '')) = 'trial'
  AND (
    om.user_id IS NOT NULL
    OR NULLIF(trim(o.owner_email), '') IS NOT NULL
  )
ORDER BY COALESCE(om.user_id::text, lower(NULLIF(trim(o.owner_email), ''))), o.created_at ASC, o.id ASC
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
