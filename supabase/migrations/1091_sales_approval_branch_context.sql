-- ============================================================
-- MIGRATION 1091: Sales & Approval Branch Context
-- Make sales documents and approval queue aware of active branch/unit.
-- ============================================================

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

ALTER TABLE public.sales_items
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

ALTER TABLE public.sales_returns
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

ALTER TABLE public.sales_payments
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

ALTER TABLE public.approval_requests
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_org_branch_date
  ON public.sales(org_id, branch_id, sale_date DESC);

CREATE INDEX IF NOT EXISTS idx_sales_items_branch_id
  ON public.sales_items(branch_id) WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_returns_org_branch_date
  ON public.sales_returns(org_id, branch_id, return_date DESC);

CREATE INDEX IF NOT EXISTS idx_sales_payments_org_branch_date
  ON public.sales_payments(org_id, branch_id, payment_date DESC);

CREATE INDEX IF NOT EXISTS idx_approval_requests_org_branch_status
  ON public.approval_requests(org_id, branch_id, status, requested_at DESC);

UPDATE public.sales s
SET branch_id = public.resolve_single_active_branch(s.org_id)
WHERE s.branch_id IS NULL;

UPDATE public.sales_items si
SET branch_id = s.branch_id
FROM public.sales s
WHERE si.sale_id = s.id
  AND si.branch_id IS NULL
  AND s.branch_id IS NOT NULL;

UPDATE public.sales_returns sr
SET branch_id = s.branch_id
FROM public.sales s
WHERE sr.sale_id = s.id
  AND sr.branch_id IS NULL
  AND s.branch_id IS NOT NULL;

UPDATE public.sales_payments sp
SET branch_id = s.branch_id
FROM public.sales s
WHERE sp.sale_id = s.id
  AND sp.branch_id IS NULL
  AND s.branch_id IS NOT NULL;

UPDATE public.approval_requests ar
SET branch_id = p.branch_id
FROM public.purchases p
WHERE ar.source_type = 'PURCHASE_ORDER'
  AND ar.source_id = p.id
  AND ar.branch_id IS NULL
  AND p.branch_id IS NOT NULL;

UPDATE public.approval_requests ar
SET branch_id = s.branch_id
FROM public.sales s
WHERE ar.source_type = 'SALES_ORDER'
  AND ar.source_id = s.id
  AND ar.branch_id IS NULL
  AND s.branch_id IS NOT NULL;

UPDATE public.approval_requests ar
SET branch_id = public.resolve_single_active_branch(ar.org_id)
WHERE ar.branch_id IS NULL;

UPDATE public.journal_entries je
SET branch_id = s.branch_id
FROM public.sales s
WHERE je.reference_type = 'SALE'
  AND je.reference_id = s.id
  AND je.branch_id IS NULL
  AND s.branch_id IS NOT NULL;

UPDATE public.journal_entries je
SET branch_id = sr.branch_id
FROM public.sales_returns sr
WHERE je.reference_type = 'SALES_RETURN'
  AND je.reference_id = sr.id
  AND je.branch_id IS NULL
  AND sr.branch_id IS NOT NULL;

UPDATE public.journal_entries je
SET branch_id = sp.branch_id
FROM public.sales_payments sp
WHERE je.reference_type = 'PAYMENT_IN'
  AND je.reference_id = sp.id
  AND je.branch_id IS NULL
  AND sp.branch_id IS NOT NULL;

UPDATE public.stock_movements sm
SET branch_id = public.resolve_stock_movement_branch_id(
  sm.reference_type,
  sm.reference_id,
  NULL,
  sm.org_id
)
WHERE sm.branch_id IS NULL
  AND sm.reference_type IN ('SALE', 'SALES_RETURN');

CREATE OR REPLACE FUNCTION process_sales_delivery_atomic(
    p_org_id UUID,
    p_sale_id UUID
) RETURNS VOID AS $$
DECLARE
    v_sale RECORD;
    v_item RECORD;
    v_hpp NUMERIC;
    v_total_hpp NUMERIC := 0;
    v_entry_id UUID;
    v_revenue NUMERIC;
    
    v_acc_ar UUID;
    v_acc_revenue UUID;
    v_acc_tax UUID;
    v_acc_cogs UUID;
    v_acc_inventory UUID;
