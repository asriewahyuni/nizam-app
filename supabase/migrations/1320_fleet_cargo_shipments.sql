-- 1320_fleet_cargo_shipments.sql

DO $$ BEGIN
  CREATE TYPE public.cargo_status AS ENUM (
    'DRAFT', 'MANIFESTED', 'IN_TRANSIT', 'ARRIVED', 'DELIVERED', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.cargo_payment_status AS ENUM ('UNPAID', 'PAID');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.fleet_cargo_shipments (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id               UUID REFERENCES public.branches(id) ON DELETE SET NULL,

  tracking_number         TEXT NOT NULL,

  sender_name             TEXT NOT NULL,
  sender_phone            TEXT NOT NULL,

  receiver_name           TEXT NOT NULL,
  receiver_phone          TEXT NOT NULL,

  origin_terminal_id      UUID NOT NULL REFERENCES public.fleet_terminals(id),
  destination_terminal_id UUID NOT NULL REFERENCES public.fleet_terminals(id),

  item_description        TEXT,
  weight_kg               NUMERIC(10, 2) DEFAULT 0,
  volume_m3               NUMERIC(10, 2) DEFAULT 0,

  shipping_cost           NUMERIC(20, 2) NOT NULL DEFAULT 0,
  handling_fee            NUMERIC(20, 2) NOT NULL DEFAULT 0,
  grand_total             NUMERIC(20, 2) NOT NULL DEFAULT 0,

  payment_status          public.cargo_payment_status NOT NULL DEFAULT 'UNPAID',
  payment_method          TEXT DEFAULT 'CASH',

  schedule_id             UUID REFERENCES public.fleet_schedules(id) ON DELETE SET NULL,
  status                  public.cargo_status NOT NULL DEFAULT 'DRAFT',

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (org_id, tracking_number)
);

CREATE INDEX IF NOT EXISTS idx_cargo_shipments_org      ON public.fleet_cargo_shipments(org_id);
CREATE INDEX IF NOT EXISTS idx_cargo_shipments_schedule ON public.fleet_cargo_shipments(schedule_id);
CREATE INDEX IF NOT EXISTS idx_cargo_shipments_tracking ON public.fleet_cargo_shipments(tracking_number);

NOTIFY pgrst, 'reload schema';
