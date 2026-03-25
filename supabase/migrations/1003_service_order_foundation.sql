-- ==========================================
-- SCRIPT 044: NIZAM SERVICE & JOB ORDER FOUNDATION
-- ==========================================
-- This script adds Job Order (SPK Jasa) infrastructure.

CREATE TYPE service_job_status AS ENUM ('PENDING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED');

CREATE TABLE IF NOT EXISTS public.service_orders (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id      UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE, -- The Customer
    job_number      TEXT NOT NULL,
    description     TEXT NOT NULL,
    status          service_job_status NOT NULL DEFAULT 'PENDING',
    start_date      DATE,
    end_date        DATE,
    assigned_to     UUID REFERENCES auth.users(id), -- The Staff
    estimated_cost  NUMERIC(20, 2) DEFAULT 0,
    actual_cost     NUMERIC(20, 2) DEFAULT 0,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(org_id, job_number)
);

-- RLS
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_can_view_service_orders" ON public.service_orders FOR SELECT 
USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE));

CREATE POLICY "admins_can_manage_service_orders" ON public.service_orders FOR ALL 
USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager') AND is_active = TRUE));
