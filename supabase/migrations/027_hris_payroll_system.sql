-- 1. ENUMS (Make Idempotent)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employment_status') THEN
        CREATE TYPE employment_status AS ENUM ('FULL_TIME', 'CONTRACT', 'PROBATION', 'INTERN', 'TERMINATED', 'RESIGNED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status') THEN
        CREATE TYPE attendance_status AS ENUM ('PRESENT', 'LATE', 'ABSENT', 'LEAVE', 'SICK', 'HALFDAY');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'leave_status') THEN
        CREATE TYPE leave_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_status') THEN
        CREATE TYPE payroll_status AS ENUM ('DRAFT', 'APPROVED', 'PAID');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_item_type') THEN
        CREATE TYPE payroll_item_type AS ENUM ('EARNING', 'DEDUCTION', 'TAX', 'BENEFIT');
    END IF;
END $$;


-- 2. EMPLOYEE MASTER DATA
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id), -- Optional link to app user
    nik VARCHAR(50) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(50),
    
    -- Demographics
    date_of_birth DATE,
    gender VARCHAR(20),
    marital_status VARCHAR(50), -- single, married, married_1_child, etc.
    tax_status VARCHAR(20), -- TK/0, K/1, dll for PTKP
    
    -- Employment Details
    job_title VARCHAR(100) NOT NULL,
    department VARCHAR(100),
    join_date DATE NOT NULL,
    end_date DATE,
    employment_status employment_status NOT NULL DEFAULT 'FULL_TIME',
    
    -- Bank & Payroll
    bank_name VARCHAR(100),
    bank_account_number VARCHAR(100),
    bank_account_holder VARCHAR(100),
    basic_salary NUMERIC(20, 2) NOT NULL DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(org_id, nik)
);

CREATE INDEX IF NOT EXISTS idx_employees_org ON employees(org_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(employment_status);


DROP TRIGGER IF EXISTS trg_employees_updated_at ON employees;
CREATE TRIGGER trg_employees_updated_at
    BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 3. PAYROLL COMPONENTS (Tunjangan & Potongan Tetap)
-- Maps to GL Accounts
CREATE TABLE IF NOT EXISTS payroll_components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- e.g., "Tunjangan Makan", "Potongan BPJS JHT"
    type payroll_item_type NOT NULL,
    is_taxable BOOLEAN NOT NULL DEFAULT TRUE,  -- Does it add to Gross Income for PPh21?
    default_amount NUMERIC(20, 2) DEFAULT 0,
    is_percentage BOOLEAN NOT NULL DEFAULT FALSE, -- e.g. BPJS is 2% of basic
    percentage_value NUMERIC(5, 2), 
    account_id UUID REFERENCES accounts(id), -- The GL Expense/Liability Account
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Employee Specific Components 
-- (Overrides default amount/percentage for specific employees)
CREATE TABLE IF NOT EXISTS employee_components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    component_id UUID NOT NULL REFERENCES payroll_components(id) ON DELETE CASCADE,
    amount NUMERIC(20, 2), -- Overrides default
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(employee_id, component_id)
);

