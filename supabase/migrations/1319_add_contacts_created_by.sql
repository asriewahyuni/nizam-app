-- Migration 1319: Add created_by to contacts
-- To allow Canvassers and specific sales personnel to have ownership of contacts

ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES internal_auth_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_created_by ON contacts(created_by);
