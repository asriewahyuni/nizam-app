-- ==========================================
-- SCRIPT 1046: SMART ATTENDANCE (GPS + QR)
-- ==========================================

-- 1. Extend Attendance table with GPS and Metadata
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS location_gps TEXT; 
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS qr_scanned_payload TEXT; 
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'::jsonb; 

-- 2. Add Terminal / Station Locations for Geofencing
CREATE TABLE IF NOT EXISTS public.fleet_terminals (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    location_name   TEXT,
    gps_coords      TEXT, -- "lat,long" center point
    radius_meters   INTEGER DEFAULT 200, 
    qr_code_token   TEXT UNIQUE, 
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for Terminals
ALTER TABLE public.fleet_terminals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_view_terminals" ON public.fleet_terminals;
CREATE POLICY "members_view_terminals" ON public.fleet_terminals FOR SELECT USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE));

DROP POLICY IF EXISTS "admins_manage_terminals" ON public.fleet_terminals;
CREATE POLICY "admins_manage_terminals" ON public.fleet_terminals FOR ALL USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager') AND is_active = TRUE));
