-- ==========================================
-- SCRIPT 043: NIZAM FLEET & RENTAL FOUNDATION
-- ==========================================
-- This script adds Vehicle Management and Booking infrastructure.

-- 1. FLEET ASSETS (The Units)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fleet_type') THEN
        CREATE TYPE fleet_type AS ENUM ('CAR', 'MOTORBIKE', 'BUS', 'TRUCK', 'OTHER');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fleet_status') THEN
        CREATE TYPE fleet_status AS ENUM ('AVAILABLE', 'RENTED', 'MAINTENANCE', 'OUT_OF_SERVICE');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.fleet_assets (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plate_number    TEXT NOT NULL,
    model           TEXT NOT NULL, -- e.g. Toyota Avanza
    brand           TEXT,          -- e.g. Toyota
    type            fleet_type NOT NULL DEFAULT 'CAR',
    status          fleet_status NOT NULL DEFAULT 'AVAILABLE',
    odometer        NUMERIC(20, 2) DEFAULT 0,
    daily_rate      NUMERIC(20, 2) DEFAULT 0,
    notes           TEXT,
    metadata        JSONB, -- Extra info like color, year, etc.
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(org_id, plate_number)
);

-- 2. FLEET BOOKINGS (The Rental Transactions)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
        CREATE TYPE booking_status AS ENUM ('RESERVED', 'ACTIVE', 'COMPLETED', 'CANCELLED');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.fleet_bookings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    asset_id        UUID NOT NULL REFERENCES fleet_assets(id) ON DELETE CASCADE,
    contact_id      UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE, -- The Customer
    start_date      TIMESTAMPTZ NOT NULL,
    end_date        TIMESTAMPTZ NOT NULL,
    status          booking_status NOT NULL DEFAULT 'RESERVED',
    total_amount    NUMERIC(20, 2) NOT NULL DEFAULT 0,
    deposit         NUMERIC(20, 2) DEFAULT 0,
    payment_status  TEXT DEFAULT 'UNPAID', -- 'UNPAID', 'PARTIAL', 'PAID'
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. FLEET MAINTENANCE (Service Logs)
CREATE TABLE IF NOT EXISTS public.fleet_maintenance_labs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    asset_id        UUID NOT NULL REFERENCES fleet_assets(id) ON DELETE CASCADE,
    service_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    description     TEXT NOT NULL,
    cost            NUMERIC(20, 2) NOT NULL DEFAULT 0,
    odometer_at     NUMERIC(20, 2),
    next_service_km NUMERIC(20, 2),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.fleet_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_maintenance_labs ENABLE ROW LEVEL SECURITY;

-- Policies (Idempotent)
DROP POLICY IF EXISTS "members_can_view_fleet" ON public.fleet_assets;
CREATE POLICY "members_can_view_fleet" ON public.fleet_assets FOR SELECT 
USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE));

DROP POLICY IF EXISTS "members_can_view_bookings" ON public.fleet_bookings;
CREATE POLICY "members_can_view_bookings" ON public.fleet_bookings FOR SELECT 
USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE));

DROP POLICY IF EXISTS "admins_can_manage_fleet" ON public.fleet_assets;
CREATE POLICY "admins_can_manage_fleet" ON public.fleet_assets FOR ALL 
USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager') AND is_active = TRUE));

DROP POLICY IF EXISTS "admins_can_manage_bookings" ON public.fleet_bookings;
CREATE POLICY "admins_can_manage_bookings" ON public.fleet_bookings FOR ALL 
USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager') AND is_active = TRUE));
