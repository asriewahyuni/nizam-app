-- ============================================================
-- MIGRATION 001: Organizations (Multi-Tenant Core)
-- Every row in NIZAM is scoped to an org_id.
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────
-- Table: organizations
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  logo_url      TEXT,
  settings      JSONB NOT NULL DEFAULT '{}',
  -- settings can store: currency, timezone, fiscal_year_start, address, npwp, etc.
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_organizations_slug ON organizations(slug);

-- ─────────────────────────────────────────────────────────────
-- Table: org_members
-- Links auth.users → organizations with a role
-- ─────────────────────────────────────────────────────────────
CREATE TYPE member_role AS ENUM ('owner', 'admin', 'manager', 'staff', 'viewer');

CREATE TABLE IF NOT EXISTS org_members (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role          member_role NOT NULL DEFAULT 'staff',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  invited_by    UUID REFERENCES auth.users(id),
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

CREATE INDEX idx_org_members_user_id ON org_members(user_id);
CREATE INDEX idx_org_members_org_id ON org_members(org_id);

-- ─────────────────────────────────────────────────────────────
-- Trigger: auto-update updated_at on organizations
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- Helper Functions (SECURITY DEFINER to break RLS recursion)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_my_org_ids()
RETURNS TABLE (org_id UUID)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE;
$$;

CREATE OR REPLACE FUNCTION is_org_admin(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = p_org_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
      AND is_active = TRUE
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- RLS: organizations
-- ─────────────────────────────────────────────────────────────
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_can_view_their_org"
  ON organizations FOR SELECT
  USING (id IN (SELECT get_my_org_ids()));

CREATE POLICY "owners_can_update_org"
  ON organizations FOR UPDATE
  USING (is_org_admin(id));

CREATE POLICY "allow_insert_organizations"
  ON organizations FOR INSERT
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- RLS: org_members
-- ─────────────────────────────────────────────────────────────
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_can_view_org_members"
  ON org_members FOR SELECT
  USING (org_id IN (SELECT get_my_org_ids()));

CREATE POLICY "admins_can_manage_members"
  ON org_members FOR ALL
  USING (is_org_admin(org_id));

-- Allow new users to create their own org membership (during onboarding)
CREATE POLICY "users_can_insert_own_membership"
  ON org_members FOR INSERT
  WITH CHECK (user_id = auth.uid());
