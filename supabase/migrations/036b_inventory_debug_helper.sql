-- ============================================================
-- MIGRATION 036: Inventory Debug Helper
-- ============================================================

CREATE OR REPLACE FUNCTION debug_org_inventory(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_products_count INTEGER;
    v_stocks_count INTEGER;
    v_total_value NUMERIC := 0;
BEGIN
    SELECT count(*) INTO v_products_count FROM products WHERE org_id = p_org_id;
    SELECT count(*) INTO v_stocks_count FROM inventory_stocks WHERE org_id = p_org_id;
    
    SELECT COALESCE(SUM(s.quantity * p.average_cost), 0) INTO v_total_value
    FROM inventory_stocks s
    JOIN products p ON s.product_id = p.id
    WHERE s.org_id = p_org_id;

    RETURN jsonb_build_object(
        'org_id', p_org_id,
        'products_count', v_products_count,
        'stocks_count', v_stocks_count,
        'logic_value', v_total_value
    );
END;
$$;
