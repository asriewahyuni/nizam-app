-- ============================================================
-- MIGRATION 024: Fix Enums for Sales Returns
-- Adds missing reference types to journal enums
-- ============================================================

-- 1. Add SALES_RETURN and TRANSFER to journal_reference_type
ALTER TYPE journal_reference_type ADD VALUE IF NOT EXISTS 'SALES_RETURN';
ALTER TYPE journal_reference_type ADD VALUE IF NOT EXISTS 'TRANSFER';

-- 2. Add TRANSFER to cash_transaction_type
ALTER TYPE cash_transaction_type ADD VALUE IF NOT EXISTS 'TRANSFER';

-- 3. Update Bank Transaction Trigger to support TRANSFER label
CREATE OR REPLACE FUNCTION auto_journal_bank_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_je_id UUID;
  v_bank_gl_account_id UUID;
  v_opp_gl_account_id UUID;
  v_ref_type journal_reference_type;
BEGIN
  -- 1. Get the GL Account ID for the bank account
  SELECT account_id INTO v_bank_gl_account_id FROM bank_accounts WHERE id = NEW.bank_account_id;
  
  -- 2. Use category_id as the opposite account (Revenue/Expense/etc.)
  v_opp_gl_account_id := NEW.category_id;
  
  IF v_opp_gl_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 3. Determine Journal Reference Type (Support TRANSFER)
  IF NEW.type::text = 'IN' THEN
    v_ref_type := 'CASH_IN';
  ELSIF NEW.type::text = 'TRANSFER' THEN
    v_ref_type := 'TRANSFER';
  ELSE
    v_ref_type := 'CASH_OUT';
  END IF;

  -- 4. Create Journal Entry Header
  INSERT INTO journal_entries (
    org_id, 
    entry_date, 
    description, 
    reference_type, 
    reference_id, 
    status, 
    is_auto,
    created_by
  ) VALUES (
    NEW.org_id,
    NEW.transaction_date,
    NEW.description,
    v_ref_type,
    NEW.id,
    'POSTED',
    TRUE,
    COALESCE(NEW.created_by, auth.uid())
  ) RETURNING id INTO v_je_id;

  -- 5. Create Journal Lines (Double-Entry)
  -- If CASH_IN: Debit Bank (+), Credit Category (-)
  -- If CASH_OUT or TRANSFER: Credit Bank (-), Debit Category (+)
  IF NEW.type::text = 'IN' THEN
    -- Debit Bank
    INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo)
    VALUES (v_je_id, v_bank_gl_account_id, NEW.amount, 0, NEW.description);
    
    -- Credit Category
    INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo)
    VALUES (v_je_id, v_opp_gl_account_id, 0, NEW.amount, NEW.description);
  ELSE
    -- Credit Bank (Outgoing side for TRANSFER/OUT)
    -- Debit Category (Incoming side for TRANSFER, or Expense for OUT)
    INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo)
    VALUES (v_je_id, v_opp_gl_account_id, NEW.amount, 0, NEW.description);
    
    INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo)
    VALUES (v_je_id, v_bank_gl_account_id, 0, NEW.amount, NEW.description);
  END IF;

  NEW.journal_entry_id := v_je_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
