-- ============================================================
-- MIGRATION 1145: Inter-Org Capital Transfer Guardrails
-- ============================================================
-- Tujuan:
--   1) Pastikan branch_id selalu tercatat eksplisit di bank_transactions.
--   2) Tolak transaksi jika akun lawan = akun kas/bank yang sama
--      (karena jurnal akan net-zero / tidak berdampak ke laporan).
-- ============================================================

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

  IF NOT EXISTS (
    SELECT 1
    FROM public.accounts
    WHERE id = p_source_counter_account_id
      AND org_id = p_source_org_id
      AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Akun lawan parent (sumber) tidak valid.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.accounts
    WHERE id = p_target_counter_account_id
      AND org_id = v_target_bank.org_id
      AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Akun lawan entitas tujuan tidak valid.';
  END IF;

  IF p_source_counter_account_id = v_source_bank.account_id THEN
    RAISE EXCEPTION 'Akun lawan parent tidak boleh sama dengan akun kas/bank sumber.';
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
