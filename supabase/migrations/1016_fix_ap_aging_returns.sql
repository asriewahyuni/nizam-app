-- ==========================================
-- MIGRATION 1016: Fix AP Aging Returns & Payments
-- Masalah: View v_ap_aging_report belum memperhitungkan Purchase Returns 
-- serta diskon pembayaran (discount_amount),
-- sehingga invoice yang sudah di-retur/diskon masih tampil sebagai hutang.
-- ==========================================

CREATE OR REPLACE VIEW v_ap_aging_report AS
WITH paid_agg AS (
    -- Total yang sudah dibayar + diskon per invoice
    SELECT purchase_id, COALESCE(SUM(amount + discount_amount), 0) as total_paid 
    FROM purchase_payments 
    GROUP BY purchase_id
),
return_agg AS (
    -- Total nilai retur per invoice (mengurangi kewajiban AP)
    SELECT purchase_id, COALESCE(SUM(total_amount), 0) as total_returned
    FROM purchase_returns
    GROUP BY purchase_id
)
SELECT 
    pur.org_id,
    c.name as contact_name,
    pur.purchase_number as doc_number,
    pur.due_date,
    pur.grand_total,
    COALESCE(p.total_paid, 0) as paid_amount,
    COALESCE(r.total_returned, 0) as returned_amount,
    -- Outstanding = Total Invoice - Pembayaran(termasuk diskon) - Retur
    (pur.grand_total - COALESCE(p.total_paid, 0) - COALESCE(r.total_returned, 0)) as outstanding,
    GREATEST(0, (CURRENT_DATE - pur.due_date)) as days_overdue,
    CASE 
        WHEN (pur.due_date >= CURRENT_DATE) THEN 'Current'
        WHEN (CURRENT_DATE - pur.due_date) <= 30 THEN '0-30 Days'
        WHEN (CURRENT_DATE - pur.due_date) <= 60 THEN '31-60 Days'
        WHEN (CURRENT_DATE - pur.due_date) <= 90 THEN '61-90 Days'
        ELSE '> 90 Days'
    END as aging_bucket
FROM purchases pur
JOIN contacts c ON pur.vendor_id = c.id
LEFT JOIN paid_agg p ON p.purchase_id = pur.id
LEFT JOIN return_agg r ON r.purchase_id = pur.id
WHERE pur.status NOT IN ('DRAFT', 'VOIDED')
-- Hanya tampilkan jika masih ada outstanding > 0 setelah dikurangi retur & bayar + diskon
AND (pur.grand_total - COALESCE(p.total_paid, 0) - COALESCE(r.total_returned, 0)) > 0.01;
