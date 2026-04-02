-- HRIS operational branch hardening:
-- 1. Make leave requests branch-aware
-- 2. Ensure leave requests inherit branch context from employee master
-- 3. Align leave RLS with org member unit access

ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);

CREATE INDEX IF NOT EXISTS idx_leave_requests_org_branch_period
ON public.leave_requests(org_id, branch_id, start_date DESC, status);

UPDATE public.leave_requests lr
SET branch_id = COALESCE(
  e.branch_id,
  public.resolve_single_active_branch(lr.org_id)
)
FROM public.employees e
WHERE e.id = lr.employee_id
  AND lr.branch_id IS DISTINCT FROM COALESCE(
    e.branch_id,
    public.resolve_single_active_branch(lr.org_id)
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.leave_requests
    WHERE branch_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Unresolved branch_id remains on leave_requests.';
  END IF;
END $$;

ALTER TABLE public.leave_requests
ALTER COLUMN branch_id SET NOT NULL;

CREATE OR REPLACE FUNCTION public.set_leave_request_branch_context()
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

DROP TRIGGER IF EXISTS trg_leave_request_branch_context ON public.leave_requests;
CREATE TRIGGER trg_leave_request_branch_context
BEFORE INSERT OR UPDATE OF org_id, employee_id
ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION public.set_leave_request_branch_context();

DROP POLICY IF EXISTS "admin_manage_leaves" ON public.leave_requests;
DROP POLICY IF EXISTS "emp_manage_own_leaves" ON public.leave_requests;

DROP POLICY IF EXISTS "branch_managers_manage_branch_leaves" ON public.leave_requests;
CREATE POLICY "branch_managers_manage_branch_leaves"
ON public.leave_requests
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

DROP POLICY IF EXISTS "employees_manage_own_branch_leaves" ON public.leave_requests;
CREATE POLICY "employees_manage_own_branch_leaves"
ON public.leave_requests
FOR ALL
USING (
  employee_id IN (
    SELECT e.id
    FROM public.employees e
    WHERE e.user_id = auth.uid()
      AND e.org_id = leave_requests.org_id
      AND e.branch_id = leave_requests.branch_id
  )
)
WITH CHECK (
  employee_id IN (
    SELECT e.id
    FROM public.employees e
    WHERE e.user_id = auth.uid()
      AND e.org_id = leave_requests.org_id
      AND e.branch_id = leave_requests.branch_id
  )
);

NOTIFY pgrst, 'reload schema';
