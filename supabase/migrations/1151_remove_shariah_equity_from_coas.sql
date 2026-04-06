-- ============================================================
-- MIGRATION 1151: Remove Only 3100 from CoAS Activation
-- ============================================================
-- Objective:
-- 1) CoAS activation no longer creates/updates 3100 Ekuitas Syariah.
-- 2) 3110 & 3120 tetap dipertahankan sebagai akun Syirkah (parent: 3000).
-- 3) Keep operational shariah accounts (Qard/Ijarah/Zakat) active.
-- 4) Cleanup only legacy 3100 by deleting/deactivating it.

CREATE OR REPLACE FUNCTION public.inject_shariah_coa(org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_liab_shariah_id UUID;
  v_ijarah_id UUID;
  v_zakat_id UUID;
  v_equity_parent UUID;
  v_liab_parent UUID;
  v_expense_parent UUID;
  v_asset_parent UUID;
BEGIN
  -- Parent roots
  SELECT id INTO v_asset_parent   FROM public.accounts WHERE org_id = inject_shariah_coa.org_id AND code = '1000' LIMIT 1;
  SELECT id INTO v_equity_parent  FROM public.accounts WHERE org_id = inject_shariah_coa.org_id AND code = '3000' LIMIT 1;
  SELECT id INTO v_liab_parent    FROM public.accounts WHERE org_id = inject_shariah_coa.org_id AND code = '2000' LIMIT 1;
  SELECT id INTO v_expense_parent FROM public.accounts WHERE org_id = inject_shariah_coa.org_id AND code = '6000' LIMIT 1;

  -- Cleanup legacy equity parent 3100 only (no longer part of CoAS activation)
  UPDATE public.accounts
  SET is_active = FALSE,
      updated_at = NOW()
  WHERE org_id = inject_shariah_coa.org_id
    AND code = '3100';

  -- Keep Syirkah children as active accounts directly under 3000.
  INSERT INTO public.accounts (org_id, code, name, type, normal_balance, parent_id, is_system, is_active)
  VALUES
    (inject_shariah_coa.org_id, '3110', 'Modal Syirkah Mudharabah', 'EQUITY', 'CREDIT', v_equity_parent, FALSE, TRUE),
    (inject_shariah_coa.org_id, '3120', 'Modal Syirkah Inan', 'EQUITY', 'CREDIT', v_equity_parent, FALSE, TRUE)
  ON CONFLICT (org_id, code) DO UPDATE
    SET name = EXCLUDED.name,
        parent_id = COALESCE(EXCLUDED.parent_id, public.accounts.parent_id),
        is_active = TRUE,
        updated_at = NOW();

  -- 1. LIABILITIES (QARD / SALAM)
  INSERT INTO public.accounts (org_id, code, name, type, normal_balance, parent_id, is_system, is_active)
  VALUES (inject_shariah_coa.org_id, '2600', 'Kewajiban Syariah', 'LIABILITY', 'CREDIT', v_liab_parent, FALSE, TRUE)
  ON CONFLICT (org_id, code) DO UPDATE
    SET name = EXCLUDED.name,
        parent_id = COALESCE(public.accounts.parent_id, EXCLUDED.parent_id),
        is_active = TRUE,
        updated_at = NOW()
  RETURNING id INTO v_liab_shariah_id;

  IF v_liab_shariah_id IS NULL THEN
    SELECT id INTO v_liab_shariah_id
    FROM public.accounts
    WHERE org_id = inject_shariah_coa.org_id
      AND code = '2600'
    LIMIT 1;
  END IF;

  INSERT INTO public.accounts (org_id, code, name, type, normal_balance, parent_id, is_system, is_active)
  VALUES
    (inject_shariah_coa.org_id, '2601', 'Hutang Qard (Kebajikan)', 'LIABILITY', 'CREDIT', v_liab_shariah_id, FALSE, TRUE),
    (inject_shariah_coa.org_id, '2602', 'Hutang Salam', 'LIABILITY', 'CREDIT', v_liab_shariah_id, FALSE, TRUE)
  ON CONFLICT (org_id, code) DO UPDATE
    SET name = EXCLUDED.name,
        parent_id = COALESCE(public.accounts.parent_id, EXCLUDED.parent_id),
        is_active = TRUE,
        updated_at = NOW();

  -- 1b. SALAM receivable
  INSERT INTO public.accounts (org_id, code, name, type, normal_balance, parent_id, is_system, is_active)
  VALUES (inject_shariah_coa.org_id, '1404', 'Piutang Salam Vendor', 'ASSET', 'DEBIT', v_asset_parent, FALSE, TRUE)
  ON CONFLICT (org_id, code) DO UPDATE
    SET name = EXCLUDED.name,
        parent_id = COALESCE(public.accounts.parent_id, EXCLUDED.parent_id),
        is_active = TRUE,
        updated_at = NOW();

  -- 2. IJARAH (EXPENSES)
  INSERT INTO public.accounts (org_id, code, name, type, normal_balance, parent_id, is_system, is_active)
  VALUES (inject_shariah_coa.org_id, '6100', 'Beban Ijarah & Ujrah', 'EXPENSE', 'DEBIT', v_expense_parent, FALSE, TRUE)
  ON CONFLICT (org_id, code) DO UPDATE
    SET name = EXCLUDED.name,
        parent_id = COALESCE(public.accounts.parent_id, EXCLUDED.parent_id),
        is_active = TRUE,
        updated_at = NOW()
  RETURNING id INTO v_ijarah_id;

  IF v_ijarah_id IS NULL THEN
    SELECT id INTO v_ijarah_id
    FROM public.accounts
    WHERE org_id = inject_shariah_coa.org_id
      AND code = '6100'
    LIMIT 1;
  END IF;

  INSERT INTO public.accounts (org_id, code, name, type, normal_balance, parent_id, is_system, is_active)
  VALUES
    (inject_shariah_coa.org_id, '6110', 'Beban Ujrah Gaji', 'EXPENSE', 'DEBIT', v_ijarah_id, FALSE, TRUE),
    (inject_shariah_coa.org_id, '6120', 'Beban Ujrah Sewa & Lainnya', 'EXPENSE', 'DEBIT', v_ijarah_id, FALSE, TRUE)
  ON CONFLICT (org_id, code) DO UPDATE
    SET name = EXCLUDED.name,
        parent_id = COALESCE(public.accounts.parent_id, EXCLUDED.parent_id),
        is_active = TRUE,
        updated_at = NOW();

  -- 3. ZAKAT & SOSIAL (EXPENSES)
  INSERT INTO public.accounts (org_id, code, name, type, normal_balance, parent_id, is_system, is_active)
  VALUES (inject_shariah_coa.org_id, '6200', 'Beban Zakat & Sosial', 'EXPENSE', 'DEBIT', v_expense_parent, FALSE, TRUE)
  ON CONFLICT (org_id, code) DO UPDATE
    SET name = EXCLUDED.name,
        parent_id = COALESCE(public.accounts.parent_id, EXCLUDED.parent_id),
        is_active = TRUE,
        updated_at = NOW()
  RETURNING id INTO v_zakat_id;

  IF v_zakat_id IS NULL THEN
    SELECT id INTO v_zakat_id
    FROM public.accounts
    WHERE org_id = inject_shariah_coa.org_id
      AND code = '6200'
    LIMIT 1;
  END IF;

  INSERT INTO public.accounts (org_id, code, name, type, normal_balance, parent_id, is_system, is_active)
  VALUES
    (inject_shariah_coa.org_id, '6210', 'Zakat Maal Pemilik', 'EXPENSE', 'DEBIT', v_zakat_id, FALSE, TRUE),
    (inject_shariah_coa.org_id, '6220', 'Zakat Tijarah (Perdagangan)', 'EXPENSE', 'DEBIT', v_zakat_id, FALSE, TRUE),
    (inject_shariah_coa.org_id, '6230', 'Cukai Mu''ahidah', 'EXPENSE', 'DEBIT', v_zakat_id, FALSE, TRUE)
  ON CONFLICT (org_id, code) DO UPDATE
    SET name = EXCLUDED.name,
        parent_id = COALESCE(public.accounts.parent_id, EXCLUDED.parent_id),
        is_active = TRUE,
        updated_at = NOW();
END;
$$;

-- Backfill cleanup for existing organizations:
-- try delete legacy 3100; fallback to deactivate when constrained.
DO $$
DECLARE
  v_acc RECORD;
BEGIN
  FOR v_acc IN
    SELECT id, org_id
    FROM public.accounts
    WHERE code = '3100'
  LOOP
    BEGIN
      DELETE FROM public.accounts
      WHERE id = v_acc.id;
    EXCEPTION
      WHEN foreign_key_violation THEN
        UPDATE public.accounts
        SET is_active = FALSE,
            updated_at = NOW()
        WHERE id = v_acc.id;
    END;
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
