-- Migration 1342: SaaS Custom Modules Catalog
-- Memungkinkan SaaS operator mendaftarkan modul baru secara dinamis
-- tanpa harus mengubah kode module-catalog.ts.

CREATE TABLE IF NOT EXISTS public.saas_custom_modules (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identitas modul
  module_key           TEXT NOT NULL UNIQUE,
  name                 TEXT NOT NULL,
  tagline              TEXT NOT NULL DEFAULT '',
  description          TEXT NOT NULL DEFAULT '',

  -- Klasifikasi
  kind                 TEXT NOT NULL DEFAULT 'vertical_module'
                       CHECK (kind IN ('vertical_module', 'addon', 'platform_core')),
  required_core_family TEXT NOT NULL DEFAULT 'lite'
                       CHECK (required_core_family IN ('lite', 'starter', 'full')),

  -- Harga default (bisa di-override per paket)
  default_price        NUMERIC(20, 2) NOT NULL DEFAULT 0,

  -- Tampilan
  icon_name            TEXT NOT NULL DEFAULT 'Package',

  -- Dependensi (module_key lain yang harus aktif dulu)
  dependencies         TEXT[] NOT NULL DEFAULT '{}',

  -- Versioning
  version              TEXT NOT NULL DEFAULT '1.0.0',
  changelog            TEXT,

  -- Status
  is_active            BOOLEAN NOT NULL DEFAULT true,

  created_by           UUID REFERENCES public.internal_auth_users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saas_custom_modules_active
  ON public.saas_custom_modules(is_active, kind);
