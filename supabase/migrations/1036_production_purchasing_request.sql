-- ============================================================
-- MIGRATION 1036: Production to Purchasing Request
-- Adds ability for manufacturing to request materials from purchasing
-- ============================================================

-- 1. Enum: Purchase Request Status
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pr_status') THEN
        CREATE TYPE pr_status AS ENUM ('PENDING', 'ORDERED', 'RECEIVED', 'REJECTED', 'CANCELLED');
    END IF; 
END $$;

-- 2. Table: purchase_requests
CREATE TABLE IF NOT EXISTS public.purchase_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    request_number  TEXT NOT NULL,         -- PR-2024-000001
    requester_id    UUID NOT NULL REFERENCES auth.users(id),
    product_id      UUID REFERENCES products(id), -- Nullable if it's a new product name
    product_name    TEXT NOT NULL,         -- Stored directly for visibility
    quantity        NUMERIC(20, 4) NOT NULL DEFAULT 0,
    unit            TEXT,
    status          pr_status NOT NULL DEFAULT 'PENDING',
    priority        TEXT DEFAULT 'NORMAL', -- 'NORMAL', 'URGENT'
    notes           TEXT,
    source_type     TEXT DEFAULT 'MANUFACTURING', 
    source_id       UUID,                 -- e.g. wo_id
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(org_id, request_number)
);

-- 3. RLS Policies
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_can_view_requests" ON public.purchase_requests;
CREATE POLICY "members_can_view_requests" ON public.purchase_requests FOR SELECT 
USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE));

DROP POLICY IF EXISTS "members_can_create_requests" ON public.purchase_requests;
CREATE POLICY "members_can_create_requests" ON public.purchase_requests FOR INSERT 
WITH CHECK (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE));

DROP POLICY IF EXISTS "members_can_update_requests" ON public.purchase_requests;
CREATE POLICY "members_can_update_requests" ON public.purchase_requests FOR UPDATE
USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE));

-- 4. Trigger for updated_at
DROP TRIGGER IF EXISTS trg_purchase_requests_updated_at ON public.purchase_requests;
CREATE TRIGGER trg_purchase_requests_updated_at
  BEFORE UPDATE ON public.purchase_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. Trigger for request number generation
CREATE OR REPLACE FUNCTION set_request_number()
RETURNS TRIGGER AS $$
DECLARE
  v_count INT;
BEGIN
  IF NEW.request_number IS NULL OR NEW.request_number = '' THEN
    SELECT COUNT(*) + 1 INTO v_count FROM purchase_requests WHERE org_id = NEW.org_id AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
    NEW.request_number = 'PR-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(v_count::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_request_number ON purchase_requests;
CREATE TRIGGER trg_set_request_number
  BEFORE INSERT ON purchase_requests FOR EACH ROW EXECUTE FUNCTION set_request_number();
