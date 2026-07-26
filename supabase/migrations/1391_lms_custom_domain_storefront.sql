-- Custom domain LMS penuh, perilaku homepage, dan alias slug storefront.
-- Target runtime: Railway PostgreSQL.

ALTER TABLE public.organization_domains
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS root_behavior TEXT NOT NULL DEFAULT 'LOGIN',
  ADD COLUMN IF NOT EXISTS provider_mode TEXT NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS railway_domain_id TEXT,
  ADD COLUMN IF NOT EXISTS cloudflare_zone_id TEXT,
  ADD COLUMN IF NOT EXISTS required_dns_records JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cloudflare_record_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS dns_status TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS certificate_status TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ;

ALTER TABLE public.organization_domains
  DROP CONSTRAINT IF EXISTS organization_domains_status_check;
ALTER TABLE public.organization_domains
  ADD CONSTRAINT organization_domains_status_check
  CHECK (status IN ('PENDING', 'VERIFYING', 'VERIFIED', 'FAILED', 'DISABLED'));

ALTER TABLE public.organization_domains
  DROP CONSTRAINT IF EXISTS organization_domains_root_behavior_check;
ALTER TABLE public.organization_domains
  ADD CONSTRAINT organization_domains_root_behavior_check
  CHECK (root_behavior IN ('STOREFRONT', 'LOGIN'));

ALTER TABLE public.organization_domains
  DROP CONSTRAINT IF EXISTS organization_domains_provider_mode_check;
ALTER TABLE public.organization_domains
  ADD CONSTRAINT organization_domains_provider_mode_check
  CHECK (provider_mode IN ('MANUAL', 'RAILWAY', 'RAILWAY_CLOUDFLARE'));

CREATE INDEX IF NOT EXISTS idx_organization_domains_store
  ON public.organization_domains (org_id, store_id, purpose, status);

CREATE TABLE IF NOT EXISTS public.store_slug_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  old_slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, old_slug)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_store_slug_aliases_ci
  ON public.store_slug_aliases (org_id, lower(old_slug));

CREATE TABLE IF NOT EXISTS public.store_product_slug_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  store_product_id UUID NOT NULL REFERENCES public.store_products(id) ON DELETE CASCADE,
  old_slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, old_slug)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_store_product_slug_aliases_ci
  ON public.store_product_slug_aliases (store_id, lower(old_slug));

CREATE UNIQUE INDEX IF NOT EXISTS uq_stores_org_slug_ci
  ON public.stores (org_id, lower(slug));

CREATE UNIQUE INDEX IF NOT EXISTS uq_store_products_store_slug_ci
  ON public.store_products (store_id, lower(public_slug));

