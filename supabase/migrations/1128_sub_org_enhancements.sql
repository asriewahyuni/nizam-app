-- Sub Org Enhancements: Manager Assignment
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS manager_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_manager ON public.organizations(manager_employee_id);

NOTIFY pgrst, 'reload schema';
