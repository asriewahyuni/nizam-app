-- ============================================================
-- MIGRATION 1230: Align sales.shariah_mode with enum shariah_mode
-- ============================================================

-- Ensure the shared shariah_mode enum exists.
DO $$
BEGIN
  CREATE TYPE public.shariah_mode AS ENUM ('CASH', 'SALAM', 'ISTISHNA');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
DECLARE
  v_udt_name TEXT;
BEGIN
  SELECT c.udt_name
  INTO v_udt_name
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'sales'
    AND c.column_name = 'shariah_mode';

  IF v_udt_name IS NULL THEN
    ALTER TABLE public.sales
      ADD COLUMN shariah_mode public.shariah_mode;
  ELSIF v_udt_name <> 'shariah_mode' THEN
    ALTER TABLE public.sales
      ALTER COLUMN shariah_mode DROP DEFAULT;

    ALTER TABLE public.sales
      ALTER COLUMN shariah_mode TYPE public.shariah_mode
      USING (
        CASE UPPER(BTRIM(COALESCE(shariah_mode::TEXT, 'CASH')))
          WHEN 'SALAM' THEN 'SALAM'
          WHEN 'ISTISHNA' THEN 'ISTISHNA'
          ELSE 'CASH'
        END
      )::public.shariah_mode;
  END IF;
END $$;

UPDATE public.sales
SET shariah_mode = 'CASH'::public.shariah_mode
WHERE shariah_mode IS NULL;

ALTER TABLE public.sales
  ALTER COLUMN shariah_mode SET DEFAULT 'CASH'::public.shariah_mode,
  ALTER COLUMN shariah_mode SET NOT NULL;

NOTIFY pgrst, 'reload schema';
