-- =============================================================================
-- 1387_commerce_multicourse_public_checkout.sql
-- Snapshot hak akses order, versi paket, membership subscription, dan klaim akun
-- checkout tamu. Seluruh perubahan idempoten untuk rehearsal berulang.
-- =============================================================================

ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS allow_member_guest_checkout BOOLEAN NOT NULL DEFAULT FALSE;

-- Checkout toko umum tetap mengikuti perilaku lama. Sakelar baru di atas khusus
-- portal member/LMS dan sengaja nonaktif sampai pilot disetujui.
ALTER TABLE public.store_settings
  ALTER COLUMN allow_guest_checkout SET DEFAULT TRUE;

-- Order dengan kupon 100% tetap mempunyai catatan settlement bernilai nol.
ALTER TABLE public.sales_payments
  DROP CONSTRAINT IF EXISTS sales_payments_amount_check;
ALTER TABLE public.sales_payments
  ADD CONSTRAINT sales_payments_amount_check CHECK (amount >= 0);

ALTER TABLE public.commerce_access_packages
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS default_access_duration_value INTEGER,
  ADD COLUMN IF NOT EXISTS default_access_duration_unit TEXT;

ALTER TABLE public.commerce_access_package_courses
  ADD COLUMN IF NOT EXISTS access_duration_value INTEGER,
  ADD COLUMN IF NOT EXISTS access_duration_unit TEXT;

