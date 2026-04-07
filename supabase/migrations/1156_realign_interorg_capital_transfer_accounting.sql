-- ============================================================
-- MIGRATION 1156: Realign Inter-Org Capital Transfer Accounting
-- ============================================================
-- Tujuan:
-- 1. Parent -> Child dicatat sebagai arus kas investasi di parent.
-- 2. Child penerima dicatat sebagai arus kas pendanaan/modal.
-- 3. Dana tetap masuk ke rekening bank target child/unit yang dipilih.
--
-- Ringkasan perubahan:
-- - Tambah akun sistem 1600 / 1601 agar parent punya akun investasi
--   standar untuk penempatan modal pada entitas anak/unit.
-- - Perketat RPC create_interorg_capital_transfer agar:
--   * sisi parent wajib akun investasi (bukan 11xx kas/bank)
--   * sisi target wajib akun financing/equity yang valid
-- ============================================================

INSERT INTO public.accounts (
  org_id,
  code,
  name,
  type,
  normal_balance,
  parent_id,
  description,
  cash_flow_category,
  is_system,
  is_active
)
SELECT
  asset_root.org_id,
  '1600',
  'Investasi Jangka Panjang',
  'ASSET',
  'DEBIT',
  asset_root.id,
  'Kelompok akun investasi jangka panjang termasuk penempatan modal ke entitas anak atau unit.',
  'INVESTING',
  TRUE,
  TRUE
FROM public.accounts asset_root
WHERE asset_root.code = '1000'
  AND NOT EXISTS (
    SELECT 1
    FROM public.accounts existing_account
    WHERE existing_account.org_id = asset_root.org_id
      AND existing_account.code = '1600'
  );

INSERT INTO public.accounts (
  org_id,
  code,
  name,
  type,
  normal_balance,
  parent_id,
  description,
  cash_flow_category,
  is_system,
  is_active
)
SELECT
  investment_root.org_id,
  '1601',
  'Investasi pada Entitas Anak / Unit',
  'ASSET',
  'DEBIT',
  investment_root.id,
  'Digunakan parent/holding untuk mencatat setoran modal atau penempatan investasi ke anak perusahaan/unit.',
  'INVESTING',
  TRUE,
  TRUE
FROM public.accounts investment_root
WHERE investment_root.code = '1600'
  AND NOT EXISTS (
    SELECT 1
    FROM public.accounts existing_account
    WHERE existing_account.org_id = investment_root.org_id
      AND existing_account.code = '1601'
  );

UPDATE public.accounts
SET cash_flow_category = 'INVESTING'
WHERE code LIKE '16%';

