-- ==========================================
-- MIGRATION 044: Budgeting Module (Financial Control)
-- Focus: Planning vs Actual Analysis
-- ==========================================

-- 1. Table: budgets
CREATE TABLE IF NOT EXISTS public.budgets (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    account_id      UUID NOT NULL REFERENCES accounts(id),
    period          DATE NOT NULL, -- Stored as 1st day of the month (YYYY-MM-01)
    budget_amount   DECIMAL(20, 2) NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(org_id, account_id, period)
);

CREATE INDEX idx_budgets_org_period ON public.budgets(org_id, period);

-- 2. Function: Get Budget vs Actual
CREATE OR REPLACE FUNCTION get_budget_vs_actual(p_org_id UUID, p_start_date DATE, p_end_date DATE)
RETURNS TABLE (
    account_code TEXT,
    account_name TEXT,
    account_type TEXT,
    budget_amount DECIMAL(19,4),
    actual_amount DECIMAL(19,4),
    variance DECIMAL(19,4),
    variance_percent DECIMAL(10,2)
) AS $$
BEGIN
    RETURN QUERY
    WITH actuals AS (
        SELECT 
            a.id as acc_id,
            a.code as acc_code,
            a.name as acc_name,
            a.type as acc_type,
            SUM(CASE 
                WHEN a.normal_balance = 'DEBIT' THEN (jl.debit - jl.credit)
                ELSE (jl.credit - jl.debit)
            END) as actual_val
        FROM accounts a
        LEFT JOIN journal_lines jl ON jl.account_id = a.id
        LEFT JOIN journal_entries je ON je.id = jl.entry_id
        WHERE a.org_id = p_org_id
        AND je.status = 'POSTED'
        AND je.entry_date BETWEEN p_start_date AND p_end_date
        GROUP BY a.id, a.code, a.name, a.type
    ),
    budget_agg AS (
        SELECT 
            account_id,
            SUM(budget_amount) as total_budget
        FROM budgets
        WHERE org_id = p_org_id
        AND period BETWEEN p_start_date AND p_end_date
        GROUP BY account_id
    )
    SELECT 
        act.acc_code,
        act.acc_name,
        act.acc_type,
        COALESCE(b.total_budget, 0)::DECIMAL(19,4) as budget_amount,
        COALESCE(act.actual_val, 0)::DECIMAL(19,4) as actual_amount,
        (COALESCE(act.actual_val, 0) - COALESCE(b.total_budget, 0))::DECIMAL(19,4) as variance,
        CASE 
            WHEN COALESCE(b.total_budget, 0) = 0 THEN 
                CASE WHEN COALESCE(act.actual_val, 0) = 0 THEN 0 ELSE 100 END
            ELSE ( (COALESCE(act.actual_val, 0) - b.total_budget) / ABS(b.total_budget) * 100 )::DECIMAL(10,2)
        END as variance_percent
    FROM actuals act
    LEFT JOIN budget_agg b ON b.account_id = act.acc_id
    WHERE COALESCE(b.total_budget, 0) != 0 OR COALESCE(act.actual_val, 0) != 0
    ORDER BY act.acc_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_can_manage_budgets" ON public.budgets FOR ALL
USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE));
