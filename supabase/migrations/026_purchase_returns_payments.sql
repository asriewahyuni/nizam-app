-- ============================================================
-- MIGRATION 026: Purchase Returns and Purchase Payments
-- ============================================================

-- 1. Extend Enums
ALTER TYPE journal_reference_type ADD VALUE IF NOT EXISTS 'PURCHASE_RETURN';
ALTER TYPE journal_reference_type ADD VALUE IF NOT EXISTS 'PURCHASE_PAYMENT';

-- 2. Add Purchase Discount Account if missing
DO $$
DECLARE
    v_org RECORD;
    v_cogs_parent UUID;
BEGIN
    FOR v_org IN SELECT id FROM public.organizations LOOP
        -- Check if Potongan Pembelian exists
        IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE code = '5004' AND org_id = v_org.id) THEN
            SELECT id INTO v_cogs_parent FROM public.accounts WHERE code = '5000' AND org_id = v_org.id;
            IF v_cogs_parent IS NOT NULL THEN
                INSERT INTO public.accounts (org_id, code, name, type, normal_balance, parent_id, is_system)
                VALUES (v_org.id, '5004', 'Potongan Pembelian (Discount)', 'EXPENSE', 'CREDIT', v_cogs_parent, TRUE);
            END IF;
        END IF;
    END LOOP;
END;
$$;

-- 3. Table: purchase_returns
CREATE TABLE IF NOT EXISTS public.purchase_returns (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    purchase_id         UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
    return_number       TEXT NOT NULL,
    return_date         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes               TEXT,
    total_amount        DECIMAL(20, 2) NOT NULL DEFAULT 0,
    tax_amount          DECIMAL(20, 2) NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          UUID REFERENCES auth.users(id),
    UNIQUE(org_id, return_number)
);

-- 4. Table: purchase_return_items
CREATE TABLE IF NOT EXISTS public.purchase_return_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id           UUID NOT NULL REFERENCES public.purchase_returns(id) ON DELETE CASCADE,
    purchase_item_id    UUID NOT NULL REFERENCES public.purchase_items(id) ON DELETE CASCADE,
    product_id          UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity            DECIMAL(20, 2) NOT NULL,
    unit_price          DECIMAL(20, 2) NOT NULL,
    total_price         DECIMAL(20, 2) NOT NULL
);

-- 5. Table: purchase_payments
CREATE TABLE IF NOT EXISTS public.purchase_payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    purchase_id     UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    account_id      UUID NOT NULL REFERENCES accounts(id), -- Kas/Bank
    payment_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    amount          DECIMAL(20, 2) NOT NULL CHECK (amount > 0),
    discount_amount DECIMAL(20, 2) NOT NULL DEFAULT 0,
    payment_number  TEXT NOT NULL,
    notes           TEXT,
    created_by      UUID REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(org_id, payment_number)
);

-- 6. Atomic Function: process_purchase_payment_atomic
CREATE OR REPLACE FUNCTION public.process_purchase_payment_atomic(
    p_org_id UUID,
    p_purchase_id UUID,
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
    v_remaining_ap DECIMAL;
    v_count INT;
    acc_hutang UUID;
    acc_potongan UUID;
BEGIN
    -- 1. Get AP Account (2101) and Purchase Discount Account (5004)
    SELECT id INTO acc_hutang FROM public.accounts WHERE code = '2101' AND org_id = p_org_id;
    SELECT id INTO acc_potongan FROM public.accounts WHERE code = '5004' AND org_id = p_org_id;

    IF acc_hutang IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Akun Hutang Usaha (2101) tidak ditemukan.');
    END IF;

    -- 2. Calculate remaining balance
    SELECT grand_total INTO v_total_invoice FROM public.purchases WHERE id = p_purchase_id;
    SELECT COALESCE(SUM(total_amount), 0) INTO v_total_returned FROM public.purchase_returns WHERE purchase_id = p_purchase_id;
    SELECT COALESCE(SUM(amount + discount_amount), 0) INTO v_total_paid FROM public.purchase_payments WHERE purchase_id = p_purchase_id;
    
    v_remaining_ap := v_total_invoice - v_total_returned - v_total_paid;

    IF (p_amount + p_discount) > (v_remaining_ap + 0.01) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Jumlah bayar + diskon melebih sisa hutang: ' || v_remaining_ap);
    END IF;

    -- 3. Generate Payment Number
    SELECT COUNT(*) + 1 INTO v_count FROM public.purchase_payments WHERE org_id = p_org_id AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
    v_payment_number := 'PPAY-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(v_count::TEXT, 6, '0');

    -- 4. Insert Payment
    INSERT INTO public.purchase_payments (org_id, purchase_id, account_id, amount, discount_amount, payment_date, payment_number, notes, created_by)
    VALUES (p_org_id, p_purchase_id, p_account_id, p_amount, p_discount, p_payment_date, v_payment_number, p_notes, p_user_id)
    RETURNING id INTO v_payment_id;

    -- 5. Journal Entry
    -- Debit: Hutang Usaha (p_amount + p_discount)
    -- Credit: Kas/Bank (p_amount)
    -- Credit: Potongan Pembelian (p_discount)
    INSERT INTO public.journal_entries (org_id, entry_date, description, reference_type, reference_id, status, is_auto)
    VALUES (p_org_id, p_payment_date, 'Pembayaran Pembelian ' || v_payment_number, 'PURCHASE_PAYMENT', v_payment_id, 'POSTED', TRUE)
    RETURNING id INTO v_je_id;

    -- Debit Hutang
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, acc_hutang, p_amount + p_discount, 0);
    
    -- Credit Cash
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, p_account_id, 0, p_amount);
    
    -- Credit Discount
    IF p_discount > 0 THEN
        IF acc_potongan IS NULL THEN
            RETURN jsonb_build_object('success', FALSE, 'error', 'Akun Potongan Pembelian (5004) tidak ditemukan.');
        END IF;
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, acc_potongan, 0, p_discount);
    END IF;

    -- 6. Update Purchase Status
    IF (v_total_paid + p_amount + p_discount) >= (v_total_invoice - v_total_returned - 0.01) THEN
        UPDATE public.purchases SET payment_status = 'PAID' WHERE id = p_purchase_id;
    ELSE
        UPDATE public.purchases SET payment_status = 'PARTIAL' WHERE id = p_purchase_id;
    END IF;

    RETURN jsonb_build_object('success', TRUE, 'payment_id', v_payment_id);