CREATE OR REPLACE FUNCTION public.seed_default_coa(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_parent_id UUID;
DECLARE v_investment_parent_id UUID;
BEGIN
  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
  (p_org_id, '1000', 'Aset', 'ASSET', 'DEBIT', TRUE)
  RETURNING id INTO v_parent_id;

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

  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, is_system) VALUES
  (p_org_id, '1500', 'Aset Tetap', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1501', 'Tanah', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1502', 'Bangunan', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1503', 'Akumulasi Penyusutan Bangunan', 'ASSET', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '1504', 'Kendaraan', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1505', 'Akumulasi Penyusutan Kendaraan', 'ASSET', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '1506', 'Peralatan & Mesin', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1507', 'Akumulasi Penyusutan Peralatan', 'ASSET', 'CREDIT', v_parent_id, TRUE);

  INSERT INTO accounts (
    org_id,
    code,
    name,
    type,
    normal_balance,
    parent_id,
    is_system,
    cash_flow_category
  ) VALUES (
    p_org_id,
    '1600',
    'Investasi Jangka Panjang',
    'ASSET',
    'DEBIT',
    v_parent_id,
    TRUE,
    'INVESTING'
  )
  RETURNING id INTO v_investment_parent_id;

  INSERT INTO accounts (
    org_id,
    code,
    name,
    type,
    normal_balance,
    parent_id,
    is_system,
    cash_flow_category
  ) VALUES (
    p_org_id,
    '1601',
    'Investasi pada Entitas Anak / Unit',
    'ASSET',
    'DEBIT',
    v_investment_parent_id,
    TRUE,
    'INVESTING'
  );

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

  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
  (p_org_id, '3000', 'Ekuitas', 'EQUITY', 'CREDIT', TRUE)
  RETURNING id INTO v_parent_id;

  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, is_system) VALUES
  (p_org_id, '3001', 'Modal Disetor', 'EQUITY', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '3002', 'Laba Ditahan', 'EQUITY', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '3003', 'Laba Periode Berjalan', 'EQUITY', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '3004', 'Prive / Dividen', 'EQUITY', 'DEBIT', v_parent_id, TRUE);

  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
  (p_org_id, '4000', 'Pendapatan', 'REVENUE', 'CREDIT', TRUE)
  RETURNING id INTO v_parent_id;

  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, is_system) VALUES
  (p_org_id, '4001', 'Pendapatan Usaha', 'REVENUE', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '4002', 'Diskon Penjualan (Contra)', 'REVENUE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '4003', 'Retur Penjualan', 'REVENUE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '4101', 'Pendapatan Bunga', 'REVENUE', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '4102', 'Pendapatan Lain-lain', 'REVENUE', 'CREDIT', v_parent_id, TRUE);

  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
  (p_org_id, '5000', 'Beban Pokok Penjualan', 'EXPENSE', 'DEBIT', TRUE)
  RETURNING id INTO v_parent_id;

  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, is_system) VALUES
  (p_org_id, '5001', 'HPP / Cost of Goods Sold', 'EXPENSE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '5002', 'Biaya Pengiriman Masuk (Freight In)', 'EXPENSE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '5003', 'Retur Pembelian (Contra)', 'EXPENSE', 'CREDIT', v_parent_id, TRUE);

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