CREATE TABLE IF NOT EXISTS public.store_domain_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  organization_domain_id UUID NOT NULL REFERENCES public.organization_domains(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  previous_status TEXT,
  next_status TEXT,
  actor_user_id UUID,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_domain_events_domain
  ON public.store_domain_events (organization_domain_id, created_at DESC);

-- Satu hostname tidak boleh sekaligus dimiliki portal organisasi dan store mandiri.
CREATE OR REPLACE FUNCTION public.guard_cross_domain_hostname_collision()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  normalized_hostname TEXT;
BEGIN
  IF TG_TABLE_NAME = 'organization_domains' THEN
    normalized_hostname := lower(trim(trailing '.' FROM NEW.hostname));
    IF EXISTS (
      SELECT 1
      FROM public.store_domains store_domain
      WHERE lower(trim(trailing '.' FROM store_domain.domain)) = normalized_hostname
    ) THEN
      RAISE EXCEPTION 'Hostname sudah dipakai oleh domain store.';
    END IF;
    NEW.hostname := normalized_hostname;
  ELSE
    normalized_hostname := lower(trim(trailing '.' FROM NEW.domain));
    IF EXISTS (
      SELECT 1
      FROM public.organization_domains organization_domain
      WHERE lower(trim(trailing '.' FROM organization_domain.hostname)) = normalized_hostname
        AND organization_domain.status <> 'DISABLED'
    ) THEN
      RAISE EXCEPTION 'Hostname sudah dipakai oleh domain organisasi.';
    END IF;
    NEW.domain := normalized_hostname;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_organization_domain_collision
  ON public.organization_domains;
CREATE TRIGGER trg_guard_organization_domain_collision
  BEFORE INSERT OR UPDATE OF hostname ON public.organization_domains
  FOR EACH ROW EXECUTE FUNCTION public.guard_cross_domain_hostname_collision();

DROP TRIGGER IF EXISTS trg_guard_store_domain_collision
  ON public.store_domains;
CREATE TRIGGER trg_guard_store_domain_collision
  BEFORE INSERT OR UPDATE OF domain ON public.store_domains
  FOR EACH ROW EXECUTE FUNCTION public.guard_cross_domain_hostname_collision();

DROP TRIGGER IF EXISTS trg_organization_domains_updated_at
  ON public.organization_domains;
CREATE TRIGGER trg_organization_domains_updated_at
  BEFORE UPDATE ON public.organization_domains
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.store_slug_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_product_slug_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_domain_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_manage_store_slug_aliases"
  ON public.store_slug_aliases;
CREATE POLICY "members_manage_store_slug_aliases"
  ON public.store_slug_aliases FOR ALL
  USING (
    org_id IN (
      SELECT org_id
      FROM public.org_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
        AND is_active = TRUE
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id
      FROM public.org_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
        AND is_active = TRUE
    )
  );

DROP POLICY IF EXISTS "members_manage_store_product_slug_aliases"
  ON public.store_product_slug_aliases;
CREATE POLICY "members_manage_store_product_slug_aliases"
  ON public.store_product_slug_aliases FOR ALL
  USING (
    org_id IN (
      SELECT org_id
      FROM public.org_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
        AND is_active = TRUE
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id
      FROM public.org_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
        AND is_active = TRUE
    )
  );

DROP POLICY IF EXISTS "members_view_store_domain_events"
  ON public.store_domain_events;
CREATE POLICY "members_view_store_domain_events"
  ON public.store_domain_events FOR SELECT
  USING (org_id IN (SELECT public.get_my_org_ids()));

DROP POLICY IF EXISTS "members_manage_store_domain_events"
  ON public.store_domain_events;
CREATE POLICY "members_manage_store_domain_events"
  ON public.store_domain_events FOR ALL
  USING (
    org_id IN (
      SELECT org_id
      FROM public.org_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND is_active = TRUE
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id
      FROM public.org_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND is_active = TRUE
    )
  );

-- Resolver tunggal untuk portal LMS dan store yang berada pada hostname sama.
CREATE OR REPLACE FUNCTION public.resolve_lms_tenant_domain(p_hostname TEXT)
RETURNS TABLE (
  domain_id UUID,
  org_id UUID,
  org_slug TEXT,
  org_name TEXT,
  store_id UUID,
  store_slug TEXT,
  root_behavior TEXT,
  purpose TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    domain.id,
    organization.id,
    organization.slug,
    organization.name,
    store.id,
    store.slug,
    domain.root_behavior,
    domain.purpose
  FROM public.organization_domains domain
  JOIN public.organizations organization
    ON organization.id = domain.org_id
  LEFT JOIN public.stores store
    ON store.id = domain.store_id
   AND store.org_id = domain.org_id
   AND store.is_active = TRUE
   AND store.is_published = TRUE
  WHERE lower(domain.hostname) = lower(trim(trailing '.' FROM p_hostname))
    AND domain.status = 'VERIFIED'
    AND domain.purpose IN ('LMS', 'MEMBER_PORTAL')
    AND organization.is_active = TRUE
  ORDER BY
    (domain.purpose = 'LMS') DESC,
    domain.is_primary DESC,
    domain.created_at
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_lms_tenant_domain(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_lms_tenant_domain(TEXT)
  TO anon, authenticated, service_role;
