-- Employee self-service attendance write access.
-- Allows authenticated employees to insert/update their own attendance rows only.

DROP POLICY IF EXISTS "employees_manage_own_branch_attendance" ON public.attendance;
CREATE POLICY "employees_manage_own_branch_attendance"
ON public.attendance
FOR ALL
USING (
  employee_id IN (
    SELECT e.id
    FROM public.employees e
    WHERE e.user_id = auth.uid()
      AND e.org_id = attendance.org_id
      AND e.branch_id = attendance.branch_id
  )
)
WITH CHECK (
  employee_id IN (
    SELECT e.id
    FROM public.employees e
    WHERE e.user_id = auth.uid()
      AND e.org_id = attendance.org_id
      AND e.branch_id = attendance.branch_id
  )
);

NOTIFY pgrst, 'reload schema';
