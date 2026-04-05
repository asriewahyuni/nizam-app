-- ============================================================
-- MIGRATION 1142: Fix Approve CoA Request Type Casting
-- ============================================================
-- Root cause: column "type" is of type account_type but 
-- expression is of type text in public.approve_coa_request. 
-- Same for normal_balance (normal_balance).
-- Fix: Add explicit casts.
-- ============================================================

CREATE OR REPLACE FUNCTION public.approve_coa_request(
  p_request_id  UUID,
  p_review_notes TEXT DEFAULT NULL
)
RETURNS UUID -- returns newly created account_id
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req               public.coa_account_requests%ROWTYPE;
  v_new_account_id    UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autentikasi diperlukan.';
  END IF;

  -- Ambil request
  SELECT * INTO v_req
  FROM public.coa_account_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request CoA tidak ditemukan.';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Hanya request berstatus pending yang dapat disetujui. Status saat ini: %', v_req.status;
  END IF;

  -- Pemeriksa harus punya otoritas finance master di org Parent
  IF NOT public.can_manage_finance_master(v_req.org_id) THEN
    RAISE EXCEPTION 'Hanya Organisasi Utama (Parent) pada konteks Unit Utama yang dapat menyetujui request CoA.';
  END IF;

  -- Validasi: Pastikan kode tidak kembar dengan yang sudah ada di Parent
  IF EXISTS (
    SELECT 1 FROM public.accounts 
    WHERE org_id = v_req.org_id AND code = v_req.proposed_code
  ) THEN
    RAISE EXCEPTION 'Gagal setuju: Kode rekening "%" sudah ada di Buku Besar. Silakan TOLAK request ini dan minta cabang gunakan kode lain yang masih kosong.', v_req.proposed_code;
  END IF;

  -- Buat akun baru di CoA Parent dengan type casting eksplisit
  INSERT INTO public.accounts (
    org_id,
    code,
    name,
    type,
    normal_balance,
    parent_id,
    description,
    is_system
  ) VALUES (
    v_req.org_id,
    v_req.proposed_code,
    v_req.proposed_name,
    v_req.proposed_type::public.account_type,
    v_req.proposed_normal_balance::public.normal_balance,
    v_req.proposed_parent_id,
    v_req.proposed_description,
    FALSE
  )
  RETURNING id INTO v_new_account_id;

  -- Update status request
  UPDATE public.coa_account_requests
  SET
    status             = 'approved',
    reviewed_by        = auth.uid(),
    reviewed_at        = now(),
    review_notes       = p_review_notes,
    created_account_id = v_new_account_id
  WHERE id = p_request_id;

  RETURN v_new_account_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