END;
$$;

-- 7. Atomic Function: process_purchase_return_atomic
CREATE OR REPLACE FUNCTION public.process_purchase_return_atomic(
    p_org_id UUID,
    p_purchase_id UUID,
    p_return_number TEXT,
    p_return_date TIMESTAMPTZ,
    p_notes TEXT,
    p_items JSONB, -- Array of {product_id, quantity, unit_price, purchase_item_id}
    p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_return_id UUID;
    v_item RECORD;
    v_total_net DECIMAL := 0;
    v_total_tax DECIMAL := 0;
    v_total_return DECIMAL := 0;
    v_je_id UUID;
    acc_hutang UUID;
    acc_persediaan UUID;
    acc_ppn_masukan UUID;
    v_avg_cost DECIMAL;
BEGIN
    -- 1. Get Accounts
    SELECT id INTO acc_hutang FROM public.accounts WHERE code = '2101' AND org_id = p_org_id;
    SELECT id INTO acc_persediaan FROM public.accounts WHERE code = '1301' AND org_id = p_org_id;
    SELECT id INTO acc_ppn_masukan FROM public.accounts WHERE code = '1401' AND org_id = p_org_id;

    -- 2. Insert Header
    INSERT INTO public.purchase_returns (org_id, purchase_id, return_number, return_date, notes, created_by)
    VALUES (p_org_id, p_purchase_id, p_return_number, p_return_date, p_notes, p_user_id)
    RETURNING id INTO v_return_id;

    -- 3. Process Items
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity DECIMAL, unit_price DECIMAL, purchase_item_id UUID)
    LOOP
        INSERT INTO public.purchase_return_items (return_id, purchase_item_id, product_id, quantity, unit_price, total_price)
        VALUES (v_return_id, v_item.purchase_item_id, v_item.product_id, v_item.quantity, v_item.unit_price, v_item.quantity * v_item.unit_price);

        -- Update Stock (Keluar)
        INSERT INTO public.stock_movements (org_id, product_id, quantity, unit_price, reference_type, reference_id, notes)
        VALUES (p_org_id, v_item.product_id, -v_item.quantity, v_item.unit_price, 'PURCHASE_RETURN', v_return_id, 'Retur Pembelian ' || p_return_number);

        -- Update average cost if needed? Usually returns use the purchase price.
        
        v_total_net := v_total_net + (v_item.quantity * v_item.unit_price);
    END LOOP;

    -- 4. Calculate Tax (Assuming 11%)
    v_total_tax := v_total_net * 0.11;
    v_total_return := v_total_net + v_total_tax;

    UPDATE public.purchase_returns SET total_amount = v_total_return, tax_amount = v_total_tax WHERE id = v_return_id;

    -- 5. Journal Entry
    -- Debit: Hutang Usaha (v_total_return)
    -- Credit: Persediaan (v_total_net)
    -- Credit: PPN Masukan (v_total_tax)
    INSERT INTO public.journal_entries (org_id, entry_date, description, reference_type, reference_id, status, is_auto)
    VALUES (p_org_id, p_return_date, 'Retur Pembelian ' || p_return_number, 'PURCHASE_RETURN', v_return_id, 'POSTED', TRUE)
    RETURNING id INTO v_je_id;

    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, acc_hutang, v_total_return, 0);
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, acc_persediaan, 0, v_total_net);
    IF v_total_tax > 0 AND acc_ppn_masukan IS NOT NULL THEN
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, acc_ppn_masukan, 0, v_total_tax);
    END IF;

    RETURN jsonb_build_object('success', TRUE, 'return_id', v_return_id);
END;
$$;

-- RLS
ALTER TABLE public.purchase_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_return_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_can_view_purchase_payments" ON public.purchase_payments FOR SELECT 
USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE));

CREATE POLICY "members_can_view_purchase_returns" ON public.purchase_returns FOR SELECT 
USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE));
