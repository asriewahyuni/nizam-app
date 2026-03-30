-- ============================================================
-- MIGRATION 1082: AI Token Economy + Sales Page Template Variant
-- ============================================================

-- 1) Sales Page template id to support truly different output layouts
ALTER TABLE public.sales_pages
  ADD COLUMN IF NOT EXISTS template_id TEXT NOT NULL DEFAULT 'LEAD_CAPTURE'
  CHECK (template_id IN ('LEAD_CAPTURE', 'WEBINAR', 'PRODUCT_LAUNCH', 'CONSULTING'));

CREATE INDEX IF NOT EXISTS idx_sales_pages_template_id ON public.sales_pages(template_id);

-- 2) Platform admin helper for policy reuse
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (auth.jwt() ->> 'email') IN ('bob@executive.id')
    OR (auth.jwt() ->> 'email') LIKE '%@nizam.id'
    OR (auth.jwt() ->> 'email') LIKE '%@executive.id',
    FALSE
  );
$$;

-- 3) AI token wallet per organization
CREATE TABLE IF NOT EXISTS public.ai_token_wallets (
  org_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  balance_tokens BIGINT NOT NULL DEFAULT 0 CHECK (balance_tokens >= 0),
  total_purchased_tokens BIGINT NOT NULL DEFAULT 0 CHECK (total_purchased_tokens >= 0),
  total_used_tokens BIGINT NOT NULL DEFAULT 0 CHECK (total_used_tokens >= 0),
  low_balance_threshold BIGINT NOT NULL DEFAULT 5000 CHECK (low_balance_threshold >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_token_wallets_balance ON public.ai_token_wallets(balance_tokens);

DROP TRIGGER IF EXISTS trg_ai_token_wallets_updated_at ON public.ai_token_wallets;
CREATE TRIGGER trg_ai_token_wallets_updated_at
BEFORE UPDATE ON public.ai_token_wallets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) AI usage ledger (credit/debit)
CREATE TABLE IF NOT EXISTS public.ai_token_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source TEXT NOT NULL CHECK (source IN ('sales_page_generate', 'topup', 'manual_adjustment', 'refund')),
  direction TEXT NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT')),
  tokens BIGINT NOT NULL CHECK (tokens > 0),
  estimated_cost_idr NUMERIC(14,2) NOT NULL DEFAULT 0,
  related_invoice_id UUID REFERENCES public.saas_invoices(id) ON DELETE SET NULL,
  note TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_token_usage_logs_org_created ON public.ai_token_usage_logs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_logs_source ON public.ai_token_usage_logs(source);

-- 5) Token topup product catalog
CREATE TABLE IF NOT EXISTS public.ai_token_topup_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  tokens BIGINT NOT NULL CHECK (tokens > 0),
  price_idr NUMERIC(14,2) NOT NULL CHECK (price_idr >= 0),
  cost_idr NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (cost_idr >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_token_topup_packages_active_sort
  ON public.ai_token_topup_packages(is_active, sort_order, price_idr);

DROP TRIGGER IF EXISTS trg_ai_token_topup_packages_updated_at ON public.ai_token_topup_packages;
CREATE TRIGGER trg_ai_token_topup_packages_updated_at
BEFORE UPDATE ON public.ai_token_topup_packages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) Token topup order (linked to SaaS invoice)
CREATE TABLE IF NOT EXISTS public.ai_token_topup_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.ai_token_topup_packages(id) ON DELETE RESTRICT,
  invoice_id UUID NOT NULL UNIQUE REFERENCES public.saas_invoices(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'CANCELLED', 'EXPIRED')),
  tokens BIGINT NOT NULL CHECK (tokens > 0),
  price_idr NUMERIC(14,2) NOT NULL CHECK (price_idr >= 0),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_token_topup_orders_org_status
  ON public.ai_token_topup_orders(org_id, status, created_at DESC);

DROP TRIGGER IF EXISTS trg_ai_token_topup_orders_updated_at ON public.ai_token_topup_orders;
CREATE TRIGGER trg_ai_token_topup_orders_updated_at
BEFORE UPDATE ON public.ai_token_topup_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7) Seed starter topup packages (idempotent)
INSERT INTO public.ai_token_topup_packages (name, description, tokens, price_idr, cost_idr, sort_order)
VALUES
  ('Starter 50K', 'Cocok untuk tim kecil yang mulai rutin generate konten AI.', 50000, 49000, 29000, 10),
  ('Growth 200K', 'Paket populer untuk tim sales & marketing aktif.', 200000, 169000, 109000, 20),
  ('Scale 1M', 'Volume tinggi untuk organisasi yang intensif menggunakan AI.', 1000000, 699000, 419000, 30)
