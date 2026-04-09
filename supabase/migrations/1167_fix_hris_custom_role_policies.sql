-- ============================================================
-- MIGRATION 1167: Fix HRIS Custom Role Policies
-- ============================================================
-- Why:
-- HRIS custom roles sudah disimpan di org_members.role_id dan diperiksa oleh
-- public.nizam_has_permission(), tetapi banyak policy HRIS lama masih memakai
-- pemeriksaan role legacy seperti ('owner','admin','hr','manager').
--
-- Dampaknya:
-- 1. User dengan custom role HRIS bisa gagal melihat data walaupun permission ada.
-- 2. User dengan custom role HRIS bisa gagal menulis payroll/attendance/employee
--    walaupun role_id sudah benar.
-- 3. Kita tetap perlu kompatibel dengan member legacy yang masih memakai role
--    sistem seperti 'hr' dan 'manager'.
--
-- This migration:
-- 1. Menambahkan helper untuk cek salah satu permission dan salah satu role legacy.
-- 2. Memecah policy HRIS menjadi SELECT dan ALL agar read-only tidak kebobolan write.
-- 3. Menjaga backward compatibility untuk role legacy hr/manager sambil
--    mengaktifkan custom role HRIS berbasis permission.

CREATE OR REPLACE FUNCTION public.nizam_has_any_permission(
  p_org_id UUID,
  p_permissions TEXT[]
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_permissions, ARRAY[]::TEXT[])) AS perm(permission)
    WHERE public.nizam_has_permission(perm.permission, p_org_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.nizam_member_has_any_role(
  p_org_id UUID,
  p_roles TEXT[]
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_members om
    WHERE om.user_id = auth.uid()
      AND om.org_id = p_org_id
      AND om.is_active = TRUE
      AND om.role::TEXT = ANY(COALESCE(p_roles, ARRAY[]::TEXT[]))
  );
$$;

-- Employees
DROP POLICY IF EXISTS "admin_manage_hr" ON public.employees;
DROP POLICY IF EXISTS "branch_managers_manage_branch_employees" ON public.employees;
DROP POLICY IF EXISTS "hr_members_view_branch_employees" ON public.employees;
DROP POLICY IF EXISTS "hr_members_manage_branch_employees" ON public.employees;

CREATE POLICY "hr_members_view_branch_employees"
ON public.employees
FOR SELECT
USING (
  branch_id IS NOT NULL
  AND public.can_access_branch(org_id, branch_id)
  AND (
    public.nizam_has_any_permission(org_id, ARRAY['employees:read', 'employees:write'])
    OR public.nizam_member_has_any_role(org_id, ARRAY['hr', 'manager'])
  )
);

CREATE POLICY "hr_members_manage_branch_employees"
ON public.employees
FOR ALL
USING (
  branch_id IS NOT NULL
  AND public.can_access_branch(org_id, branch_id)
  AND (
    public.nizam_has_any_permission(org_id, ARRAY['employees:write'])
    OR public.nizam_member_has_any_role(org_id, ARRAY['hr', 'manager'])
  )
)
WITH CHECK (
  branch_id IS NOT NULL
  AND public.can_access_branch(org_id, branch_id)
  AND (
    public.nizam_has_any_permission(org_id, ARRAY['employees:write'])
    OR public.nizam_member_has_any_role(org_id, ARRAY['hr', 'manager'])
  )
);

-- Attendance
DROP POLICY IF EXISTS "admin_manage_attendance" ON public.attendance;
DROP POLICY IF EXISTS "branch_managers_manage_branch_attendance" ON public.attendance;
DROP POLICY IF EXISTS "hr_members_view_branch_attendance" ON public.attendance;
DROP POLICY IF EXISTS "hr_members_manage_branch_attendance" ON public.attendance;

CREATE POLICY "hr_members_view_branch_attendance"
ON public.attendance
FOR SELECT
USING (
  branch_id IS NOT NULL
  AND public.can_access_branch(org_id, branch_id)
  AND (
    public.nizam_has_any_permission(org_id, ARRAY['attendance:read', 'attendance:write'])
    OR public.nizam_member_has_any_role(org_id, ARRAY['hr', 'manager'])
  )
);

CREATE POLICY "hr_members_manage_branch_attendance"
ON public.attendance
FOR ALL
USING (
  branch_id IS NOT NULL
  AND public.can_access_branch(org_id, branch_id)
  AND (
    public.nizam_has_any_permission(org_id, ARRAY['attendance:write'])
    OR public.nizam_member_has_any_role(org_id, ARRAY['hr', 'manager'])
  )
)
WITH CHECK (
  branch_id IS NOT NULL
  AND public.can_access_branch(org_id, branch_id)
  AND (
    public.nizam_has_any_permission(org_id, ARRAY['attendance:write'])
    OR public.nizam_member_has_any_role(org_id, ARRAY['hr', 'manager'])
  )
);

-- Leave Requests
DROP POLICY IF EXISTS "admin_manage_leaves" ON public.leave_requests;
DROP POLICY IF EXISTS "branch_managers_manage_branch_leaves" ON public.leave_requests;
DROP POLICY IF EXISTS "hr_members_view_branch_leaves" ON public.leave_requests;
DROP POLICY IF EXISTS "hr_members_manage_branch_leaves" ON public.leave_requests;

CREATE POLICY "hr_members_view_branch_leaves"
ON public.leave_requests
FOR SELECT
USING (
  branch_id IS NOT NULL
  AND public.can_access_branch(org_id, branch_id)
  AND (
    public.nizam_has_any_permission(org_id, ARRAY['attendance:read', 'attendance:write'])
    OR public.nizam_member_has_any_role(org_id, ARRAY['hr', 'manager'])
  )
);

CREATE POLICY "hr_members_manage_branch_leaves"
ON public.leave_requests
FOR ALL
USING (
  branch_id IS NOT NULL
  AND public.can_access_branch(org_id, branch_id)
  AND (
    public.nizam_has_any_permission(org_id, ARRAY['attendance:write'])
    OR public.nizam_member_has_any_role(org_id, ARRAY['hr', 'manager'])
  )
)
WITH CHECK (
  branch_id IS NOT NULL
  AND public.can_access_branch(org_id, branch_id)
  AND (
    public.nizam_has_any_permission(org_id, ARRAY['attendance:write'])
    OR public.nizam_member_has_any_role(org_id, ARRAY['hr', 'manager'])
  )
);

-- Payroll Runs
DROP POLICY IF EXISTS "admin_manage_payroll" ON public.payroll_runs;
DROP POLICY IF EXISTS "hr_members_view_payroll_runs" ON public.payroll_runs;
DROP POLICY IF EXISTS "hr_members_manage_payroll_runs" ON public.payroll_runs;

CREATE POLICY "hr_members_view_payroll_runs"
ON public.payroll_runs
FOR SELECT
USING (
  branch_id IS NOT NULL
  AND public.can_access_branch(org_id, branch_id)
  AND (
    public.nizam_has_any_permission(org_id, ARRAY['payroll:read', 'payroll:write'])
    OR public.nizam_member_has_any_role(org_id, ARRAY['hr'])
  )
);

CREATE POLICY "hr_members_manage_payroll_runs"
ON public.payroll_runs
FOR ALL
USING (
  branch_id IS NOT NULL
  AND public.can_access_branch(org_id, branch_id)
  AND (
    public.nizam_has_any_permission(org_id, ARRAY['payroll:write'])
    OR public.nizam_member_has_any_role(org_id, ARRAY['hr'])
  )
)
WITH CHECK (
  branch_id IS NOT NULL
  AND public.can_access_branch(org_id, branch_id)
  AND (
    public.nizam_has_any_permission(org_id, ARRAY['payroll:write'])
    OR public.nizam_member_has_any_role(org_id, ARRAY['hr'])
  )
);

-- Payslips
DROP POLICY IF EXISTS "admin_manage_payslips" ON public.payslips;
DROP POLICY IF EXISTS "hr_members_view_branch_payslips" ON public.payslips;
DROP POLICY IF EXISTS "hr_members_manage_branch_payslips" ON public.payslips;

CREATE POLICY "hr_members_view_branch_payslips"
ON public.payslips
FOR SELECT
USING (
  branch_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.payroll_runs r
    WHERE r.id = payslips.run_id
      AND public.can_access_branch(r.org_id, payslips.branch_id)
      AND (
        public.nizam_has_any_permission(r.org_id, ARRAY['payroll:read', 'payroll:write'])
        OR public.nizam_member_has_any_role(r.org_id, ARRAY['hr'])
      )
  )
);

