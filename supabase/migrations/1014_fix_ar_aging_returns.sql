-- ==========================================
-- MIGRATION 1014: Fix AR Aging View
-- Masalah: View tidak memperhitungkan Sales Returns,
-- sehingga invoice yang sudah di-retur masih tampil sebagai piutang.
-- ==========================================

CREATE OR REPLACE VIEW v_ar_aging_report AS
WITH paid_agg AS (
    -- Total yang sudah dibayar per invoice
    SELECT sale_id, COALESCE(SUM(amount), 0) as total_paid 
    FROM sales_payments 
    GROUP BY sale_id
),
return_agg AS (
    -- Total nilai retur per invoice (mengurangi kewajiban AR)
    SELECT sale_id, COALESCE(SUM(grand_total), 0) as total_returned
    FROM sales_returns
    WHERE status != 'VOIDED'
    GROUP BY sale_id
)
SELECT 
    s.org_id,
    c.name as contact_name,
    s.sale_number as doc_number,
    s.due_date,
    s.grand_total,
    COALESCE(p.total_paid, 0) as paid_amount,
    COALESCE(r.total_returned, 0) as returned_amount,
    -- Outstanding = Total Invoice - Pembayaran - Retur
    (s.grand_total - COALESCE(p.total_paid, 0) - COALESCE(r.total_returned, 0)) as outstanding,
    GREATEST(0, (CURRENT_DATE - s.due_date)) as days_overdue,
    CASE 
        WHEN (s.due_date >= CURRENT_DATE) THEN 'Current'
        WHEN (CURRENT_DATE - s.due_date) <= 30 THEN '0-30 Days'
        WHEN (CURRENT_DATE - s.due_date) <= 60 THEN '31-60 Days'
        WHEN (CURRENT_DATE - s.due_date) <= 90 THEN '61-90 Days'
        ELSE '> 90 Days'
    END as aging_bucket
FROM sales s
JOIN contacts c ON s.customer_id = c.id
LEFT JOIN paid_agg p ON p.sale_id = s.id
LEFT JOIN return_agg r ON r.sale_id = s.id
WHERE s.status NOT IN ('DRAFT', 'VOIDED')
-- Hanya tampilkan jika masih ada outstanding > 0 setelah dikurangi retur & bayar
AND (s.grand_total - COALESCE(p.total_paid, 0) - COALESCE(r.total_returned, 0)) > 0.01;
