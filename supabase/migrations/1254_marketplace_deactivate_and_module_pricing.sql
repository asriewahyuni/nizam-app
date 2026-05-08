-- Migration: 1254_marketplace_deactivate_and_module_pricing.sql
-- Dua tujuan:
--   1. Support status DISABLED di org_module_instances
--   2. Kolom operational_prices di saas_packages untuk harga per modul operasional

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Fix constraint status di org_module_instances (add DISABLED)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.org_module_instances
  DROP CONSTRAINT IF EXISTS org_module_instances_status_check;

ALTER TABLE public.org_module_instances
  ADD CONSTRAINT org_module_instances_status_check
  CHECK (status IN ('PENDING', 'ONBOARDING', 'READY', 'DISABLED'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RPC: remove_enabled_module (safe idempotent)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.remove_enabled_module(p_org_id UUID, p_module_key TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.organizations
  SET enabled_modules = array_remove(COALESCE(enabled_modules, '{}'), p_module_key)
  WHERE id = p_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RPC: append_enabled_module (safe idempotent — buat ulang di sini juga)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.append_enabled_module(p_org_id UUID, p_module_key TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.organizations
  SET enabled_modules = array_append(
    COALESCE(enabled_modules, '{}'),
    p_module_key
  )
  WHERE id = p_org_id
    AND NOT (p_module_key = ANY(COALESCE(enabled_modules, '{}')));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Tambah kolom operational_prices di saas_packages
--    Format: { "LMS": 250000, "Fleet & Rental": 300000, ... }
--    Nilai dalam Rupiah per bulan (atau sesuai billing cycle paket).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.saas_packages
  ADD COLUMN IF NOT EXISTS operational_prices JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.saas_packages.operational_prices IS
  'Harga per modul operasional dalam Rupiah. Format: {"LMS": 250000, "Fleet & Rental": 300000}. Diset oleh admin SaaS.';

NOTIFY pgrst, 'reload schema';