CREATE POLICY "hr_members_manage_branch_payslips"
ON public.payslips
FOR ALL
USING (
  branch_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.payroll_runs r
    WHERE r.id = payslips.run_id
      AND public.can_access_branch(r.org_id, payslips.branch_id)
      AND (
        public.nizam_has_any_permission(r.org_id, ARRAY['payroll:write'])
        OR public.nizam_member_has_any_role(r.org_id, ARRAY['hr'])
      )
  )
)
WITH CHECK (
  branch_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.payroll_runs r
    WHERE r.id = payslips.run_id
      AND public.can_access_branch(r.org_id, payslips.branch_id)
      AND (
        public.nizam_has_any_permission(r.org_id, ARRAY['payroll:write'])
        OR public.nizam_member_has_any_role(r.org_id, ARRAY['hr'])
      )
  )
);

-- Payroll Components
DROP POLICY IF EXISTS "admin_manage_payroll_components" ON public.payroll_components;
DROP POLICY IF EXISTS "hr_members_view_payroll_components" ON public.payroll_components;
DROP POLICY IF EXISTS "hr_members_manage_payroll_components" ON public.payroll_components;

CREATE POLICY "hr_members_view_payroll_components"
ON public.payroll_components
FOR SELECT
USING (
  public.nizam_has_any_permission(org_id, ARRAY['payroll:read', 'payroll:write'])
  OR public.nizam_member_has_any_role(org_id, ARRAY['hr'])
);

