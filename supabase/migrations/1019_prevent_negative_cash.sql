-- ============================================================
-- MIGRATION 1019: Cash Balance Guard
-- Prevents Outgoing Cash transactions from exceeding available balance
-- Applies strictly on 1. Purchase Payments, 2. Manual Bank OUT TXs
-- ============================================================

-- Function to check cash balance efficiently
CREATE OR REPLACE FUNCTION public.check_cash_balance(p_org_id UUID, p_account_id UUID, p_amount DECIMAL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cash_normal_balance TEXT;
    v_cash_total_debit DECIMAL;
    v_cash_total_credit DECIMAL;
    v_cash_balance DECIMAL;
BEGIN
    SELECT total_debit, total_credit INTO v_cash_total_debit, v_cash_total_credit 
    FROM public.account_balances 
    WHERE org_id = p_org_id AND account_id = p_account_id;
    
    -- Cash/Bank is an Asset (Normal DEBIT)
    v_cash_balance := COALESCE(v_cash_total_debit, 0) - COALESCE(v_cash_total_credit, 0);
    
    IF v_cash_balance < p_amount THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;

-- 1. Update auto_journal_bank_transaction for Manual Transactions
CREATE OR REPLACE FUNCTION auto_journal_bank_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_je_id UUID;
  v_bank_gl_account_id UUID;
  v_opp_gl_account_id UUID;
  v_ref_type journal_reference_type;
  v_is_enough BOOLEAN;
  v_cash_total_debit DECIMAL;
  v_cash_total_credit DECIMAL;
  v_cash_balance DECIMAL;
BEGIN
  SELECT account_id INTO v_bank_gl_account_id FROM bank_accounts WHERE id = NEW.bank_account_id;
  v_opp_gl_account_id := NEW.category_id;
  
  IF v_opp_gl_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.type = 'IN' THEN
    v_ref_type := 'CASH_IN';
  ELSE
    v_ref_type := 'CASH_OUT';
    
    -- BALANCE CHECK
    SELECT total_debit, total_credit INTO v_cash_total_debit, v_cash_total_credit 
    FROM account_balances WHERE org_id = NEW.org_id AND account_id = v_bank_gl_account_id;
    
    v_cash_balance := COALESCE(v_cash_total_debit, 0) - COALESCE(v_cash_total_credit, 0);
    IF v_cash_balance < NEW.amount THEN
       RAISE EXCEPTION 'Saldo Kas Tidak Mencukupi! Saldo saat ini % lebih kecil dari tagihan %', v_cash_balance, NEW.amount;
    END IF;
  END IF;

  INSERT INTO journal_entries (
    org_id, entry_date, description, reference_type, reference_id, status, is_auto, created_by
  ) VALUES (
    NEW.org_id, NEW.transaction_date, NEW.description, v_ref_type, NEW.id, 'POSTED', TRUE, NEW.created_by
  ) RETURNING id INTO v_je_id;

  IF NEW.type = 'IN' THEN
    INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo) VALUES (v_je_id, v_bank_gl_account_id, NEW.amount, 0, NEW.description);
    INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo) VALUES (v_je_id, v_opp_gl_account_id, 0, NEW.amount, NEW.description);
  ELSE
    INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo) VALUES (v_je_id, v_opp_gl_account_id, NEW.amount, 0, NEW.description);
    INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo) VALUES (v_je_id, v_bank_gl_account_id, 0, NEW.amount, NEW.description);
  END IF;

  NEW.journal_entry_id := v_je_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update process_purchase_payment_atomic for Purchase Payments
