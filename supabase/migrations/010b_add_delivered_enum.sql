-- Migration to add DELIVERED to document_status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'document_status' AND e.enumlabel = 'DELIVERED') THEN
    ALTER TYPE document_status ADD VALUE 'DELIVERED';
  END IF;
END
$$;
