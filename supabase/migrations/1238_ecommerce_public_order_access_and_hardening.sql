ALTER TABLE public.ecommerce_orders
  ADD COLUMN IF NOT EXISTS public_access_token TEXT,
  ADD COLUMN IF NOT EXISTS public_access_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checkout_idempotency_key TEXT;

ALTER TABLE public.ecommerce_order_payments
  ADD COLUMN IF NOT EXISTS client_upload_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ecommerce_orders_public_access_token
  ON public.ecommerce_orders(public_access_token)
  WHERE public_access_token IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ecommerce_orders_store_checkout_idempotency
  ON public.ecommerce_orders(store_id, checkout_idempotency_key)
  WHERE checkout_idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ecommerce_order_payments_upload_key
  ON public.ecommerce_order_payments(order_id, client_upload_key)
  WHERE client_upload_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.ecommerce_public_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.ecommerce_orders(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  scope_key TEXT NOT NULL,
  ip_address TEXT,
  request_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ecommerce_public_request_logs_scope
  ON public.ecommerce_public_request_logs(action_type, scope_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ecommerce_public_request_logs_order
  ON public.ecommerce_public_request_logs(order_id, created_at DESC);

ALTER TABLE public.ecommerce_public_request_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ecommerce_public_request_logs_members_select" ON public.ecommerce_public_request_logs;
CREATE POLICY "ecommerce_public_request_logs_members_select"
  ON public.ecommerce_public_request_logs FOR SELECT
  USING (org_id IN (SELECT public.get_my_org_ids()));

DROP POLICY IF EXISTS "ecommerce_public_request_logs_members_manage" ON public.ecommerce_public_request_logs;
CREATE POLICY "ecommerce_public_request_logs_members_manage"
  ON public.ecommerce_public_request_logs FOR ALL
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

NOTIFY pgrst, 'reload schema';