ON CONFLICT (name) DO NOTHING;

-- 8) Ensure configurable defaults in saas_config
INSERT INTO public.saas_config (key, value)
VALUES
  (
    'ai_token_policy',
    jsonb_build_object(
      'cost_per_1k_input_idr', 7,
      'cost_per_1k_output_idr', 14,
      'avg_input_tokens', 2200,
      'avg_output_tokens', 1800,
      'tokens_per_generation', 4000,
      'overhead_percent', 15,
      'margin_percent', 50,
      'low_balance_threshold', 5000
    )
  ),
  (
    'ai_token_inventory',
    jsonb_build_object(
      'total_stock_tokens', 10000000
    )
  )
ON CONFLICT (key) DO NOTHING;

-- 9) RLS policies
ALTER TABLE public.ai_token_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_token_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_token_topup_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_token_topup_orders ENABLE ROW LEVEL SECURITY;

-- wallets
DROP POLICY IF EXISTS "ai_wallet_select" ON public.ai_token_wallets;
CREATE POLICY "ai_wallet_select"
ON public.ai_token_wallets FOR SELECT
USING (
  public.is_platform_admin()
  OR org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid() AND is_active = TRUE
  )
);

DROP POLICY IF EXISTS "ai_wallet_insert" ON public.ai_token_wallets;
CREATE POLICY "ai_wallet_insert"
ON public.ai_token_wallets FOR INSERT
WITH CHECK (
  public.is_platform_admin()
  OR org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid() AND is_active = TRUE
  )
);

DROP POLICY IF EXISTS "ai_wallet_update" ON public.ai_token_wallets;
CREATE POLICY "ai_wallet_update"
ON public.ai_token_wallets FOR UPDATE
USING (
  public.is_platform_admin()
  OR org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid() AND is_active = TRUE
  )
)
WITH CHECK (
  public.is_platform_admin()
  OR org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid() AND is_active = TRUE
  )
);

-- usage logs
DROP POLICY IF EXISTS "ai_usage_select" ON public.ai_token_usage_logs;
CREATE POLICY "ai_usage_select"
ON public.ai_token_usage_logs FOR SELECT
USING (
  public.is_platform_admin()
  OR org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid() AND is_active = TRUE
  )
);

DROP POLICY IF EXISTS "ai_usage_insert" ON public.ai_token_usage_logs;
CREATE POLICY "ai_usage_insert"
ON public.ai_token_usage_logs FOR INSERT
WITH CHECK (
  public.is_platform_admin()
  OR org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid() AND is_active = TRUE
  )
);

-- topup packages
DROP POLICY IF EXISTS "ai_topup_pkg_select" ON public.ai_token_topup_packages;
CREATE POLICY "ai_topup_pkg_select"
ON public.ai_token_topup_packages FOR SELECT
USING (true);

DROP POLICY IF EXISTS "ai_topup_pkg_manage" ON public.ai_token_topup_packages;
CREATE POLICY "ai_topup_pkg_manage"
ON public.ai_token_topup_packages FOR ALL
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

-- topup orders
DROP POLICY IF EXISTS "ai_topup_order_select" ON public.ai_token_topup_orders;
CREATE POLICY "ai_topup_order_select"
ON public.ai_token_topup_orders FOR SELECT
USING (
  public.is_platform_admin()
  OR org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid() AND is_active = TRUE
  )
);

DROP POLICY IF EXISTS "ai_topup_order_insert" ON public.ai_token_topup_orders;
CREATE POLICY "ai_topup_order_insert"
ON public.ai_token_topup_orders FOR INSERT
WITH CHECK (
  public.is_platform_admin()
  OR org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid() AND is_active = TRUE
  )
);

DROP POLICY IF EXISTS "ai_topup_order_update" ON public.ai_token_topup_orders;
CREATE POLICY "ai_topup_order_update"
ON public.ai_token_topup_orders FOR UPDATE
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

-- 10) Strengthen saas_config admin policy to include executive.id
DROP POLICY IF EXISTS "Admin write for saas_config" ON public.saas_config;
CREATE POLICY "Admin write for saas_config"
ON public.saas_config FOR ALL
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());