-- 4. ATTENDANCE TRACKING
CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    record_date DATE NOT NULL,
    check_in TIMESTAMPTZ,
    check_out TIMESTAMPTZ,
    status attendance_status NOT NULL DEFAULT 'ABSENT',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(employee_id, record_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_org_date ON attendance(org_id, record_date);


-- 5. LEAVE MANAGEMENT (Cuti)
CREATE TABLE IF NOT EXISTS leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type VARCHAR(50) NOT NULL, -- Annual, Sick, Unpaid
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_taken NUMERIC(5, 1) NOT NULL,
    reason TEXT NOT NULL,
    status leave_status NOT NULL DEFAULT 'PENDING',
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. PERIODIC PAYROLL (Slip Gaji / Penggajian)
CREATE TABLE IF NOT EXISTS payroll_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    payment_date DATE NOT NULL,
    status payroll_status NOT NULL DEFAULT 'DRAFT',
    journal_entry_id UUID REFERENCES journal_entries(id), -- Link to general ledger
    total_gross NUMERIC(20, 2) NOT NULL DEFAULT 0,
    total_deductions NUMERIC(20, 2) NOT NULL DEFAULT 0,
    total_net NUMERIC(20, 2) NOT NULL DEFAULT 0,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Individual Payslips within a run
CREATE TABLE IF NOT EXISTS payslips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    basic_salary NUMERIC(20, 2) NOT NULL,
    gross_salary NUMERIC(20, 2) DEFAULT 0,
    total_deductions NUMERIC(20, 2) DEFAULT 0,
    net_salary NUMERIC(20, 2) NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'UNPAID', -- UNPAID, PAID
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure New Columns exist for existing tables
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS gross_salary NUMERIC(20, 2) DEFAULT 0;
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS total_deductions NUMERIC(20, 2) DEFAULT 0;


-- Detail line items per payslip (The Breakdown)
CREATE TABLE IF NOT EXISTS payslip_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payslip_id UUID NOT NULL REFERENCES payslips(id) ON DELETE CASCADE,
    component_name VARCHAR(100) NOT NULL,
    type payroll_item_type NOT NULL,
    amount NUMERIC(20, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure New Columns exist if table was already there
ALTER TABLE payslip_lines ADD COLUMN IF NOT EXISTS component_id UUID REFERENCES payroll_components(id) ON DELETE SET NULL;
ALTER TABLE payslip_lines ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id);

CREATE INDEX IF NOT EXISTS idx_payslip_lines_payslip ON payslip_lines(payslip_id);
CREATE INDEX IF NOT EXISTS idx_payslip_lines_component ON payslip_lines(component_id);




-- 7. REIMBURSEMENTS & EXPENSE CLAIMS (Bonus Feature)
CREATE TABLE IF NOT EXISTS expense_claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    claim_date DATE NOT NULL,
    category VARCHAR(50) NOT NULL, -- Mileage, Medical, Supplies
    amount NUMERIC(20, 2) NOT NULL,
    description TEXT NOT NULL,
    receipt_url TEXT,
    status leave_status NOT NULL DEFAULT 'PENDING', -- Reusing pending/approved/rejected
    approved_by UUID REFERENCES auth.users(id),
    journal_entry_id UUID REFERENCES journal_entries(id), -- Automatically log as expense liability
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

--- RLS POLICIES (Make Idempotent) ---

ALTER TYPE member_role ADD VALUE IF NOT EXISTS 'hr';

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE payslip_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_claims ENABLE ROW LEVEL SECURITY;

-- Admins/HR can manage all HR data
DROP POLICY IF EXISTS "admin_manage_hr" ON employees;
CREATE POLICY "admin_manage_hr" ON employees FOR ALL USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'hr'))
);

-- Employees can view their own data (ESS)
DROP POLICY IF EXISTS "emp_view_self" ON employees;
CREATE POLICY "emp_view_self" ON employees FOR SELECT USING (
    user_id = auth.uid()
);

DROP POLICY IF EXISTS "admin_manage_payroll" ON payroll_runs;
CREATE POLICY "admin_manage_payroll" ON payroll_runs FOR ALL USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'hr'))
);

DROP POLICY IF EXISTS "emp_view_payslip" ON payslips;
CREATE POLICY "emp_view_payslip" ON payslips FOR SELECT USING (
    employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "admin_manage_payroll_components" ON payroll_components;
CREATE POLICY "admin_manage_payroll_components" ON payroll_components FOR ALL USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'hr'))
);

DROP POLICY IF EXISTS "admin_manage_attendance" ON attendance;
CREATE POLICY "admin_manage_attendance" ON attendance FOR ALL USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'hr'))
);

DROP POLICY IF EXISTS "admin_manage_leaves" ON leave_requests;
CREATE POLICY "admin_manage_leaves" ON leave_requests FOR ALL USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'hr'))
);

DROP POLICY IF EXISTS "emp_view_attendance" ON attendance;
CREATE POLICY "emp_view_attendance" ON attendance FOR SELECT USING (
    employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "emp_manage_own_leaves" ON leave_requests;
CREATE POLICY "emp_manage_own_leaves" ON leave_requests FOR ALL USING (
    employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
);

-- Expense Claims
DROP POLICY IF EXISTS "admin_manage_expenses" ON expense_claims;
CREATE POLICY "admin_manage_expenses" ON expense_claims FOR ALL USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'hr'))
);

DROP POLICY IF EXISTS "emp_manage_own_expenses" ON expense_claims;
CREATE POLICY "emp_manage_own_expenses" ON expense_claims FOR ALL USING (
    employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
);

