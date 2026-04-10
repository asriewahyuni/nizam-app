-- ============================================================
-- MIGRATION 1168: Fix Payroll Payment Disbursement Runtime
-- ============================================================
-- Why:
-- Beberapa environment masih men-trigger error:
--   record "v_run" has no field "disbursement_account_id"
-- saat memanggil public.process_payroll_payment().
--
-- Root cause:
-- Fungsi lama membaca SELECT * ke RECORD lalu mengakses field
-- disbursement_account_id. Bila schema belum konsisten, akses field ini
-- meledak di runtime.
--
-- This migration:
-- 1) Memastikan kolom payroll_runs.disbursement_account_id ada.
-- 2) Menulis ulang function process_payroll_payment agar tidak bergantung
--    pada RECORD.* yang rapuh.

ALTER TABLE public.payroll_runs
ADD COLUMN IF NOT EXISTS disbursement_account_id UUID REFERENCES public.accounts(id);

COMMENT ON COLUMN public.payroll_runs.disbursement_account_id
IS 'Akun Bank/Kas yang digunakan untuk pencairan gaji pada periode ini.';

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
        v_payment_date,
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
        disbursement_account_id = v_bank_acc_id
    WHERE id = p_run_id;

    UPDATE public.payslips
    SET payment_status = 'PAID'
    WHERE run_id = p_run_id;

    RETURN v_je_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
