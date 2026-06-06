-- 1355: Perbaikan CoA Kojasmat — tambah akun yang hilang & update inject_koperasi_coa

-- 1. Tambah Simpanan Sukarela (Wadiah) ke fungsi inject_koperasi_coa
CREATE OR REPLACE FUNCTION inject_koperasi_coa(p_org_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_parent_id UUID;
BEGIN
  -- Skip jika sudah pernah diinject (idempotent)
  IF EXISTS (
    SELECT 1 FROM accounts WHERE org_id = p_org_id AND code = '31-1000'
  ) THEN RETURN; END IF;

  -- ASET KOPERASI
  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
    (p_org_id, '11-3000', 'Piutang Murabahah', 'ASSET', 'DEBIT', TRUE)
  RETURNING id INTO v_parent_id;
  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, is_system) VALUES
    (p_org_id, '11-3001', 'Piutang Murabahah — Dalam Tagih', 'ASSET', 'DEBIT', v_parent_id, TRUE);

  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
    (p_org_id, '11-4000', 'Piutang Mudharabah', 'ASSET', 'DEBIT', TRUE)
  RETURNING id INTO v_parent_id;
  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, is_system) VALUES
    (p_org_id, '11-4001', 'Piutang Mudharabah — Pembiayaan Aktif', 'ASSET', 'DEBIT', v_parent_id, TRUE);

  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
    (p_org_id, '11-5000', 'Barang Dalam Wakalah', 'ASSET', 'DEBIT', TRUE);

  -- LIABILITAS KOPERASI
  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
    (p_org_id, '21-5000', 'Dana Syirkah Temporer', 'LIABILITY', 'CREDIT', TRUE)
  RETURNING id INTO v_parent_id;
  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, is_system) VALUES
    (p_org_id, '21-5001', 'DST — Murabahah',  'LIABILITY', 'CREDIT', v_parent_id, TRUE),
    (p_org_id, '21-5002', 'DST — Mudharabah', 'LIABILITY', 'CREDIT', v_parent_id, TRUE);

  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
    (p_org_id, '21-6000', 'Simpanan Sukarela (Wadiah)', 'LIABILITY', 'CREDIT', TRUE),
    (p_org_id, '22-1000', 'Utang Bagi Hasil Belum Dibagikan', 'LIABILITY', 'CREDIT', TRUE),
    (p_org_id, '22-2000', 'Dana Sosial (Ta''zir & Zakat)',    'LIABILITY', 'CREDIT', TRUE);

  -- EKUITAS KOPERASI
  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
    (p_org_id, '31-1000', 'Simpanan Pokok',    'EQUITY', 'CREDIT', TRUE),
    (p_org_id, '31-2000', 'Simpanan Wajib',    'EQUITY', 'CREDIT', TRUE),
    (p_org_id, '32-1000', 'Cadangan Koperasi', 'EQUITY', 'CREDIT', TRUE),
    (p_org_id, '33-1000', 'SHU Ditahan',       'EQUITY', 'CREDIT', TRUE),
    (p_org_id, '34-1000', 'SHU Tahun Berjalan','EQUITY', 'CREDIT', TRUE);

  -- PENDAPATAN KOPERASI
  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
    (p_org_id, '41-6000', 'Pendapatan Ujrah', 'REVENUE', 'CREDIT', TRUE)
  RETURNING id INTO v_parent_id;
  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, is_system) VALUES
    (p_org_id, '41-6001', 'Ujrah Wakalah Murabahah',  'REVENUE', 'CREDIT', v_parent_id, TRUE),
    (p_org_id, '41-6002', 'Ujrah Wakalah Mudharabah', 'REVENUE', 'CREDIT', v_parent_id, TRUE);

  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
    (p_org_id, '41-7000', 'Pendapatan Administrasi', 'REVENUE', 'CREDIT', TRUE);

  -- BEBAN KOPERASI
  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
    (p_org_id, '61-5000', 'Beban Operasional Koperasi', 'EXPENSE', 'DEBIT', TRUE),
    (p_org_id, '61-6000', 'Beban Sertifikasi DPS',      'EXPENSE', 'DEBIT', TRUE),
    (p_org_id, '81-1000', 'Zakat Usaha',                'EXPENSE', 'DEBIT', TRUE);
END;
$$;

-- 2. Backfill: inject CoA untuk semua org yang sudah punya modul kojasmat aktif
--    tapi belum punya akun-akun koperasi syariah
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT org_id FROM kojasmat_anggota
  LOOP
    PERFORM inject_koperasi_coa(r.org_id);
  END LOOP;
END;
$$;

-- 3. Tambah kolom simpanan_sukarela ke inject jika org sudah ada 31-1000 tapi belum 21-6000
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT org_id FROM accounts WHERE code = '31-1000'
    EXCEPT
    SELECT DISTINCT org_id FROM accounts WHERE code = '21-6000'
  LOOP
    INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system)
    VALUES (r.org_id, '21-6000', 'Simpanan Sukarela (Wadiah)', 'LIABILITY', 'CREDIT', TRUE)
    ON CONFLICT (org_id, code) DO NOTHING;
  END LOOP;
END;
$$;
