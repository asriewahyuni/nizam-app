-- ============================================================
-- MIGRATION 1027: WMS & MANUFACTURING ADVANCED
-- Enhancing Inventory and Production with Enterprise Features
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. WMS ENHANCEMENTS: BIN MANAGEMENT & BATCH TRACKING
-- ─────────────────────────────────────────────────────────────

-- Table: warehouse_bins (Specific locations within a warehouse)
CREATE TABLE IF NOT EXISTS public.warehouse_bins (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    warehouse_id    UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    code            TEXT NOT NULL, -- e.g., RAK-A1, BIN-02
    description     TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(warehouse_id, code)
);

-- Add Batch and Expiry support to inventory_stocks
-- We need to drop the old unique constraint and add a new one including bin, batch, and expiry
ALTER TABLE public.inventory_stocks 
ADD COLUMN IF NOT EXISTS bin_id UUID REFERENCES warehouse_bins(id),
ADD COLUMN IF NOT EXISTS batch_number TEXT,
ADD COLUMN IF NOT EXISTS expiry_date DATE;

-- Update Index for faster FEFO (First Expired First Out) lookups
CREATE INDEX IF NOT EXISTS idx_inv_stocks_expiry ON public.inventory_stocks(expiry_date) WHERE expiry_date IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 2. MANUFACTURING ENHANCEMENTS: ROUTING & OPERATION COSTS
-- ─────────────────────────────────────────────────────────────

-- Table: production_operations (Definition of tasks like Cutting, Assembly, Finishing)
CREATE TABLE IF NOT EXISTS public.production_operations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    estimated_cost  NUMERIC(20, 2) DEFAULT 0, -- Default labor cost for this op
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: production_bom_routings (The sequence of operations for a BoM)
CREATE TABLE IF NOT EXISTS public.production_bom_routings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bom_id          UUID NOT NULL REFERENCES production_boms(id) ON DELETE CASCADE,
    operation_id    UUID NOT NULL REFERENCES production_operations(id) ON DELETE CASCADE,
    sequence_order  INT NOT NULL DEFAULT 1,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: production_wo_costs (Tracking actual labor/overhead per Work Order)
CREATE TABLE IF NOT EXISTS public.production_wo_costs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wo_id           UUID NOT NULL REFERENCES production_work_orders(id) ON DELETE CASCADE,
    description     TEXT NOT NULL, -- e.g., "Electricity Overhead", "Assembly Labor"
    amount          NUMERIC(20, 2) NOT NULL DEFAULT 0,
    cost_type       TEXT NOT NULL DEFAULT 'LABOR', -- 'LABOR', 'OVERHEAD', 'OTHER'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 3. RLS & POLICIES
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.warehouse_bins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_bom_routings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_wo_costs ENABLE ROW LEVEL SECURITY;

-- Dynamic Policies
CREATE POLICY "members_can_view_bins" ON public.warehouse_bins FOR SELECT 
USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE));

CREATE POLICY "members_can_view_ops" ON public.production_operations FOR SELECT 
USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE));

-- ─────────────────────────────────────────────────────────────
-- 4. UPDATE PROCESS: Recalculate FG Unit Cost with Overhead
-- ─────────────────────────────────────────────────────────────

