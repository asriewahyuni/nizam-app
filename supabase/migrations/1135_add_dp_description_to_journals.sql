-- ============================================================
-- MIGRATION 1135: Add DP or Notes description to Journals
-- ============================================================

CREATE OR REPLACE FUNCTION public.process_sales_payment_atomic(
    p_org_id UUID,
    p_sale_id UUID,
    p_account_id UUID,
    p_amount DECIMAL,
    p_discount DECIMAL,
    p_payment_date TIMESTAMPTZ,
    p_notes TEXT,
    p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_payment_id UUID;
    v_payment_number TEXT;
    v_je_id UUID;
    v_total_invoice DECIMAL;
    v_total_returned DECIMAL;
    v_total_paid DECIMAL;
    v_remaining_ar DECIMAL;
    v_count INT;
    v_sale RECORD;
    v_is_salam BOOLEAN := FALSE;
    v_is_istishna BOOLEAN := FALSE;
    v_credit_account_id UUID;
    acc_piutang UUID;
    acc_diskon UUID;
    v_journal_desc TEXT;
BEGIN
    SELECT id INTO acc_piutang FROM public.accounts WHERE code = '1201' AND org_id = p_org_id;
    SELECT id INTO acc_diskon FROM public.accounts WHERE code = '4002' AND org_id = p_org_id;

    SELECT id, branch_id, grand_total, shariah_mode, status
    INTO v_sale
    FROM public.sales
    WHERE id = p_sale_id
      AND org_id = p_org_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Invoice penjualan tidak ditemukan.');
    END IF;

    v_is_salam := UPPER(COALESCE(v_sale.shariah_mode::TEXT, 'CASH')) = 'SALAM';
    v_is_istishna := UPPER(COALESCE(v_sale.shariah_mode::TEXT, 'CASH')) = 'ISTISHNA';

    IF v_is_salam THEN
      v_credit_account_id := public.ensure_salam_liability_account(p_org_id);
      IF v_credit_account_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Akun Hutang Salam (2602) belum tersedia di CoA.');
      END IF;
    ELSIF v_is_istishna THEN
      IF COALESCE(v_sale.status::TEXT, '') = 'FINISHED' THEN
        v_credit_account_id := acc_piutang;
        IF v_credit_account_id IS NULL THEN
          RETURN jsonb_build_object('success', FALSE, 'error', 'Akun Piutang (1201) tidak ditemukan.');
        END IF;
      ELSE
        v_credit_account_id := public.ensure_istishna_liability_account(p_org_id);
        IF v_credit_account_id IS NULL THEN
          RETURN jsonb_build_object('success', FALSE, 'error', 'Akun Hutang Istishna (2603) belum tersedia di CoA.');
        END IF;
      END IF;
    ELSE
      v_credit_account_id := acc_piutang;
      IF v_credit_account_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Akun Piutang (1201) tidak ditemukan.');
      END IF;
    END IF;

    v_total_invoice := COALESCE(v_sale.grand_total, 0);
    SELECT COALESCE(SUM(grand_total), 0) INTO v_total_returned FROM public.sales_returns WHERE sale_id = p_sale_id;
    SELECT COALESCE(SUM(amount + discount_amount), 0) INTO v_total_paid FROM public.sales_payments WHERE sale_id = p_sale_id;

    v_remaining_ar := v_total_invoice - v_total_returned - v_total_paid;

    IF (p_amount + p_discount) > (v_remaining_ar + 0.01) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Jumlah bayar + diskon melebih sisa tagihan: ' || v_remaining_ar);
    END IF;

    IF v_is_salam AND (p_amount + p_discount) < (v_remaining_ar - 0.01) THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Akad SALAM wajib lunas di awal. Sisa tagihan: ' || v_remaining_ar);
    END IF;

    SELECT COUNT(*) + 1 INTO v_count FROM public.sales_payments WHERE org_id = p_org_id AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
    v_payment_number := 'PAY-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(v_count::TEXT, 6, '0');

    INSERT INTO public.sales_payments (
      org_id, branch_id, sale_id, account_id, amount, discount_amount, payment_date, payment_number, notes, created_by
    )
    VALUES (
      p_org_id, v_sale.branch_id, p_sale_id, p_account_id, p_amount, p_discount, p_payment_date, v_payment_number, p_notes, p_user_id
    )
    RETURNING id INTO v_payment_id;

    -- Generate Journal Description combining Payment Type + Number + Notes (DP explicit)
    v_journal_desc := CASE 
        WHEN v_is_salam THEN 'Pembayaran SALAM ' || v_payment_number 
        WHEN v_is_istishna THEN 'Pembayaran ISTISHNA ' || v_payment_number 
        ELSE 'Pembayaran Invoice ' || v_payment_number 
    END;

    IF p_notes IS NOT NULL AND BTRIM(p_notes) != '' THEN
        v_journal_desc := v_journal_desc || ' (' || p_notes || ')';
    END IF;

    INSERT INTO public.journal_entries (
      org_id, branch_id, entry_date, description, reference_type, reference_id, status, is_auto
    )
    VALUES (
      p_org_id,
      v_sale.branch_id,
      p_payment_date,
      v_journal_desc,
      'PAYMENT_IN',
      v_payment_id,
      'POSTED',
      TRUE
    )
    RETURNING id INTO v_je_id;

    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, p_account_id, p_amount, 0);

    IF p_discount > 0 THEN
        IF acc_diskon IS NULL THEN
             RETURN jsonb_build_object('success', FALSE, 'error', 'Akun Diskon Penjualan (4002) tidak ditemukan.');
        END IF;
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, acc_diskon, p_discount, 0);
    END IF;

    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
    VALUES (v_je_id, v_credit_account_id, 0, p_amount + p_discount);

    IF (v_total_paid + p_amount + p_discount) >= (v_total_invoice - v_total_returned - 0.01) THEN
        UPDATE public.sales SET payment_status = 'PAID' WHERE id = p_sale_id;
    ELSE
        UPDATE public.sales SET payment_status = 'PARTIAL' WHERE id = p_sale_id;
    END IF;

    RETURN jsonb_build_object('success', TRUE, 'payment_id', v_payment_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;
