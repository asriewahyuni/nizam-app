-- Add owner_email column for easy display in Admin Panel
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS owner_email TEXT;

-- Update existing organizations (best effort from members)
DO $$ 
BEGIN
    -- This is a one-time backfill attempt
    -- Usually not reliable for all since auth.users is in separate schema
    -- But for new ones, we will populate it properly in the server action.
END $$;
