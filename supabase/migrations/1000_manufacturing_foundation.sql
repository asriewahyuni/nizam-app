-- ==========================================
-- SCRIPT 041: NIZAM MANUFACTURING FOUNDATION
-- ==========================================
-- This script adds Bill of Materials (BoM) and Work Order (SPK) infrastructure.

-- 1. Bill of Materials (BoM)
CREATE TABLE IF NOT EXISTS public.production_boms (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE, -- The Finished Good
    code            TEXT NOT NULL,
    description     TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(org_id, code)
);

-- 2. BoM Items (The Ingredients)
CREATE TABLE IF NOT EXISTS public.production_bom_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bom_id          UUID NOT NULL REFERENCES production_boms(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE, -- The Raw Material
    quantity        NUMERIC(20, 4) NOT NULL DEFAULT 1,
    unit            TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Work Orders (The Process / SPK)
CREATE TABLE IF NOT EXISTS public.production_work_orders (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    bom_id          UUID NOT NULL REFERENCES production_boms(id) ON DELETE CASCADE,
    wo_number       TEXT NOT NULL,
    quantity_planned NUMERIC(20, 4) NOT NULL DEFAULT 1,
    quantity_actual  NUMERIC(20, 4) DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'RELEASED', 'COMPLETED', 'CANCELLED'
    released_at     TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(org_id, wo_number)
);

-- Enable RLS
ALTER TABLE public.production_boms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_bom_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_work_orders ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "members_can_view_production" ON public.production_boms FOR SELECT 
USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE));

CREATE POLICY "members_can_view_bom_items" ON public.production_bom_items FOR SELECT 
USING (bom_id IN (SELECT id FROM production_boms WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE)));

CREATE POLICY "members_can_view_wo" ON public.production_work_orders FOR SELECT 
USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE));

-- Crud Access for production
CREATE POLICY "admins_can_manage_production" ON public.production_boms FOR ALL 
USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager') AND is_active = TRUE));

CREATE POLICY "admins_can_manage_bom_items" ON public.production_bom_items FOR ALL 
USING (bom_id IN (SELECT id FROM production_boms WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager') AND is_active = TRUE)));

CREATE POLICY "admins_can_manage_wo" ON public.production_work_orders FOR ALL 
USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager') AND is_active = TRUE));

-- Indexes
CREATE INDEX idx_boms_product ON public.production_boms(product_id);
CREATE INDEX idx_wo_status ON public.production_work_orders(org_id, status);
