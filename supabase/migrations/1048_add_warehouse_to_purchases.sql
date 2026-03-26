-- Migration 1048: Add warehouse support to Purchasing
-- Fixes the sync between Purchases and Physical Inventory (WMS)

-- 1. Add column to purchases table
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id);

-- 2. Update existing purchases to use the first available warehouse for that org (best effort)
DO $$
DECLARE
    r RECORD;
    v_wh_id UUID;
BEGIN
    FOR r IN SELECT id, org_id FROM purchases WHERE warehouse_id IS NULL LOOP
        SELECT id INTO v_wh_id FROM warehouses WHERE org_id = r.org_id LIMIT 1;
        IF v_wh_id IS NOT NULL THEN
            UPDATE purchases SET warehouse_id = v_wh_id WHERE id = r.id;
        END IF;
    END LOOP;
END $$;
