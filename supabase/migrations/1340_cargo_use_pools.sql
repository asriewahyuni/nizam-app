-- 1340_cargo_use_pools.sql
-- Add origin_pool_id and destination_pool_id to fleet_cargo_shipments
-- Make origin_terminal_id and destination_terminal_id nullable

ALTER TABLE public.fleet_cargo_shipments
  ADD COLUMN IF NOT EXISTS origin_pool_id UUID REFERENCES public.bus_pools(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS destination_pool_id UUID REFERENCES public.bus_pools(id) ON DELETE SET NULL;

ALTER TABLE public.fleet_cargo_shipments
  ALTER COLUMN origin_terminal_id DROP NOT NULL,
  ALTER COLUMN destination_terminal_id DROP NOT NULL;

-- Optional: populate pool_id from terminal_id if there is a 1:1 mapping (best effort)
-- Find the first pool associated with the terminal and assign it.
UPDATE public.fleet_cargo_shipments s
SET origin_pool_id = (
  SELECT p.id FROM public.bus_pools p WHERE p.terminal_id = s.origin_terminal_id LIMIT 1
)
WHERE s.origin_pool_id IS NULL AND s.origin_terminal_id IS NOT NULL;

UPDATE public.fleet_cargo_shipments s
SET destination_pool_id = (
  SELECT p.id FROM public.bus_pools p WHERE p.terminal_id = s.destination_terminal_id LIMIT 1
)
WHERE s.destination_pool_id IS NULL AND s.destination_terminal_id IS NOT NULL;

COMMENT ON COLUMN public.fleet_cargo_shipments.origin_pool_id IS 'Mendukung Anti-Silo: kargo berangkat dari Pool/Agen spesifik';
COMMENT ON COLUMN public.fleet_cargo_shipments.destination_pool_id IS 'Mendukung Anti-Silo: kargo tiba di Pool/Agen spesifik';
