-- HRIS branch hardening:
-- 1. Make expense claims branch-aware
-- 2. Ensure expense journals inherit the originating branch
-- 3. Align RLS with org member unit access

ALTER TABLE public.expense_claims
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);

CREATE INDEX IF NOT EXISTS idx_expense_claims_org_branch_date
ON public.expense_claims(org_id, branch_id, claim_date DESC);

UPDATE public.expense_claims ec
SET branch_id = COALESCE(
  e.branch_id,
  public.resolve_single_active_branch(ec.org_id)
)
FROM public.employees e
WHERE e.id = ec.employee_id
  AND ec.branch_id IS DISTINCT FROM COALESCE(
    e.branch_id,
    public.resolve_single_active_branch(ec.org_id)
  );

UPDATE public.journal_entries je
SET branch_id = ec.branch_id
FROM public.expense_claims ec
WHERE ec.journal_entry_id = je.id
  AND ec.branch_id IS NOT NULL
  AND je.branch_id IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.expense_claims
    WHERE branch_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Unresolved branch_id remains on expense_claims.';
  END IF;
END $$;

ALTER TABLE public.expense_claims
ALTER COLUMN branch_id SET NOT NULL;

CREATE OR REPLACE FUNCTION public.set_expense_claim_branch_context()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_employee_org_id UUID;
  v_employee_branch_id UUID;
BEGIN
  SELECT org_id, branch_id
  INTO v_employee_org_id, v_employee_branch_id
  FROM public.employees
  WHERE id = NEW.employee_id;

  IF v_employee_org_id IS NULL THEN
    RAISE EXCEPTION 'Employee % not found.', NEW.employee_id;
  END IF;

  IF NEW.org_id IS NULL THEN
    NEW.org_id := v_employee_org_id;
  END IF;

  IF NEW.org_id <> v_employee_org_id THEN
    RAISE EXCEPTION 'Employee % does not belong to org %.', NEW.employee_id, NEW.org_id;
  END IF;

  IF v_employee_branch_id IS NULL THEN
    v_employee_branch_id := public.resolve_single_active_branch(NEW.org_id);
  END IF;

  IF v_employee_branch_id IS NULL THEN
    RAISE EXCEPTION 'Unable to resolve branch for employee %.', NEW.employee_id;
  END IF;

  NEW.branch_id := v_employee_branch_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_expense_claim_branch_context ON public.expense_claims;
CREATE TRIGGER trg_expense_claim_branch_context
BEFORE INSERT OR UPDATE OF org_id, employee_id
ON public.expense_claims
FOR EACH ROW
EXECUTE FUNCTION public.set_expense_claim_branch_context();

DROP POLICY IF EXISTS "admin_manage_expenses" ON public.expense_claims;
DROP POLICY IF EXISTS "emp_manage_own_expenses" ON public.expense_claims;

DROP POLICY IF EXISTS "branch_managers_manage_branch_expenses" ON public.expense_claims;
CREATE POLICY "branch_managers_manage_branch_expenses"
ON public.expense_claims
FOR ALL
USING (
  branch_id IS NOT NULL
  AND public.can_access_branch(org_id, branch_id)
  AND org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager', 'hr')
      AND is_active = TRUE
  )
)
WITH CHECK (
  branch_id IS NOT NULL
  AND public.can_access_branch(org_id, branch_id)
  AND org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager', 'hr')
      AND is_active = TRUE
  )
);

DROP POLICY IF EXISTS "employees_manage_own_branch_expenses" ON public.expense_claims;
CREATE POLICY "employees_manage_own_branch_expenses"
ON public.expense_claims
FOR ALL
USING (
  employee_id IN (
    SELECT e.id
    FROM public.employees e
    WHERE e.user_id = auth.uid()
      AND e.org_id = expense_claims.org_id
      AND e.branch_id = expense_claims.branch_id
  )
)
WITH CHECK (
  employee_id IN (
    SELECT e.id
    FROM public.employees e
    WHERE e.user_id = auth.uid()
      AND e.org_id = expense_claims.org_id
      AND e.branch_id = expense_claims.branch_id
  )
);

CREATE OR REPLACE FUNCTION public.process_expense_claim(
    p_claim_id UUID,
    p_approved_by UUID,
    p_expense_account_id UUID,
    p_payable_account_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_claim RECORD;
    v_je_id UUID;
BEGIN
    SELECT * INTO v_claim FROM public.expense_claims WHERE id = p_claim_id;
    
    IF v_claim.status != 'PENDING' THEN
        RAISE EXCEPTION 'Claim already processed.';
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
        v_claim.org_id,
        v_claim.branch_id,
        v_claim.claim_date,
        'Reimbursement: ' || v_claim.description,
        'EMPLOYEE_EXPENSE',
        v_claim.id,
        'POSTED',
        TRUE,
        p_approved_by
    ) RETURNING id INTO v_je_id;

    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
    VALUES (v_je_id, p_expense_account_id, v_claim.amount, 0, v_claim.description);
    
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
    VALUES (v_je_id, p_payable_account_id, 0, v_claim.amount, 'Payable to employee: ' || v_claim.employee_id);

    UPDATE public.expense_claims SET 
        status = 'APPROVED',
        approved_by = p_approved_by,
        journal_entry_id = v_je_id,
        updated_at = NOW()
    WHERE id = p_claim_id;

    RETURN v_je_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
