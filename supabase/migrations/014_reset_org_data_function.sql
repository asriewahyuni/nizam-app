-- ==========================================
-- MIGRATION 014: High-Performance Data Reset
-- ==========================================

CREATE OR REPLACE FUNCTION public.reset_org_data(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_role TEXT;
    v_success BOOLEAN := FALSE;
BEGIN
    -- 1. Security Check (Only owner/admin can reset)
    SELECT role INTO v_user_role 
    FROM public.org_members 
    WHERE org_id = p_org_id AND user_id = auth.uid() AND is_active = TRUE;

    IF v_user_role NOT IN ('owner', 'admin') THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Unauthorized: Only Owner or Admin can reset data.');
    END IF;

    -- 2. Delete Transactional Data (ORDER MATTERS due to FKs if cascade is not set everywhere)
    
    -- Finance & Assets
    DELETE FROM public.asset_depreciation_logs WHERE org_id = p_org_id;
    DELETE FROM public.fixed_assets WHERE org_id = p_org_id;
    DELETE FROM public.journal_lines WHERE org_id = p_org_id;
    DELETE FROM public.journal_entries WHERE org_id = p_org_id;
    
    -- Sales & Purchases
    DELETE FROM public.sales_items WHERE org_id = p_org_id;
    DELETE FROM public.sales WHERE org_id = p_org_id;
    DELETE FROM public.purchase_items WHERE org_id = p_org_id;
    DELETE FROM public.purchases WHERE org_id = p_org_id;
    
    -- Inventory & Governance
    DELETE FROM public.inventory_stocks WHERE org_id = p_org_id;
    DELETE FROM public.approval_requests WHERE org_id = p_org_id;
    DELETE FROM public.audit_logs WHERE org_id = p_org_id;

    -- 3. Log the reset event (Wait, we just deleted all audit logs? Let's add one back)
    INSERT INTO public.audit_logs (org_id, user_id, action, table_name, record_id, new_data)
    VALUES (p_org_id, auth.uid(), 'DELETE', 'SYSTEM', p_org_id, '{"action": "FULL_RESET", "status": "SUCCESS"}'::JSONB);

    RETURN jsonb_build_object('success', TRUE, 'message', 'Organization data has been reset to zero.');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;
