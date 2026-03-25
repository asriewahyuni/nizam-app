-- ============================================================
-- MIGRATION 011: NIZAM ERP CORE - Audit, Approval, & Warehouse
-- Phase 1: Governance & Physical Infrastructure
-- ============================================================

-- 1. AUDIT LOGS: The Forensic Log
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES auth.users(id),
    action          TEXT NOT NULL,                    -- 'CREATE', 'UPDATE', 'DELETE', 'VOID', 'POST'
    table_name      TEXT NOT NULL,
    record_id       UUID NOT NULL,
    old_data        JSONB,
    new_data        JSONB,
    ip_address      TEXT,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_org_id ON public.audit_logs(org_id);
CREATE INDEX idx_audit_logs_table_record ON public.audit_logs(table_name, record_id);

-- 2. APPROVAL SYSTEM: The Central Command
CREATE TYPE approval_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE IF NOT EXISTS public.approval_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    requester_id    UUID NOT NULL REFERENCES auth.users(id),
    approver_id     UUID REFERENCES auth.users(id),   -- Final decision by specialized role
    source_type     TEXT NOT NULL,                    -- 'PURCHASE_ORDER', 'SALES_DISCOUNT', 'LEAVE_REQUEST'
    source_id       UUID NOT NULL,                    -- Reference to the actual table
    status          approval_status NOT NULL DEFAULT 'PENDING',
    reason          TEXT,                             -- Reason for request
    notes           TEXT,                             -- Comments from approver
    requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at      TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_approvals_org_status ON public.approval_requests(org_id, status);

-- 3. WAREHOUSE MANAGEMENT (WMS): Multi-location Physics
CREATE TABLE IF NOT EXISTS public.warehouses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code            TEXT NOT NULL,                    -- e.g. 'JKT-01'
    name            TEXT NOT NULL,                    -- e.g. 'Gudang Utama Jakarta'
    address         TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(org_id, code)
);

CREATE INDEX idx_warehouses_org_id ON public.warehouses(org_id);

-- 4. INVENTORY STOCK: Track Physical Location
CREATE TABLE IF NOT EXISTS public.inventory_stocks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id    UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    quantity        NUMERIC(20, 4) NOT NULL DEFAULT 0,
    batch_number    TEXT,
    expiry_date     DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(product_id, warehouse_id, batch_number)
);

CREATE INDEX idx_inv_stocks_product_warehouse ON public.inventory_stocks(product_id, warehouse_id);

-- ─────────────────────────────────────────────────────────────
-- RLS POLICIES
-- ─────────────────────────────────────────────────────────────

-- Audit Logs (Only Managers can view)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "managers_can_view_audit" ON public.audit_logs FOR SELECT 
USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager') AND is_active = TRUE));

-- Approval Requests (All members can view their own, managers view all)
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_can_view_relevant_approvals" ON public.approval_requests FOR SELECT 
USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE));

CREATE POLICY "members_can_create_approvals" ON public.approval_requests FOR INSERT 
WITH CHECK (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE));

-- Warehouses
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_can_view_warehouses" ON public.warehouses FOR SELECT 
USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE));

CREATE POLICY "admins_can_manage_warehouses" ON public.warehouses FOR ALL 
USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager') AND is_active = TRUE));
