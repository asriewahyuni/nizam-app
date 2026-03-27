-- ============================================================
-- MIGRATION: Employee Auth Linkage
-- Allows employees to register using NIK and link to Auth
-- ============================================================

-- 1. Add user_id to employees to link with auth.users
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON public.employees(user_id);

-- 2. Add registration status (optional but helpful)
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS registration_status TEXT NOT NULL DEFAULT 'PENDING'; -- PENDING, REGISTERED

-- 3. Security: Prevent others from registering an already registered NIK
-- Handled via logic, but we can add a constraint if we want one user_id per employee
-- A user can be linked to multiple employees in different orgs? (ERP multi-tenant)
-- Actually, employees are scoped to org_id. So (org_id, user_id) should be unique.
-- But (nik, org_id) is already unique.
