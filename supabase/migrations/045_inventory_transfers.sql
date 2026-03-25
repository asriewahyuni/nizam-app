-- ============================================================
-- MIGRATION 045: Inventory Transfers & System Health
-- Handling movements between warehouses
-- ============================================================

-- 1. TRANSFERS TABLE
CREATE TABLE IF NOT EXISTS public.inventory_transfers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    transfer_number TEXT NOT NULL,         -- TRF-2024-000001
    transfer_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    source_wh_id    UUID NOT NULL REFERENCES warehouses(id),
    target_wh_id    UUID NOT NULL REFERENCES warehouses(id),
    notes           TEXT,
    status          document_status NOT NULL DEFAULT 'DRAFT',
    created_by      UUID REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(org_id, transfer_number)
);

CREATE INDEX idx_inv_transfer_org_id ON public.inventory_transfers(org_id);
CREATE INDEX idx_inv_transfer_source_wh ON public.inventory_transfers(source_wh_id);
CREATE INDEX idx_inv_transfer_target_wh ON public.inventory_transfers(target_wh_id);

-- 2. TRANSFER ITEMS
CREATE TABLE IF NOT EXISTS public.inventory_transfer_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    transfer_id     UUID NOT NULL REFERENCES inventory_transfers(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id),
    quantity        NUMERIC(20, 4) NOT NULL,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. AUTO-NUMBER
CREATE OR REPLACE FUNCTION set_transfer_number()
RETURNS TRIGGER AS $$
DECLARE
  v_count INT;
BEGIN
  IF NEW.transfer_number IS NULL OR NEW.transfer_number = '' THEN
    SELECT COUNT(*) + 1 INTO v_count FROM inventory_transfers WHERE org_id = NEW.org_id AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
    NEW.transfer_number = 'TRF-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(v_count::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_transfer_number
  BEFORE INSERT ON inventory_transfers FOR EACH ROW EXECUTE FUNCTION set_transfer_number();

-- 4. RPC: Process Inventory Transfer
CREATE OR REPLACE FUNCTION process_inventory_transfer(
    p_transfer_id UUID,
    p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_trf RECORD;
    v_item RECORD;
BEGIN
    -- 1. Get Transfer Info
    SELECT * INTO v_trf FROM inventory_transfers WHERE id = p_transfer_id;
    IF v_trf.status != 'DRAFT' THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Transfer already processed.');
    END IF;

    IF v_trf.source_wh_id = v_trf.target_wh_id THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Source and Target warehouses must be different.');
    END IF;

    -- 2. Process Items
    FOR v_item IN SELECT * FROM inventory_transfer_items WHERE transfer_id = p_transfer_id LOOP
        
        -- A. Decrement Source Stock
        INSERT INTO inventory_stocks (org_id, product_id, warehouse_id, quantity)
        VALUES (v_trf.org_id, v_item.product_id, v_trf.source_wh_id, -v_item.quantity)
        ON CONFLICT (product_id, warehouse_id, batch_number) DO UPDATE
        SET quantity = inventory_stocks.quantity - v_item.quantity,
            updated_at = NOW();

        -- B. Increment Target Stock
        INSERT INTO inventory_stocks (org_id, product_id, warehouse_id, quantity)
        VALUES (v_trf.org_id, v_item.product_id, v_trf.target_wh_id, v_item.quantity)
        ON CONFLICT (product_id, warehouse_id, batch_number) DO UPDATE
        SET quantity = inventory_stocks.quantity + v_item.quantity,
            updated_at = NOW();

        -- C. Create Stock Movements (Source & Target)
        INSERT INTO stock_movements (
            org_id, product_id, movement_date, quantity, 
            reference_type, reference_id, notes
        ) VALUES (
            v_trf.org_id, v_item.product_id, v_trf.transfer_date, -v_item.quantity,
            'TRANSFER_OUT', v_trf.id, 'Transfer ke ' || (SELECT name FROM warehouses WHERE id = v_trf.target_wh_id)
        );

        INSERT INTO stock_movements (
            org_id, product_id, movement_date, quantity, 
            reference_type, reference_id, notes
        ) VALUES (
            v_trf.org_id, v_item.product_id, v_trf.transfer_date, v_item.quantity,
            'TRANSFER_IN', v_trf.id, 'Transfer dari ' || (SELECT name FROM warehouses WHERE id = v_trf.source_wh_id)
        );

    END LOOP;

    -- 3. Update Status
    UPDATE inventory_transfers SET 
        status = 'FINISHED'
    WHERE id = p_transfer_id;

    RETURN jsonb_build_object('success', TRUE, 'transfer_id', p_transfer_id);
END;
$$;

-- RLS
ALTER TABLE public.inventory_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transfer_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_can_view_transfers" ON public.inventory_transfers FOR SELECT 
USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE));

CREATE POLICY "members_can_create_transfers" ON public.inventory_transfers FOR INSERT 
WITH CHECK (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE));

CREATE POLICY "members_can_view_transfer_items" ON public.inventory_transfer_items FOR SELECT 
USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE));
