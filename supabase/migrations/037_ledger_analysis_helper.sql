-- ============================================================
-- MIGRATION 037: Deep Inventory Analysis
-- ============================================================

CREATE OR REPLACE FUNCTION get_account_ledger_details(p_account_id UUID, p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
    entry_date DATE,
    entry_number TEXT,
    description TEXT,
    debit NUMERIC,
    credit NUMERIC,
    reference_type TEXT,
    reference_id UUID
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT 
        je.entry_date,
        je.entry_number,
        je.description,
        jl.debit,
        jl.credit,
        je.reference_type::text,
        je.reference_id
    FROM journal_lines jl
    JOIN journal_entries je ON jl.entry_id = je.id
    WHERE jl.account_id = p_account_id
    ORDER BY je.entry_date DESC, je.created_at DESC
    LIMIT p_limit;
$$;
