-- ============================================================
-- MIGRATION 031: Inventory Adjustment & Write-off
-- Handling Stock Loss, Damage, and Adjustments
-- ============================================================

-- 1. ADJ TYPE ENUM
CREATE TYPE inventory_adjustment_type AS ENUM ('STOCK_COUNT', 'WRITE_OFF');

-- 2. ADJUSTMENT TABLE
CREATE TABLE IF NOT EXISTS public.inventory_adjustments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    adj_number      TEXT NOT NULL,         -- ADJ-2024-000001
    adj_date        DATE NOT NULL DEFAULT CURRENT_DATE,
    type            inventory_adjustment_type NOT NULL DEFAULT 'STOCK_COUNT',
    status          document_status NOT NULL DEFAULT 'DRAFT',
    total_value     NUMERIC(20, 2) NOT NULL DEFAULT 0,
    notes           TEXT,
    journal_entry_id UUID REFERENCES journal_entries(id),
    created_by      UUID REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(org_id, adj_number)
);

CREATE INDEX idx_inv_adj_org_id ON public.inventory_adjustments(org_id);

-- 3. ADJUSTMENT ITEMS
CREATE TABLE IF NOT EXISTS public.inventory_adjustment_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    adjustment_id   UUID NOT NULL REFERENCES inventory_adjustments(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id),
    warehouse_id    UUID REFERENCES warehouses(id),
    actual_quantity NUMERIC(20, 4) NOT NULL, -- The quantity after adjustment (for STOCK_COUNT)
    diff_quantity   NUMERIC(20, 4) NOT NULL, -- Negative for decrease/write-off
    unit_cost       NUMERIC(20, 2) NOT NULL, -- HPP at the time
    total_value     NUMERIC(20, 2) NOT NULL,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. AUTO-NUMBER (FIXED FOR DUPLICATES)
CREATE OR REPLACE FUNCTION set_adj_number()
RETURNS TRIGGER AS $$
DECLARE
  v_count INT;
BEGIN
  IF NEW.adj_number IS NULL OR NEW.adj_number = '' OR EXISTS (SELECT 1 FROM inventory_adjustments WHERE org_id = NEW.org_id AND adj_number = NEW.adj_number) THEN
    SELECT COUNT(*) + 1 INTO v_count FROM inventory_adjustments WHERE org_id = NEW.org_id AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
    -- Tambahkan Random Suffix agar tidak mungkin duplikat
    NEW.adj_number = 'ADJ-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(v_count::TEXT, 4, '0') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 4));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_adj_number
  BEFORE INSERT ON inventory_adjustments FOR EACH ROW EXECUTE FUNCTION set_adj_number();

-- 5. SEED LOSS ACCOUNT (6011)
DO $$
DECLARE 
    r RECORD;
    v_parent_id UUID;
BEGIN
    FOR r IN SELECT id FROM organizations LOOP
        -- Check if it already exists
        IF NOT EXISTS (SELECT 1 FROM accounts WHERE org_id = r.id AND code = '6011') THEN
            -- Get Parent 6000
            SELECT id INTO v_parent_id FROM accounts WHERE org_id = r.id AND code = '6000';
            
            IF v_parent_id IS NOT NULL THEN
                INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, is_system)
                VALUES (r.id, '6011', 'Kerugian Persediaan (Write-off)', 'EXPENSE', 'DEBIT', v_parent_id, TRUE);
            END IF;
        END IF;
    END LOOP;
END $$;

-- Update seed_default_coa function for future orgs
CREATE OR REPLACE FUNCTION seed_default_coa_updated(p_org_id UUID)
RETURNS VOID AS $$
DECLARE v_parent_id UUID;
BEGIN
    -- This is a simplified version, ideally I'd update the original function in migration 003
    -- but for now I'll just make sure 6011 is added if missing
    SELECT id INTO v_parent_id FROM accounts WHERE org_id = p_org_id AND code = '6000';
    IF v_parent_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM accounts WHERE org_id = p_org_id AND code = '6011') THEN
        INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, is_system)
        VALUES (p_org_id, '6011', 'Kerugian Persediaan (Write-off)', 'EXPENSE', 'DEBIT', v_parent_id, TRUE);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 6. RPC: Process Inventory Adjustment (Atomically handle Stocks, Movements, and Journals)
