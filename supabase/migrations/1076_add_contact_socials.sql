-- MIGRATION 1076: Add more contact details (WA & IG)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS phone_wa TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS instagram TEXT;

-- Update indexes for quick search
CREATE INDEX IF NOT EXISTS idx_contacts_wa ON contacts(phone_wa);
CREATE INDEX IF NOT EXISTS idx_contacts_ig ON contacts(instagram);