CREATE POLICY "hr_members_manage_payroll_components"
ON public.payroll_components
FOR ALL
USING (
  public.nizam_has_any_permission(org_id, ARRAY['payroll:write'])
  OR public.nizam_member_has_any_role(org_id, ARRAY['hr'])
)
WITH CHECK (
  public.nizam_has_any_permission(org_id, ARRAY['payroll:write'])
  OR public.nizam_member_has_any_role(org_id, ARRAY['hr'])
);

-- Employee Components
DROP POLICY IF EXISTS "admin_manage_emp_components" ON public.employee_components;
DROP POLICY IF EXISTS "hr_members_view_employee_components" ON public.employee_components;
DROP POLICY IF EXISTS "hr_members_manage_employee_components" ON public.employee_components;

CREATE POLICY "hr_members_view_employee_components"
ON public.employee_components
FOR SELECT
USING (
  employee_id IN (
    SELECT e.id
    FROM public.employees e
    WHERE e.id = employee_components.employee_id
      AND e.branch_id IS NOT NULL
      AND public.can_access_branch(e.org_id, e.branch_id)
      AND (
        public.nizam_has_any_permission(e.org_id, ARRAY['payroll:read', 'payroll:write'])
        OR public.nizam_member_has_any_role(e.org_id, ARRAY['hr'])
      )
  )
);

CREATE POLICY "hr_members_manage_employee_components"
ON public.employee_components
FOR ALL
USING (
  employee_id IN (
    SELECT e.id
    FROM public.employees e
    WHERE e.id = employee_components.employee_id
      AND e.branch_id IS NOT NULL
      AND public.can_access_branch(e.org_id, e.branch_id)
      AND (
        public.nizam_has_any_permission(e.org_id, ARRAY['payroll:write'])
        OR public.nizam_member_has_any_role(e.org_id, ARRAY['hr'])
      )
  )
)
WITH CHECK (
  employee_id IN (
    SELECT e.id
    FROM public.employees e
    WHERE e.id = employee_components.employee_id
      AND e.branch_id IS NOT NULL
      AND public.can_access_branch(e.org_id, e.branch_id)
      AND (
        public.nizam_has_any_permission(e.org_id, ARRAY['payroll:write'])
        OR public.nizam_member_has_any_role(e.org_id, ARRAY['hr'])
      )
  )
);

-- Payslip Lines
DROP POLICY IF EXISTS "admin_manage_payslip_lines" ON public.payslip_lines;
DROP POLICY IF EXISTS "hr_members_view_payslip_lines" ON public.payslip_lines;
DROP POLICY IF EXISTS "hr_members_manage_payslip_lines" ON public.payslip_lines;

CREATE POLICY "hr_members_view_payslip_lines"
ON public.payslip_lines
FOR SELECT
USING (
  payslip_id IN (
    SELECT p.id
    FROM public.payslips p
    JOIN public.payroll_runs r ON r.id = p.run_id
    WHERE p.id = payslip_lines.payslip_id
      AND p.branch_id IS NOT NULL
      AND public.can_access_branch(r.org_id, p.branch_id)
      AND (
        public.nizam_has_any_permission(r.org_id, ARRAY['payroll:read', 'payroll:write'])
        OR public.nizam_member_has_any_role(r.org_id, ARRAY['hr'])
      )
  )
);

CREATE POLICY "hr_members_manage_payslip_lines"
ON public.payslip_lines
FOR ALL
USING (
  payslip_id IN (
    SELECT p.id
    FROM public.payslips p
    JOIN public.payroll_runs r ON r.id = p.run_id
    WHERE p.id = payslip_lines.payslip_id
      AND p.branch_id IS NOT NULL
      AND public.can_access_branch(r.org_id, p.branch_id)
      AND (
        public.nizam_has_any_permission(r.org_id, ARRAY['payroll:write'])
        OR public.nizam_member_has_any_role(r.org_id, ARRAY['hr'])
      )
  )
)
WITH CHECK (
  payslip_id IN (
    SELECT p.id
    FROM public.payslips p
    JOIN public.payroll_runs r ON r.id = p.run_id
    WHERE p.id = payslip_lines.payslip_id
      AND p.branch_id IS NOT NULL
      AND public.can_access_branch(r.org_id, p.branch_id)
      AND (
        public.nizam_has_any_permission(r.org_id, ARRAY['payroll:write'])
        OR public.nizam_member_has_any_role(r.org_id, ARRAY['hr'])
      )
  )
);

NOTIFY pgrst, 'reload schema';