CREATE OR REPLACE FUNCTION public.process_purchase_payment_atomic(
    p_org_id UUID, p_purchase_id UUID, p_account_id UUID, p_amount DECIMAL, p_discount DECIMAL, p_payment_date TIMESTAMPTZ, p_notes TEXT, p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_payment_id UUID;
    v_payment_number TEXT;
    v_je_id UUID;
    v_total_invoice DECIMAL;
    v_total_returned DECIMAL;
    v_total_paid DECIMAL;
    v_remaining_ap DECIMAL;
    v_count INT;
    acc_hutang UUID;
    acc_potongan UUID;
    v_is_enough BOOLEAN;
    v_cash_total_debit DECIMAL;
    v_cash_total_credit DECIMAL;
    v_cash_balance DECIMAL;
BEGIN
    SELECT id INTO acc_hutang FROM public.accounts WHERE code = '2101' AND org_id = p_org_id;
    SELECT id INTO acc_potongan FROM public.accounts WHERE code = '5004' AND org_id = p_org_id;

    IF acc_hutang IS NULL THEN RETURN jsonb_build_object('success', FALSE, 'error', 'Akun Hutang (2101) tidak ditemukan.'); END IF;

    -- BALANCE GUARD
    SELECT total_debit, total_credit INTO v_cash_total_debit, v_cash_total_credit 
    FROM public.account_balances WHERE org_id = p_org_id AND account_id = p_account_id;
    v_cash_balance := COALESCE(v_cash_total_debit, 0) - COALESCE(v_cash_total_credit, 0);
    
    IF v_cash_balance < p_amount THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'DITOLAK: Saldo Kas Tidak Mencukupi! Saldo (' || v_cash_balance || ') lebih kecil dari tagihan (' || p_amount || ')');
    END IF;

    SELECT grand_total INTO v_total_invoice FROM public.purchases WHERE id = p_purchase_id;
    SELECT COALESCE(SUM(total_amount), 0) INTO v_total_returned FROM public.purchase_returns WHERE purchase_id = p_purchase_id;
    SELECT COALESCE(SUM(amount + discount_amount), 0) INTO v_total_paid FROM public.purchase_payments WHERE purchase_id = p_purchase_id;
    
    v_remaining_ap := v_total_invoice - v_total_returned - v_total_paid;
    IF (p_amount + p_discount) > (v_remaining_ap + 0.01) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Jumlah bayar melebih sisa hutang: ' || v_remaining_ap);
    END IF;

    SELECT COUNT(*) + 1 INTO v_count FROM public.purchase_payments WHERE org_id = p_org_id AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
    v_payment_number := 'PPAY-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(v_count::TEXT, 6, '0');

    INSERT INTO public.purchase_payments (org_id, purchase_id, account_id, amount, discount_amount, payment_date, payment_number, notes, created_by)
    VALUES (p_org_id, p_purchase_id, p_account_id, p_amount, p_discount, p_payment_date, v_payment_number, p_notes, p_user_id)
    RETURNING id INTO v_payment_id;

    INSERT INTO public.journal_entries (org_id, entry_date, description, reference_type, reference_id, status, is_auto)
    VALUES (p_org_id, p_payment_date, 'Pembayaran Pembelian ' || v_payment_number, 'PURCHASE_PAYMENT', v_payment_id, 'POSTED', TRUE)
    RETURNING id INTO v_je_id;

    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, acc_hutang, p_amount + p_discount, 0);
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, p_account_id, 0, p_amount);
    
    IF p_discount > 0 THEN
        IF acc_potongan IS NULL THEN RETURN jsonb_build_object('success', FALSE, 'error', 'Akun Potongan (5004) tidak ditemukan.'); END IF;
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, acc_potongan, 0, p_discount);
    END IF;

    IF (v_total_paid + p_amount + p_discount) >= (v_total_invoice - v_total_returned - 0.01) THEN
        UPDATE public.purchases SET payment_status = 'PAID' WHERE id = p_purchase_id;
    ELSE
        UPDATE public.purchases SET payment_status = 'PARTIAL' WHERE id = p_purchase_id;
    END IF;

    RETURN jsonb_build_object('success', TRUE, 'payment_id', v_payment_id);
END;
$$;
