-- ============================================================
-- MIGRATION 1125: HRIS department_id Schema Repair
-- ============================================================
-- Goals:
-- 1) Ensure enum type nizam_department exists
-- 2) Ensure employees.department_id exists for HRIS employee form writes
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'nizam_department'
  ) THEN
    CREATE TYPE public.nizam_department AS ENUM (
      'KEUANGAN',
      'INVENTORY',
      'PEMBELIAN',
      'PENJUALAN',
      'SDM',
      'OPERASIONAL',
      'ADMINISTRATOR'
    );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'employees'
      AND column_name = 'department_id'
  ) THEN
    ALTER TABLE public.employees
      ADD COLUMN department_id public.nizam_department;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
