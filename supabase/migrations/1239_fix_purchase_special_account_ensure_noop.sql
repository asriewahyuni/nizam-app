-- Prevent purchase payment special-account helpers from updating existing child-org CoA rows.
--
-- Child organizations receive special purchase accounts (1404/1205) from parent CoA sync.
-- The old helpers used INSERT ... ON CONFLICT DO UPDATE even when the account already
-- existed. That still fires the accounts governance trigger, so child-org ISTISHNA/SALAM
-- payments can fail with:
-- "Hanya Organisasi Utama pada konteks Unit Utama yang dapat membuat/mengubah rekening CoA."

CREATE OR REPLACE FUNCTION public.ensure_salam_vendor_receivable_account(p_org_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asset_root_id UUID;
  v_salam_receivable_id UUID;
BEGIN
  SELECT id
  INTO v_salam_receivable_id
  FROM public.accounts
  WHERE org_id = p_org_id
    AND code = '1404'
  ORDER BY is_active DESC, created_at ASC NULLS LAST, id ASC
  LIMIT 1;

  IF v_salam_receivable_id IS NOT NULL THEN
    RETURN v_salam_receivable_id;
  END IF;

  IF NOT public.can_manage_finance_master(p_org_id) THEN
    RETURN NULL;
  END IF;

  SELECT id
  INTO v_asset_root_id
  FROM public.accounts
  WHERE org_id = p_org_id
    AND code = '1000'
  LIMIT 1;

  IF v_asset_root_id IS NULL THEN
    SELECT id
    INTO v_asset_root_id
    FROM public.accounts
    WHERE org_id = p_org_id
      AND type = 'ASSET'
    ORDER BY code
    LIMIT 1;
  END IF;

  INSERT INTO public.accounts (
    org_id,
    code,
    name,
    type,
    normal_balance,
    parent_id,
    is_system,
    is_active
  )
  VALUES (
    p_org_id,
    '1404',
    'Piutang Salam Vendor',
    'ASSET',
    'DEBIT',
    v_asset_root_id,
    FALSE,
    TRUE
  )
  ON CONFLICT (org_id, code) DO NOTHING
  RETURNING id INTO v_salam_receivable_id;

  IF v_salam_receivable_id IS NULL THEN
    SELECT id
    INTO v_salam_receivable_id
    FROM public.accounts
    WHERE org_id = p_org_id
      AND code = '1404'
    ORDER BY is_active DESC, created_at ASC NULLS LAST, id ASC
    LIMIT 1;
  END IF;

  RETURN v_salam_receivable_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_istishna_vendor_asset_account(p_org_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asset_root_id UUID;
  v_istishna_asset_id UUID;
BEGIN
  SELECT id
  INTO v_istishna_asset_id
  FROM public.accounts
  WHERE org_id = p_org_id
    AND code = '1205'
  ORDER BY is_active DESC, created_at ASC NULLS LAST, id ASC
  LIMIT 1;

  IF v_istishna_asset_id IS NOT NULL THEN
    RETURN v_istishna_asset_id;
  END IF;

  IF NOT public.can_manage_finance_master(p_org_id) THEN
    RETURN NULL;
  END IF;

  SELECT id
  INTO v_asset_root_id
  FROM public.accounts
  WHERE org_id = p_org_id
    AND code = '1200'
  LIMIT 1;

  IF v_asset_root_id IS NULL THEN
    SELECT id
    INTO v_asset_root_id
    FROM public.accounts
    WHERE org_id = p_org_id
      AND type = 'ASSET'
    ORDER BY code
    LIMIT 1;
  END IF;

  INSERT INTO public.accounts (
    org_id,
    code,
    name,
    type,
    normal_balance,
    parent_id,
    is_system,
    is_active
  )
  VALUES (
    p_org_id,
    '1205',
    'Aset / Piutang Barang Istishna (Pembelian)',
    'ASSET',
    'DEBIT',
    v_asset_root_id,
    FALSE,
    TRUE
  )
  ON CONFLICT (org_id, code) DO NOTHING
  RETURNING id INTO v_istishna_asset_id;

  IF v_istishna_asset_id IS NULL THEN
    SELECT id
    INTO v_istishna_asset_id
    FROM public.accounts
    WHERE org_id = p_org_id
      AND code = '1205'
    ORDER BY is_active DESC, created_at ASC NULLS LAST, id ASC
    LIMIT 1;
  END IF;

  RETURN v_istishna_asset_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_salam_vendor_receivable_account(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_istishna_vendor_asset_account(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