-- Employee Components
DROP POLICY IF EXISTS "admin_manage_emp_components" ON employee_components;
CREATE POLICY "admin_manage_emp_components" ON employee_components FOR ALL USING (
    employee_id IN (
        SELECT id FROM employees 
        WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'hr'))
    )
);

DROP POLICY IF EXISTS "emp_view_own_components" ON employee_components;
CREATE POLICY "emp_view_own_components" ON employee_components FOR SELECT USING (
    employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
);

-- Payslip Lines (Inherited RLS from Payslips)
DROP POLICY IF EXISTS "admin_manage_payslip_lines" ON payslip_lines;
CREATE POLICY "admin_manage_payslip_lines" ON payslip_lines FOR ALL USING (
    payslip_id IN (
        SELECT p.id FROM payslips p
        JOIN payroll_runs r ON p.run_id = r.id
        WHERE r.org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'hr'))
    )
);

DROP POLICY IF EXISTS "emp_view_own_payslip_lines" ON payslip_lines;
CREATE POLICY "emp_view_own_payslip_lines" ON payslip_lines FOR SELECT USING (
    payslip_id IN (
        SELECT id FROM payslips WHERE employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
    )
);

-- Triggers for updated_at (Make Idempotent)
DROP TRIGGER IF EXISTS trg_payroll_components_updated_at ON payroll_components;
CREATE TRIGGER trg_payroll_components_updated_at BEFORE UPDATE ON payroll_components FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_attendance_updated_at ON attendance;
CREATE TRIGGER trg_attendance_updated_at BEFORE UPDATE ON attendance FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_leave_requests_updated_at ON leave_requests;
CREATE TRIGGER trg_leave_requests_updated_at BEFORE UPDATE ON leave_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_payroll_runs_updated_at ON payroll_runs;
CREATE TRIGGER trg_payroll_runs_updated_at BEFORE UPDATE ON payroll_runs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_expense_claims_updated_at ON expense_claims;
CREATE TRIGGER trg_expense_claims_updated_at BEFORE UPDATE ON expense_claims FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();



--- 8. HELPER FUNCTIONS ---

-- Ensure Payroll Journal Enums exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'journal_reference_type' AND e.enumlabel = 'PAYROLL') THEN
        ALTER TYPE journal_reference_type ADD VALUE 'PAYROLL';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'journal_reference_type' AND e.enumlabel = 'EMPLOYEE_EXPENSE') THEN
        ALTER TYPE journal_reference_type ADD VALUE 'EMPLOYEE_EXPENSE';
    END IF;
EXCEPTION
    WHEN OTHERS THEN null;
END $$;

