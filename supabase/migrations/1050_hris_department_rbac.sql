-- ============================================================
-- MIGRATION: HRIS Structure & Granular RBAC
-- Links Employees/Members to Departments and Custom Roles
-- ============================================================

-- 1. Add Department Classification to Employees
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'nizam_department') THEN
        CREATE TYPE nizam_department AS ENUM (
            'DASHBOARD_AUDIT',
            'INSIGHT',
            'CONFIG',
            'FINANCE',
            'OPERASIONAL',
            'MARKETING_SALES',
            'HRIS'
        );
    END IF;
END $$;

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS department_id nizam_department;
ALTER TABLE public.org_members ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES public.roles(id);
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS department_id nizam_department;

-- 2. Update nizam_has_permission to check both system role and custom role_id
CREATE OR REPLACE FUNCTION nizam_has_permission(
  p_permission TEXT,
  p_org_id     UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_role member_role;
  v_custom_role_id UUID;
BEGIN
  SELECT role, role_id INTO v_role, v_custom_role_id
  FROM org_members
  WHERE user_id = auth.uid()
    AND org_id = p_org_id
    AND is_active = TRUE
  LIMIT 1;

  -- owner and admin have all permissions implicitly
  IF v_role IN ('owner', 'admin') THEN
    RETURN TRUE;
  END IF;

  -- if there is a custom role assigned, check its permissions
  IF v_custom_role_id IS NOT NULL THEN
     RETURN EXISTS (
       SELECT 1 FROM roles r
       WHERE r.id = v_custom_role_id
         AND p_permission = ANY(r.permissions)
     );
  END IF;

  -- fallback: if no custom role_id, check any role in the org that matches standard name fallback (legacy check)
  RETURN EXISTS (
    SELECT 1 FROM roles r
    JOIN org_members om ON om.org_id = r.org_id
    WHERE om.user_id = auth.uid()
      AND r.name = (CASE 
          WHEN v_role = 'manager' THEN 'Manager' 
          WHEN v_role = 'staff' THEN 'Staff' 
          WHEN v_role = 'viewer' THEN 'Viewer' 
          ELSE NULL 
        END)
      AND r.org_id = p_org_id
      AND p_permission = ANY(r.permissions)
      AND om.is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
