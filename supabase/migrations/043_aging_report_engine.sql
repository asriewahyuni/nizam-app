-- ==========================================
-- MIGRATION 043: Aging Accounts (Receivable & Payable)
-- Focus: Liquidity Management & Cash Flow Visibility
-- ==========================================

-- 1. Table: purchase_payments (Essential for A/P Aging)
CREATE TABLE IF NOT EXISTS public.purchase_payments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    purchase_id     UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    account_id      UUID NOT NULL REFERENCES accounts(id), -- Kas/Bank used for payment
    payment_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    amount          DECIMAL(20, 2) NOT NULL CHECK (amount > 0),
    payment_number  TEXT NOT NULL,
    notes           TEXT,
    created_by      UUID REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for purchase_payments
ALTER TABLE public.purchase_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_can_view_purchase_payments" ON public.purchase_payments FOR SELECT 
USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE));

-- 2. Function: Get Aging Report (Receivable)
CREATE OR REPLACE FUNCTION get_ar_aging_report(p_org_id UUID)
RETURNS TABLE (
    contact_name TEXT,
    doc_number TEXT,
    due_date DATE,
    grand_total DECIMAL(19,4),
    paid_amount DECIMAL(19,4),
    outstanding DECIMAL(19,4),
    days_overdue INT,
    aging_bucket TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.name,
        s.sale_number,
        s.due_date,
        s.grand_total::DECIMAL(19,4),
        COALESCE(p.total_paid, 0)::DECIMAL(19,4) as paid_amount,
        (s.grand_total - COALESCE(p.total_paid, 0))::DECIMAL(19,4) as outstanding,
        GREATEST(0, (CURRENT_DATE - s.due_date))::INT as days_overdue,
        CASE 
            WHEN (s.due_date >= CURRENT_DATE) THEN 'Current'
            WHEN (CURRENT_DATE - s.due_date) <= 30 THEN '0-30 Days'
            WHEN (CURRENT_DATE - s.due_date) <= 60 THEN '31-60 Days'
            WHEN (CURRENT_DATE - s.due_date) <= 90 THEN '61-90 Days'
            ELSE '> 90 Days'
        END as aging_bucket
    FROM sales s
    JOIN contacts c ON s.customer_id = c.id
    LEFT JOIN (
        SELECT sale_id, SUM(amount) as total_paid 
        FROM sales_payments 
        GROUP BY sale_id
    ) p ON p.sale_id = s.id
    WHERE s.org_id = p_org_id
    AND s.status NOT IN ('DRAFT', 'VOIDED')
    AND (s.grand_total - COALESCE(p.total_paid, 0)) > 0.01
    ORDER BY days_overdue DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Function: Get Aging Report (Payable)
CREATE OR REPLACE FUNCTION get_ap_aging_report(p_org_id UUID)
RETURNS TABLE (
    contact_name TEXT,
    doc_number TEXT,
    due_date DATE,
    grand_total DECIMAL(19,4),
    paid_amount DECIMAL(19,4),
    outstanding DECIMAL(19,4),
    days_overdue INT,
    aging_bucket TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.name,
        pur.purchase_number,
        pur.due_date,
        pur.grand_total::DECIMAL(19,4),
        COALESCE(pay.total_paid, 0)::DECIMAL(19,4) as paid_amount,
        (pur.grand_total - COALESCE(pay.total_paid, 0))::DECIMAL(19,4) as outstanding,
        GREATEST(0, (CURRENT_DATE - pur.due_date))::INT as days_overdue,
        CASE 
            WHEN (pur.due_date >= CURRENT_DATE) THEN 'Current'
            WHEN (CURRENT_DATE - pur.due_date) <= 30 THEN '0-30 Days'
            WHEN (CURRENT_DATE - pur.due_date) <= 60 THEN '31-60 Days'
            WHEN (CURRENT_DATE - pur.due_date) <= 90 THEN '61-90 Days'
            ELSE '> 90 Days'
        END as aging_bucket
    FROM purchases pur
    JOIN contacts c ON pur.vendor_id = c.id
    LEFT JOIN (
        SELECT purchase_id, SUM(amount) as total_paid 
        FROM purchase_payments 
        GROUP BY purchase_id
    ) pay ON pay.purchase_id = pur.id
    WHERE pur.org_id = p_org_id
    AND pur.status NOT IN ('DRAFT', 'VOIDED')
    AND (pur.grand_total - COALESCE(pay.total_paid, 0)) > 0.01
    ORDER BY days_overdue DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
