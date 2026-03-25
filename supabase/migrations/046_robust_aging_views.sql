-- ==========================================
-- MIGRATION 046: Final Robust Aging Engine
-- Focus: Solid Views replacing complex RPCs
-- ==========================================

-- 1. AR Aging View
CREATE OR REPLACE VIEW v_ar_aging_report AS
WITH paid_agg AS (
    SELECT sale_id, SUM(amount) as total_paid 
    FROM sales_payments 
    GROUP BY sale_id
)
SELECT 
    s.org_id,
    c.name as contact_name,
    s.sale_number as doc_number,
    s.due_date,
    s.grand_total,
    COALESCE(p.total_paid, 0) as paid_amount,
    (s.grand_total - COALESCE(p.total_paid, 0)) as outstanding,
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
WHERE s.status NOT IN ('DRAFT', 'VOIDED')
AND (s.grand_total - COALESCE(p.total_paid, 0)) > 0.01;

-- 2. AP Aging View
CREATE OR REPLACE VIEW v_ap_aging_report AS
WITH paid_agg AS (
    SELECT purchase_id, SUM(amount) as total_paid 
    FROM purchase_payments 
    GROUP BY purchase_id
)
SELECT 
    pur.org_id,
    c.name as contact_name,
    pur.purchase_number as doc_number,
    pur.due_date,
    pur.grand_total,
    COALESCE(p.total_paid, 0) as paid_amount,
    (pur.grand_total - COALESCE(p.total_paid, 0)) as outstanding,
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
WHERE pur.status NOT IN ('DRAFT', 'VOIDED')
AND (pur.grand_total - COALESCE(p.total_paid, 0)) > 0.01;
