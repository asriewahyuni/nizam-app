-- ============================================================
-- MIGRATION 1081: Sales Page Module
-- Public landing pages, Meta Pixel tracking, and lead capture
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sales_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED')),
  offer_badge TEXT,
  headline TEXT NOT NULL,
  subheadline TEXT,
  description TEXT,
  target_audience TEXT,
  price_label TEXT,
  bonus_text TEXT,
  guarantee_text TEXT,
  urgency_text TEXT,
  hero_image_url TEXT,
  hero_image_alt TEXT,
  primary_cta_label TEXT NOT NULL DEFAULT 'Hubungi Kami',
  primary_cta_url TEXT NOT NULL DEFAULT '#lead-form',
  secondary_cta_label TEXT,
  secondary_cta_url TEXT,
  meta_title TEXT,
  meta_description TEXT,
  meta_pixel_id TEXT,
  theme JSONB NOT NULL DEFAULT '{}'::jsonb,
  proof_points JSONB NOT NULL DEFAULT '[]'::jsonb,
  benefits JSONB NOT NULL DEFAULT '[]'::jsonb,
  offer_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  testimonials JSONB NOT NULL DEFAULT '[]'::jsonb,
  faq_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  form_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_sales_pages_org_id ON public.sales_pages(org_id);
CREATE INDEX IF NOT EXISTS idx_sales_pages_status ON public.sales_pages(status);
CREATE INDEX IF NOT EXISTS idx_sales_pages_slug ON public.sales_pages(slug);

CREATE TABLE IF NOT EXISTS public.sales_page_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sales_page_id UUID NOT NULL REFERENCES public.sales_pages(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'CONTACTED', 'QUALIFIED', 'CLOSED')),
  source_url TEXT,
  utm_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_page_leads_org_id ON public.sales_page_leads(org_id);
CREATE INDEX IF NOT EXISTS idx_sales_page_leads_page_id ON public.sales_page_leads(sales_page_id);
CREATE INDEX IF NOT EXISTS idx_sales_page_leads_status ON public.sales_page_leads(status);

DROP TRIGGER IF EXISTS trg_sales_pages_updated_at ON public.sales_pages;
CREATE TRIGGER trg_sales_pages_updated_at
BEFORE UPDATE ON public.sales_pages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.sales_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_page_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_can_view_sales_pages" ON public.sales_pages;
CREATE POLICY "members_can_view_sales_pages"
ON public.sales_pages FOR SELECT
USING (
  org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid() AND is_active = TRUE
  )
);

DROP POLICY IF EXISTS "members_can_manage_sales_pages" ON public.sales_pages;
CREATE POLICY "members_can_manage_sales_pages"
ON public.sales_pages FOR ALL
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

DROP POLICY IF EXISTS "members_can_view_sales_page_leads" ON public.sales_page_leads;
CREATE POLICY "members_can_view_sales_page_leads"
ON public.sales_page_leads FOR SELECT
USING (
  org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid() AND is_active = TRUE
  )
);

DROP POLICY IF EXISTS "members_can_manage_sales_page_leads" ON public.sales_page_leads;
CREATE POLICY "members_can_manage_sales_page_leads"
ON public.sales_page_leads FOR ALL
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

DROP TRIGGER IF EXISTS audit_sales_pages_trigger ON public.sales_pages;
CREATE TRIGGER audit_sales_pages_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.sales_pages
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_sales_page_leads_trigger ON public.sales_page_leads;
CREATE TRIGGER audit_sales_page_leads_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.sales_page_leads
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