-- Function: Generate Payslips for a Payroll Run
-- Function: Generate Payslips for a Payroll Run (Detailed Version)
DROP FUNCTION IF EXISTS generate_payslips_for_run(UUID);
CREATE OR REPLACE FUNCTION generate_payslips_for_run(p_run_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_org_id UUID;
    v_status payroll_status;
    v_employee RECORD;
    v_component RECORD;
    v_payslip_id UUID;
    v_basic_salary NUMERIC;
    v_total_earnings NUMERIC := 0;
    v_total_deductions NUMERIC := 0;
    v_net_salary NUMERIC := 0;
    v_amount NUMERIC;
    v_basic_salary_account_id UUID;
    v_count INTEGER := 0;
BEGIN
    -- 1. Get Run Info & Org ID
    SELECT org_id, status INTO v_org_id, v_status FROM payroll_runs WHERE id = p_run_id;
    
    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'Payroll run not found.';
    END IF;

    IF v_status = 'PAID' THEN
        RAISE EXCEPTION 'Cannot re-generate slips for a PAID run.';
    END IF;

    -- 2. Clear existing slips for this run (Idempotency)
    DELETE FROM payslips WHERE run_id = p_run_id;

    -- 3. Find default Expense Account for Basic Salary
    SELECT id INTO v_basic_salary_account_id FROM accounts 
    WHERE org_id = v_org_id AND code = '6001' LIMIT 1;
    
    IF v_basic_salary_account_id IS NULL THEN
        SELECT id INTO v_basic_salary_account_id FROM accounts 
        WHERE org_id = v_org_id AND (code LIKE '6%' OR name ILIKE '%Beban Gaji%') LIMIT 1;
    END IF;

    -- 4. Loop through active employees in the org
    FOR v_employee IN 
        SELECT id, first_name, last_name, basic_salary FROM employees 
        WHERE org_id = v_org_id 
        AND employment_status NOT IN ('TERMINATED', 'RESIGNED')
    LOOP
        v_basic_salary := v_employee.basic_salary;
        v_total_earnings := 0;
        v_total_deductions := 0;

        -- Create Payslip Header (Totals will be updated after lines)
        INSERT INTO payslips (run_id, employee_id, basic_salary, net_salary)
        VALUES (p_run_id, v_employee.id, v_basic_salary, 0)
        RETURNING id INTO v_payslip_id;

        -- Add Basic Salary Line (Line #1)
        INSERT INTO payslip_lines (payslip_id, component_name, type, amount, account_id)
        VALUES (v_payslip_id, 'Gaji Pokok', 'EARNING', v_basic_salary, v_basic_salary_account_id);

        -- Gather Additional Components (Earnings/Deductions)
        FOR v_component IN 
            SELECT 
                pc.id, pc.account_id, pc.name, pc.type, 
                COALESCE(ec.amount, pc.default_amount) as amount,
                pc.is_percentage, pc.percentage_value
            FROM payroll_components pc
            LEFT JOIN employee_components ec ON pc.id = ec.component_id AND ec.employee_id = v_employee.id
            WHERE pc.org_id = v_org_id 
            AND (ec.is_active IS TRUE OR ec.id IS NULL)
        LOOP
            IF v_component.is_percentage THEN
                v_amount := (v_component.percentage_value / 100.0) * v_basic_salary;
            ELSE
                v_amount := v_component.amount;
            END IF;

            INSERT INTO payslip_lines (payslip_id, component_id, account_id, component_name, type, amount)
            VALUES (v_payslip_id, v_component.id, v_component.account_id, v_component.name, v_component.type, v_amount);

            IF v_component.type IN ('EARNING', 'BENEFIT') THEN
                v_total_earnings := v_total_earnings + v_amount;
            ELSIF v_component.type IN ('DEDUCTION', 'TAX') THEN
                v_total_deductions := v_total_deductions + v_amount;
            END IF;
        END LOOP;

        -- 5. Calculate Final Totals for this Payslip
        -- Gross = Basic + All other earnings/benefits
        v_net_salary := v_basic_salary + v_total_earnings - v_total_deductions;
        
        UPDATE payslips SET 
            gross_salary = v_basic_salary + v_total_earnings,
            total_deductions = v_total_deductions,
            net_salary = v_net_salary 
        WHERE id = v_payslip_id;

        v_count := v_count + 1;
    END LOOP;

    -- 6. Update Overall Payroll Run Totals
    UPDATE payroll_runs SET
        total_gross = (SELECT SUM(gross_salary) FROM payslips WHERE run_id = p_run_id),
        total_deductions = (SELECT SUM(total_deductions) FROM payslips WHERE run_id = p_run_id),
        total_net = (SELECT SUM(net_salary) FROM payslips WHERE run_id = p_run_id)
    WHERE id = p_run_id;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Function: Process Payroll Payment (Journalize)
CREATE OR REPLACE FUNCTION process_payroll_payment(
    p_run_id UUID, 
    p_bank_account_id UUID, -- account_id from bank_accounts table
    p_created_by UUID
)
RETURNS UUID AS $$
DECLARE
    v_run RECORD;
    v_je_id UUID;
    v_line RECORD;
    v_total_net NUMERIC := 0;
BEGIN
    -- 1. Get Run Info
    SELECT * INTO v_run FROM payroll_runs WHERE id = p_run_id;
    IF v_run.status = 'PAID' THEN
        RAISE EXCEPTION 'Payroll run already paid.';
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
        'Pembayaran Gaji Periode ' || v_run.period_start::text || ' s/d ' || v_run.period_end::text,
        'PAYROLL',
        v_run.id,
        'POSTED',
        TRUE,
        p_created_by
    ) RETURNING id INTO v_je_id;

    -- 3. Create Journal Lines (Aggregate by account_id)
    -- Debit Earnings/Benefits (Expenses)
    -- Credit Deductions/Tax (Liabilities/Tax Payable)
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

    -- Balance against Bank (Net Salary Credit)
    INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo)
    VALUES (v_je_id, p_bank_account_id, 0, v_run.total_net, 'Disbursement (Net Salary)');

    -- 4. Update HRIS Records
    UPDATE payroll_runs SET status = 'PAID', journal_entry_id = v_je_id WHERE id = p_run_id;
    UPDATE payslips SET payment_status = 'PAID' WHERE run_id = p_run_id;

    RETURN v_je_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get Attendance Summary
