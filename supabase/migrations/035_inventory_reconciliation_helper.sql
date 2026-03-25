-- ============================================================
-- MIGRATION 035: Inventory Reconciliation Helper
-- Allows checking the actual data bypassing RLS
-- ============================================================

CREATE OR REPLACE FUNCTION get_inventory_reconciliation(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_acc_balance NUMERIC;
    v_phys_value NUMERIC;
    v_account_id UUID;
BEGIN
    -- 1. Get Account 1301 Balance
    SELECT id INTO v_account_id FROM accounts WHERE org_id = p_org_id AND code = '1301' LIMIT 1;
    
    IF v_account_id IS NULL THEN
        RETURN jsonb_build_object('error', 'Account 1301 not found');
    END IF;

    SELECT balance INTO v_acc_balance FROM account_balances WHERE account_id = v_account_id;

    -- 2. Get Physical Inventory Value
    SELECT COALESCE(SUM(s.quantity * p.average_cost), 0) INTO v_phys_value
    FROM inventory_stocks s
    JOIN products p ON s.product_id = p.id
    WHERE s.org_id = p_org_id;

    RETURN jsonb_build_object(
        'org_id', p_org_id,
        'account_id', v_account_id,
        'balance_sheet_value', COALESCE(v_acc_balance, 0),
        'inventory_module_value', v_phys_value,
        'discrepancy', COALESCE(v_acc_balance, 0) - v_phys_value
    );
END;
$$;
