-- ============================================================
-- MIGRATION 1158: Sales Page AI Profiles
-- Brand Brain defaults for reusable sales page generation.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sales_page_ai_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  brand_positioning TEXT,
  default_audience TEXT,
  default_tone_style TEXT NOT NULL DEFAULT 'TEGAS_FRIENDLY'
    CHECK (default_tone_style IN ('TEGAS_FRIENDLY', 'KONSULTATIF', 'EKSEKUTIF', 'EDUKATIF', 'ASSERTIVE')),
  default_primary_cta_label TEXT,
  default_primary_cta_url TEXT,
  default_hero_image_url TEXT,
  default_hero_image_alt TEXT,
  key_benefits TEXT,
  proof_assets TEXT,
  objection_handling TEXT,
  ai_rules TEXT,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id)
);

CREATE INDEX IF NOT EXISTS idx_sales_page_ai_profiles_org_id
  ON public.sales_page_ai_profiles(org_id);

DROP TRIGGER IF EXISTS trg_sales_page_ai_profiles_updated_at ON public.sales_page_ai_profiles;
CREATE TRIGGER trg_sales_page_ai_profiles_updated_at
BEFORE UPDATE ON public.sales_page_ai_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.sales_page_ai_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_can_view_sales_page_ai_profiles" ON public.sales_page_ai_profiles;
CREATE POLICY "members_can_view_sales_page_ai_profiles"
ON public.sales_page_ai_profiles FOR SELECT
USING (
  org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid() AND is_active = TRUE
  )
);

DROP POLICY IF EXISTS "members_can_manage_sales_page_ai_profiles" ON public.sales_page_ai_profiles;
CREATE POLICY "members_can_manage_sales_page_ai_profiles"
ON public.sales_page_ai_profiles FOR ALL
USING (
  org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager', 'staff')
      AND is_active = TRUE
  )
)
WITH CHECK (
  org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager', 'staff')
      AND is_active = TRUE
  )
);

DROP TRIGGER IF EXISTS audit_sales_page_ai_profiles_trigger ON public.sales_page_ai_profiles;
CREATE TRIGGER audit_sales_page_ai_profiles_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.sales_page_ai_profiles
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
