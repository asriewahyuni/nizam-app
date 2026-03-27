-- 1056_org_module_activation.sql
-- Add enabled_modules column to track SaaS feature activation per organization

ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS enabled_modules TEXT[] DEFAULT ARRAY['finance', 'accounting', 'inventory', 'purchasing', 'sales', 'pos', 'hris', 'reports'];

-- Update existing organizations to have core modules enabled
UPDATE organizations 
SET enabled_modules = ARRAY['finance', 'accounting', 'inventory', 'purchasing', 'sales', 'pos', 'hris', 'reports', 'config']
WHERE enabled_modules IS NULL;

-- Description of optional modules (for future):
-- 'factory' (Manufacturing)
-- 'fleet' (Fleet & Rental)
-- 'services' (Job Order / Service Jasa)
-- 'zakat' (Islamic Finance)
