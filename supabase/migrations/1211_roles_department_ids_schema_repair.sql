-- ============================================================
-- MIGRATION 1211: Roles department_ids schema repair
-- Normalizes legacy/broken roles.department_ids definitions so
-- role creation can safely persist multi-department selections.
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
      ADD COLUMN department_ids TEXT[] NOT NULL DEFAULT '{}';
  ELSIF v_department_ids_udt = 'nizam_department' THEN
    ALTER TABLE public.roles
      ALTER COLUMN department_ids TYPE TEXT[]
      USING (
        CASE
          WHEN department_ids IS NULL THEN ARRAY[]::TEXT[]
          ELSE ARRAY[department_ids::TEXT]
        END
      );

    ALTER TABLE public.roles
      ALTER COLUMN department_ids SET DEFAULT '{}';
  END IF;
END;
$$;

DO $$
BEGIN
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
END;
$$;

NOTIFY pgrst, 'reload schema';
