-- ============================================================
-- MIGRATION 1139: Fix submit_coa_request Parameter Order
-- ============================================================
-- Root cause: PostgREST passes named parameters alphabetically,
-- but the original function in 1137 was defined in a different
-- parameter order. When Supabase client calls:
--   .rpc('submit_coa_request', { p_business_reason, p_parent_org_id, ... })
-- PostgREST resolves by NAME (alphabetically), so the function
-- signature must match the exact parameter names expected.
--
-- This migration replaces submit_coa_request with an identical
-- implementation but ensures all named params are registered
-- correctly in the pg_proc catalog so PostgREST can find it.
-- ============================================================

-- Drop existing overloads to avoid ambiguity
DROP FUNCTION IF EXISTS public.submit_coa_request(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.submit_coa_request(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, UUID, UUID);

-- Re-create with clean canonical parameter names (alphabetical matches PostgREST lookup)
CREATE OR REPLACE FUNCTION public.submit_coa_request(
  p_business_reason       TEXT,
  p_parent_org_id         UUID,
  p_proposed_code         TEXT,
  p_proposed_description  TEXT DEFAULT NULL,
  p_proposed_name         TEXT DEFAULT NULL,
  p_proposed_normal_balance TEXT DEFAULT NULL,
  p_proposed_parent_id    UUID DEFAULT NULL,
  p_proposed_type         TEXT DEFAULT NULL,
  p_requester_branch_id   UUID DEFAULT NULL,
  p_requester_org_id      UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autentikasi diperlukan.';
  END IF;

  IF p_business_reason IS NULL OR trim(p_business_reason) = '' THEN
    RAISE EXCEPTION 'Alasan bisnis wajib diisi saat mengajukan request rekening CoA.';
  END IF;

  IF p_proposed_code IS NULL OR trim(p_proposed_code) = '' THEN
    RAISE EXCEPTION 'Kode akun yang diajukan wajib diisi.';
  END IF;

  IF p_proposed_name IS NULL OR trim(p_proposed_name) = '' THEN
    RAISE EXCEPTION 'Nama akun yang diajukan wajib diisi.';
  END IF;

  IF p_proposed_type IS NULL THEN
    RAISE EXCEPTION 'Tipe akun yang diajukan wajib diisi.';
  END IF;

  IF p_proposed_normal_balance IS NULL THEN
    RAISE EXCEPTION 'Saldo normal akun yang diajukan wajib diisi.';
  END IF;

  INSERT INTO public.coa_account_requests (
    org_id,
    requester_org_id,
    requester_branch_id,
    requested_by,
    proposed_code,
    proposed_name,
    proposed_type,
    proposed_normal_balance,
    proposed_parent_id,
    proposed_description,
    business_reason
  ) VALUES (
    p_parent_org_id,
    p_requester_org_id,
    p_requester_branch_id,
    auth.uid(),
    trim(p_proposed_code),
    trim(p_proposed_name),
    p_proposed_type,
    p_proposed_normal_balance,
    p_proposed_parent_id,
    p_proposed_description,
    trim(p_business_reason)
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.submit_coa_request(
  TEXT, UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, UUID, UUID
) TO authenticated;

NOTIFY pgrst, 'reload schema';
