-- 1058_fix_org_cascades.sql
-- Update all relevant tables to support ON DELETE CASCADE for organizations

-- 1. Helper Function to safely update FKs (if multiple schemas/tables)
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    -- This script finds all foreign keys referencing public.organizations(id) 
    -- and recreates them with ON DELETE CASCADE
    FOR r IN (
        SELECT 
            tc.table_name, 
            kcu.column_name, 
            tc.constraint_name -- Fixed: replaced conname with constraint_name
        FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND ccu.table_name = 'organizations'
          AND ccu.column_name = 'id'
          AND tc.table_schema = 'public' -- Ensure we only touch public schema
    ) LOOP
        EXECUTE 'ALTER TABLE ' || r.table_name || ' DROP CONSTRAINT ' || r.constraint_name;
        EXECUTE 'ALTER TABLE ' || r.table_name || ' ADD CONSTRAINT ' || r.constraint_name || 
                ' FOREIGN KEY (' || r.column_name || ') REFERENCES organizations(id) ON DELETE CASCADE';
    END LOOP;
END $$;
