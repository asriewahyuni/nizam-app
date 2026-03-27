-- ============================================================
-- MIGRATION 1007: Fix CoA Seed Trigger (Security Definer)
-- Fixes issue where trigger fails because RLS isn't set yet
-- ============================================================

CREATE OR REPLACE FUNCTION public.seed_default_coa(p_org_id UUID)
RETURNS VOID 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_parent_id UUID;
BEGIN
  -- ══════════════════════════════════════════
  -- 1. ASET (ASSET / DEBIT)
  -- ══════════════════════════════════════════
  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
  (p_org_id, '1000', 'Aset', 'ASSET', 'DEBIT', TRUE)
  RETURNING id INTO v_parent_id;

  -- 1.1 Aset Lancar
  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, is_system) VALUES
  (p_org_id, '1100', 'Aset Lancar', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1101', 'Kas Besar', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1102', 'Kas Kecil (Petty Cash)', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1103', 'Bank - Rekening Operasional', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1104', 'Bank - Rekening Payroll', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1105', 'Bank - Rekening Lainnya', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1201', 'Piutang Usaha', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1202', 'Piutang Karyawan', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1203', 'Cadangan Kerugian Piutang', 'ASSET', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '1301', 'Persediaan Barang Dagangan', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1302', 'Persediaan Barang Dalam Proses', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1401', 'PPN Masukan (Pajak Dibayar)', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1402', 'Biaya Dibayar Dimuka', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1403', 'Uang Muka Pembelian', 'ASSET', 'DEBIT', v_parent_id, TRUE);

  -- 1.2 Aset Tetap
  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, is_system) VALUES
  (p_org_id, '1500', 'Aset Tetap', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1501', 'Tanah', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1502', 'Bangunan', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1503', 'Akumulasi Penyusutan Bangunan', 'ASSET', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '1504', 'Kendaraan', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1505', 'Akumulasi Penyusutan Kendaraan', 'ASSET', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '1506', 'Peralatan & Mesin', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1507', 'Akumulasi Penyusutan Peralatan', 'ASSET', 'CREDIT', v_parent_id, TRUE);

  -- ══════════════════════════════════════════
  -- 2. LIABILITAS (LIABILITY / CREDIT)
  -- ══════════════════════════════════════════
  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
  (p_org_id, '2000', 'Liabilitas', 'LIABILITY', 'CREDIT', TRUE)
  RETURNING id INTO v_parent_id;

  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, is_system) VALUES
  (p_org_id, '2101', 'Hutang Usaha', 'LIABILITY', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '2102', 'Hutang Bank Jangka Pendek', 'LIABILITY', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '2201', 'PPN Keluaran (Pajak Dipungut)', 'LIABILITY', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '2202', 'Hutang PPh 21', 'LIABILITY', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '2203', 'Hutang PPh 23', 'LIABILITY', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '2204', 'Hutang PPh Badan', 'LIABILITY', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '2301', 'Pendapatan Diterima di Muka', 'LIABILITY', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '2302', 'Uang Muka Penjualan', 'LIABILITY', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '2401', 'Hutang Gaji', 'LIABILITY', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '2501', 'Hutang Bank Jangka Panjang', 'LIABILITY', 'CREDIT', v_parent_id, TRUE);

  -- ══════════════════════════════════════════
  -- 3. EKUITAS (EQUITY / CREDIT)
  -- ══════════════════════════════════════════
  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
  (p_org_id, '3000', 'Ekuitas', 'EQUITY', 'CREDIT', TRUE)
  RETURNING id INTO v_parent_id;

  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, is_system) VALUES
  (p_org_id, '3001', 'Modal Disetor', 'EQUITY', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '3002', 'Laba Ditahan', 'EQUITY', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '3003', 'Laba Periode Berjalan', 'EQUITY', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '3004', 'Prive / Dividen', 'EQUITY', 'DEBIT', v_parent_id, TRUE);

  -- ══════════════════════════════════════════
  -- 4. PENDAPATAN (REVENUE / CREDIT)
  -- ══════════════════════════════════════════
  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
  (p_org_id, '4000', 'Pendapatan', 'REVENUE', 'CREDIT', TRUE)
  RETURNING id INTO v_parent_id;

  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, is_system) VALUES
  (p_org_id, '4001', 'Pendapatan Usaha', 'REVENUE', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '4002', 'Diskon Penjualan (Contra)', 'REVENUE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '4003', 'Retur Penjualan', 'REVENUE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '4101', 'Pendapatan Bunga', 'REVENUE', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '4102', 'Pendapatan Lain-lain', 'REVENUE', 'CREDIT', v_parent_id, TRUE);

  -- ══════════════════════════════════════════
  -- 5. BEBAN POKOK (COGS / DEBIT)
  -- ══════════════════════════════════════════
  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
  (p_org_id, '5000', 'Beban Pokok Penjualan', 'EXPENSE', 'DEBIT', TRUE)
  RETURNING id INTO v_parent_id;

  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, is_system) VALUES
  (p_org_id, '5001', 'HPP / Cost of Goods Sold', 'EXPENSE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '5002', 'Biaya Pengiriman Masuk (Freight In)', 'EXPENSE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '5003', 'Retur Pembelian (Contra)', 'EXPENSE', 'CREDIT', v_parent_id, TRUE);

  -- ══════════════════════════════════════════
  -- 6. BEBAN OPERASIONAL (EXPENSE / DEBIT)
  -- ══════════════════════════════════════════
  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
  (p_org_id, '6000', 'Beban Operasional', 'EXPENSE', 'DEBIT', TRUE)
  RETURNING id INTO v_parent_id;

  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, is_system) VALUES
  (p_org_id, '6001', 'Gaji & Tunjangan', 'EXPENSE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '6002', 'Sewa Tempat', 'EXPENSE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '6003', 'Utilitas (Listrik, Air, Internet)', 'EXPENSE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '6004', 'Perlengkapan Kantor', 'EXPENSE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '6005', 'Biaya Pemasaran & Iklan', 'EXPENSE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '6006', 'Biaya Transportasi', 'EXPENSE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '6007', 'Biaya Perbaikan & Pemeliharaan', 'EXPENSE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '6008', 'Biaya Asuransi', 'EXPENSE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '6009', 'Biaya Penyusutan', 'EXPENSE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '6010', 'Biaya Profesional & Konsultan', 'EXPENSE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '6099', 'Beban Lain-lain', 'EXPENSE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '6101', 'Biaya Bunga Pinjaman', 'EXPENSE', 'DEBIT', v_parent_id, TRUE);

END;
$$;

-- Ensure the trigger function also has elevated privileges
CREATE OR REPLACE FUNCTION public.trigger_seed_coa()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.seed_default_coa(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