-- We improve the original process_work_order_completion to include overhead costs
CREATE OR REPLACE FUNCTION process_work_order_completion_v2(
    p_wo_id UUID,
    p_user_id UUID,
    p_warehouse_id UUID,
    p_bin_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wo RECORD;
    v_bom RECORD;
    v_item RECORD;
    v_je_id UUID;
    v_total_rm_cost NUMERIC(20, 2) := 0;
    v_total_overhead_cost NUMERIC(20, 2) := 0;
    v_grand_total_cost NUMERIC(20, 2) := 0;
    v_fg_asset_account_id UUID;
    v_org_id UUID;
    v_overhead_account_id UUID; -- Usually a liability or expense clearing account
BEGIN
    -- 1. Get Work Order Info
    SELECT * INTO v_wo FROM production_work_orders WHERE id = p_wo_id;
    IF v_wo.status != 'RELEASED' THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Hanya SPK berstatus RELEASED yang bisa diselesaikan.');
    END IF;

    v_org_id := v_wo.org_id;

    -- 2. Calculate Real Overhead Costs from production_wo_costs
    SELECT COALESCE(SUM(amount), 0) INTO v_total_overhead_cost 
    FROM production_wo_costs 
    WHERE wo_id = p_wo_id;

    -- 3. Get BoM and FG Info
    SELECT b.*, p.asset_account_id as fg_account 
    INTO v_bom 
    FROM production_boms b
    JOIN products p ON p.id = b.product_id
    WHERE b.id = v_wo.bom_id;

    v_fg_asset_account_id := v_bom.fg_account;

    -- 4. Create Journal Entry
    INSERT INTO journal_entries (
        org_id, entry_date, description, reference_type, reference_id, status, is_auto, created_by
    ) VALUES (
        v_org_id, NOW(), 
        'Produksi Selesai: ' || v_wo.wo_number || ' (Inc. Overhead)',
        'PRODUCTION', v_wo.id, 'POSTED', TRUE, p_user_id
    ) RETURNING id INTO v_je_id;

    -- 5. Process Raw Materials (Consumption)
    FOR v_item IN (SELECT bi.*, p.asset_account_id as rm_account, p.name as product_name
                   FROM production_bom_items bi
                   JOIN products p ON p.id = bi.product_id
                   WHERE bi.bom_id = v_wo.bom_id) LOOP
        
        DECLARE
            v_qty_to_consume NUMERIC(20, 4) := v_item.quantity * v_wo.quantity_planned;
            v_unit_cost NUMERIC(20, 2);
        BEGIN
            SELECT COALESCE(average_cost, purchase_price, 0) INTO v_unit_cost FROM products WHERE id = v_item.product_id;
            v_total_rm_cost := v_total_rm_cost + (v_qty_to_consume * v_unit_cost);

            INSERT INTO stock_movements (
                org_id, product_id, movement_date, quantity, unit_price, 
                reference_type, reference_id, notes
            ) VALUES (
                v_org_id, v_item.product_id, NOW(), -v_qty_to_consume, v_unit_cost,
                'PRODUCTION_CONSUMPTION', v_wo.id, 'Consummed for ' || v_wo.wo_number
            );

            -- Account: Credit Asset RM
            INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo)
            VALUES (v_je_id, v_item.rm_account, 0, v_qty_to_consume * v_unit_cost, 'Bahan Baku: ' || v_item.product_name);
        END;
    END LOOP;

    -- 6. Process Overhead Journal (Credit Overhead/Wages Clearing)
    IF v_total_overhead_cost > 0 THEN
        -- Link to a default overhead account (6099 or similar if specific not found)
        SELECT id INTO v_overhead_account_id FROM accounts WHERE org_id = v_org_id AND code = '6099';
        
        INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo)
        VALUES (v_je_id, v_overhead_account_id, 0, v_total_overhead_cost, 'Biaya Overhead/Tenaga Kerja Produksi');
    END IF;

    -- 7. Process Finished Goods (Production)
    v_grand_total_cost := v_total_rm_cost + v_total_overhead_cost;
    
    DECLARE
        v_fg_unit_cost NUMERIC(20, 2) := v_grand_total_cost / v_wo.quantity_planned;
    BEGIN
        INSERT INTO stock_movements (
            org_id, product_id, movement_date, quantity, unit_price, 
            reference_type, reference_id, notes
        ) VALUES (
            v_org_id, v_bom.product_id, NOW(), v_wo.quantity_planned, v_fg_unit_cost,
            'PRODUCTION_OUTPUT', v_wo.id, 'Produced via ' || v_wo.wo_number
        );

        -- Update Physical Stocks
        INSERT INTO inventory_stocks (org_id, product_id, warehouse_id, bin_id, quantity)
        VALUES (v_org_id, v_bom.product_id, p_warehouse_id, p_bin_id, v_wo.quantity_planned)
        ON CONFLICT (product_id, warehouse_id, COALESCE(bin_id, '00000000-0000-0000-0000-000000000000'), COALESCE(batch_number, '')) DO UPDATE
        SET quantity = inventory_stocks.quantity + EXCLUDED.quantity;

        -- Account: Debit Asset FG
        INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo)
        VALUES (v_je_id, v_fg_asset_account_id, v_grand_total_cost, 0, 'Produk Jadi: ' || v_wo.wo_number);
    END;

    -- 8. Finalize WO
    UPDATE production_work_orders SET 
        status = 'COMPLETED', 
        completed_at = NOW(),
        quantity_actual = quantity_planned
    WHERE id = p_wo_id;

    RETURN jsonb_build_object(
        'success', TRUE, 
        'rm_cost', v_total_rm_cost, 
        'overhead_cost', v_total_overhead_cost, 
        'total_cost', v_grand_total_cost,
        'fg_unit_cost', v_grand_total_cost / v_wo.quantity_planned
    );
END;
$$;
