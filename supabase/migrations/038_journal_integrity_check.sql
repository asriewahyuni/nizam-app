-- ============================================================
-- MIGRATION 038: Journal Integrity Check
-- ============================================================

CREATE OR REPLACE FUNCTION check_all_journals_balance()
RETURNS TABLE (
    entry_id UUID,
    entry_number TEXT,
    description TEXT,
    debit_total NUMERIC,
    credit_total NUMERIC,
    diff NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT 
        je.id,
        je.entry_number,
        je.description,
        SUM(jl.debit) as debit_total,
        SUM(jl.credit) as credit_total,
        SUM(jl.debit) - SUM(jl.credit) as diff
    FROM journal_entries je
    JOIN journal_lines jl ON je.id = jl.entry_id
    GROUP BY je.id, je.entry_number, je.description
    HAVING SUM(jl.debit) != SUM(jl.credit);
$$;