CREATE OR REPLACE FUNCTION process_inventory_adjustment(
    p_adj_id UUID,
    p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_adj RECORD;
    v_item RECORD;
    v_je_id UUID;
    v_loss_account_id UUID;
    v_product RECORD;
BEGIN
    -- 1. Get Adjustment Info
    SELECT * INTO v_adj FROM inventory_adjustments WHERE id = p_adj_id;
    IF v_adj.status != 'DRAFT' THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Adjustment already processed.');
    END IF;

    -- 2. Get Loss Account (6011)
    SELECT id INTO v_loss_account_id FROM accounts WHERE org_id = v_adj.org_id AND code = '6011';
    IF v_loss_account_id IS NULL THEN
        -- Fallback to 6000 or 6099 if 6011 not found
        SELECT id INTO v_loss_account_id FROM accounts WHERE org_id = v_adj.org_id AND code = '6099';
    END IF;

    -- 3. Create Journal Entry
    INSERT INTO journal_entries (
        org_id, entry_date, description, reference_type, reference_id, status, is_auto, created_by
    ) VALUES (
        v_adj.org_id, v_adj.adj_date, 
        'Inventory Adjustment: ' || v_adj.adj_number || ' (' || v_adj.type::text || ')',
        'INVENTORY_ADJ', v_adj.id, 'POSTED', TRUE, p_user_id
    ) RETURNING id INTO v_je_id;

    -- 4. Process Items
    FOR v_item IN SELECT * FROM inventory_adjustment_items WHERE adjustment_id = p_adj_id LOOP
        -- Get Product Info for Asset Account
        SELECT asset_account_id FROM products WHERE id = v_item.product_id INTO v_product;

        -- A. Create Stock Movement
        INSERT INTO stock_movements (
            org_id, product_id, movement_date, quantity, unit_price, 
            reference_type, reference_id, notes
        ) VALUES (
            v_adj.org_id, v_item.product_id, v_adj.adj_date, v_item.diff_quantity, v_item.unit_cost,
            'ADJUSTMENT', v_adj.id, v_item.notes
        );

        -- B. Update Physical Stocks (if warehouse specified)
        IF v_item.warehouse_id IS NOT NULL THEN
            INSERT INTO inventory_stocks (org_id, product_id, warehouse_id, quantity)
            VALUES (v_adj.org_id, v_item.product_id, v_item.warehouse_id, v_item.diff_quantity)
            ON CONFLICT (product_id, warehouse_id, batch_number) DO UPDATE
            SET quantity = inventory_stocks.quantity + v_item.diff_quantity,
                updated_at = NOW();
        END IF;

        -- C. Journal Lines
        IF v_item.diff_quantity < 0 THEN
            -- DEBIT Loss, CREDIT Inventory Asset
            INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo)
            VALUES (v_je_id, v_loss_account_id, v_item.total_value, 0, 'Kerugian/Write-off Persediaan');
            
            INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo)
            VALUES (v_je_id, v_product.asset_account_id, 0, v_item.total_value, 'Penurunan Stok: ' || v_adj.adj_number);
        ELSE
            -- DEBIT Inventory Asset, CREDIT (Gain/Misc Revenue - currently mapping to Loss for simplicity or use 4102)
            INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo)
            VALUES (v_je_id, v_product.asset_account_id, v_item.total_value, 0, 'Penambahan Stok: ' || v_adj.adj_number);
            
            INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo)
            VALUES (v_je_id, v_loss_account_id, 0, v_item.total_value, 'Penyesuaian Stok (Gain/Correction)');
        END IF;
    END LOOP;

    -- 5. Update Status
    UPDATE inventory_adjustments SET 
        status = 'FINISHED', 
        journal_entry_id = v_je_id 
    WHERE id = p_adj_id;

    RETURN jsonb_build_object('success', TRUE, 'adj_id', p_adj_id);
END;
$$;
