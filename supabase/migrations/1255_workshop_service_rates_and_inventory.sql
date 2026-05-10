-- Migration: 1255_workshop_service_rates_and_inventory.sql
-- Menambahkan:
-- 1. Tarif jasa bengkel (workshop_service_rates)
-- 2. Link produk/inventori di item SPK (product_id)

-- 1. Tambah product_id dan org_id ke workshop_work_order_items
ALTER TABLE public.workshop_work_order_items
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 2. Tabel tarif jasa bengkel
CREATE TABLE IF NOT EXISTS public.workshop_service_rates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  unit_price  NUMERIC NOT NULL DEFAULT 0,
  category    TEXT DEFAULT 'UMUM',
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.workshop_service_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org access service rates" ON public.workshop_service_rates;
CREATE POLICY "org access service rates"
  ON public.workshop_service_rates
  USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_workshop_service_rates_org ON public.workshop_service_rates(org_id);

NOTIFY pgrst, 'reload schema';