CREATE TABLE IF NOT EXISTS public.commerce_access_package_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.commerce_access_packages(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  actor_user_id UUID,
  previous_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  current_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_commerce_access_package_events_package
  ON public.commerce_access_package_events (org_id, package_id, version DESC);

CREATE TABLE IF NOT EXISTS public.commerce_order_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.ecommerce_orders(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES public.ecommerce_order_items(id) ON DELETE SET NULL,
  store_product_id UUID NOT NULL REFERENCES public.store_products(id) ON DELETE RESTRICT,
  course_id UUID NOT NULL REFERENCES public.learning_courses(id) ON DELETE RESTRICT,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('DIRECT', 'PACKAGE', 'MIXED')),
  package_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  package_versions JSONB NOT NULL DEFAULT '{}'::jsonb,
  access_duration_value INTEGER,
  access_duration_unit TEXT,
  source_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, order_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_commerce_order_entitlements_order
  ON public.commerce_order_entitlements (org_id, order_id, course_id);

ALTER TABLE public.commerce_memberships
  ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES public.commerce_subscriptions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS initial_order_id UUID REFERENCES public.ecommerce_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS latest_order_id UUID REFERENCES public.ecommerce_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS package_version INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_memberships_subscription_package
  ON public.commerce_memberships (org_id, subscription_id, package_id)
  WHERE subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commerce_memberships_subscription
  ON public.commerce_memberships (org_id, subscription_id, status);

CREATE TABLE IF NOT EXISTS public.commerce_membership_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  membership_id UUID NOT NULL REFERENCES public.commerce_memberships(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  order_id UUID REFERENCES public.ecommerce_orders(id) ON DELETE SET NULL,
  course_id UUID REFERENCES public.learning_courses(id) ON DELETE SET NULL,
  idempotency_key TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_commerce_membership_events_membership
  ON public.commerce_membership_events (org_id, membership_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.internal_auth_account_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  internal_user_id UUID NOT NULL REFERENCES public.internal_auth_users(id) ON DELETE CASCADE,
  auth_user_id UUID NOT NULL,
  order_id UUID REFERENCES public.ecommerce_orders(id) ON DELETE SET NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_internal_auth_account_claims_lookup
  ON public.internal_auth_account_claims (org_id, token_hash, expires_at)
  WHERE used_at IS NULL;

-- Order lama yang belum dibayar memperoleh snapshot dari konfigurasi produk saat
-- migrasi. Order selesai tidak disentuh agar tidak membuat ulang akses historis.
WITH entitlement_candidates AS (
  SELECT
    ecommerce_order.org_id,
    ecommerce_order.id AS order_id,
    item.id AS order_item_id,
    store_product.id AS store_product_id,
    product_course.course_id,
    COALESCE(
      product_course.access_duration_value,
      course.access_duration_value
    ) AS duration_value,
    COALESCE(
      product_course.access_duration_unit,
      course.access_duration_unit
    ) AS duration_unit,
    'DIRECT'::TEXT AS source_kind,
    NULL::UUID AS package_id,
    NULL::INTEGER AS package_version
  FROM public.ecommerce_orders ecommerce_order
  JOIN public.ecommerce_order_items item
    ON item.org_id = ecommerce_order.org_id
   AND item.order_id = ecommerce_order.id
  JOIN public.store_products store_product
    ON store_product.org_id = item.org_id
   AND store_product.store_id = item.store_id
   AND store_product.product_id = item.product_id
  JOIN public.commerce_product_courses product_course
    ON product_course.org_id = store_product.org_id
   AND product_course.store_product_id = store_product.id
  JOIN public.learning_courses course
    ON course.org_id = product_course.org_id
   AND course.id = product_course.course_id
  WHERE ecommerce_order.payment_status <> 'VALIDATED'

  UNION ALL

  SELECT
    ecommerce_order.org_id,
    ecommerce_order.id AS order_id,
    item.id AS order_item_id,
    store_product.id AS store_product_id,
    package_course.course_id,
    COALESCE(
      package_course.access_duration_value,
      access_package.default_access_duration_value,
      course.access_duration_value
    ) AS duration_value,
    COALESCE(
      package_course.access_duration_unit,
      access_package.default_access_duration_unit,
      course.access_duration_unit
    ) AS duration_unit,
    'PACKAGE'::TEXT AS source_kind,
    access_package.id AS package_id,
    access_package.version AS package_version
  FROM public.ecommerce_orders ecommerce_order
  JOIN public.ecommerce_order_items item
    ON item.org_id = ecommerce_order.org_id
   AND item.order_id = ecommerce_order.id
  JOIN public.store_products store_product
    ON store_product.org_id = item.org_id
   AND store_product.store_id = item.store_id
   AND store_product.product_id = item.product_id
  JOIN public.commerce_product_access_packages product_package
    ON product_package.org_id = store_product.org_id
   AND product_package.store_product_id = store_product.id
  JOIN public.commerce_access_packages access_package
    ON access_package.org_id = product_package.org_id
   AND access_package.id = product_package.package_id
  JOIN public.commerce_access_package_courses package_course
    ON package_course.org_id = access_package.org_id
   AND package_course.package_id = access_package.id
  JOIN public.learning_courses course
    ON course.org_id = package_course.org_id
   AND course.id = package_course.course_id
  WHERE ecommerce_order.payment_status <> 'VALIDATED'
),
ranked AS (
  SELECT
    candidate.*,
    ROW_NUMBER() OVER (
      PARTITION BY candidate.org_id, candidate.order_id, candidate.course_id
      ORDER BY
        (candidate.duration_value IS NULL) DESC,
        CASE UPPER(COALESCE(candidate.duration_unit, ''))
          WHEN 'YEAR' THEN candidate.duration_value * 31536000
          WHEN 'YEARS' THEN candidate.duration_value * 31536000
          WHEN 'MONTH' THEN candidate.duration_value * 2592000
          WHEN 'MONTHS' THEN candidate.duration_value * 2592000
          WHEN 'WEEK' THEN candidate.duration_value * 604800
          WHEN 'WEEKS' THEN candidate.duration_value * 604800
          WHEN 'DAY' THEN candidate.duration_value * 86400
          WHEN 'DAYS' THEN candidate.duration_value * 86400
          WHEN 'HOUR' THEN candidate.duration_value * 3600
          WHEN 'HOURS' THEN candidate.duration_value * 3600
          ELSE COALESCE(candidate.duration_value, 0)
        END DESC,
        candidate.source_kind
    ) AS choice_rank
  FROM entitlement_candidates candidate
),
aggregated AS (
  SELECT
    candidate.org_id,
    candidate.order_id,
    candidate.course_id,
    ARRAY_AGG(DISTINCT candidate.package_id)
      FILTER (WHERE candidate.package_id IS NOT NULL) AS package_ids,
    JSONB_OBJECT_AGG(
      candidate.package_id::TEXT,
      candidate.package_version
    ) FILTER (WHERE candidate.package_id IS NOT NULL) AS package_versions,
    JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'kind', candidate.source_kind,
        'packageId', candidate.package_id,
        'packageVersion', candidate.package_version,
        'durationValue', candidate.duration_value,
        'durationUnit', candidate.duration_unit
      )
    ) AS source_snapshot,
    BOOL_OR(candidate.source_kind = 'DIRECT') AS has_direct,
    BOOL_OR(candidate.source_kind = 'PACKAGE') AS has_package
  FROM entitlement_candidates candidate
  GROUP BY candidate.org_id, candidate.order_id, candidate.course_id
)
INSERT INTO public.commerce_order_entitlements (
  org_id,
  order_id,
  order_item_id,
  store_product_id,
  course_id,
  source_kind,
  package_ids,
  package_versions,
  access_duration_value,
  access_duration_unit,
  source_snapshot
)
SELECT
  ranked.org_id,
  ranked.order_id,
  ranked.order_item_id,
  ranked.store_product_id,
  ranked.course_id,
  CASE
    WHEN aggregated.has_direct AND aggregated.has_package THEN 'MIXED'
    WHEN aggregated.has_package THEN 'PACKAGE'
    ELSE 'DIRECT'
  END,
  COALESCE(aggregated.package_ids, '{}'::UUID[]),
  COALESCE(aggregated.package_versions, '{}'::JSONB),
  ranked.duration_value,
  ranked.duration_unit,
  JSONB_BUILD_OBJECT('sources', aggregated.source_snapshot, 'backfilled', TRUE)
FROM ranked
JOIN aggregated
  ON aggregated.org_id = ranked.org_id
 AND aggregated.order_id = ranked.order_id
 AND aggregated.course_id = ranked.course_id
WHERE ranked.choice_rank = 1
ON CONFLICT (org_id, order_id, course_id) DO NOTHING;

COMMENT ON TABLE public.commerce_order_entitlements IS
  'Snapshot immutable course yang diperoleh dari order agar pembelian sekali bayar tidak berubah saat paket diedit.';
