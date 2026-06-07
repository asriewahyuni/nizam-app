-- 1357: Reklasifikasi Simpanan Pokok & Wajib dari Ekuitas → Liabilitas (Wadiah)
--
-- Simpanan anggota koperasi syariah adalah titipan (wadiah yad dhamanah),
-- bukan modal permanen. Koperasi wajib mengembalikannya saat anggota keluar.
-- Oleh karena itu keduanya dicatat sebagai LIABILITAS, bukan EKUITAS.
-- Referensi: PSAK 105/106, Pedoman Akuntansi Koperasi Syariah IAI.

-- 1. Reklasifikasi akun yang sudah ada di semua org
UPDATE accounts
SET type = 'LIABILITY', name = 'Simpanan Pokok (Wadiah)'
WHERE code = '31-1000' AND type = 'EQUITY';

UPDATE accounts
SET type = 'LIABILITY', name = 'Simpanan Wajib (Wadiah)'
WHERE code = '31-2000' AND type = 'EQUITY';

-- 2. Perbarui fungsi inject_koperasi_coa agar org baru langsung klasifikasi benar
CREATE OR REPLACE FUNCTION inject_koperasi_coa(p_org_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_parent_id UUID;
BEGIN
  -- Idempotent: skip jika sudah diinject
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

  -- Simpanan Pokok & Wajib — LIABILITAS (Wadiah), bukan Ekuitas
  -- Anggota berhak menarik kembali saat keluar → kewajiban koperasi
  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
    (p_org_id, '31-1000', 'Simpanan Pokok (Wadiah)', 'LIABILITY', 'CREDIT', TRUE),
    (p_org_id, '31-2000', 'Simpanan Wajib (Wadiah)', 'LIABILITY', 'CREDIT', TRUE);

  -- EKUITAS KOPERASI (modal permanen organisasi, bukan titipan anggota)
  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
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
