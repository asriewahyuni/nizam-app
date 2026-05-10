-- Migration: 1260_inject_fleet_coa.sql
-- Description: CoA injection function for Fleet & Rental module
-- Accounts:
--   ASSET    : 1401 Kendaraan Operasional
--              1402 Alat Berat / Unit Rental
--              1403 Akumulasi Penyusutan Kendaraan
--              1404 Spare Part & Perlengkapan Armada
--   REVENUE  : 4520 Pendapatan Sewa Kendaraan
--              4530 Pendapatan Sewa Alat Berat
--              4540 Pendapatan Driver/Pengemudi
--   EXPENSE  : 6540 Beban Operasional Armada
--              6550 Beban Perawatan & Servis Kendaraan
--              6560 Beban BBM & Tol
--              6570 Beban Asuransi Armada

CREATE OR REPLACE FUNCTION public.inject_fleet_coa(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asset_parent   UUID;
  v_revenue_parent UUID;
  v_expense_parent UUID;
  v_fleet_asset_id UUID;
  v_fleet_rev_id   UUID;
  v_fleet_exp_id   UUID;
BEGIN
  -- Ambil parent accounts utama
  SELECT id INTO v_asset_parent   FROM accounts WHERE org_id = p_org_id AND code = '1000' LIMIT 1;
  SELECT id INTO v_revenue_parent FROM accounts WHERE org_id = p_org_id AND code = '4000' LIMIT 1;
  SELECT id INTO v_expense_parent FROM accounts WHERE org_id = p_org_id AND code = '6000' LIMIT 1;

  -- ASET: Kendaraan Operasional (induk untuk sub-aset fleet)
  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, is_system, cash_flow_category)
  VALUES (p_org_id, '1401', 'Kendaraan Operasional', 'ASSET', 'DEBIT', v_asset_parent, FALSE, 'INVESTING')
  ON CONFLICT (org_id, code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_fleet_asset_id;

  -- Alat Berat / Unit Rental
  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, cash_flow_category)
  VALUES (p_org_id, '1402', 'Alat Berat & Unit Rental', 'ASSET', 'DEBIT', v_fleet_asset_id, 'INVESTING')
  ON CONFLICT (org_id, code) DO NOTHING;

  -- Akumulasi Penyusutan
  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, cash_flow_category)
  VALUES (p_org_id, '1403', 'Akum. Penyusutan Kendaraan', 'ASSET', 'CREDIT', v_fleet_asset_id, 'INVESTING')
  ON CONFLICT (org_id, code) DO NOTHING;

  -- Spare Part & Perlengkapan (persediaan)
  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, cash_flow_category)
  VALUES (p_org_id, '1404', 'Spare Part & Perlengkapan Armada', 'ASSET', 'DEBIT', v_asset_parent, 'OPERATING')
  ON CONFLICT (org_id, code) DO NOTHING;

  -- PENDAPATAN
  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, cash_flow_category)
  VALUES (p_org_id, '4520', 'Pendapatan Sewa Kendaraan', 'REVENUE', 'CREDIT', v_revenue_parent, 'OPERATING')
  ON CONFLICT (org_id, code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_fleet_rev_id;

  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, cash_flow_category)
  VALUES (p_org_id, '4530', 'Pendapatan Sewa Alat Berat', 'REVENUE', 'CREDIT', v_fleet_rev_id, 'OPERATING')
  ON CONFLICT (org_id, code) DO NOTHING;

  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, cash_flow_category)
  VALUES (p_org_id, '4540', 'Pendapatan Driver/Pengemudi', 'REVENUE', 'CREDIT', v_fleet_rev_id, 'OPERATING')
  ON CONFLICT (org_id, code) DO NOTHING;

  -- BEBAN
  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, cash_flow_category)
  VALUES (p_org_id, '6540', 'Beban Operasional Armada', 'EXPENSE', 'DEBIT', v_expense_parent, 'OPERATING')
  ON CONFLICT (org_id, code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_fleet_exp_id;

  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, cash_flow_category)
  VALUES (p_org_id, '6550', 'Beban Perawatan & Servis Kendaraan', 'EXPENSE', 'DEBIT', v_fleet_exp_id, 'OPERATING')
  ON CONFLICT (org_id, code) DO NOTHING;

  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, cash_flow_category)
  VALUES (p_org_id, '6560', 'Beban BBM & Tol', 'EXPENSE', 'DEBIT', v_fleet_exp_id, 'OPERATING')
  ON CONFLICT (org_id, code) DO NOTHING;

  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, cash_flow_category)
  VALUES (p_org_id, '6570', 'Beban Asuransi Armada', 'EXPENSE', 'DEBIT', v_fleet_exp_id, 'OPERATING')
  ON CONFLICT (org_id, code) DO NOTHING;
END;
$$;
