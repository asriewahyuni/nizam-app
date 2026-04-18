-- ============================================================
-- MIGRATION 1215: Roles department_ids text[] repair
-- Normalizes lingering legacy enum-backed department_ids columns
-- into plain text[] so role CRUD paths behave consistently.
-- ============================================================

DO $$
DECLARE
  v_department_ids_udt TEXT;
BEGIN
  SELECT c.udt_name
    INTO v_department_ids_udt
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'roles'
    AND c.column_name = 'department_ids'
  LIMIT 1;

  IF v_department_ids_udt IS NULL THEN
    ALTER TABLE public.roles
      ADD COLUMN department_ids TEXT[] DEFAULT '{}'::TEXT[];
  ELSIF v_department_ids_udt = '_nizam_department' THEN
    ALTER TABLE public.roles
      ALTER COLUMN department_ids TYPE TEXT[]
      USING (department_ids::TEXT[]);
  ELSIF v_department_ids_udt = 'nizam_department' THEN
    ALTER TABLE public.roles
      ALTER COLUMN department_ids TYPE TEXT[]
      USING (
        CASE
          WHEN department_ids IS NULL THEN NULL
          ELSE ARRAY[department_ids::TEXT]
        END
      );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'roles'
      AND column_name = 'department_id'
  ) THEN
    UPDATE public.roles
    SET department_ids = ARRAY[department_id::TEXT]
    WHERE COALESCE(array_length(department_ids, 1), 0) = 0
      AND department_id IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'roles'
      AND column_name = 'department_ids'
  ) THEN
    ALTER TABLE public.roles
      ALTER COLUMN department_ids SET DEFAULT '{}'::TEXT[];
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
