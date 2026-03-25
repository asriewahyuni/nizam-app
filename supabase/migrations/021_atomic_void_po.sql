-- ============================================================
-- MIGRATION 021: Atomic PO Voiding (Bypass RLS for Ledger Sync)
-- ============================================================

CREATE OR REPLACE FUNCTION public.void_purchase_atomic(
  p_org_id UUID,
  p_purchase_id UUID,
  p_user_id UUID,
  p_reason TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- PENTING: Menjalankan dengan hak akses admin
AS $$
DECLARE
    v_purchase_number TEXT;
BEGIN
    -- 1. Verifikasi PO
    SELECT purchase_number INTO v_purchase_number FROM public.purchases 
    WHERE id = p_purchase_id AND org_id = p_org_id;

    IF v_purchase_number IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'PO tidak ditemukan');
    END IF;

    -- 2. Void Journal Entry (Ledger)
    UPDATE public.journal_entries 
    SET status = 'VOIDED',
        voided_at = NOW(),
        voided_by = p_user_id,
        void_reason = p_reason
    WHERE reference_id = p_purchase_id 
      AND reference_type = 'PURCHASE'
      AND org_id = p_org_id;

    -- 3. Delete Stock Movements (Sub-Ledger)
    DELETE FROM public.stock_movements 
    WHERE reference_id = p_purchase_id 
      AND reference_type = 'PURCHASE'
      AND org_id = p_org_id;

    -- 4. Update PO Status
    UPDATE public.purchases 
    SET status = 'VOIDED'
    WHERE id = p_purchase_id AND org_id = p_org_id;

    RETURN jsonb_build_object('success', TRUE);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;
