-- Migration 1032: Robust Manufacturing Account Mapping
-- Fixes NULL account_id errors during SPK completion by providing fallbacks for Inventory and Expense accounts.

-- 0. CLEANUP OLD VERSIONS TO PREVENT AMBIGUITY
DROP FUNCTION IF EXISTS process_work_order_completion(uuid, uuid);
DROP FUNCTION IF EXISTS process_work_order_completion(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS process_work_order_completion_v2(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS process_work_order_completion_v2(uuid, uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION process_work_order_completion(
    p_wo_id UUID,
    p_user_id UUID,
    p_warehouse_id UUID DEFAULT NULL
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
    v_fg_asset_account_id UUID;
    v_org_id UUID;
BEGIN
    -- 1. Get Work Order Info
    SELECT * INTO v_wo FROM production_work_orders WHERE id = p_wo_id;
    IF v_wo.status != 'RELEASED' THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Hanya SPK berstatus RELEASED yang bisa diselesaikan.');
    END IF;

    v_org_id := v_wo.org_id;

    -- 2. Get BoM and FG Info
    SELECT b.*, p.asset_account_id as fg_account 
    INTO v_bom 
    FROM production_boms b
    JOIN products p ON p.id = b.product_id
    WHERE b.id = v_wo.bom_id;

    v_fg_asset_account_id := v_bom.fg_account;
    
    -- Fallback for FG Account (Default to 1301 Inventory)
    IF v_fg_asset_account_id IS NULL THEN
        SELECT id INTO v_fg_asset_account_id FROM accounts WHERE org_id = v_org_id AND code = '1301' LIMIT 1;
    END IF;
    -- Absolute Fallback
    IF v_fg_asset_account_id IS NULL THEN
        SELECT id INTO v_fg_asset_account_id FROM accounts WHERE org_id = v_org_id AND type = 'ASSET' ORDER BY code LIMIT 1;
    END IF;

    -- 3. Create Journal Entry for Transformation
    INSERT INTO journal_entries (
        org_id, entry_date, description, reference_type, reference_id, status, is_auto, created_by
    ) VALUES (
        v_org_id, NOW(), 
        'Produksi Selesai: ' || v_wo.wo_number || ' (' || v_bom.code || ')',
        'PRODUCTION', v_wo.id, 'POSTED', TRUE, p_user_id
    ) RETURNING id INTO v_je_id;

    -- 4. Process Raw Materials (Consumption)
    FOR v_item IN (SELECT bi.*, p.asset_account_id as rm_account, p.name as product_name
                   FROM production_bom_items bi
                   JOIN products p ON p.id = bi.product_id
                   WHERE bi.bom_id = v_wo.bom_id) LOOP
        
        DECLARE
            v_qty_to_consume NUMERIC(20, 4) := v_item.quantity * v_wo.quantity_planned;
            v_unit_cost NUMERIC(20, 2);
            v_rm_account UUID := v_item.rm_account;
        BEGIN
            -- Get Average Cost for valuation
            SELECT COALESCE(average_cost, purchase_price, 0) INTO v_unit_cost FROM products WHERE id = v_item.product_id;
            v_total_rm_cost := v_total_rm_cost + (v_qty_to_consume * v_unit_cost);

            -- A. Create Stock Movement (OUT)
            INSERT INTO stock_movements (
                org_id, product_id, movement_date, quantity, unit_price, 
                reference_type, reference_id, notes
            ) VALUES (
                v_org_id, v_item.product_id, NOW(), -v_qty_to_consume, v_unit_cost,
                'PRODUCTION_CONSUMPTION', v_wo.id, 'Consummed for ' || v_wo.wo_number
            );

            -- B. Update Physical Stocks (if warehouse provided)
            IF p_warehouse_id IS NOT NULL THEN
                UPDATE inventory_stocks 
                SET quantity = quantity - v_qty_to_consume
                WHERE product_id = v_item.product_id AND warehouse_id = p_warehouse_id;
            END IF;

            -- Fallback for RM Account
            IF v_rm_account IS NULL THEN
                SELECT id INTO v_rm_account FROM accounts WHERE org_id = v_org_id AND code = '1301' LIMIT 1;
            END IF;
            IF v_rm_account IS NULL THEN
                SELECT id INTO v_rm_account FROM accounts WHERE org_id = v_org_id AND type = 'ASSET' ORDER BY code LIMIT 1;
            END IF;

            -- C. Journal Line (CREDIT RM Asset)
            INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo)
            VALUES (v_je_id, v_rm_account, 0, v_qty_to_consume * v_unit_cost, 'Bahan Baku: ' || v_item.product_name);
        END;
    END LOOP;

    -- 5. Process Finished Goods (Production)
    DECLARE
        v_fg_unit_cost NUMERIC(20, 2) := v_total_rm_cost / v_wo.quantity_planned;
    BEGIN
        INSERT INTO stock_movements (
            org_id, product_id, movement_date, quantity, unit_price, 
            reference_type, reference_id, notes
        ) VALUES (
            v_org_id, v_bom.product_id, NOW(), v_wo.quantity_planned, v_fg_unit_cost,
            'PRODUCTION_OUTPUT', v_wo.id, 'Produced via ' || v_wo.wo_number
        );

        -- B. Update Physical Stocks
        IF p_warehouse_id IS NOT NULL THEN
            INSERT INTO inventory_stocks (org_id, product_id, warehouse_id, quantity)
            VALUES (v_org_id, v_bom.product_id, p_warehouse_id, v_wo.quantity_planned)
            ON CONFLICT (product_id, warehouse_id, batch_number) DO UPDATE
            SET quantity = inventory_stocks.quantity + EXCLUDED.quantity;
        END IF;

        -- C. Journal Line (DEBIT FG Asset)
        INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo)
        VALUES (v_je_id, v_fg_asset_account_id, v_total_rm_cost, 0, 'Produk Jadi: ' || v_wo.wo_number);

        -- Update the product master with the NEW Unit Cost (HPP)
        UPDATE public.products SET 
            average_cost = v_fg_unit_cost,
            purchase_price = v_fg_unit_cost,
            selling_price = CASE 
                WHEN COALESCE(selling_price, 0) = 0 THEN ROUND(v_fg_unit_cost / 0.7 / 100) * 100
                ELSE selling_price
            END,
            updated_at = NOW()
        WHERE id = v_bom.product_id;
    END;

    -- 6. Update WO Status
    UPDATE production_work_orders SET 
        status = 'COMPLETED', 
        completed_at = NOW(),
        quantity_actual = quantity_planned
    WHERE id = p_wo_id;

    RETURN jsonb_build_object('success', TRUE, 'total_cost', v_total_rm_cost);
END;
$$;


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
    v_overhead_account_id UUID;
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
    
    -- Fallback for FG Account
    IF v_fg_asset_account_id IS NULL THEN
        SELECT id INTO v_fg_asset_account_id FROM accounts WHERE org_id = v_org_id AND code = '1301' LIMIT 1;
    END IF;
    IF v_fg_asset_account_id IS NULL THEN
        SELECT id INTO v_fg_asset_account_id FROM accounts WHERE org_id = v_org_id AND type = 'ASSET' ORDER BY code LIMIT 1;
    END IF;

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
            v_rm_account UUID := v_item.rm_account;
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

            -- Fallback for RM Account
            IF v_rm_account IS NULL THEN
                SELECT id INTO v_rm_account FROM accounts WHERE org_id = v_org_id AND code = '1301' LIMIT 1;
            END IF;
            IF v_rm_account IS NULL THEN
                SELECT id INTO v_rm_account FROM accounts WHERE org_id = v_org_id AND type = 'ASSET' ORDER BY code LIMIT 1;
            END IF;

            -- Account: Credit Asset RM
            INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo)
            VALUES (v_je_id, v_rm_account, 0, v_qty_to_consume * v_unit_cost, 'Bahan Baku: ' || v_item.product_name);
        END;
    END LOOP;

    -- 6. Process Overhead Journal (Credit Overhead/Wages Clearing)
    IF v_total_overhead_cost > 0 THEN
        -- Link to a default overhead account (6100 General Expense)
        SELECT id INTO v_overhead_account_id FROM accounts WHERE org_id = v_org_id AND code = '6100' LIMIT 1;
        
        -- Fallback
        IF v_overhead_account_id IS NULL THEN
            SELECT id INTO v_overhead_account_id FROM accounts WHERE org_id = v_org_id AND code = '6001' LIMIT 1;
        END IF;
        IF v_overhead_account_id IS NULL THEN
            SELECT id INTO v_overhead_account_id FROM accounts WHERE org_id = v_org_id AND type = 'EXPENSE' ORDER BY code LIMIT 1;
        END IF;
        
        IF v_overhead_account_id IS NOT NULL THEN
            INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo)
            VALUES (v_je_id, v_overhead_account_id, 0, v_total_overhead_cost, 'Biaya Overhead Produksi');
        END IF;
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

        -- Update the product master with the NEW Unit Cost (HPP Modal)
        -- and providing a default selling price recommendation (30% margin) if currently zero
        UPDATE public.products SET 
            average_cost = v_fg_unit_cost,
            purchase_price = v_fg_unit_cost,
            selling_price = CASE 
                WHEN COALESCE(selling_price, 0) = 0 THEN ROUND(v_fg_unit_cost / 0.7 / 100) * 100 -- Rounded to nearest 100
                ELSE selling_price
            END,
            updated_at = NOW()
        WHERE id = v_bom.product_id;
    END;

    -- 8. Finalize WO
    UPDATE production_work_orders SET 
        status = 'COMPLETED', 
        completed_at = NOW(),
        quantity_actual = quantity_planned
    WHERE id = p_wo_id;

    RETURN jsonb_build_object(
        'success', TRUE, 
        'total_cost', v_grand_total_cost
    );
END;
$$;
