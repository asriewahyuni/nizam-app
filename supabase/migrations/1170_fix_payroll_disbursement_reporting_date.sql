-- ============================================================
-- MIGRATION 1170: Fix Payroll Disbursement Reporting Date
-- ============================================================
-- Why:
-- Ada kasus payroll sudah "PAID" dan jurnal sudah tercatat, tetapi tidak
-- muncul di Neraca / P&L / Cashflow untuk hari berjalan.
--
-- Root cause:
-- Laporan mengambil jurnal POSTED berbasis entry_date.
-- Sebagian jurnal payroll tersimpan dengan entry_date di masa depan
-- (lebih besar dari tanggal hari ini Asia/Jakarta), sehingga tidak ikut
-- rentang laporan default.
--
-- This migration:
-- 1) Backfill jurnal payroll POSTED yang entry_date-nya di masa depan
--    agar menggunakan tanggal disbursement efektif (maksimal hari ini).
-- 2) Hardening function process_payroll_payment supaya tidak pernah
--    menulis entry_date di masa depan.

CREATE OR REPLACE FUNCTION public.process_payroll_payment(
    p_run_id UUID,
    p_bank_account_id UUID,
    p_created_by UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_id UUID;
    v_branch_id UUID;
    v_status TEXT;
    v_payment_date DATE;
    v_period_start DATE;
    v_period_end DATE;
    v_total_net NUMERIC;
    v_saved_disbursement_account_id UUID;
    v_je_id UUID;
    v_line RECORD;
    v_bank_acc_id UUID;
    v_today_jkt DATE := (timezone('Asia/Jakarta', now()))::DATE;
    v_effective_payment_date DATE;
BEGIN
    SELECT
        r.org_id,
        r.branch_id,
        r.status::TEXT,
        r.payment_date,
        r.period_start,
        r.period_end,
        r.total_net,
        r.disbursement_account_id
    INTO
        v_org_id,
        v_branch_id,
        v_status,
        v_payment_date,
        v_period_start,
        v_period_end,
        v_total_net,
        v_saved_disbursement_account_id
    FROM public.payroll_runs r
    WHERE r.id = p_run_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payroll run tidak ditemukan.';
    END IF;

    IF v_status = 'PAID' THEN
        RAISE EXCEPTION 'Payroll periode ini sudah diproses pembayarannya.';
    END IF;

    IF v_branch_id IS NULL THEN
        RAISE EXCEPTION 'Payroll run branch context is required.';
    END IF;

    v_bank_acc_id := COALESCE(v_saved_disbursement_account_id, p_bank_account_id);

    IF v_bank_acc_id IS NULL THEN
        RAISE EXCEPTION 'Akun bank pembayaran tidak ditemukan. Harap pilih akun bank sumber dana.';
    END IF;

    -- Jangan biarkan jurnal payroll tercatat di masa depan karena akan
    -- terlewat dari range laporan default.
    v_effective_payment_date := COALESCE(v_payment_date, v_today_jkt);
    IF v_effective_payment_date > v_today_jkt THEN
        v_effective_payment_date := v_today_jkt;
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
        v_org_id,
        v_branch_id,
        v_effective_payment_date,
        'Payroll Disbursement: Periode ' || v_period_start::TEXT || ' s/d ' || v_period_end::TEXT,
        'PAYROLL',
        p_run_id,
        'POSTED',
        TRUE,
        p_created_by
    ) RETURNING id INTO v_je_id;

    FOR v_line IN
        SELECT
            account_id,
            SUM(CASE WHEN type IN ('EARNING', 'BENEFIT') THEN amount ELSE 0 END) AS total_debit,
            SUM(CASE WHEN type IN ('DEDUCTION', 'TAX') THEN amount ELSE 0 END) AS total_credit
        FROM public.payslip_lines
        WHERE payslip_id IN (SELECT id FROM public.payslips WHERE run_id = p_run_id)
          AND account_id IS NOT NULL
        GROUP BY account_id
    LOOP
        IF v_line.total_debit > 0 THEN
            INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
            VALUES (v_je_id, v_line.account_id, v_line.total_debit, 0, 'Beban Gaji & Komponen');
        END IF;

        IF v_line.total_credit > 0 THEN
            INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
            VALUES (v_je_id, v_line.account_id, 0, v_line.total_credit, 'Potongan/Pajak Gaji');
        END IF;
    END LOOP;

    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
    VALUES (v_je_id, v_bank_acc_id, 0, v_total_net, 'Payroll Net Salary Transfer');

    UPDATE public.payroll_runs
    SET
        status = 'PAID',
        journal_entry_id = v_je_id,
        disbursement_account_id = v_bank_acc_id,
        payment_date = v_effective_payment_date
    WHERE id = p_run_id;

    UPDATE public.payslips
    SET payment_status = 'PAID'
    WHERE run_id = p_run_id;

    RETURN v_je_id;
END;
$$;

DO $$
DECLARE
    v_today_jkt DATE := (timezone('Asia/Jakarta', now()))::DATE;
BEGIN
    -- 1) Sinkronkan payment_date run PAID agar tidak di masa depan.
    UPDATE public.payroll_runs r
    SET payment_date = LEAST(COALESCE(r.payment_date, v_today_jkt), v_today_jkt)
    WHERE r.status = 'PAID'
      AND r.journal_entry_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.journal_entries je
        WHERE je.id = r.journal_entry_id
          AND je.reference_type = 'PAYROLL'
          AND je.status = 'POSTED'
          AND je.entry_date > v_today_jkt
      );

    -- 2) Sinkronkan entry_date jurnal payroll POSTED yang di masa depan.
    UPDATE public.journal_entries je
    SET entry_date = LEAST(COALESCE(r.payment_date, v_today_jkt), v_today_jkt)
    FROM public.payroll_runs r
    WHERE je.id = r.journal_entry_id
      AND r.status = 'PAID'
      AND je.reference_type = 'PAYROLL'
      AND je.status = 'POSTED'
      AND je.entry_date > v_today_jkt;
END $$;

NOTIFY pgrst, 'reload schema';
