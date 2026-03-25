-- ==========================================
-- MIGRATION 039: Add Disbursement Account Mapping to Payroll
-- ==========================================

-- 1. Tambah kolom di payroll_runs
ALTER TABLE payroll_runs 
ADD COLUMN IF NOT EXISTS disbursement_account_id UUID REFERENCES accounts(id);

COMMENT ON COLUMN payroll_runs.disbursement_account_id IS 'Akun Bank/Kas yang digunakan untuk pencairan gaji pada periode ini.';

-- 2. Update Fungsi process_payroll_payment agar fleksibel
CREATE OR REPLACE FUNCTION process_payroll_payment(
    p_run_id UUID, 
    p_bank_account_id UUID, -- Fallback jika kolom disbursement_account_id kosong
    p_created_by UUID
)
RETURNS UUID AS $$
DECLARE
    v_run RECORD;
    v_je_id UUID;
    v_line RECORD;
    v_bank_acc_id UUID;
BEGIN
    -- 1. Ambil Info Run
    SELECT * INTO v_run FROM payroll_runs WHERE id = p_run_id;
    IF v_run.status = 'PAID' THEN
        RAISE EXCEPTION 'Payroll periode ini sudah diproses pembayarannya.';
    END IF;

    -- Tentukan Akun Bank (Prioritas: yang tersimpan di table > p_bank_account_id)
    v_bank_acc_id := COALESCE(v_run.disbursement_account_id, p_bank_account_id);
    
    IF v_bank_acc_id IS NULL THEN
        RAISE EXCEPTION 'Akun bank pembayaran tidak ditemukan. Harap pilih akun bank sumber dana.';
    END IF;

    -- 2. Create Journal Entry Header
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
        v_run.org_id,
        v_run.payment_date,
        'Payroll Disbursement: Periode ' || v_run.period_start::text || ' s/d ' || v_run.period_end::text,
        'PAYROLL',
        v_run.id,
        'POSTED',
        TRUE,
        p_created_by
    ) RETURNING id INTO v_je_id;

    -- 3. Create Journal Lines (Aggregate by account_id)
    FOR v_line IN 
        SELECT 
            account_id,
            SUM(CASE WHEN type IN ('EARNING', 'BENEFIT') THEN amount ELSE 0 END) as total_debit,
            SUM(CASE WHEN type IN ('DEDUCTION', 'TAX') THEN amount ELSE 0 END) as total_credit
        FROM payslip_lines
        WHERE payslip_id IN (SELECT id FROM payslips WHERE run_id = p_run_id)
        AND account_id IS NOT NULL
        GROUP BY account_id
    LOOP
        IF v_line.total_debit > 0 THEN
            INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo)
            VALUES (v_je_id, v_line.account_id, v_line.total_debit, 0, 'Beban Gaji & Komponen');
        END IF;

        IF v_line.total_credit > 0 THEN
            INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo)
            VALUES (v_je_id, v_line.account_id, 0, v_line.total_credit, 'Potongan/Pajak Gaji');
        END IF;
    END LOOP;

    -- 4. Balance: Kredit ke Bank (Net)
    INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo)
    VALUES (v_je_id, v_bank_acc_id, 0, v_run.total_net, 'Payroll Net Salary Transfer');

    -- 5. Update State
    UPDATE payroll_runs SET 
        status = 'PAID', 
        journal_entry_id = v_je_id,
        disbursement_account_id = v_bank_acc_id
    WHERE id = p_run_id;
    
    UPDATE payslips SET payment_status = 'PAID' WHERE run_id = p_run_id;

    RETURN v_je_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
