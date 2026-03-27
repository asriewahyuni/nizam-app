-- 1057_add_is_demo_to_org.sql
-- Add is_demo flag to differentiate between trial/demo and production accounts

ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;

-- Mark existing organizations that contain 'demo' or 'test' in their name as demo
UPDATE organizations 
SET is_demo = TRUE 
WHERE LOWER(name) LIKE '%demo%' 
   OR LOWER(name) LIKE '%test%'
   OR LOWER(name) LIKE '%catering sehat%' -- Based on user list, these seem to be demo targets
   OR LOWER(name) LIKE '%assembly%';
