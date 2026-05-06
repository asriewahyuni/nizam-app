-- ============================================================
-- MIGRATION 1237: E-Commerce + Theme Builder Foundation
-- Fondasi multi-store, katalog publik, varian, theme draft/publish,
-- order e-commerce, upload bukti bayar, dan reservasi stok.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'store_theme_version_status'
  ) THEN
    CREATE TYPE public.store_theme_version_status AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'ecommerce_order_status'
  ) THEN
    CREATE TYPE public.ecommerce_order_status AS ENUM (
      'DRAFT',
      'AWAITING_PAYMENT',
      'PAYMENT_UNDER_REVIEW',
      'PAID',
      'READY_TO_FULFILL',
      'FULFILLING',
      'SHIPPED',
      'COMPLETED',
      'PAYMENT_REJECTED',
      'PAYMENT_EXCEPTION',
      'CANCELLED',
      'REFUNDED'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'ecommerce_payment_status'
  ) THEN
    CREATE TYPE public.ecommerce_payment_status AS ENUM (
      'PENDING_UPLOAD',
      'UNDER_REVIEW',
      'VALIDATED',
      'REJECTED'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'ecommerce_reservation_status'
  ) THEN
    CREATE TYPE public.ecommerce_reservation_status AS ENUM (
      'ACTIVE',
      'CONSUMED',
      'RELEASED',
      'CANCELLED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE RESTRICT,
  shipping_fee_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  brand_name TEXT,
  line_name TEXT,
  support_email TEXT,
  support_phone TEXT,
  whatsapp_phone TEXT,
  logo_url TEXT,
  headline TEXT,
  subheadline TEXT,
  currency TEXT NOT NULL DEFAULT 'IDR',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, slug)
);

CREATE TABLE IF NOT EXISTS public.store_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  domain TEXT NOT NULL UNIQUE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'PENDING',
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.store_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  seo_title TEXT,
  seo_description TEXT,
  hero_notice TEXT,
  checkout_notice TEXT,
  transfer_instructions TEXT,
  allow_guest_checkout BOOLEAN NOT NULL DEFAULT TRUE,
  allow_manual_payment BOOLEAN NOT NULL DEFAULT TRUE,
  weight_unit TEXT NOT NULL DEFAULT 'kg',
  dimension_unit TEXT NOT NULL DEFAULT 'cm',
  social_links JSONB NOT NULL DEFAULT '{}'::jsonb,
  contact_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  footer_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_id)
);

CREATE TABLE IF NOT EXISTS public.store_shipping_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  countries JSONB NOT NULL DEFAULT '[]'::jsonb,
  provinces JSONB NOT NULL DEFAULT '[]'::jsonb,
  cities JSONB NOT NULL DEFAULT '[]'::jsonb,
  postal_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_id, code)
);

CREATE TABLE IF NOT EXISTS public.store_shipping_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  zone_id UUID NOT NULL REFERENCES public.store_shipping_zones(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rate_type TEXT NOT NULL DEFAULT 'FLAT',
  min_weight NUMERIC(20, 4) NOT NULL DEFAULT 0,
  max_weight NUMERIC(20, 4),
  flat_amount NUMERIC(20, 2) NOT NULL DEFAULT 0,
  per_kg_amount NUMERIC(20, 2) NOT NULL DEFAULT 0,
  free_shipping_min_subtotal NUMERIC(20, 2) NOT NULL DEFAULT 0,
  eta_label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.product_attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  display_type TEXT NOT NULL DEFAULT 'TEXT',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, slug)
);

CREATE TABLE IF NOT EXISTS public.product_attribute_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  attribute_id UUID NOT NULL REFERENCES public.product_attributes(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  slug TEXT NOT NULL,
  swatch_hex TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(attribute_id, slug)
);

CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  inventory_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  sku TEXT,
  name TEXT NOT NULL,
  weight NUMERIC(20, 4) NOT NULL DEFAULT 0,
  length_cm NUMERIC(20, 4) NOT NULL DEFAULT 0,
  width_cm NUMERIC(20, 4) NOT NULL DEFAULT 0,
  height_cm NUMERIC(20, 4) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.product_variant_attribute_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  attribute_id UUID NOT NULL REFERENCES public.product_attributes(id) ON DELETE CASCADE,
  attribute_value_id UUID NOT NULL REFERENCES public.product_attribute_values(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(variant_id, attribute_id),
  UNIQUE(variant_id, attribute_value_id)
);

CREATE TABLE IF NOT EXISTS public.store_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  public_slug TEXT NOT NULL,
  public_name TEXT NOT NULL,
  short_description TEXT,
  public_description TEXT,
  price_override NUMERIC(20, 2),
  compare_price NUMERIC(20, 2),
  badge_text TEXT,
  seo_title TEXT,
  seo_description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  stock_visibility TEXT NOT NULL DEFAULT 'AUTO',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_id, product_id),
  UNIQUE(store_id, public_slug)
);

CREATE TABLE IF NOT EXISTS public.store_variant_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  public_name TEXT,
  price_override NUMERIC(20, 2),
  compare_price NUMERIC(20, 2),
  badge_text TEXT,
  hero_image_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_id, variant_id)
);

CREATE TABLE IF NOT EXISTS public.ecommerce_product_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL DEFAULT 'IMAGE',
  url TEXT NOT NULL,
  alt_text TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.store_theme_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  tokens JSONB NOT NULL DEFAULT '{}'::jsonb,
  layout JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.store_theme_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.store_theme_templates(id) ON DELETE SET NULL,
  version_name TEXT NOT NULL DEFAULT 'Default Theme',
  status public.store_theme_version_status NOT NULL DEFAULT 'DRAFT',
  preview_token TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  tokens JSONB NOT NULL DEFAULT '{}'::jsonb,
  layout JSONB NOT NULL DEFAULT '{}'::jsonb,
  branding JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(preview_token)
);

CREATE TABLE IF NOT EXISTS public.store_theme_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  theme_version_id UUID REFERENCES public.store_theme_versions(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL DEFAULT 'IMAGE',
  label TEXT,
  storage_key TEXT,
  public_url TEXT,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ecommerce_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT NOT NULL,
  customer_note TEXT,
  order_number TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'IDR',
  status public.ecommerce_order_status NOT NULL DEFAULT 'DRAFT',
  payment_status public.ecommerce_payment_status NOT NULL DEFAULT 'PENDING_UPLOAD',
  subtotal_amount NUMERIC(20, 2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(20, 2) NOT NULL DEFAULT 0,
  shipping_amount NUMERIC(20, 2) NOT NULL DEFAULT 0,
  grand_total NUMERIC(20, 2) NOT NULL DEFAULT 0,
  shipping_zone_id UUID REFERENCES public.store_shipping_zones(id) ON DELETE SET NULL,
  shipping_rate_id UUID REFERENCES public.store_shipping_rates(id) ON DELETE SET NULL,
  shipping_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  pricing_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  theme_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  cart_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  payment_due_at TIMESTAMPTZ,
  erp_sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  erp_sync_status TEXT NOT NULL DEFAULT 'PENDING',
  erp_sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, order_number)
);

