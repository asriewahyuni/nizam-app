-- Drop NOT NULL constraint on customer_id for POS walk-in compatibility
ALTER TABLE IF EXISTS sales ALTER COLUMN customer_id DROP NOT NULL;
