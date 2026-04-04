-- ============================================================
-- MIGRATION 1113: Restore Bank Transfer Journal Reference Type
-- Keeps branch-aware cash journaling while labeling transfers
-- correctly as bank transfers instead of generic cash-out.
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_journal_bank_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_je_id UUID;
  v_bank_gl_account_id UUID;
  v_opp_gl_account_id UUID;
  v_ref_type journal_reference_type;
  v_bank_branch_id UUID;
BEGIN
  SELECT account_id, branch_id
  INTO v_bank_gl_account_id, v_bank_branch_id
  FROM public.bank_accounts
  WHERE id = NEW.bank_account_id
    AND org_id = NEW.org_id;

  IF v_bank_gl_account_id IS NULL THEN
    RAISE EXCEPTION 'Bank account % tidak ditemukan untuk organisasi %', NEW.bank_account_id, NEW.org_id;
  END IF;

  IF NEW.branch_id IS NULL THEN
    NEW.branch_id := COALESCE(v_bank_branch_id, public.resolve_single_active_branch(NEW.org_id));
  END IF;

  IF NEW.branch_id IS NULL THEN
    RAISE EXCEPTION 'branch_id is required for bank transaction journaling on organization %', NEW.org_id;
  END IF;

  IF v_bank_branch_id IS NOT NULL AND NEW.branch_id IS DISTINCT FROM v_bank_branch_id THEN
    RAISE EXCEPTION 'bank transaction branch % does not match bank account branch %', NEW.branch_id, v_bank_branch_id;
  END IF;

  v_opp_gl_account_id := NEW.category_id;

  IF v_opp_gl_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.type::text = 'IN' THEN
    v_ref_type := 'CASH_IN';
  ELSIF NEW.type::text = 'TRANSFER' THEN
    v_ref_type := 'BANK_TRANSFER';
  ELSE
    v_ref_type := 'CASH_OUT';
  END IF;

  INSERT INTO public.journal_entries (
    org_id,
    branch_id,
    entry_date,
    description,
    reference_type,
    reference_id,
    status,
    is_auto,
    created_by
  ) VALUES (
    NEW.org_id,
    NEW.branch_id,
    NEW.transaction_date,
    NEW.description,
    v_ref_type,
    NEW.id,
    'POSTED',
    TRUE,
    NEW.created_by
  ) RETURNING id INTO v_je_id;

  IF NEW.type::text = 'IN' THEN
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
    VALUES (v_je_id, v_bank_gl_account_id, NEW.amount, 0, NEW.description);

    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
    VALUES (v_je_id, v_opp_gl_account_id, 0, NEW.amount, NEW.description);
  ELSE
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
    VALUES (v_je_id, v_opp_gl_account_id, NEW.amount, 0, NEW.description);

    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
    VALUES (v_je_id, v_bank_gl_account_id, 0, NEW.amount, NEW.description);
  END IF;

  NEW.journal_entry_id := v_je_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