CREATE TABLE IF NOT EXISTS public.ecommerce_order_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.ecommerce_orders(id) ON DELETE CASCADE,
  address_type TEXT NOT NULL DEFAULT 'SHIPPING',
  recipient_name TEXT NOT NULL,
  phone TEXT,
  line1 TEXT NOT NULL,
  line2 TEXT,
  district TEXT,
  city TEXT,
  province TEXT,
  postal_code TEXT,
  country TEXT NOT NULL DEFAULT 'ID',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ecommerce_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.ecommerce_orders(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  inventory_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  variant_name TEXT,
  sku TEXT,
  slug TEXT,
  image_url TEXT,
  unit_label TEXT,
  quantity NUMERIC(20, 4) NOT NULL DEFAULT 1,
  unit_price NUMERIC(20, 2) NOT NULL DEFAULT 0,
  compare_price NUMERIC(20, 2) NOT NULL DEFAULT 0,
  line_subtotal NUMERIC(20, 2) NOT NULL DEFAULT 0,
  line_total NUMERIC(20, 2) NOT NULL DEFAULT 0,
  attributes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ecommerce_order_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.ecommerce_orders(id) ON DELETE CASCADE,
  status public.ecommerce_payment_status NOT NULL DEFAULT 'PENDING_UPLOAD',
  method TEXT NOT NULL DEFAULT 'BANK_TRANSFER',
  proof_storage_key TEXT,
  proof_url TEXT,
  payer_name TEXT,
  payer_bank_name TEXT,
  paid_amount NUMERIC(20, 2),
  paid_at TIMESTAMPTZ,
  reviewer_user_id UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  erp_payment_id UUID REFERENCES public.sales_payments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ecommerce_order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.ecommerce_orders(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id),
  actor_label TEXT,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ecommerce_inventory_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL REFERENCES public.ecommerce_orders(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES public.ecommerce_order_items(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  quantity NUMERIC(20, 4) NOT NULL CHECK (quantity > 0),
  status public.ecommerce_reservation_status NOT NULL DEFAULT 'ACTIVE',
  reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consumed_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stores_org_active
  ON public.stores(org_id, is_active, is_published);
CREATE INDEX IF NOT EXISTS idx_store_domains_store_status
  ON public.store_domains(store_id, status, is_primary);
CREATE INDEX IF NOT EXISTS idx_store_products_store_publish
  ON public.store_products(store_id, is_published, sort_order);
CREATE INDEX IF NOT EXISTS idx_store_variant_overrides_store_publish
  ON public.store_variant_overrides(store_id, is_published, sort_order);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_active
  ON public.product_variants(product_id, is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_ecommerce_orders_store_date
  ON public.ecommerce_orders(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ecommerce_orders_status_date
  ON public.ecommerce_orders(org_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ecommerce_order_items_order
  ON public.ecommerce_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_ecommerce_order_payments_order_status
  ON public.ecommerce_order_payments(order_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ecommerce_inventory_reservations_lookup
  ON public.ecommerce_inventory_reservations(org_id, warehouse_id, product_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_store_theme_versions_single_draft
  ON public.store_theme_versions(store_id)
  WHERE status = 'DRAFT';
CREATE UNIQUE INDEX IF NOT EXISTS idx_store_theme_versions_single_published
  ON public.store_theme_versions(store_id)
  WHERE status = 'PUBLISHED';

CREATE OR REPLACE FUNCTION public.validate_store_context()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_branch_org_id UUID;
  v_warehouse_org_id UUID;
  v_warehouse_branch_id UUID;
  v_bank_org_id UUID;
  v_bank_branch_id UUID;
BEGIN
  SELECT org_id INTO v_branch_org_id
  FROM public.branches
  WHERE id = NEW.branch_id;

  IF v_branch_org_id IS DISTINCT FROM NEW.org_id THEN
    RAISE EXCEPTION 'Cabang store tidak valid untuk organisasi %', NEW.org_id;
  END IF;

  SELECT org_id, branch_id
  INTO v_warehouse_org_id, v_warehouse_branch_id
  FROM public.warehouses
  WHERE id = NEW.warehouse_id;

  IF v_warehouse_org_id IS DISTINCT FROM NEW.org_id THEN
    RAISE EXCEPTION 'Gudang store tidak valid untuk organisasi %', NEW.org_id;
  END IF;

  IF v_warehouse_branch_id IS NOT NULL AND v_warehouse_branch_id IS DISTINCT FROM NEW.branch_id THEN
    RAISE EXCEPTION 'Gudang store harus berada pada unit yang sama.';
  END IF;

  SELECT org_id, branch_id
  INTO v_bank_org_id, v_bank_branch_id
  FROM public.bank_accounts
  WHERE id = NEW.bank_account_id;

  IF v_bank_org_id IS DISTINCT FROM NEW.org_id THEN
    RAISE EXCEPTION 'Rekening penerima tidak valid untuk organisasi %', NEW.org_id;
  END IF;

  IF v_bank_branch_id IS NOT NULL AND v_bank_branch_id IS DISTINCT FROM NEW.branch_id THEN
    RAISE EXCEPTION 'Rekening penerima harus berada pada unit yang sama.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stores_validate_context ON public.stores;
CREATE TRIGGER trg_stores_validate_context
  BEFORE INSERT OR UPDATE OF org_id, branch_id, warehouse_id, bank_account_id
  ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_store_context();

CREATE OR REPLACE FUNCTION public.set_ecommerce_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INT;
BEGIN
  IF NEW.order_number IS NULL OR BTRIM(NEW.order_number) = '' THEN
    SELECT COUNT(*) + 1
    INTO v_count
    FROM public.ecommerce_orders
    WHERE org_id = NEW.org_id
      AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());

    NEW.order_number := 'ECO-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(v_count::TEXT, 6, '0');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_ecommerce_order_number ON public.ecommerce_orders;
CREATE TRIGGER trg_set_ecommerce_order_number
  BEFORE INSERT ON public.ecommerce_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_ecommerce_order_number();

DROP TRIGGER IF EXISTS trg_stores_updated_at ON public.stores;
CREATE TRIGGER trg_stores_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_store_settings_updated_at ON public.store_settings;
CREATE TRIGGER trg_store_settings_updated_at
  BEFORE UPDATE ON public.store_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_store_shipping_zones_updated_at ON public.store_shipping_zones;
CREATE TRIGGER trg_store_shipping_zones_updated_at
  BEFORE UPDATE ON public.store_shipping_zones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_store_shipping_rates_updated_at ON public.store_shipping_rates;
CREATE TRIGGER trg_store_shipping_rates_updated_at
  BEFORE UPDATE ON public.store_shipping_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_product_attributes_updated_at ON public.product_attributes;
CREATE TRIGGER trg_product_attributes_updated_at
  BEFORE UPDATE ON public.product_attributes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_product_attribute_values_updated_at ON public.product_attribute_values;
CREATE TRIGGER trg_product_attribute_values_updated_at
  BEFORE UPDATE ON public.product_attribute_values
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_product_variants_updated_at ON public.product_variants;
CREATE TRIGGER trg_product_variants_updated_at
  BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_store_products_updated_at ON public.store_products;
CREATE TRIGGER trg_store_products_updated_at
  BEFORE UPDATE ON public.store_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_store_variant_overrides_updated_at ON public.store_variant_overrides;
CREATE TRIGGER trg_store_variant_overrides_updated_at
  BEFORE UPDATE ON public.store_variant_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_ecommerce_product_media_updated_at ON public.ecommerce_product_media;
CREATE TRIGGER trg_ecommerce_product_media_updated_at
  BEFORE UPDATE ON public.ecommerce_product_media
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_store_theme_templates_updated_at ON public.store_theme_templates;
CREATE TRIGGER trg_store_theme_templates_updated_at
  BEFORE UPDATE ON public.store_theme_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_store_theme_versions_updated_at ON public.store_theme_versions;
CREATE TRIGGER trg_store_theme_versions_updated_at
  BEFORE UPDATE ON public.store_theme_versions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_store_theme_assets_updated_at ON public.store_theme_assets;
CREATE TRIGGER trg_store_theme_assets_updated_at
  BEFORE UPDATE ON public.store_theme_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_ecommerce_orders_updated_at ON public.ecommerce_orders;
CREATE TRIGGER trg_ecommerce_orders_updated_at
  BEFORE UPDATE ON public.ecommerce_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_ecommerce_order_items_updated_at ON public.ecommerce_order_items;
CREATE TRIGGER trg_ecommerce_order_items_updated_at
  BEFORE UPDATE ON public.ecommerce_order_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_ecommerce_order_payments_updated_at ON public.ecommerce_order_payments;
CREATE TRIGGER trg_ecommerce_order_payments_updated_at
  BEFORE UPDATE ON public.ecommerce_order_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_ecommerce_inventory_reservations_updated_at ON public.ecommerce_inventory_reservations;
CREATE TRIGGER trg_ecommerce_inventory_reservations_updated_at
  BEFORE UPDATE ON public.ecommerce_inventory_reservations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_shipping_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_shipping_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_attribute_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variant_attribute_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_variant_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ecommerce_product_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_theme_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_theme_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_theme_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ecommerce_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ecommerce_order_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ecommerce_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ecommerce_order_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ecommerce_order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ecommerce_inventory_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_can_view_stores" ON public.stores;
CREATE POLICY "members_can_view_stores"
  ON public.stores FOR SELECT
  USING (org_id IN (SELECT public.get_my_org_ids()));

DROP POLICY IF EXISTS "members_manage_stores" ON public.stores;
CREATE POLICY "members_manage_stores"
  ON public.stores FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
        AND is_active = TRUE
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
        AND is_active = TRUE
    )
  );

DROP POLICY IF EXISTS "members_view_store_domains" ON public.store_domains;
CREATE POLICY "members_view_store_domains"
  ON public.store_domains FOR SELECT
  USING (org_id IN (SELECT public.get_my_org_ids()));

DROP POLICY IF EXISTS "members_manage_store_domains" ON public.store_domains;
CREATE POLICY "members_manage_store_domains"
  ON public.store_domains FOR ALL
  USING (org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
      AND is_active = TRUE
  ))
  WITH CHECK (org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
      AND is_active = TRUE
  ));

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOR table_name IN
    SELECT unnest(ARRAY[
      'store_settings',
      'store_shipping_zones',
      'store_shipping_rates',
      'product_attributes',
      'product_attribute_values',
      'product_variants',
      'product_variant_attribute_values',
      'store_products',
      'store_variant_overrides',
      'ecommerce_product_media',
      'store_theme_versions',
      'store_theme_assets',
      'ecommerce_orders',
      'ecommerce_order_addresses',
      'ecommerce_order_items',
      'ecommerce_order_payments',
      'ecommerce_order_events',
      'ecommerce_inventory_reservations'
    ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_members_select" ON public.%I', table_name, table_name);
    EXECUTE format(
      'CREATE POLICY "%s_members_select" ON public.%I FOR SELECT USING (org_id IN (SELECT public.get_my_org_ids()))',
      table_name,
      table_name
    );

    EXECUTE format('DROP POLICY IF EXISTS "%s_members_manage" ON public.%I', table_name, table_name);
    EXECUTE format(
      $policy$
      CREATE POLICY "%1$s_members_manage" ON public.%2$I FOR ALL
      USING (
        org_id IN (
          SELECT org_id FROM public.org_members
          WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin', 'manager', 'staff')
            AND is_active = TRUE
        )
      )
      WITH CHECK (
        org_id IN (
          SELECT org_id FROM public.org_members
          WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin', 'manager', 'staff')
            AND is_active = TRUE
        )
      )
      $policy$,
      table_name,
      table_name
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS "store_theme_templates_public_select" ON public.store_theme_templates;
CREATE POLICY "store_theme_templates_public_select"
  ON public.store_theme_templates FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "store_theme_templates_members_manage" ON public.store_theme_templates;
CREATE POLICY "store_theme_templates_members_manage"
  ON public.store_theme_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.org_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
        AND is_active = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.org_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
        AND is_active = TRUE
    )
  );

NOTIFY pgrst, 'reload schema';
