-- ============================================================
-- MIGRATION 1110: Legacy Helper Objects Consolidation
-- Normalizes previously untracked helper migrations that used invalid
-- filenames and were skipped by the Supabase CLI.
-- ============================================================

-- Add DELIVERED status for document workflows if it does not exist yet.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'document_status'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'document_status'
      AND e.enumlabel = 'DELIVERED'
  ) THEN
    ALTER TYPE document_status ADD VALUE 'DELIVERED';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.debug_org_inventory(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_products_count INTEGER;
    v_stocks_count INTEGER;
    v_total_value NUMERIC := 0;
BEGIN
    SELECT count(*) INTO v_products_count FROM public.products WHERE org_id = p_org_id;
    SELECT count(*) INTO v_stocks_count FROM public.inventory_stocks WHERE org_id = p_org_id;

    SELECT COALESCE(SUM(s.quantity * p.average_cost), 0) INTO v_total_value
    FROM public.inventory_stocks s
    JOIN public.products p ON s.product_id = p.id
    WHERE s.org_id = p_org_id;

    RETURN jsonb_build_object(
        'org_id', p_org_id,
        'products_count', v_products_count,
        'stocks_count', v_stocks_count,
        'logic_value', v_total_value
    );
END;
$$;

CREATE OR REPLACE VIEW public.v_sales_growth_analysis AS
SELECT
    je.org_id,
    DATE_TRUNC('month', je.entry_date) AS report_month,
    SUM(jl.credit - jl.debit) AS mtd_sales
FROM public.journal_lines jl
JOIN public.journal_entries je ON je.id = jl.entry_id
JOIN public.accounts a ON a.id = jl.account_id
WHERE je.status = 'POSTED'
  AND (a.code LIKE '4%' OR a.type = 'REVENUE')
GROUP BY je.org_id, DATE_TRUNC('month', je.entry_date);

CREATE OR REPLACE VIEW public.v_budget_vs_actual AS
WITH actual_monthly AS (
    SELECT
        je.org_id,
        jl.account_id,
        DATE_TRUNC('month', je.entry_date) AS period,
        SUM(
            CASE
                WHEN a.normal_balance = 'DEBIT' THEN (jl.debit - jl.credit)
                ELSE (jl.credit - jl.debit)
            END
        ) AS actual_amount
    FROM public.journal_lines jl
    JOIN public.journal_entries je ON je.id = jl.entry_id
    JOIN public.accounts a ON a.id = jl.account_id
    WHERE je.status = 'POSTED'
    GROUP BY je.org_id, jl.account_id, DATE_TRUNC('month', je.entry_date)
)
SELECT
    a.org_id,
    a.id AS account_id,
    a.code AS account_code,
    a.name AS account_name,
    COALESCE(b.period, am.period) AS period,
    COALESCE(b.budget_amount, 0) AS budget_amount,
    COALESCE(am.actual_amount, 0) AS actual_amount,
    (COALESCE(am.actual_amount, 0) - COALESCE(b.budget_amount, 0)) AS variance
FROM public.accounts a
LEFT JOIN public.budgets b ON b.account_id = a.id
LEFT JOIN actual_monthly am ON am.account_id = a.id AND am.period = b.period
WHERE a.type::text IN ('REVENUE', 'EXPENSE', 'COGS')
  AND (b.budget_amount != 0 OR am.actual_amount != 0);
