-- Tabel Invitation Tokens (Unique Links for Join)
CREATE TABLE IF NOT EXISTS org_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
  invitation_code TEXT UNIQUE NOT NULL, -- The unique token
  label TEXT, -- E.g., "Link for Sales Dept"
  max_uses INTEGER DEFAULT 0, -- 0 for unlimited
  use_count INTEGER DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- RLS Policies
ALTER TABLE org_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow members with config access to manage invitations"
ON org_invitations
FOR ALL
USING (EXISTS (
  SELECT 1 FROM org_members 
  WHERE org_members.org_id = org_invitations.org_id 
  AND org_members.user_id = auth.uid()
  AND org_members.role IN ('owner', 'admin') -- Only owner/admin manages links
));

-- Public read for the join page validation (minimal info)
CREATE POLICY "Allow public to read invitation by code"
ON org_invitations
FOR SELECT
TO anon, authenticated
USING (is_active AND (expires_at IS NULL OR expires_at > NOW()));

-- Index for lookup
CREATE INDEX IF NOT EXISTS idx_invitations_code ON org_invitations(invitation_code);
