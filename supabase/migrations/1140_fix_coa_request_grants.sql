-- ============================================================
-- MIGRATION 1140: Fix CoA Request View & Table Grants
-- ============================================================
-- Root cause: view coa_request_summary dan table coa_account_requests
-- tidak memiliki GRANT SELECT untuk role 'authenticated'.
-- PostgREST mengembalikan empty error object {} karena permission denied.
-- ============================================================

-- 1. Grant SELECT pada tabel utama untuk authenticated (RLS tetap berlaku)
GRANT SELECT ON public.coa_account_requests TO authenticated;
GRANT INSERT ON public.coa_account_requests TO authenticated;

-- 2. Grant SELECT pada view summary (RLS tabel sumber tetap berlaku)
GRANT SELECT ON public.coa_request_summary TO authenticated;

-- 3. Pastikan semua RPC functions bisa diakses oleh authenticated
GRANT EXECUTE ON FUNCTION public.submit_coa_request(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_coa_request(UUID, TEXT)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_coa_request(UUID, TEXT)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_coa_request(UUID)         TO authenticated;

-- 4. Pastikan helper governance functions juga bisa diakses
GRANT EXECUTE ON FUNCTION public.is_main_organization(UUID)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_finance_master(UUID)  TO authenticated;

-- 5. Pastikan view consolidation juga bisa diakses (dependency dari coa_request_summary view)
GRANT SELECT ON public.coa_request_summary TO anon;

NOTIFY pgrst, 'reload schema';
