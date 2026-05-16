-- Fix generate_payslips_for_run: gross_salary and net_salary were missing v_basic_salary
-- Root cause: old version of function used v_total_earnings only (without v_basic_salary)
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
        v_basic_salary := COALESCE(v_employee.basic_salary, 0);
        v_total_earnings := 0;
        v_total_deductions := 0;

        INSERT INTO public.payslips (run_id, branch_id, employee_id, basic_salary, gross_salary, net_salary)
        VALUES (p_run_id, v_run.branch_id, v_employee.id, v_basic_salary, 0, 0)
        RETURNING id INTO v_payslip_id;

        INSERT INTO public.payslip_lines (payslip_id, component_name, type, amount, account_id)
        VALUES (v_payslip_id, 'Gaji Pokok', 'EARNING', v_basic_salary, v_basic_salary_account_id);

        FOR v_component IN
            SELECT
                pc.id, pc.account_id, pc.name, pc.type,
                COALESCE(ec.amount, pc.default_amount) AS amount,
                pc.is_percentage, pc.percentage_value
            FROM public.payroll_components pc
            LEFT JOIN public.employee_components ec
                ON pc.id = ec.component_id AND ec.employee_id = v_employee.id
            WHERE pc.org_id = v_run.org_id
              AND (ec.is_active IS TRUE OR ec.id IS NULL)
        LOOP
            IF v_component.is_percentage THEN
                v_amount := (v_component.percentage_value / 100.0) * v_basic_salary;
            ELSE
                v_amount := COALESCE(v_component.amount, 0);
            END IF;

            INSERT INTO public.payslip_lines (payslip_id, component_id, account_id, component_name, type, amount)
            VALUES (v_payslip_id, v_component.id, v_component.account_id, v_component.name, v_component.type, v_amount);

            IF v_component.type IN ('EARNING', 'BENEFIT') THEN
                v_total_earnings := v_total_earnings + v_amount;
            ELSIF v_component.type IN ('DEDUCTION', 'TAX') THEN
                v_total_deductions := v_total_deductions + v_amount;
            END IF;
        END LOOP;

        -- gross = basic + additional earnings (NOT counting the hardcoded Gaji Pokok line again)
        v_net_salary := v_basic_salary + v_total_earnings - v_total_deductions;

        UPDATE public.payslips SET
            gross_salary   = v_basic_salary + v_total_earnings,
            total_deductions = v_total_deductions,
            net_salary     = v_net_salary
        WHERE id = v_payslip_id;

        v_count := v_count + 1;
    END LOOP;

    UPDATE public.payroll_runs SET
        total_gross      = COALESCE((SELECT SUM(gross_salary)      FROM public.payslips WHERE run_id = p_run_id), 0),
        total_deductions = COALESCE((SELECT SUM(total_deductions)  FROM public.payslips WHERE run_id = p_run_id), 0),
        total_net        = COALESCE((SELECT SUM(net_salary)        FROM public.payslips WHERE run_id = p_run_id), 0)
    WHERE id = p_run_id;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
