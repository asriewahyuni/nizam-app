-- ============================================================
-- MIGRATION 1123: Purchase SALAM Receivable + Payment Enforcement
-- ============================================================
-- Goals:
-- 1) Ensure CoA syariah has account 1404 (Piutang Salam Vendor)
-- 2) Route SALAM purchase payments to Piutang Salam Vendor (asset)
-- 3) Enforce SALAM purchase payments as full payment before receiving goods
-- ============================================================

CREATE OR REPLACE FUNCTION public.ensure_salam_vendor_receivable_account(p_org_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asset_root_id UUID;
  v_salam_receivable_id UUID;
BEGIN
  SELECT id
  INTO v_asset_root_id
  FROM public.accounts
  WHERE org_id = p_org_id
    AND code = '1000'
  LIMIT 1;

  IF v_asset_root_id IS NULL THEN
    SELECT id
    INTO v_asset_root_id
    FROM public.accounts
    WHERE org_id = p_org_id
      AND type = 'ASSET'
    ORDER BY code
    LIMIT 1;
  END IF;

  INSERT INTO public.accounts (
    org_id,
    code,
    name,
    type,
    normal_balance,
    parent_id,
    is_system,
    is_active
  )
  VALUES (
    p_org_id,
    '1404',
    'Piutang Salam Vendor',
    'ASSET',
    'DEBIT',
    v_asset_root_id,
    FALSE,
    TRUE
  )
  ON CONFLICT (org_id, code)
  DO UPDATE
    SET
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      normal_balance = EXCLUDED.normal_balance,
      parent_id = COALESCE(public.accounts.parent_id, EXCLUDED.parent_id),
      is_active = TRUE
  RETURNING id INTO v_salam_receivable_id;

  RETURN v_salam_receivable_id;
END;
$$;

DO $$
DECLARE
  v_org_id UUID;
BEGIN
  FOR v_org_id IN
    (
      SELECT DISTINCT org_id
      FROM public.purchases
      WHERE UPPER(COALESCE(shariah_mode::TEXT, 'CASH')) = 'SALAM'
      UNION
      SELECT DISTINCT org_id
      FROM public.accounts
      WHERE code = '2600'
    )
  LOOP
    PERFORM public.ensure_salam_vendor_receivable_account(v_org_id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_purchase_payment_atomic(
    p_org_id UUID,
    p_purchase_id UUID,
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
    v_remaining_ap DECIMAL;
    v_count INT;
    v_purchase RECORD;
    v_is_salam BOOLEAN := FALSE;
    v_debit_account_id UUID;
    acc_hutang UUID;
    acc_potongan UUID;
    v_cash_total_debit DECIMAL;
    v_cash_total_credit DECIMAL;
    v_cash_balance DECIMAL;
BEGIN
    SELECT id INTO acc_hutang FROM public.accounts WHERE code = '2101' AND org_id = p_org_id;
    SELECT id INTO acc_potongan FROM public.accounts WHERE code = '5004' AND org_id = p_org_id;

    SELECT id, branch_id, grand_total, shariah_mode
    INTO v_purchase
    FROM public.purchases
    WHERE id = p_purchase_id
      AND org_id = p_org_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Invoice pembelian tidak ditemukan.');
    END IF;

    v_is_salam := UPPER(COALESCE(v_purchase.shariah_mode::TEXT, 'CASH')) = 'SALAM';

    IF v_is_salam THEN
      v_debit_account_id := public.ensure_salam_vendor_receivable_account(p_org_id);
      IF v_debit_account_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Akun Piutang Salam Vendor (1404) belum tersedia di CoA.');
      END IF;
    ELSE
      v_debit_account_id := acc_hutang;
      IF v_debit_account_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Akun Hutang (2101) tidak ditemukan.');
      END IF;
    END IF;

    -- BALANCE GUARD
    SELECT total_debit, total_credit
    INTO v_cash_total_debit, v_cash_total_credit
    FROM public.account_balances
    WHERE org_id = p_org_id
      AND account_id = p_account_id;

    v_cash_balance := COALESCE(v_cash_total_debit, 0) - COALESCE(v_cash_total_credit, 0);

    IF v_cash_balance < p_amount THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'DITOLAK: Saldo Kas Tidak Mencukupi! Saldo (' || v_cash_balance || ') lebih kecil dari tagihan (' || p_amount || ')');
    END IF;

    v_total_invoice := COALESCE(v_purchase.grand_total, 0);
    SELECT COALESCE(SUM(total_amount), 0) INTO v_total_returned FROM public.purchase_returns WHERE purchase_id = p_purchase_id;
    SELECT COALESCE(SUM(amount + discount_amount), 0) INTO v_total_paid FROM public.purchase_payments WHERE purchase_id = p_purchase_id;

    v_remaining_ap := v_total_invoice - v_total_returned - v_total_paid;

    IF (p_amount + p_discount) > (v_remaining_ap + 0.01) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Jumlah bayar melebih sisa hutang: ' || v_remaining_ap);
    END IF;

    IF v_is_salam AND (p_amount + p_discount) < (v_remaining_ap - 0.01) THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Akad SALAM pembelian wajib lunas di awal. Sisa kewajiban: ' || v_remaining_ap);
    END IF;

    SELECT COUNT(*) + 1
    INTO v_count
    FROM public.purchase_payments
    WHERE org_id = p_org_id
      AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());

    v_payment_number := 'PPAY-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(v_count::TEXT, 6, '0');

    INSERT INTO public.purchase_payments (
      org_id,
      purchase_id,
      account_id,
      amount,
      discount_amount,
      payment_date,
      payment_number,
      notes,
      created_by
    )
    VALUES (
      p_org_id,
      p_purchase_id,
      p_account_id,
      p_amount,
      p_discount,
      p_payment_date,
      v_payment_number,
      p_notes,
      p_user_id
    )
    RETURNING id INTO v_payment_id;

    INSERT INTO public.journal_entries (
      org_id,
      branch_id,
      entry_date,
      description,
      reference_type,
      reference_id,
      status,
      is_auto
    )
    VALUES (
      p_org_id,
      v_purchase.branch_id,
      p_payment_date,
      CASE WHEN v_is_salam THEN 'Pembayaran SALAM Pembelian ' || v_payment_number ELSE 'Pembayaran Pembelian ' || v_payment_number END,
      'PURCHASE_PAYMENT',
      v_payment_id,
      'POSTED',
      TRUE
    )
    RETURNING id INTO v_je_id;

    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
    VALUES (v_je_id, v_debit_account_id, p_amount + p_discount, 0);

    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
    VALUES (v_je_id, p_account_id, 0, p_amount);

    IF p_discount > 0 THEN
        IF acc_potongan IS NULL THEN
             RETURN jsonb_build_object('success', FALSE, 'error', 'Akun Potongan (5004) tidak ditemukan.');
        END IF;
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
        VALUES (v_je_id, acc_potongan, 0, p_discount);
    END IF;

    IF (v_total_paid + p_amount + p_discount) >= (v_total_invoice - v_total_returned - 0.01) THEN
        UPDATE public.purchases SET payment_status = 'PAID' WHERE id = p_purchase_id;
    ELSE
        UPDATE public.purchases SET payment_status = 'PARTIAL' WHERE id = p_purchase_id;
    END IF;

    RETURN jsonb_build_object('success', TRUE, 'payment_id', v_payment_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_salam_vendor_receivable_account(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_purchase_payment_atomic(UUID, UUID, UUID, DECIMAL, DECIMAL, TIMESTAMPTZ, TEXT, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
