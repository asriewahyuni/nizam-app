-- ============================================================
-- MIGRATION 1025: PERFORMANCE INDEXING & AUDIT VIEWS
-- Sprint 3: Performance & Audit Hardening
-- ============================================================

-- 1. INDEXING FOR PERFORMANCE
-- Mengurangi beban query pada tabel-tabel besar (Accounting & Inventory)

-- Journal Entries & Lines
CREATE INDEX IF NOT EXISTS idx_journal_entries_org_date ON public.journal_entries(org_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_org_status ON public.journal_entries(org_id, status);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account_org ON public.journal_lines(account_id, org_id);

-- Inventory Stocks
CREATE INDEX IF NOT EXISTS idx_inventory_stocks_org_warehouse ON public.inventory_stocks(org_id, warehouse_id);

-- Sales & Purchases
CREATE INDEX IF NOT EXISTS idx_sales_org_date ON public.sales(org_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_org_date ON public.purchases(org_id, purchase_date DESC);

-- Payroll
CREATE INDEX IF NOT EXISTS idx_payslips_org_period ON public.payslips(org_id, period_start, period_end);


-- 2. AUDIT LOG ENHANCEMENT
-- View untuk mempermudah pembacaan log oleh Admin (Human Readable)

CREATE OR REPLACE VIEW v_admin_audit_trail AS
SELECT 
    al.id,
    al.org_id,
    al.created_at,
    u.email as user_email,
    u.raw_user_meta_data->>'full_name' as user_name,
    al.action,
    al.table_name,
    al.record_id,
    al.old_data,
    al.new_data,
    CASE 
        WHEN al.action = 'CREATE' THEN 'Menambahkan data baru di ' || al.table_name
        WHEN al.action = 'UPDATE' THEN 'Mengubah data di ' || al.table_name
        WHEN al.action = 'DELETE' THEN 'Menghapus data dari ' || al.table_name
        WHEN al.action = 'VOID' THEN 'Membatalkan (VOID) transaksi di ' || al.table_name
        ELSE al.action || ' pada ' || al.table_name
    END as description
FROM public.audit_logs al
LEFT JOIN auth.users u ON al.user_id = u.id
ORDER BY al.created_at DESC;

COMMENT ON VIEW v_admin_audit_trail IS 'View audit trail yang lebih manusiawi untuk dibaca di Dashboard Admin.';

-- RLS for the view (following audit_logs policy)
-- Note: In Supabase, views inherit RLS or need explicit security definer functions.
-- We will use a function to fetch logs to ensure RLS compliance.

CREATE OR REPLACE FUNCTION get_admin_audit_trail(p_limit INT DEFAULT 50)
RETURNS SETOF v_admin_audit_trail AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM v_admin_audit_trail
    WHERE org_id IN (
        SELECT m.org_id FROM org_members m 
        WHERE m.user_id = auth.uid() 
        AND m.role IN ('owner', 'admin') 
        AND m.is_active = TRUE
    )
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
