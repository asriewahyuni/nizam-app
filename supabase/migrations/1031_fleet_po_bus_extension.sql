-- Migration 1031: PO BUS Specific Extension
-- This script adds Route, Schedule, and Ticketing infrastructure for Bus Operators.

-- 1. CAPACITY for Assets (Seats)
DO $$ 
BEGIN
    -- Only run ALTER if table exists AND column doesn't
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fleet_assets') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fleet_assets' AND column_name = 'capacity') THEN
            ALTER TABLE public.fleet_assets ADD COLUMN capacity INTEGER DEFAULT 40;
        END IF;
    END IF;
END $$;

-- 2. ROUTES
CREATE TABLE IF NOT EXISTS public.fleet_routes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL, -- e.g. "Jakarta - Bandung (Cipularang)"
    origin          TEXT NOT NULL,
    destination     TEXT NOT NULL,
    distance_km     NUMERIC(10, 2),
    base_price      NUMERIC(20, 2) DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. SCHEDULES (Keberangkatan)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'schedule_status') THEN
        CREATE TYPE schedule_status AS ENUM ('SCHEDULED', 'DEPARTED', 'ARRIVED', 'CANCELLED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_status') THEN
        CREATE TYPE ticket_status AS ENUM ('BOOKED', 'PAID', 'USED', 'CANCELLED');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.fleet_schedules (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    route_id        UUID NOT NULL REFERENCES fleet_routes(id) ON DELETE CASCADE,
    asset_id        UUID NOT NULL REFERENCES fleet_assets(id) ON DELETE CASCADE,
    driver_id       UUID REFERENCES contacts(id) ON DELETE SET NULL, -- Driver
    departure_time  TIMESTAMPTZ NOT NULL,
    arrival_time    TIMESTAMPTZ,
    status          schedule_status NOT NULL DEFAULT 'SCHEDULED',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. TICKETS

CREATE TABLE IF NOT EXISTS public.fleet_tickets (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    schedule_id     UUID NOT NULL REFERENCES fleet_schedules(id) ON DELETE CASCADE,
    passenger_id    UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    seat_number     TEXT NOT NULL,
    price           NUMERIC(20, 2) NOT NULL DEFAULT 0,
    status          ticket_status NOT NULL DEFAULT 'BOOKED',
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.fleet_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_tickets ENABLE ROW LEVEL SECURITY;

-- Policies (Idempotent)
DROP POLICY IF EXISTS "members_view_routes" ON public.fleet_routes;
CREATE POLICY "members_view_routes" ON public.fleet_routes FOR SELECT USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE));

DROP POLICY IF EXISTS "members_view_schedules" ON public.fleet_schedules;
CREATE POLICY "members_view_schedules" ON public.fleet_schedules FOR SELECT USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE));

DROP POLICY IF EXISTS "members_view_tickets" ON public.fleet_tickets;
CREATE POLICY "members_view_tickets" ON public.fleet_tickets FOR SELECT USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE));

DROP POLICY IF EXISTS "admins_manage_routes" ON public.fleet_routes;
CREATE POLICY "admins_manage_routes" ON public.fleet_routes FOR ALL USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager') AND is_active = TRUE));

DROP POLICY IF EXISTS "admins_manage_schedules" ON public.fleet_schedules;
CREATE POLICY "admins_manage_schedules" ON public.fleet_schedules FOR ALL USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager') AND is_active = TRUE));

DROP POLICY IF EXISTS "admins_manage_tickets" ON public.fleet_tickets;
CREATE POLICY "admins_manage_tickets" ON public.fleet_tickets FOR ALL USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager') AND is_active = TRUE));
