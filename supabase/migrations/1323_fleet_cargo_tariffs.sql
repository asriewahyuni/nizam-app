-- Migration 1323: Fleet Cargo Tariffs
-- Tabel tarif pengiriman kargo antar terminal/pool bus.
-- Migration 1341 menambah origin_pool_id / destination_pool_id.

CREATE TABLE IF NOT EXISTS public.fleet_cargo_tariffs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  origin_terminal_id      UUID REFERENCES public.fleet_terminals(id) ON DELETE SET NULL,
  destination_terminal_id UUID REFERENCES public.fleet_terminals(id) ON DELETE SET NULL,

  base_price              NUMERIC(20, 2) NOT NULL DEFAULT 0,
  price_per_kg            NUMERIC(20, 2) NOT NULL DEFAULT 0,
  price_per_m3            NUMERIC(20, 2) NOT NULL DEFAULT 0,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fleet_cargo_tariffs_org_id
  ON public.fleet_cargo_tariffs(org_id);
