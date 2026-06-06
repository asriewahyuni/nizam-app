-- 1341_cargo_tariff_use_pools.sql

ALTER TABLE public.fleet_cargo_tariffs
  ADD COLUMN IF NOT EXISTS origin_pool_id UUID REFERENCES public.bus_pools(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS destination_pool_id UUID REFERENCES public.bus_pools(id) ON DELETE CASCADE;

ALTER TABLE public.fleet_cargo_tariffs
  ALTER COLUMN origin_terminal_id DROP NOT NULL,
  ALTER COLUMN destination_terminal_id DROP NOT NULL;

-- Remove old unique constraint that depended on terminal ids
ALTER TABLE public.fleet_cargo_tariffs
  DROP CONSTRAINT IF EXISTS fleet_cargo_tariffs_org_id_origin_terminal_id_destinatio_key;

-- Add new unique constraint for pools
ALTER TABLE public.fleet_cargo_tariffs
  ADD CONSTRAINT fleet_cargo_tariffs_org_id_origin_pool_id_destination_po_key UNIQUE (org_id, origin_pool_id, destination_pool_id);

COMMENT ON COLUMN public.fleet_cargo_tariffs.origin_pool_id IS 'Mendukung Anti-Silo: Tarif berdasarkan Pool/Agen';
COMMENT ON COLUMN public.fleet_cargo_tariffs.destination_pool_id IS 'Mendukung Anti-Silo: Tarif berdasarkan Pool/Agen';
