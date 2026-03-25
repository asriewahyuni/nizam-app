-- ==========================================
-- MIGRATION 042: Balanced Scorecard (BSC) Core Metrics Engine
-- Focus: Internal Process & Financial High-Readiness
-- ==========================================

-- 1. INTERNAL PROCESS: Approval Lead Time (SLA Monitoring)
CREATE OR REPLACE VIEW v_internal_sla_stats AS
SELECT 
    org_id,
    source_type,
    COUNT(*) as total_requests,
    AVG(EXTRACT(EPOCH FROM (decided_at - requested_at))/3600)::DECIMAL(10,2) as avg_hours_to_decide,
    COUNT(*) FILTER (WHERE status = 'APPROVED') as total_approved,
    COUNT(*) FILTER (WHERE status = 'REJECTED') as total_rejected
FROM approval_requests
WHERE status IN ('APPROVED', 'REJECTED')
GROUP BY org_id, source_type;

-- 2. FINANCIAL: Dynamic Key Performance Indicators (KPI)
CREATE OR REPLACE FUNCTION get_financial_kpis(p_org_id UUID, p_date DATE)
RETURNS TABLE (
    kpi_name TEXT,
    kpi_value DECIMAL(19,4),
    category TEXT,
    bench_mark TEXT
) AS $$
DECLARE
    v_total_assets DECIMAL(19,4);
    v_curr_assets DECIMAL(19,4);
    v_curr_liabilities DECIMAL(19,4);
    v_net_profit DECIMAL(19,4);
BEGIN
    -- Hitung Current Assets (Code 11xx - 14xx)
    SELECT SUM(balance) INTO v_curr_assets 
    FROM account_balances 
    WHERE org_id = p_org_id AND code LIKE '1%';

    -- Hitung Current Liabilities (Code 21xx - 24xx)
    SELECT SUM(balance) INTO v_curr_liabilities 
    FROM account_balances 
    WHERE org_id = p_org_id AND code LIKE '2%';

    -- Total Assets
    v_total_assets := v_curr_assets; -- Simplified for now, should include fixed assets (15xx)

    -- Net Profit (All time as of date for ROA)
    SELECT (SUM(total_credit) - SUM(total_debit)) INTO v_net_profit
    FROM account_balances
    WHERE org_id = p_org_id AND code LIKE '4%'; -- Revenue
    
    -- Substract Expenses
    v_net_profit := v_net_profit - (SELECT SUM(total_debit - total_credit) FROM account_balances WHERE org_id = p_org_id AND (code LIKE '5%' OR code LIKE '6%'));

    -- KPI 1: Current Ratio (Liquidity)
    kpi_name := 'Current Ratio';
    kpi_value := COALESCE(v_curr_assets / NULLIF(v_curr_liabilities, 0), 0);
    category := 'LIQUIDITY';
    bench_mark := '> 1.5 Healthy';
    RETURN NEXT;

    -- KPI 2: Net Profit Margin (Profitability)
    kpi_name := 'Net Profit Margin';
    kpi_value := COALESCE(v_net_profit / NULLIF((SELECT SUM(total_credit - total_debit) FROM account_balances WHERE org_id = p_org_id AND code LIKE '4%'), 0), 0) * 100;
    category := 'PROFITABILITY';
    bench_mark := '> 10% Good';
    RETURN NEXT;

    -- KPI 3: Inventory Turnover (Efficiency)
    -- Mock for now: COGS / Avg Inventory
    kpi_name := 'Inventory Health Index';
    kpi_value := (SELECT COUNT(*) FROM products WHERE org_id = p_org_id AND stock_qty > 0);
    category := 'OPERATIONAL';
    bench_mark := '> 0 Active';
    RETURN NEXT;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
