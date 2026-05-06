-- ============================================================
-- MIGRATION 1241: Add Syirkah Profit Sharing Equity Account
-- ============================================================
-- Tujuan:
-- 1. Menambahkan akun equity turunan 3130 "Bagi Hasil Syirkah"
--    di bawah header 3000 Ekuitas.
-- 2. Memastikan akun ini ikut dalam injeksi paket akun syariah.
-- 3. Membackfill akun ke organisasi yang sudah memakai mode syariah
--    atau sudah memiliki aktivitas syirkah.

CREATE OR REPLACE FUNCTION public.inject_shariah_coa(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asset_root_id UUID;
  v_current_asset_parent_id UUID;
  v_equity_parent UUID;
  v_liab_parent UUID;
  v_expense_parent UUID;
  v_liab_shariah_id UUID;
  v_ijarah_id UUID;
  v_zakat_id UUID;
BEGIN
  SELECT id
  INTO v_asset_root_id
  FROM public.accounts
  WHERE public.accounts.org_id = p_org_id
    AND code = '1000'
  LIMIT 1;

  IF v_asset_root_id IS NULL THEN
    SELECT id
    INTO v_asset_root_id
    FROM public.accounts
    WHERE public.accounts.org_id = p_org_id
      AND type = 'ASSET'
    ORDER BY code
    LIMIT 1;
  END IF;

  SELECT id
  INTO v_current_asset_parent_id
  FROM public.accounts
  WHERE public.accounts.org_id = p_org_id
    AND code = '1200'
  LIMIT 1;

  IF v_current_asset_parent_id IS NULL THEN
    v_current_asset_parent_id := v_asset_root_id;
  END IF;

  SELECT id INTO v_equity_parent
  FROM public.accounts
  WHERE public.accounts.org_id = p_org_id
    AND code = '3000'
  LIMIT 1;

  SELECT id INTO v_liab_parent
  FROM public.accounts
  WHERE public.accounts.org_id = p_org_id
    AND code = '2000'
  LIMIT 1;

  IF v_liab_parent IS NULL THEN
    SELECT id INTO v_liab_parent
    FROM public.accounts
    WHERE public.accounts.org_id = p_org_id
      AND type = 'LIABILITY'
    ORDER BY code
    LIMIT 1;
  END IF;

  SELECT id INTO v_expense_parent
  FROM public.accounts
  WHERE public.accounts.org_id = p_org_id
    AND code = '6000'
  LIMIT 1;

  IF v_expense_parent IS NULL THEN
    SELECT id INTO v_expense_parent
    FROM public.accounts
    WHERE public.accounts.org_id = p_org_id
      AND type = 'EXPENSE'
    ORDER BY code
    LIMIT 1;
  END IF;

  UPDATE public.accounts
  SET is_active = FALSE,
      updated_at = NOW()
  WHERE public.accounts.org_id = p_org_id
    AND code = '3100';

  INSERT INTO public.accounts (org_id, code, name, type, normal_balance, parent_id, is_system, is_active)
  VALUES
    (p_org_id, '3110', 'Modal Syirkah Mudharabah', 'EQUITY', 'CREDIT', v_equity_parent, FALSE, TRUE),
    (p_org_id, '3120', 'Modal Syirkah Inan', 'EQUITY', 'CREDIT', v_equity_parent, FALSE, TRUE),
    (p_org_id, '3130', 'Bagi Hasil Syirkah', 'EQUITY', 'DEBIT', v_equity_parent, FALSE, TRUE)
  ON CONFLICT (org_id, code) DO UPDATE
    SET name = EXCLUDED.name,
        normal_balance = EXCLUDED.normal_balance,
        parent_id = COALESCE(EXCLUDED.parent_id, public.accounts.parent_id),
        is_active = TRUE,
        updated_at = NOW();

  INSERT INTO public.accounts (org_id, code, name, type, normal_balance, parent_id, is_system, is_active)
  VALUES (p_org_id, '2600', 'Kewajiban Syariah', 'LIABILITY', 'CREDIT', v_liab_parent, FALSE, TRUE)
  ON CONFLICT (org_id, code) DO UPDATE
    SET name = EXCLUDED.name,
        parent_id = COALESCE(public.accounts.parent_id, EXCLUDED.parent_id),
        is_active = TRUE,
        updated_at = NOW()
  RETURNING id INTO v_liab_shariah_id;

  IF v_liab_shariah_id IS NULL THEN
    SELECT id INTO v_liab_shariah_id
    FROM public.accounts
    WHERE public.accounts.org_id = p_org_id
      AND code = '2600'
    LIMIT 1;
  END IF;

  INSERT INTO public.accounts (org_id, code, name, type, normal_balance, parent_id, is_system, is_active)
  VALUES
    (p_org_id, '2601', 'Hutang Qard (Kebajikan)', 'LIABILITY', 'CREDIT', v_liab_shariah_id, FALSE, TRUE),
    (p_org_id, '2602', 'Hutang Salam', 'LIABILITY', 'CREDIT', v_liab_shariah_id, FALSE, TRUE),
    (p_org_id, '2603', 'Hutang Istishna', 'LIABILITY', 'CREDIT', v_liab_shariah_id, FALSE, TRUE)
  ON CONFLICT (org_id, code) DO UPDATE
    SET name = EXCLUDED.name,
        parent_id = COALESCE(public.accounts.parent_id, EXCLUDED.parent_id),
        is_active = TRUE,
        updated_at = NOW();

  INSERT INTO public.accounts (org_id, code, name, type, normal_balance, parent_id, is_system, is_active)
  VALUES
    (p_org_id, '1404', 'Piutang Salam Vendor', 'ASSET', 'DEBIT', v_asset_root_id, FALSE, TRUE),
    (
      p_org_id,
      '1205',
      'Aset / Piutang Barang Istishna (Pembelian)',
      'ASSET',
      'DEBIT',
      v_current_asset_parent_id,
      FALSE,
      TRUE
    )
  ON CONFLICT (org_id, code) DO UPDATE
    SET name = EXCLUDED.name,
        parent_id = COALESCE(public.accounts.parent_id, EXCLUDED.parent_id),
        is_active = TRUE,
        updated_at = NOW();

  INSERT INTO public.accounts (org_id, code, name, type, normal_balance, parent_id, is_system, is_active)
  VALUES (p_org_id, '6100', 'Beban Ijarah & Ujrah', 'EXPENSE', 'DEBIT', v_expense_parent, FALSE, TRUE)
  ON CONFLICT (org_id, code) DO UPDATE
    SET name = EXCLUDED.name,
        parent_id = COALESCE(public.accounts.parent_id, EXCLUDED.parent_id),
        is_active = TRUE,
        updated_at = NOW()
  RETURNING id INTO v_ijarah_id;

  IF v_ijarah_id IS NULL THEN
    SELECT id INTO v_ijarah_id
    FROM public.accounts
    WHERE public.accounts.org_id = p_org_id
      AND code = '6100'
    LIMIT 1;
  END IF;

  INSERT INTO public.accounts (org_id, code, name, type, normal_balance, parent_id, is_system, is_active)
  VALUES
    (p_org_id, '6110', 'Beban Ujrah Gaji', 'EXPENSE', 'DEBIT', v_ijarah_id, FALSE, TRUE),
    (p_org_id, '6120', 'Beban Ujrah Sewa & Lainnya', 'EXPENSE', 'DEBIT', v_ijarah_id, FALSE, TRUE)
  ON CONFLICT (org_id, code) DO UPDATE
    SET name = EXCLUDED.name,
        parent_id = COALESCE(public.accounts.parent_id, EXCLUDED.parent_id),
        is_active = TRUE,
        updated_at = NOW();

  INSERT INTO public.accounts (org_id, code, name, type, normal_balance, parent_id, is_system, is_active)
  VALUES (p_org_id, '6200', 'Beban Zakat & Sosial', 'EXPENSE', 'DEBIT', v_expense_parent, FALSE, TRUE)
  ON CONFLICT (org_id, code) DO UPDATE
    SET name = EXCLUDED.name,
        parent_id = COALESCE(public.accounts.parent_id, EXCLUDED.parent_id),
        is_active = TRUE,
        updated_at = NOW()
  RETURNING id INTO v_zakat_id;

  IF v_zakat_id IS NULL THEN
    SELECT id INTO v_zakat_id
    FROM public.accounts
    WHERE public.accounts.org_id = p_org_id
      AND code = '6200'
    LIMIT 1;
  END IF;

  INSERT INTO public.accounts (org_id, code, name, type, normal_balance, parent_id, is_system, is_active)
  VALUES
    (p_org_id, '6210', 'Zakat Maal Pemilik', 'EXPENSE', 'DEBIT', v_zakat_id, FALSE, TRUE),
    (p_org_id, '6220', 'Zakat Tijarah (Perdagangan)', 'EXPENSE', 'DEBIT', v_zakat_id, FALSE, TRUE),
    (p_org_id, '6230', 'Cukai Mu''ahidah', 'EXPENSE', 'DEBIT', v_zakat_id, FALSE, TRUE)
  ON CONFLICT (org_id, code) DO UPDATE
    SET name = EXCLUDED.name,
        parent_id = COALESCE(public.accounts.parent_id, EXCLUDED.parent_id),
        is_active = TRUE,
        updated_at = NOW();
END;
$$;

DO $$
DECLARE
  v_org RECORD;
BEGIN
  FOR v_org IN
    (
      SELECT DISTINCT seeded.org_id
      FROM (
        SELECT a.org_id
        FROM public.accounts a
        WHERE a.code IN ('3100', '3110', '3120', '3130', '2600', '2601', '2602', '2603', '1404', '1205', '6100', '6200')
        UNION
        SELECT sc.org_id
        FROM public.syirkah_contracts sc
        UNION
        SELECT s.org_id
        FROM public.sales s
        WHERE UPPER(COALESCE(s.shariah_mode::TEXT, 'CASH')) IN ('SALAM', 'ISTISHNA')
        UNION
        SELECT p.org_id
        FROM public.purchases p
        WHERE UPPER(COALESCE(p.shariah_mode::TEXT, 'CASH')) IN ('SALAM', 'ISTISHNA')
        UNION
        SELECT o.id AS org_id
        FROM public.organizations o
        WHERE COALESCE(o.settings ->> 'is_shariah_enabled', 'false') = 'true'
      ) seeded
    )
  LOOP
    PERFORM public.inject_shariah_coa(v_org.org_id);
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
