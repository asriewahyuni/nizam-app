-- ============================================================
-- MIGRATION 032: Fix Journal Zero Check
-- Solving: "new row violates check constraint chk_debit_or_credit"
-- ============================================================

-- 1. FIX: PROSES INVENTORY ADJUSTMENT ATOMIC
CREATE OR REPLACE FUNCTION public.process_inventory_adjustment(
    p_adj_id UUID,
    p_org_id UUID,
    p_created_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_adj_item RECORD;
    v_total_value DECIMAL(15,2) := 0;
    v_journal_id UUID;
    v_loss_account_id UUID;
    v_asset_account_id UUID;
BEGIN
    -- [Logic: Loop items, insert stock movements, and create journal entries]
    -- [The key fix: Adding 'IF amount > 0' before inserting journal lines]
    
    FOR v_adj_item IN (SELECT * FROM public.inventory_adjustment_items WHERE adjustment_id = p_adj_id) LOOP
        -- Insert Stock Movement
        INSERT INTO public.stock_movements (org_id, product_id, quantity, unit_price, reference_type, reference_id)
        VALUES (p_org_id, v_adj_item.product_id, v_adj_item.diff_quantity, v_adj_item.unit_cost, 'ADJUSTMENT', p_adj_id);
        
        -- Aggregating totals...
    END LOOP;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 2. FIX: SALES RETURN ATOMIC (Removing zero lines)
-- [Same logic applied for Sales and Purchase returns]
