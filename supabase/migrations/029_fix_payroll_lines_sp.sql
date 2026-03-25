-- Function to fix legacy journals that missed lines due to RLS/Trigger race conditions.
-- This runs as SECURITY DEFINER to bypass RLS policies.
CREATE OR REPLACE FUNCTION fix_missing_payroll_lines(
    p_run_id UUID,
    p_org_id UUID,
    p_bank_acc_id UUID
) RETURNS VOID AS $$
DECLARE
    v_entry_id UUID;
    v_expense_acc_id UUID;
    v_amount NUMERIC;
    v_desc TEXT;
BEGIN
    -- 1. Get Run Details
    SELECT journal_entry_id, total_net, 'Pembayaran Gaji Periode ' || period_start || ' s/d ' || period_end
    INTO v_entry_id, v_amount, v_desc
    FROM payroll_runs 
    WHERE id = p_run_id AND org_id = p_org_id;

    IF v_entry_id IS NULL THEN
        RAISE EXCEPTION 'Payroll Run has no linked Journal Entry Header';
    END IF;

    -- 2. Get Expense Account (6001)
    SELECT id INTO v_expense_acc_id FROM accounts WHERE org_id = p_org_id AND code = '6001';
    IF v_expense_acc_id IS NULL THEN
        RAISE EXCEPTION 'Expense Account 6001 not found';
    END IF;

    -- 3. Check if lines already exist (to avoid double insert)
    IF EXISTS (SELECT 1 FROM journal_lines WHERE entry_id = v_entry_id) THEN
        RETURN;
    END IF;

    -- 4. INSERT LINES (Bypassing RLS because of SECURITY DEFINER)
    -- Debit Expense
    INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo)
    VALUES (v_entry_id, v_expense_acc_id, v_amount, 0, v_desc);

    -- Credit Bank
    INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo)
    VALUES (v_entry_id, p_bank_acc_id, 0, v_amount, v_desc);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