CREATE OR REPLACE FUNCTION public.create_interorg_capital_transfer(
  p_source_org_id UUID,
  p_source_bank_account_id UUID,
  p_source_counter_account_id UUID,
  p_target_bank_account_id UUID,
  p_target_counter_account_id UUID,
  p_transaction_date DATE,
  p_amount NUMERIC,
  p_description TEXT,
  p_reference_number TEXT DEFAULT NULL
)
RETURNS TABLE (
  source_transaction_id UUID,
  target_transaction_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_source_bank RECORD;
  v_target_bank RECORD;
  v_source_counter_account RECORD;
  v_target_counter_account RECORD;
  v_source_tx_id UUID;
  v_target_tx_id UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autentikasi diperlukan.';
  END IF;

  IF p_source_org_id IS NULL THEN
    RAISE EXCEPTION 'Organisasi sumber wajib diisi.';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Nominal transfer wajib lebih besar dari 0.';
  END IF;

  IF p_transaction_date IS NULL THEN
    RAISE EXCEPTION 'Tanggal transaksi wajib diisi.';
  END IF;

  IF p_description IS NULL OR btrim(p_description) = '' THEN
    RAISE EXCEPTION 'Deskripsi transaksi wajib diisi.';
  END IF;

  IF NOT public.can_manage_finance_master(p_source_org_id) THEN
    RAISE EXCEPTION 'Hanya Parent/Holding pada konteks unit utama yang dapat melakukan transfer modal antar entitas.';
  END IF;

  SELECT id, org_id, branch_id, account_id
  INTO v_source_bank
  FROM public.bank_accounts
  WHERE id = p_source_bank_account_id
    AND org_id = p_source_org_id
    AND is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rekening sumber tidak ditemukan atau tidak aktif.';
  END IF;

  SELECT id, org_id, branch_id, account_id
  INTO v_target_bank
  FROM public.bank_accounts
  WHERE id = p_target_bank_account_id
    AND is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rekening tujuan tidak ditemukan atau tidak aktif.';
  END IF;

  IF v_target_bank.org_id = p_source_org_id THEN
    RAISE EXCEPTION 'Gunakan transfer internal biasa untuk rekening pada organisasi yang sama.';
  END IF;

  IF NOT public.is_org_in_consolidation_tree(v_target_bank.org_id, p_source_org_id) THEN
    RAISE EXCEPTION 'Organisasi tujuan tidak termasuk dalam struktur parent/holding sumber.';
  END IF;

  SELECT id, org_id, code, name, type, is_active, cash_flow_category
  INTO v_source_counter_account
  FROM public.accounts
  WHERE id = p_source_counter_account_id
    AND org_id = p_source_org_id
    AND is_active = TRUE
  LIMIT 1;

  IF v_source_counter_account.id IS NULL THEN
    RAISE EXCEPTION 'Akun investasi parent (sumber) tidak valid.';
  END IF;

  IF NOT (
    v_source_counter_account.type = 'ASSET'
    AND (
      COALESCE(v_source_counter_account.cash_flow_category, '') = 'INVESTING'
      OR v_source_counter_account.code LIKE '16%%'
      OR v_source_counter_account.name ILIKE '%%investasi%%'
    )
  ) THEN
    RAISE EXCEPTION
      'Akun lawan parent harus akun investasi (kelompok 16xx), misalnya 1601 Investasi pada Entitas Anak / Unit.';
  END IF;

  SELECT id, org_id, code, name, type, is_active, cash_flow_category
  INTO v_target_counter_account
  FROM public.accounts
  WHERE id = p_target_counter_account_id
    AND org_id = v_target_bank.org_id
    AND is_active = TRUE
  LIMIT 1;

  IF v_target_counter_account.id IS NULL THEN
    RAISE EXCEPTION 'Akun lawan entitas tujuan tidak valid.';
  END IF;

  IF NOT (
    v_target_counter_account.type IN ('EQUITY', 'LIABILITY')
    AND (
      COALESCE(v_target_counter_account.cash_flow_category, '') = 'FINANCING'
      OR v_target_counter_account.code LIKE '25%%'
      OR v_target_counter_account.code LIKE '26%%'
      OR v_target_counter_account.code LIKE '3%%'
    )
  ) THEN
    RAISE EXCEPTION
      'Akun lawan entitas tujuan harus akun pendanaan/modal (kelompok 25xx, 26xx, atau 3xxx), misalnya 3001 Modal Disetor.';
  END IF;

  IF p_source_counter_account_id = v_source_bank.account_id THEN
    RAISE EXCEPTION 'Akun investasi parent tidak boleh sama dengan akun kas/bank sumber.';
  END IF;

  IF p_target_counter_account_id = v_target_bank.account_id THEN
    RAISE EXCEPTION 'Akun lawan entitas tujuan tidak boleh sama dengan akun kas/bank tujuan.';
  END IF;

  INSERT INTO public.bank_transactions (
    org_id,
    branch_id,
    bank_account_id,
    transaction_date,
    description,
    amount,
    type,
    category_id,
    reference_number,
    status,
    created_by
  ) VALUES (
    p_source_org_id,
    v_source_bank.branch_id,
    p_source_bank_account_id,
    p_transaction_date,
    btrim(p_description),
    p_amount,
    'TRANSFER',
    p_source_counter_account_id,
    p_reference_number,
    'POSTED',
    v_uid
  )
  RETURNING id INTO v_source_tx_id;

  INSERT INTO public.bank_transactions (
    org_id,
    branch_id,
    bank_account_id,
    transaction_date,
    description,
    amount,
    type,
    category_id,
    reference_number,
    status,
    created_by
  ) VALUES (
    v_target_bank.org_id,
    v_target_bank.branch_id,
    p_target_bank_account_id,
    p_transaction_date,
    btrim(p_description),
    p_amount,
    'IN',
    p_target_counter_account_id,
    p_reference_number,
    'POSTED',
    v_uid
  )
  RETURNING id INTO v_target_tx_id;

  RETURN QUERY SELECT v_source_tx_id, v_target_tx_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_interorg_capital_transfer(
  UUID, UUID, UUID, UUID, UUID, DATE, NUMERIC, TEXT, TEXT
) TO authenticated;

NOTIFY pgrst, 'reload schema';
