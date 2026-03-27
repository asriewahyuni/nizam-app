-- Ensure organizations slug exists and is unique for the join URL feature
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS slug TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

-- Ensure employees lookup by NIK + Org is fast
CREATE INDEX IF NOT EXISTS idx_employees_nik_org ON employees(nik, org_id);
