-- ==========================================
-- MIGRATION 040: System Audit & Integrity Dashboard
-- ==========================================

-- 1. Helper Function: Get Unbalanced Journals
CREATE OR REPLACE FUNCTION get_unbalanced_journals(p_org_id UUID)
RETURNS TABLE (
    entry_id UUID,
    entry_date DATE,
    description TEXT,
    reference_type journal_reference_type,
    total_debit DECIMAL(19,4),
    total_credit DECIMAL(19,4),
    diff DECIMAL(19,4)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        je.id,
        je.entry_date,
        je.description,
        je.reference_type,
        SUM(jl.debit) as total_debit,
        SUM(jl.credit) as total_credit,
        ABS(SUM(jl.debit) - SUM(jl.credit)) as diff
    FROM journal_entries je
    JOIN journal_lines jl ON je.id = jl.entry_id
    WHERE je.org_id = p_org_id
    AND je.status = 'POSTED'
    GROUP BY je.id, je.entry_date, je.description, je.reference_type
    HAVING SUM(jl.debit) != SUM(jl.credit);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. View for Audit System Overview
CREATE OR REPLACE VIEW v_audit_red_flags AS
WITH unbalanced_count AS (
    SELECT org_id, COUNT(*) as count 
    FROM journal_entries je
    JOIN journal_lines jl ON je.id = jl.entry_id
    WHERE je.status = 'POSTED'
    GROUP BY org_id, je.id
    HAVING SUM(jl.debit) != SUM(jl.credit)
),
late_assets AS (
    SELECT org_id, COUNT(*) as count
    FROM fixed_assets
    WHERE status = 'ACTIVE'
    AND (last_depreciation_date IS NULL OR last_depreciation_date < (CURRENT_DATE - INTERVAL '1 month')::DATE)
    GROUP BY org_id
)
SELECT 
    o.id as org_id,
    o.name as org_name,
    COALESCE(u.count, 0) as unbalanced_journals,
    COALESCE(la.count, 0) as overdue_depreciation
FROM organizations o
LEFT JOIN (SELECT org_id, SUM(count) as count FROM unbalanced_count GROUP BY org_id) u ON o.id = u.org_id
LEFT JOIN late_assets la ON o.id = la.org_id;

-- 3. Inventory vs GL Comparison Helper
CREATE OR REPLACE FUNCTION check_inventory_ledger_sync(p_org_id UUID)
RETURNS TABLE (
    product_id UUID,
    product_name TEXT,
    stock_qty NUMERIC,
    avg_cost DECIMAL(19,4),
    on_hand_value DECIMAL(19,4),
    ledger_value DECIMAL(19,4),
    variance DECIMAL(19,4)
) AS $$
DECLARE
    v_gl_inventory_acc_id UUID;
BEGIN
    -- 1. Cari Akun Persediaan Utama (Default: 1401)
    SELECT id INTO v_gl_inventory_acc_id FROM accounts WHERE org_id = p_org_id AND code = '1401' LIMIT 1;
    
    RETURN QUERY
    WITH stock_calc AS (
        SELECT 
            p.id,
            p.name,
            COALESCE(SUM(s.quantity), 0) as total_qty,
            COALESCE(p.average_cost, 0) as avg_cost
        FROM products p
        LEFT JOIN inventory_stocks s ON p.id = s.product_id
        WHERE p.org_id = p_org_id
        GROUP BY p.id, p.name, p.average_cost
    ),
    ledger_calc AS (
        -- Hitung saldo di buku besar untuk akun 1401 per produk jika ada reference_id
        -- Namun di sistem kita, jurnal perolehan biasanya glongongan per FO/PO.
        -- Sebagai dashboard audit, kita bandingkan Total On-Hand Value vs Saldo Akun 1401
        SELECT 
            SUM(debit - credit) as balance
        FROM journal_lines jl
        JOIN journal_entries je ON jl.entry_id = je.id
        WHERE je.org_id = p_org_id 
        AND je.status = 'POSTED'
        AND jl.account_id = v_gl_inventory_acc_id
    )
    SELECT 
        sc.id,
        sc.name,
        sc.total_qty,
        sc.avg_cost::DECIMAL(19,4),
        (sc.total_qty * sc.avg_cost)::DECIMAL(19,4) as on_hand_value,
        (lc.balance / (SELECT COUNT(*) FROM stock_calc WHERE total_qty > 0)) as ledger_value_allocated, -- Simplified allocation
        ((sc.total_qty * sc.avg_cost) - (lc.balance / (SELECT NULLIF(COUNT(*), 0) FROM stock_calc WHERE total_qty > 0))) as variance
    FROM stock_calc sc, ledger_calc lc;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
