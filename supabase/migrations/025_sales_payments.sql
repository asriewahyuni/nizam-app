-- ============================================================
-- MIGRATION 025: Sales Payments (Partial & Full)
-- Handles the recording of cash/bank receipts against invoices
-- ============================================================

-- 1. Table: sales_payments
CREATE TABLE IF NOT EXISTS public.sales_payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    sale_id         UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    account_id      UUID NOT NULL REFERENCES accounts(id), -- The Kas/Bank receiving the money
    payment_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    amount          DECIMAL(20, 2) NOT NULL CHECK (amount > 0),
    discount_amount DECIMAL(20, 2) NOT NULL DEFAULT 0, -- Settlement discount
    payment_number  TEXT NOT NULL, -- PYM-2024-000001
    notes           TEXT,
    created_by      UUID REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sales_payments_sale ON public.sales_payments(sale_id);
CREATE INDEX idx_sales_payments_org ON public.sales_payments(org_id);

-- 2. Atomic Function to process payment
CREATE OR REPLACE FUNCTION public.process_sales_payment_atomic(
    p_org_id UUID,
    p_sale_id UUID,
    p_account_id UUID,
    p_amount DECIMAL,
    p_discount DECIMAL,
    p_payment_date TIMESTAMPTZ,
    p_notes TEXT,
    p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_payment_id UUID;
    v_payment_number TEXT;
    v_je_id UUID;
    v_total_invoice DECIMAL;
    v_total_returned DECIMAL;
    v_total_paid DECIMAL;
    v_remaining_ar DECIMAL;
    v_count INT;
    acc_piutang UUID;
    acc_diskon UUID;
BEGIN
    -- 1. Get AR Account (1201) and Discount Account (4002)
    SELECT id INTO acc_piutang FROM public.accounts WHERE code = '1201' AND org_id = p_org_id;
    SELECT id INTO acc_diskon FROM public.accounts WHERE code = '4002' AND org_id = p_org_id;

    IF acc_piutang IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Akun Piutang (1201) tidak ditemukan.');
    END IF;

    -- 2. Calculate remaining balance
    -- Total Invoice
    SELECT grand_total INTO v_total_invoice FROM public.sales WHERE id = p_sale_id;
    -- Total Returns
    SELECT COALESCE(SUM(grand_total), 0) INTO v_total_returned FROM public.sales_returns WHERE sale_id = p_sale_id;
    -- Total Payments existing (Amount + Discount)
    SELECT COALESCE(SUM(amount + discount_amount), 0) INTO v_total_paid FROM public.sales_payments WHERE sale_id = p_sale_id;
    
    v_remaining_ar := v_total_invoice - v_total_returned - v_total_paid;

    -- Validation
    IF (p_amount + p_discount) > (v_remaining_ar + 0.01) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Jumlah bayar + diskon melebih sisa piutang: ' || v_remaining_ar);
    END IF;

    -- 3. Generate Payment Number
    SELECT COUNT(*) + 1 INTO v_count FROM public.sales_payments WHERE org_id = p_org_id AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
    v_payment_number := 'PAY-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(v_count::TEXT, 6, '0');

    -- 4. Insert Payment
    INSERT INTO public.sales_payments (org_id, sale_id, account_id, amount, discount_amount, payment_date, payment_number, notes, created_by)
    VALUES (p_org_id, p_sale_id, p_account_id, p_amount, p_discount, p_payment_date, v_payment_number, p_notes, p_user_id)
    RETURNING id INTO v_payment_id;

    -- 5. Journal Entry
    -- Debit: Kas/Bank (p_amount)
    -- Debit: Diskon Penjualan (p_discount)
    -- Credit: Piutang (p_amount + p_discount)
    INSERT INTO public.journal_entries (org_id, entry_date, description, reference_type, reference_id, status, is_auto)
    VALUES (p_org_id, p_payment_date, 'Pembayaran Invoice ' || v_payment_number, 'PAYMENT_IN', v_payment_id, 'POSTED', TRUE)
    RETURNING id INTO v_je_id;

    -- Cash line
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, p_account_id, p_amount, 0);
    
    -- Discount line (only if > 0)
    IF p_discount > 0 THEN
        IF acc_diskon IS NULL THEN
             -- Fallback or error? Let's check if we have 4002
             RETURN jsonb_build_object('success', FALSE, 'error', 'Akun Diskon Penjualan (4002) tidak ditemukan.');
        END IF;
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, acc_diskon, p_discount, 0);
    END IF;

    -- Credit Piutang (Total amount + discount)
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, acc_piutang, 0, p_amount + p_discount);

    -- 6. Update Sales Payment Status
    IF (v_total_paid + p_amount + p_discount) >= (v_total_invoice - v_total_returned - 0.01) THEN
        UPDATE public.sales SET payment_status = 'PAID' WHERE id = p_sale_id;
    ELSE
        UPDATE public.sales SET payment_status = 'PARTIAL' WHERE id = p_sale_id;
    END IF;

    RETURN jsonb_build_object('success', TRUE, 'payment_id', v_payment_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;

-- RLS
ALTER TABLE public.sales_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "members_can_view_payments" ON public.sales_payments;
CREATE POLICY "members_can_view_payments" ON public.sales_payments FOR SELECT 
USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE));