CREATE OR REPLACE FUNCTION get_attendance_summary(
    p_employee_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    total_days INTEGER,
    present_days INTEGER,
    late_days INTEGER,
    absent_days INTEGER,
    sick_days INTEGER,
    leave_days INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (p_end_date - p_start_date + 1)::INTEGER,
        COUNT(*) FILTER (WHERE status = 'PRESENT')::INTEGER,
        COUNT(*) FILTER (WHERE status = 'PRESENT' AND check_in > (record_date + interval '9 hours'))::INTEGER, 
        COUNT(*) FILTER (WHERE status = 'ABSENT')::INTEGER,
        COUNT(*) FILTER (WHERE status = 'SICK')::INTEGER,
        COUNT(*) FILTER (WHERE status = 'LEAVE')::INTEGER
    FROM attendance
    WHERE employee_id = p_employee_id
    AND record_date BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Function: Process Expense Claim (Approve & Journal)
CREATE OR REPLACE FUNCTION process_expense_claim(
    p_claim_id UUID,
    p_approved_by UUID,
    p_expense_account_id UUID, -- The GL Account for this category
    p_payable_account_id UUID  -- Usually a "Utang Karyawan" / Employee Payable account
)
RETURNS UUID AS $$
DECLARE
    v_claim RECORD;
    v_je_id UUID;
BEGIN
    SELECT * INTO v_claim FROM expense_claims WHERE id = p_claim_id;
    
    IF v_claim.status != 'PENDING' THEN
        RAISE EXCEPTION 'Claim already processed.';
    END IF;

    -- 1. Create Journal Entry
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
        v_claim.org_id,
        v_claim.claim_date,
        'Reimbursement: ' || v_claim.description,
        'EMPLOYEE_EXPENSE',
        v_claim.id,
        'POSTED',
        TRUE,
        p_approved_by
    ) RETURNING id INTO v_je_id;

    -- 2. Journal Lines
    -- Debit Expense
    INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo)
    VALUES (v_je_id, p_expense_account_id, v_claim.amount, 0, v_claim.description);
    
    -- Credit Liability (Employee Payable)
    INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo)
    VALUES (v_je_id, p_payable_account_id, 0, v_claim.amount, 'Payable to employee: ' || v_claim.employee_id);

    -- 3. Update Claim
    UPDATE expense_claims SET 
        status = 'APPROVED',
        approved_by = p_approved_by,
        journal_entry_id = v_je_id,
        updated_at = NOW()
    WHERE id = p_claim_id;

    RETURN v_je_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. VIEWS
CREATE OR REPLACE VIEW v_employee_details AS
SELECT 
    e.*,
    o.name as organization_name,
    (SELECT COUNT(*) FROM attendance a WHERE a.employee_id = e.id AND a.record_date = CURRENT_DATE) > 0 as is_present_today,
    (SELECT SUM(amount) FROM employee_components ec JOIN payroll_components pc ON ec.component_id = pc.id WHERE ec.employee_id = e.id AND pc.type = 'EARNING' AND ec.is_active = true) as total_allowances
FROM employees e
JOIN organizations o ON e.org_id = o.id;

-- 10. WRAP UP
COMMENT ON TABLE employees IS 'Master data karyawan untuk HRIS dan Payroll.';
COMMENT ON TABLE payroll_runs IS 'Periode penggajian bulanan atau mingguan.';
COMMENT ON TABLE expense_claims IS 'Klaim pengeluaran / reimbursement karyawan.';

-- Function: Void Payroll Run
CREATE OR REPLACE FUNCTION void_payroll_run(p_run_id UUID)
RETURNS void AS $$
DECLARE
    v_je_id UUID;
BEGIN
    SELECT journal_entry_id INTO v_je_id FROM payroll_runs WHERE id = p_run_id;
    
    -- 1. Void Journal Entry if exists
    IF v_je_id IS NOT NULL THEN
        UPDATE journal_entries SET status = 'VOIDED' WHERE id = v_je_id;
    END IF;

    -- 2. Reset Run & Payslips
    UPDATE payroll_runs SET status = 'DRAFT', journal_entry_id = NULL WHERE id = p_run_id;
    UPDATE payslips SET payment_status = 'UNPAID' WHERE run_id = p_run_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;





