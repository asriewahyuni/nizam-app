-- Payroll branch context
-- Payroll components stay org-wide, but payroll runs and payslips are scoped to a unit.

ALTER TABLE public.payroll_runs
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);

ALTER TABLE public.payslips
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_org_branch_period
ON public.payroll_runs(org_id, branch_id, period_start DESC);

CREATE INDEX IF NOT EXISTS idx_payslips_run_branch
ON public.payslips(run_id, branch_id, employee_id);

UPDATE public.payslips p
SET branch_id = COALESCE(e.branch_id, p.branch_id)
FROM public.employees e
WHERE e.id = p.employee_id
  AND p.branch_id IS DISTINCT FROM COALESCE(e.branch_id, p.branch_id);

UPDATE public.payroll_runs r
SET branch_id = COALESCE(
  branch_lookup.branch_id,
  public.resolve_single_active_branch(r.org_id)
)
FROM (
  SELECT
    p.run_id,
    CASE
      WHEN COUNT(DISTINCT p.branch_id) FILTER (WHERE p.branch_id IS NOT NULL) = 1
        THEN MIN((p.branch_id)::text) FILTER (WHERE p.branch_id IS NOT NULL)::uuid
      ELSE NULL
    END AS branch_id
  FROM public.payslips p
  GROUP BY p.run_id
) AS branch_lookup
WHERE branch_lookup.run_id = r.id
  AND r.branch_id IS DISTINCT FROM COALESCE(
    branch_lookup.branch_id,
    public.resolve_single_active_branch(r.org_id)
  );

UPDATE public.payroll_runs r
SET branch_id = public.resolve_single_active_branch(r.org_id)
WHERE r.branch_id IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.payroll_runs
    WHERE branch_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Unresolved branch_id remains on payroll_runs.';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.payslips
    WHERE branch_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Unresolved branch_id remains on payslips.';
  END IF;
END $$;

ALTER TABLE public.payroll_runs
ALTER COLUMN branch_id SET NOT NULL;

ALTER TABLE public.payslips
ALTER COLUMN branch_id SET NOT NULL;

DROP POLICY IF EXISTS "admin_manage_payroll" ON public.payroll_runs;
CREATE POLICY "admin_manage_payroll"
ON public.payroll_runs
FOR ALL
USING (
  public.can_access_branch(org_id, branch_id)
  AND org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'hr')
      AND is_active = TRUE
  )
)
WITH CHECK (
  public.can_access_branch(org_id, branch_id)
  AND org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'hr')
      AND is_active = TRUE
  )
);

DROP POLICY IF EXISTS "admin_manage_payslips" ON public.payslips;
CREATE POLICY "admin_manage_payslips"
ON public.payslips
FOR ALL
USING (
  branch_id IS NOT NULL
  AND public.can_access_branch(
    (SELECT r.org_id FROM public.payroll_runs r WHERE r.id = payslips.run_id),
    branch_id
  )
  AND EXISTS (
    SELECT 1
    FROM public.payroll_runs r
    JOIN public.org_members om ON om.org_id = r.org_id
    WHERE r.id = payslips.run_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'hr')
      AND om.is_active = TRUE
  )
)
WITH CHECK (
  branch_id IS NOT NULL
  AND public.can_access_branch(
    (SELECT r.org_id FROM public.payroll_runs r WHERE r.id = payslips.run_id),
    branch_id
  )
  AND EXISTS (
    SELECT 1
    FROM public.payroll_runs r
    JOIN public.org_members om ON om.org_id = r.org_id
    WHERE r.id = payslips.run_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'hr')
      AND om.is_active = TRUE
  )
);

DROP POLICY IF EXISTS "admin_manage_payslip_lines" ON public.payslip_lines;
CREATE POLICY "admin_manage_payslip_lines"
ON public.payslip_lines
FOR ALL
USING (
  payslip_id IN (
    SELECT p.id
    FROM public.payslips p
    JOIN public.payroll_runs r ON p.run_id = r.id
    WHERE p.branch_id IS NOT NULL
      AND public.can_access_branch(r.org_id, p.branch_id)
      AND r.org_id IN (
        SELECT org_id
        FROM public.org_members
        WHERE user_id = auth.uid()
          AND role IN ('owner', 'admin', 'hr')
          AND is_active = TRUE
      )
  )
)
WITH CHECK (
  payslip_id IN (
    SELECT p.id
    FROM public.payslips p
    JOIN public.payroll_runs r ON p.run_id = r.id
    WHERE p.branch_id IS NOT NULL
      AND public.can_access_branch(r.org_id, p.branch_id)
      AND r.org_id IN (
        SELECT org_id
        FROM public.org_members
        WHERE user_id = auth.uid()
          AND role IN ('owner', 'admin', 'hr')
          AND is_active = TRUE
      )
  )
);

