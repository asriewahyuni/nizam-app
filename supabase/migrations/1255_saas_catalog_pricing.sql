-- Migration: 1255_saas_catalog_pricing.sql

ALTER TABLE public.saas_packages
  ADD COLUMN IF NOT EXISTS core_prices JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS addon_prices JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.saas_packages.core_prices IS 'Harga per modul inti dalam Rupiah.';
COMMENT ON COLUMN public.saas_packages.addon_prices IS 'Harga per addon dalam Rupiah.';

NOTIFY pgrst, 'reload schema';
