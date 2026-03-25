-- ==========================================
-- MIGRATION 045: Performance Engine Refinement
-- Focus: Robust Views for BSC & Reports
-- ==========================================

-- 1. Sales Growth View (MTD)
CREATE OR REPLACE VIEW v_sales_growth_analysis AS
SELECT 
    je.org_id,
    DATE_TRUNC('month', je.entry_date) as report_month,
    SUM(jl.credit - jl.debit) as mtd_sales
FROM journal_lines jl
JOIN journal_entries je ON je.id = jl.entry_id
JOIN accounts a ON a.id = jl.account_id
WHERE je.status = 'POSTED'
AND (a.code LIKE '4%' OR a.type = 'REVENUE')
GROUP BY je.org_id, DATE_TRUNC('month', je.entry_date);

-- 2. Refined Budget vs Actual View
-- This makes it MUCH easier to fetch from JS
CREATE OR REPLACE VIEW v_budget_vs_actual AS
WITH actual_monthly AS (
    SELECT 
        je.org_id,
        jl.account_id,
        DATE_TRUNC('month', je.entry_date) as period,
        SUM(CASE 
            WHEN a.normal_balance = 'DEBIT' THEN (jl.debit - jl.credit)
            ELSE (jl.credit - jl.debit)
        END) as actual_amount
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.entry_id
    JOIN accounts a ON a.id = jl.account_id
    WHERE je.status = 'POSTED'
    GROUP BY je.org_id, jl.account_id, DATE_TRUNC('month', je.entry_date)
)
SELECT 
    a.org_id,
    a.id as account_id,
    a.code as account_code,
    a.name as account_name,
    COALESCE(b.period, am.period) as period,
    COALESCE(b.budget_amount, 0) as budget_amount,
    COALESCE(am.actual_amount, 0) as actual_amount,
    (COALESCE(am.actual_amount, 0) - COALESCE(b.budget_amount, 0)) as variance
FROM accounts a
LEFT JOIN budgets b ON b.account_id = a.id
LEFT JOIN actual_monthly am ON am.account_id = a.id AND am.period = b.period
WHERE (a.type IN ('REVENUE', 'EXPENSE', 'COGS'))
AND (b.budget_amount != 0 OR am.actual_amount != 0);

-- 3. Fix potential gen_random_uuid issue in all new tables
-- (Already handled by previous replacements, but double check)
