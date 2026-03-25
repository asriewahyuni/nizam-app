-- ============================================================
-- MIGRATION 1006: Shariah CoA Add-on (CoAS) - SIMPLIFIED
-- Adds a function to inject Shariah-compliant accounts
-- ============================================================

CREATE OR REPLACE FUNCTION public.inject_shariah_coa(org_id UUID)
RETURNS VOID 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE 
  v_equity_shariah_id UUID;
  v_liab_shariah_id UUID;
  v_ijarah_id UUID;
  v_zakat_id UUID;
  v_equity_parent UUID;
  v_liab_parent UUID;
  v_expense_parent UUID;
BEGIN
  -- Get major parents
  SELECT id INTO v_equity_parent FROM accounts WHERE org_id = inject_shariah_coa.org_id AND code = '3000';
  SELECT id INTO v_liab_parent FROM accounts WHERE org_id = inject_shariah_coa.org_id AND code = '2000';
  SELECT id INTO v_expense_parent FROM accounts WHERE org_id = inject_shariah_coa.org_id AND code = '6000';

  -- 1. EQUITY SYARIAH
  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, is_system) 
  VALUES (inject_shariah_coa.org_id, '3100', 'Ekuitas Syariah', 'EQUITY', 'CREDIT', v_equity_parent, FALSE)
  ON CONFLICT (org_id, code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_equity_shariah_id;

  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id) VALUES
  (inject_shariah_coa.org_id, '3110', 'Modal Syirkah Mudharabah', 'EQUITY', 'CREDIT', v_equity_shariah_id),
  (inject_shariah_coa.org_id, '3120', 'Modal Syirkah Inan', 'EQUITY', 'CREDIT', v_equity_shariah_id)
  ON CONFLICT (org_id, code) DO NOTHING;

  -- 2. LIABILITIES (QARD)
  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, is_system) 
  VALUES (inject_shariah_coa.org_id, '2600', 'Kewajiban Syariah', 'LIABILITY', 'CREDIT', v_liab_parent, FALSE)
  ON CONFLICT (org_id, code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_liab_shariah_id;

  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id) VALUES
  (inject_shariah_coa.org_id, '2601', 'Hutang Qard (Kebajikan)', 'LIABILITY', 'CREDIT', v_liab_shariah_id)
  ON CONFLICT (org_id, code) DO NOTHING;

  -- 3. IJARAH (EXPENSES)
  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, is_system) 
  VALUES (inject_shariah_coa.org_id, '6100', 'Beban Ijarah & Ujrah', 'EXPENSE', 'DEBIT', v_expense_parent, FALSE)
  ON CONFLICT (org_id, code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_ijarah_id;

  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id) VALUES
  (inject_shariah_coa.org_id, '6110', 'Beban Ujrah Gaji', 'EXPENSE', 'DEBIT', v_ijarah_id),
  (inject_shariah_coa.org_id, '6120', 'Beban Ujrah Sewa & Lainnya', 'EXPENSE', 'DEBIT', v_ijarah_id)
  ON CONFLICT (org_id, code) DO NOTHING;

  -- 4. ZAKAT & CUKAI (EXPENSES)
  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, is_system) 
  VALUES (inject_shariah_coa.org_id, '6200', 'Beban Zakat & Sosial', 'EXPENSE', 'DEBIT', v_expense_parent, FALSE)
  ON CONFLICT (org_id, code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_zakat_id;

  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id) VALUES
  (inject_shariah_coa.org_id, '6210', 'Zakat Maal Pemilik', 'EXPENSE', 'DEBIT', v_zakat_id),
  (inject_shariah_coa.org_id, '6220', 'Zakat Tijarah (Perdagangan)', 'EXPENSE', 'DEBIT', v_zakat_id),
  (inject_shariah_coa.org_id, '6230', 'Cukai Mu''ahidah', 'EXPENSE', 'DEBIT', v_zakat_id)
  ON CONFLICT (org_id, code) DO NOTHING;

END;
$$;