BEGIN
    SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id AND org_id = p_org_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Sale order not found'; END IF;
    IF v_sale.status = 'FINISHED' THEN RETURN; END IF;

    SELECT id INTO v_acc_ar FROM public.accounts WHERE org_id = p_org_id AND code = '1201' LIMIT 1;
    SELECT id INTO v_acc_revenue FROM public.accounts WHERE org_id = p_org_id AND code = '4001' LIMIT 1;
    SELECT id INTO v_acc_tax FROM public.accounts WHERE org_id = p_org_id AND code = '2201' LIMIT 1;
    SELECT id INTO v_acc_cogs FROM public.accounts WHERE org_id = p_org_id AND code = '5001' LIMIT 1;
    SELECT id INTO v_acc_inventory FROM public.accounts WHERE org_id = p_org_id AND code = '1301' LIMIT 1;

    FOR v_item IN SELECT * FROM public.sales_items WHERE sale_id = p_sale_id LOOP
        SELECT average_cost INTO v_hpp FROM public.products WHERE id = v_item.product_id;
        IF v_hpp IS NULL THEN v_hpp := 0; END IF;
        v_total_hpp := v_total_hpp + (v_hpp * v_item.quantity);
        
        INSERT INTO public.stock_movements (
          org_id, product_id, quantity, unit_price, reference_type, reference_id, notes, branch_id
        )
        VALUES (
          p_org_id, v_item.product_id, -(v_item.quantity), v_hpp, 'SALE', p_sale_id,
          'Pengiriman SO ' || v_sale.sale_number, COALESCE(v_item.branch_id, v_sale.branch_id)
        );
    END LOOP;

    UPDATE public.sales SET status = 'FINISHED', updated_at = NOW() WHERE id = p_sale_id;

    INSERT INTO public.journal_entries (
      org_id, branch_id, entry_date, description, reference_id, reference_type, status, is_auto
    )
    VALUES (
      p_org_id, v_sale.branch_id, CURRENT_DATE,
      'Pengakuan Laba, Piutang, & PPN atas Penjualan SO ' || v_sale.sale_number,
      p_sale_id, 'SALE', 'POSTED', TRUE
    )
    RETURNING id INTO v_entry_id;

    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_entry_id, v_acc_ar, v_sale.grand_total, 0);

    IF v_sale.tax_amount > 0 THEN
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_entry_id, v_acc_tax, 0, v_sale.tax_amount);
    END IF;

    v_revenue := v_sale.total_amount - v_sale.discount_amount;
    IF v_revenue > 0 THEN
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_entry_id, v_acc_revenue, 0, v_revenue);
    END IF;

    IF v_total_hpp > 0 THEN
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_entry_id, v_acc_cogs, v_total_hpp, 0);
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_entry_id, v_acc_inventory, 0, v_total_hpp);
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.process_sales_return_atomic(
    p_org_id UUID,
    p_sale_id UUID,
    p_return_number TEXT,
    p_nota_retur TEXT,
    p_items JSONB, 
    p_user_id UUID,
    p_refund_account_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_return_id UUID;
    v_item RECORD;
    v_total_net DECIMAL(15,2) := 0;
    v_total_tax DECIMAL(15,2) := 0;
    v_total_return DECIMAL(15,2) := 0;
    v_hpp_total DECIMAL(15,2) := 0;
    v_avg_cost DECIMAL(15,2);
    v_je_id UUID;
    v_sale_branch_id UUID;
    
    acc_piutang UUID;
    acc_retur_penjualan UUID;
    acc_ppn_keluaran UUID;
    acc_persediaan UUID;
    acc_hpp UUID;
    v_target_credit_account UUID;
BEGIN
    SELECT id INTO acc_piutang FROM public.accounts WHERE code = '1201' AND org_id = p_org_id;
    SELECT id INTO acc_retur_penjualan FROM public.accounts WHERE code = '4003' AND org_id = p_org_id; 
    SELECT id INTO acc_ppn_keluaran FROM public.accounts WHERE code = '2201' AND org_id = p_org_id;
    SELECT id INTO acc_persediaan FROM public.accounts WHERE code = '1301' AND org_id = p_org_id;
    SELECT id INTO acc_hpp FROM public.accounts WHERE code = '5001' AND org_id = p_org_id;
    SELECT branch_id INTO v_sale_branch_id FROM public.sales WHERE id = p_sale_id AND org_id = p_org_id;

    IF acc_piutang IS NULL OR acc_retur_penjualan IS NULL OR acc_ppn_keluaran IS NULL OR acc_persediaan IS NULL OR acc_hpp IS NULL THEN
         RETURN jsonb_build_object('success', FALSE, 'error', 'Akun Pembukuan (1201, 4003, 2201, 1301, 5001) belum lengkap di COA.');
    END IF;

    v_target_credit_account := COALESCE(p_refund_account_id, acc_piutang);

    INSERT INTO public.sales_returns (org_id, branch_id, sale_id, return_number, nota_retur_number, created_by, status)
    VALUES (p_org_id, v_sale_branch_id, p_sale_id, p_return_number, p_nota_retur, p_user_id, 'COMPLETED')
    RETURNING id INTO v_return_id;

    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity DECIMAL, unit_price DECIMAL, sale_item_id UUID)
    LOOP
        INSERT INTO public.sales_return_items (return_id, sale_item_id, product_id, quantity, unit_price, total_price)
        VALUES (v_return_id, v_item.sale_item_id, v_item.product_id, v_item.quantity, v_item.unit_price, v_item.quantity * v_item.unit_price);

        SELECT COALESCE(average_cost, 0) INTO v_avg_cost FROM public.products WHERE id = v_item.product_id;
        v_hpp_total := v_hpp_total + (v_avg_cost * v_item.quantity);

        INSERT INTO public.stock_movements (
          org_id, product_id, quantity, unit_price, reference_type, reference_id, notes, branch_id
        )
        VALUES (
          p_org_id, v_item.product_id, v_item.quantity, v_avg_cost, 'SALES_RETURN', v_return_id,
          'Retur dr ' || p_return_number, v_sale_branch_id
        );

        v_total_net := v_total_net + (v_item.quantity * v_item.unit_price);
    END LOOP;

    v_total_tax := v_total_net * 0.11;
    v_total_return := v_total_net + v_total_tax;

    UPDATE public.sales_returns SET grand_total = v_total_return, tax_amount = v_total_tax, total_amount = v_total_net WHERE id = v_return_id;

    INSERT INTO public.journal_entries (org_id, branch_id, entry_date, description, reference_type, reference_id, status)
    VALUES (p_org_id, v_sale_branch_id, NOW(), 'Retur Penjualan ' || p_return_number, 'SALES_RETURN', v_return_id, 'POSTED')
    RETURNING id INTO v_je_id;

    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, acc_retur_penjualan, v_total_net, 0);
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, acc_ppn_keluaran, v_total_tax, 0);
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, v_target_credit_account, 0, v_total_return);
    
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, acc_persediaan, v_hpp_total, 0);
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, acc_hpp, 0, v_hpp_total);

    RETURN jsonb_build_object('success', TRUE, 'return_id', v_return_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;

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
    v_sale_branch_id UUID;
    acc_piutang UUID;
    acc_diskon UUID;
BEGIN
    SELECT id INTO acc_piutang FROM public.accounts WHERE code = '1201' AND org_id = p_org_id;
    SELECT id INTO acc_diskon FROM public.accounts WHERE code = '4002' AND org_id = p_org_id;
    SELECT branch_id INTO v_sale_branch_id FROM public.sales WHERE id = p_sale_id AND org_id = p_org_id;

    IF acc_piutang IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Akun Piutang (1201) tidak ditemukan.');
    END IF;

    SELECT grand_total INTO v_total_invoice FROM public.sales WHERE id = p_sale_id;
    SELECT COALESCE(SUM(grand_total), 0) INTO v_total_returned FROM public.sales_returns WHERE sale_id = p_sale_id;
    SELECT COALESCE(SUM(amount + discount_amount), 0) INTO v_total_paid FROM public.sales_payments WHERE sale_id = p_sale_id;
    
    v_remaining_ar := v_total_invoice - v_total_returned - v_total_paid;

    IF (p_amount + p_discount) > (v_remaining_ar + 0.01) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Jumlah bayar + diskon melebih sisa piutang: ' || v_remaining_ar);
    END IF;

    SELECT COUNT(*) + 1 INTO v_count FROM public.sales_payments WHERE org_id = p_org_id AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
    v_payment_number := 'PAY-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(v_count::TEXT, 6, '0');

    INSERT INTO public.sales_payments (
      org_id, branch_id, sale_id, account_id, amount, discount_amount, payment_date, payment_number, notes, created_by
    )
    VALUES (
      p_org_id, v_sale_branch_id, p_sale_id, p_account_id, p_amount, p_discount, p_payment_date, v_payment_number, p_notes, p_user_id
    )
    RETURNING id INTO v_payment_id;

    INSERT INTO public.journal_entries (
      org_id, branch_id, entry_date, description, reference_type, reference_id, status, is_auto
    )
    VALUES (
      p_org_id, v_sale_branch_id, p_payment_date, 'Pembayaran Invoice ' || v_payment_number, 'PAYMENT_IN', v_payment_id, 'POSTED', TRUE
    )
    RETURNING id INTO v_je_id;

    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, p_account_id, p_amount, 0);
    
    IF p_discount > 0 THEN
        IF acc_diskon IS NULL THEN
             RETURN jsonb_build_object('success', FALSE, 'error', 'Akun Diskon Penjualan (4002) tidak ditemukan.');
        END IF;
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, acc_diskon, p_discount, 0);
    END IF;

    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, acc_piutang, 0, p_amount + p_discount);

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

