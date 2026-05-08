-- Guard terhadap duplikasi anggota/saksi syirkah pada identitas yang jelas.
-- Server action tetap melakukan dedup terlebih dahulu, tetapi index unik ini
-- menjadi pagar terakhir bila ada retry / race condition / request ganda.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'syirkah_members'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'syirkah_members'
        AND column_name = 'nik'
    ) THEN
      EXECUTE '
        CREATE UNIQUE INDEX IF NOT EXISTS idx_syirkah_members_contract_nik_unique
          ON public.syirkah_members (contract_id, upper(trim(nik)))
          WHERE nik IS NOT NULL AND trim(nik) <> ''''
      ';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'syirkah_members'
        AND column_name = 'email'
    ) THEN
      EXECUTE '
        CREATE UNIQUE INDEX IF NOT EXISTS idx_syirkah_members_contract_email_unique
          ON public.syirkah_members (contract_id, lower(trim(email)))
          WHERE email IS NOT NULL AND trim(email) <> ''''
      ';
    END IF;

  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'syirkah_witnesses'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'syirkah_witnesses'
        AND column_name = 'nik'
    ) THEN
      EXECUTE '
        CREATE UNIQUE INDEX IF NOT EXISTS idx_syirkah_witnesses_contract_nik_unique
          ON public.syirkah_witnesses (contract_id, upper(trim(nik)))
          WHERE nik IS NOT NULL AND trim(nik) <> ''''
      ';
    END IF;

  END IF;
END $$;