DROP FUNCTION IF EXISTS public.generate_payslips_for_run(UUID);
CREATE OR REPLACE FUNCTION public.generate_payslips_for_run(p_run_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_run RECORD;
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
    SELECT * INTO v_run FROM public.payroll_runs WHERE id = p_run_id;
    
    IF v_run.org_id IS NULL THEN
        RAISE EXCEPTION 'Payroll run not found.';
    END IF;

    IF v_run.branch_id IS NULL THEN
        RAISE EXCEPTION 'Payroll run branch context is required.';
    END IF;

    IF v_run.status = 'PAID' THEN
        RAISE EXCEPTION 'Cannot re-generate slips for a PAID run.';
    END IF;

    DELETE FROM public.payslips WHERE run_id = p_run_id;

    SELECT id INTO v_basic_salary_account_id FROM public.accounts
    WHERE org_id = v_run.org_id AND code = '6001' LIMIT 1;
    
    IF v_basic_salary_account_id IS NULL THEN
        SELECT id INTO v_basic_salary_account_id FROM public.accounts
        WHERE org_id = v_run.org_id AND (code LIKE '6%' OR name ILIKE '%Beban Gaji%') LIMIT 1;
    END IF;

    FOR v_employee IN
        SELECT id, first_name, last_name, basic_salary, branch_id
        FROM public.employees
        WHERE org_id = v_run.org_id
          AND branch_id = v_run.branch_id
          AND employment_status NOT IN ('TERMINATED', 'RESIGNED')
    LOOP
        v_basic_salary := v_employee.basic_salary;
        v_total_earnings := 0;
        v_total_deductions := 0;

        INSERT INTO public.payslips (run_id, branch_id, employee_id, basic_salary, net_salary)
        VALUES (p_run_id, v_run.branch_id, v_employee.id, v_basic_salary, 0)
        RETURNING id INTO v_payslip_id;

        INSERT INTO public.payslip_lines (payslip_id, component_name, type, amount, account_id)
        VALUES (v_payslip_id, 'Gaji Pokok', 'EARNING', v_basic_salary, v_basic_salary_account_id);

        FOR v_component IN
            SELECT
                pc.id, pc.account_id, pc.name, pc.type,
                COALESCE(ec.amount, pc.default_amount) as amount,
                pc.is_percentage, pc.percentage_value
            FROM public.payroll_components pc
            LEFT JOIN public.employee_components ec ON pc.id = ec.component_id AND ec.employee_id = v_employee.id
            WHERE pc.org_id = v_run.org_id
              AND (ec.is_active IS TRUE OR ec.id IS NULL)
        LOOP
            IF v_component.is_percentage THEN
                v_amount := (v_component.percentage_value / 100.0) * v_basic_salary;
            ELSE
                v_amount := v_component.amount;
            END IF;

            INSERT INTO public.payslip_lines (payslip_id, component_id, account_id, component_name, type, amount)
            VALUES (v_payslip_id, v_component.id, v_component.account_id, v_component.name, v_component.type, v_amount);

            IF v_component.type IN ('EARNING', 'BENEFIT') THEN
                v_total_earnings := v_total_earnings + v_amount;
            ELSIF v_component.type IN ('DEDUCTION', 'TAX') THEN
                v_total_deductions := v_total_deductions + v_amount;
            END IF;
        END LOOP;

        v_net_salary := v_basic_salary + v_total_earnings - v_total_deductions;
        
        UPDATE public.payslips SET
            gross_salary = v_basic_salary + v_total_earnings,
            total_deductions = v_total_deductions,
            net_salary = v_net_salary
        WHERE id = v_payslip_id;

        v_count := v_count + 1;
    END LOOP;

    UPDATE public.payroll_runs SET
        total_gross = COALESCE((SELECT SUM(gross_salary) FROM public.payslips WHERE run_id = p_run_id), 0),
        total_deductions = COALESCE((SELECT SUM(total_deductions) FROM public.payslips WHERE run_id = p_run_id), 0),
        total_net = COALESCE((SELECT SUM(net_salary) FROM public.payslips WHERE run_id = p_run_id), 0)
    WHERE id = p_run_id;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.process_payroll_payment(
    p_run_id UUID,
    p_bank_account_id UUID,
    p_created_by UUID
)
RETURNS UUID AS $$
DECLARE
    v_run RECORD;
    v_je_id UUID;
    v_line RECORD;
    v_bank_acc_id UUID;
BEGIN
    SELECT * INTO v_run FROM public.payroll_runs WHERE id = p_run_id;
    IF v_run.status = 'PAID' THEN
        RAISE EXCEPTION 'Payroll periode ini sudah diproses pembayarannya.';
    END IF;

    IF v_run.branch_id IS NULL THEN
        RAISE EXCEPTION 'Payroll run branch context is required.';
    END IF;

    v_bank_acc_id := COALESCE(v_run.disbursement_account_id, p_bank_account_id);
    
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
        v_run.org_id,
        v_run.branch_id,
        v_run.payment_date,
        'Payroll Disbursement: Periode ' || v_run.period_start::text || ' s/d ' || v_run.period_end::text,
        'PAYROLL',
        v_run.id,
        'POSTED',
        TRUE,
        p_created_by
    ) RETURNING id INTO v_je_id;

    FOR v_line IN
        SELECT
            account_id,
            SUM(CASE WHEN type IN ('EARNING', 'BENEFIT') THEN amount ELSE 0 END) as total_debit,
            SUM(CASE WHEN type IN ('DEDUCTION', 'TAX') THEN amount ELSE 0 END) as total_credit
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
    VALUES (v_je_id, v_bank_acc_id, 0, v_run.total_net, 'Payroll Net Salary Transfer');

    UPDATE public.payroll_runs SET
        status = 'PAID',
        journal_entry_id = v_je_id,
        disbursement_account_id = v_bank_acc_id
    WHERE id = p_run_id;
    
    UPDATE public.payslips SET payment_status = 'PAID' WHERE run_id = p_run_id;

    RETURN v_je_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