CREATE OR REPLACE FUNCTION public.process_purchase_atomic(
  p_org_id       UUID,
  p_vendor_id    UUID,
  p_date         TIMESTAMPTZ,
  p_due_date     DATE,
  p_total        NUMERIC,
  p_tax          NUMERIC,
  p_shipping     NUMERIC,
  p_grand_total  NUMERIC,
  p_notes        TEXT,
  p_lines        JSONB,
  p_user_id      UUID,
  p_branch_id    UUID DEFAULT NULL,
  p_shariah_mode TEXT DEFAULT 'CASH'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_purchase_id UUID;
    v_line        RECORD;
    v_branch_exists BOOLEAN;
BEGIN
    IF p_branch_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1
            FROM public.branches
            WHERE id = p_branch_id
              AND org_id = p_org_id
              AND is_active = TRUE
        ) INTO v_branch_exists;

        IF NOT v_branch_exists THEN
            RAISE EXCEPTION 'Branch % is not part of organization %', p_branch_id, p_org_id;
        END IF;
    END IF;

    INSERT INTO public.purchases (
        org_id, branch_id, vendor_id, purchase_date, due_date,
        total_amount, tax_amount, shipping_amount, grand_total,
        status, created_by, notes, shariah_mode
    ) VALUES (
        p_org_id, p_branch_id, p_vendor_id, p_date, p_due_date,
        p_total, p_tax, p_shipping, p_grand_total,
        'ORDERED', p_user_id, p_notes,
        (CASE p_shariah_mode
            WHEN 'SALAM'    THEN 'SALAM'
            WHEN 'ISTISHNA' THEN 'ISTISHNA'
            ELSE                 'CASH'
         END)::shariah_mode
    ) RETURNING id INTO v_purchase_id;

    FOR v_line IN
        SELECT * FROM jsonb_to_recordset(p_lines) AS x(
            product_id      UUID,
            description     TEXT,
            quantity        NUMERIC,
            unit_price      NUMERIC,
            discount_amount NUMERIC,
            tax_amount      NUMERIC
        )
    LOOP
        INSERT INTO public.purchase_items (
            org_id, purchase_id, product_id, description,
            quantity, unit_price, discount_amount, tax_amount
        ) VALUES (
            p_org_id, v_purchase_id, v_line.product_id, v_line.description,
            v_line.quantity, v_line.unit_price,
            COALESCE(v_line.discount_amount, 0),
            COALESCE(v_line.tax_amount, 0)
        );
    END LOOP;

    INSERT INTO public.approval_requests (
        org_id, branch_id, requester_id, source_type, source_id, status, reason
    ) VALUES (
        p_org_id, p_branch_id, p_user_id, 'PURCHASE_ORDER', v_purchase_id, 'PENDING',
        'Atomic Purchase Order (' || p_shariah_mode || ')'
    );

    RETURN jsonb_build_object('success', TRUE, 'purchase_id', v_purchase_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;

NOTIFY pgrst, 'reload schema';
