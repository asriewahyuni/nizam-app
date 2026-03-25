-- ============================================================
-- MIGRATION 042: Manufacturing Completion Engine (The Real Data Engine)
-- ============================================================

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
    v_rm_asset_account_id UUID;
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

            -- C. Journal Line (CREDIT RM Asset)
            INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo)
            VALUES (v_je_id, v_item.rm_account, 0, v_qty_to_consume * v_unit_cost, 'Bahan Baku: ' || v_item.product_name);
        END;
    END LOOP;

    -- 5. Process Finished Goods (Production)
    -- A. Stock Movement (IN)
    -- Unit cost of FG = Sum of RM Costs / FG Qty
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

        -- B. Update Physical Stocks (FG Warehouse)
        IF p_warehouse_id IS NOT NULL THEN
            INSERT INTO inventory_stocks (org_id, product_id, warehouse_id, quantity)
            VALUES (v_org_id, v_bom.product_id, p_warehouse_id, v_wo.quantity_planned)
            ON CONFLICT (product_id, warehouse_id, batch_number) DO UPDATE
            SET quantity = inventory_stocks.quantity + EXCLUDED.quantity;
        END IF;

        -- C. Journal Line (DEBIT FG Asset)
        INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo)
        VALUES (v_je_id, v_fg_asset_account_id, v_total_rm_cost, 0, 'Produk Jadi: ' || v_wo.wo_number);
    END;

    -- 6. Update WO Status
    UPDATE production_work_orders SET 
        status = 'COMPLETED', 
        completed_at = NOW(),
        quantity_actual = quantity_planned
    WHERE id = p_wo_id;

    RETURN jsonb_build_object('success', TRUE, 'total_cost', v_total_rm_cost, 'je_id', v_je_id);
END;
$$;
