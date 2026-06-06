-- 1341_cargo_tariff_use_pools.sql

ALTER TABLE public.fleet_cargo_tariffs
  ADD COLUMN IF NOT EXISTS origin_pool_id UUID REFERENCES public.bus_pools(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS destination_pool_id UUID REFERENCES public.bus_pools(id) ON DELETE CASCADE;

-- Drop NOT NULL jika kolom terminal masih ada (migrasi lama mungkin sudah nullable)
DO $$ BEGIN
  ALTER TABLE public.fleet_cargo_tariffs ALTER COLUMN origin_terminal_id DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.fleet_cargo_tariffs ALTER COLUMN destination_terminal_id DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- Hapus unique constraint lama berbasis terminal (jika ada)
ALTER TABLE public.fleet_cargo_tariffs
  DROP CONSTRAINT IF EXISTS fleet_cargo_tariffs_org_id_origin_terminal_id_destinatio_key;

-- Tambah unique constraint baru berbasis pool
DO $$ BEGIN
  ALTER TABLE public.fleet_cargo_tariffs
    ADD CONSTRAINT fleet_cargo_tariffs_org_id_origin_pool_id_destination_po_key
    UNIQUE (org_id, origin_pool_id, destination_pool_id);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;
