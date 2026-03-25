-- ============================================================
-- MIGRATION 002: RBAC (Role-Based Access Control)
-- Granular permission per feature/module per org
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Table: roles (custom roles per org)
-- Default roles will be seeded from org creation trigger
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  -- permissions: array of strings e.g. ["accounting:read", "accounting:write", "inventory:read"]
  permissions   TEXT[] NOT NULL DEFAULT '{}',
  is_system     BOOLEAN NOT NULL DEFAULT FALSE, -- system roles cannot be deleted
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, name)
);

CREATE INDEX idx_roles_org_id ON roles(org_id);

-- ─────────────────────────────────────────────────────────────
-- RLS: roles
-- ─────────────────────────────────────────────────────────────
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_can_view_roles"
  ON roles FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY "admins_can_manage_roles"
  ON roles FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = TRUE
    )
  );

-- ─────────────────────────────────────────────────────────────
-- Helper function: check if current user has a permission
-- Usage: SELECT nizam_has_permission('accounting:write', org_id_here);
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION nizam_has_permission(
  p_permission TEXT,
  p_org_id     UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_role member_role;
BEGIN
  SELECT role INTO v_role
  FROM org_members
  WHERE user_id = auth.uid()
    AND org_id = p_org_id
    AND is_active = TRUE
  LIMIT 1;

  -- owner and admin have all permissions implicitly
  IF v_role IN ('owner', 'admin') THEN
    RETURN TRUE;
  END IF;

  -- for other roles, check the permissions array in roles table
  RETURN EXISTS (
    SELECT 1 FROM roles r
    JOIN org_members om ON om.org_id = r.org_id
    WHERE om.user_id = auth.uid()
      AND r.org_id = p_org_id
      AND p_permission = ANY(r.permissions)
      AND om.is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────
-- Trigger: seed default roles on org creation
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION seed_default_roles()
RETURNS TRIGGER AS $$
BEGIN
  -- Manager role
  INSERT INTO roles (org_id, name, permissions, is_system) VALUES
  (NEW.id, 'Manager', ARRAY[
    'accounting:read', 'accounting:write',
    'inventory:read', 'inventory:write',
    'sales:read', 'sales:write',
    'purchasing:read', 'purchasing:write',
    'reports:read'
  ], TRUE);

  -- Staff role (limited)
  INSERT INTO roles (org_id, name, permissions, is_system) VALUES
  (NEW.id, 'Staff', ARRAY[
    'accounting:read',
    'inventory:read',
    'sales:read', 'sales:write',
    'purchasing:read'
  ], TRUE);

  -- Viewer role (read-only)
  INSERT INTO roles (org_id, name, permissions, is_system) VALUES
  (NEW.id, 'Viewer', ARRAY[
    'accounting:read',
    'inventory:read',
    'reports:read'
  ], TRUE);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_seed_default_roles
  AFTER INSERT ON organizations
  FOR EACH ROW EXECUTE FUNCTION seed_default_roles();
