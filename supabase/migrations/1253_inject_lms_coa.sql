-- Migration: 1253_inject_lms_coa.sql
-- Description: CoA injection function for LMS module (Pelatihan Komersial)
-- Accounts:
--   REVENUE : 4500 Pendapatan Program Pelatihan
--             4510 Pendapatan Sertifikasi
--   ASSET   : 1320 Piutang Peserta Pelatihan
--             1330 Pendapatan Diterima di Muka (Deposit Peserta)  → LIABILITY
--   LIABILITY: 2310 Pendapatan Ditangguhkan (DP Peserta)
--   EXPENSE : 6500 Beban Operasional Pelatihan
--             6510 Beban Honorarium Instruktur
--             6520 Beban Materi & Perlengkapan Training
--             6530 Beban Sewa Tempat Pelatihan
--             6540 Beban Sertifikasi & Percetakan

CREATE OR REPLACE FUNCTION public.inject_lms_coa(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_revenue_parent UUID;
  v_asset_parent   UUID;
  v_liab_parent    UUID;
  v_expense_parent UUID;
  v_lms_rev_id     UUID;
  v_lms_exp_id     UUID;
BEGIN
  -- Ambil parent accounts utama
  SELECT id INTO v_revenue_parent FROM accounts WHERE org_id = p_org_id AND code = '4000' LIMIT 1;
  SELECT id INTO v_asset_parent   FROM accounts WHERE org_id = p_org_id AND code = '1000' LIMIT 1;
  SELECT id INTO v_liab_parent    FROM accounts WHERE org_id = p_org_id AND code = '2000' LIMIT 1;
  SELECT id INTO v_expense_parent FROM accounts WHERE org_id = p_org_id AND code = '6000' LIMIT 1;

  -- ── REVENUE ──────────────────────────────────────────────
  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, is_system, cash_flow_category)
  VALUES (p_org_id, '4500', 'Pendapatan Program Pelatihan', 'REVENUE', 'CREDIT', v_revenue_parent, FALSE, 'OPERATING')
  ON CONFLICT (org_id, code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_lms_rev_id;

  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, cash_flow_category)
  VALUES (p_org_id, '4510', 'Pendapatan Sertifikasi', 'REVENUE', 'CREDIT', v_lms_rev_id, 'OPERATING')
  ON CONFLICT (org_id, code) DO NOTHING;

  -- ── ASSET (Piutang) ───────────────────────────────────────
  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, cash_flow_category)
  VALUES (p_org_id, '1320', 'Piutang Peserta Pelatihan', 'ASSET', 'DEBIT', v_asset_parent, 'OPERATING')
  ON CONFLICT (org_id, code) DO NOTHING;

  -- ── LIABILITY (Pendapatan Ditangguhkan) ───────────────────
  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, cash_flow_category)
  VALUES (p_org_id, '2310', 'Pendapatan Ditangguhkan (DP Peserta)', 'LIABILITY', 'CREDIT', v_liab_parent, 'OPERATING')
  ON CONFLICT (org_id, code) DO NOTHING;

  -- ── EXPENSE ───────────────────────────────────────────────
  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, is_system, cash_flow_category)
  VALUES (p_org_id, '6500', 'Beban Operasional Pelatihan', 'EXPENSE', 'DEBIT', v_expense_parent, FALSE, 'OPERATING')
  ON CONFLICT (org_id, code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_lms_exp_id;

  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, cash_flow_category) VALUES
    (p_org_id, '6510', 'Beban Honorarium Instruktur',         'EXPENSE', 'DEBIT', v_lms_exp_id, 'OPERATING'),
    (p_org_id, '6520', 'Beban Materi & Perlengkapan Training', 'EXPENSE', 'DEBIT', v_lms_exp_id, 'OPERATING'),
    (p_org_id, '6530', 'Beban Sewa Tempat Pelatihan',         'EXPENSE', 'DEBIT', v_lms_exp_id, 'OPERATING'),
    (p_org_id, '6540', 'Beban Sertifikasi & Percetakan',      'EXPENSE', 'DEBIT', v_lms_exp_id, 'OPERATING')
  ON CONFLICT (org_id, code) DO NOTHING;

END;
$$;

NOTIFY pgrst, 'reload schema';
