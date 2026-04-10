-- ============================================================
-- MIGRATION 1174: Enable POS Cashier-Only Permission Path
-- ============================================================
-- Why:
-- Role kasir idealnya cukup dengan permission `pos:write` tanpa harus
-- membawa akses penuh `sales:write`.
--
-- Saat ini sebagian flow POS masih mengandalkan permission sales:
-- 1) RLS `sales_items` (insert line item) masih mengharuskan sales:write.
-- 2) RPC `process_sales_delivery_atomic` (finalisasi + stock movement + jurnal)
--    masih memblokir user tanpa sales:write.
--
-- This migration:
-- 1) Mengizinkan RLS `sales_items` untuk `pos:read/pos:write` juga.
-- 2) Mengizinkan delivery RPC untuk `pos:write` OR `sales:write`.
-- 3) Menjaga backward compatibility untuk role legacy operasional.

DROP POLICY IF EXISTS "Org members can view sales items" ON public.sales_items;
DROP POLICY IF EXISTS "Org members can manage sales items" ON public.sales_items;

CREATE POLICY "Org members can view sales items"
ON public.sales_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.sales s
    WHERE s.id = sales_items.sale_id
      AND s.org_id = sales_items.org_id
      AND public.can_access_branch_or_default(
        s.org_id,
        COALESCE(sales_items.branch_id, s.branch_id)
      )
      AND (
        public.nizam_has_permission('sales:read', s.org_id)
        OR public.nizam_has_permission('sales:write', s.org_id)
        OR public.nizam_has_permission('pos:read', s.org_id)
        OR public.nizam_has_permission('pos:write', s.org_id)
        OR EXISTS (
          SELECT 1
          FROM public.org_members om
          WHERE om.user_id = auth.uid()
            AND om.org_id = s.org_id
            AND om.is_active = TRUE
            AND om.role IN ('owner', 'admin', 'manager', 'staff')
        )
      )
  )
);

CREATE POLICY "Org members can manage sales items"
ON public.sales_items
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.sales s
    WHERE s.id = sales_items.sale_id
      AND s.org_id = sales_items.org_id
      AND public.can_access_branch_or_default(
        s.org_id,
        COALESCE(sales_items.branch_id, s.branch_id)
      )
      AND (
        public.nizam_has_permission('sales:write', s.org_id)
        OR public.nizam_has_permission('pos:write', s.org_id)
        OR EXISTS (
          SELECT 1
          FROM public.org_members om
          WHERE om.user_id = auth.uid()
            AND om.org_id = s.org_id
            AND om.is_active = TRUE
            AND om.role IN ('owner', 'admin', 'manager', 'staff')
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sales s
    WHERE s.id = sales_items.sale_id
      AND s.org_id = sales_items.org_id
      AND public.can_access_branch_or_default(
        s.org_id,
        COALESCE(sales_items.branch_id, s.branch_id)
      )
      AND (
        public.nizam_has_permission('sales:write', s.org_id)
        OR public.nizam_has_permission('pos:write', s.org_id)
        OR EXISTS (
          SELECT 1
          FROM public.org_members om
          WHERE om.user_id = auth.uid()
            AND om.org_id = s.org_id
            AND om.is_active = TRUE
            AND om.role IN ('owner', 'admin', 'manager', 'staff')
        )
      )
  )
);

CREATE OR REPLACE FUNCTION public.process_sales_delivery_atomic(
    p_org_id UUID,
    p_sale_id UUID,
    p_warehouse_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sale RECORD;
    v_item RECORD;
    v_hpp NUMERIC;
    v_total_hpp NUMERIC := 0;
    v_entry_id UUID;
    v_revenue NUMERIC;
    v_acc_ar UUID;
    v_acc_hutang_salam UUID;
    v_acc_hutang_istishna UUID;
    v_acc_debit_target UUID;
    v_acc_revenue UUID;
    v_acc_tax UUID;
    v_acc_cogs UUID;
    v_requires_inventory_sync BOOLEAN;
    v_resolved_warehouse_id UUID;
    v_warehouse_branch_id UUID;
    v_warehouse_is_active BOOLEAN;
    v_item_inventory_account UUID;
    v_inventory_credit_by_account JSONB := '{}'::JSONB;
    v_credit_line RECORD;
    v_is_salam BOOLEAN := FALSE;
    v_is_istishna BOOLEAN := FALSE;
    v_total_paid_istishna NUMERIC := 0;
    v_istishna_debit NUMERIC := 0;
    v_ar_debit NUMERIC := 0;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required'
          USING ERRCODE = '42501';
    END IF;

    IF NOT (
      public.nizam_has_permission('sales:write', p_org_id)
      OR public.nizam_has_permission('pos:write', p_org_id)
    ) THEN
        RAISE EXCEPTION 'Insufficient permission (sales:write or pos:write) to deliver sales for organization %', p_org_id
          USING ERRCODE = '42501';
    END IF;

    SELECT *
    INTO v_sale
    FROM public.sales
    WHERE id = p_sale_id
      AND org_id = p_org_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sale order not found';
    END IF;

    v_is_salam := UPPER(COALESCE(v_sale.shariah_mode::TEXT, 'CASH')) = 'SALAM';
    v_is_istishna := UPPER(COALESCE(v_sale.shariah_mode::TEXT, 'CASH')) = 'ISTISHNA';

    IF v_sale.branch_id IS NOT NULL
       AND NOT public.can_access_branch(p_org_id, v_sale.branch_id) THEN
        RAISE EXCEPTION 'Branch % is not accessible for current user', v_sale.branch_id
          USING ERRCODE = '42501';
    END IF;

    IF v_sale.status = 'FINISHED' THEN
        RETURN;
    END IF;

    IF v_sale.status = 'VOIDED' THEN
        RAISE EXCEPTION 'Sale order has been voided';
    END IF;

    IF v_is_salam AND COALESCE(v_sale.payment_status::TEXT, 'UNPAID') <> 'PAID' THEN
      RAISE EXCEPTION 'Akad SALAM wajib lunas terlebih dahulu sebelum pengiriman barang.';
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.sales_items si
      JOIN public.products p ON p.id = si.product_id
      WHERE si.sale_id = p_sale_id
        AND COALESCE(p.type, 'INVENTORY') = 'INVENTORY'
    )
    INTO v_requires_inventory_sync;

    IF v_requires_inventory_sync THEN
        v_resolved_warehouse_id := COALESCE(
          p_warehouse_id,
          v_sale.warehouse_id,
          public.resolve_single_active_warehouse(p_org_id, v_sale.branch_id)
        );

        IF v_resolved_warehouse_id IS NULL THEN
            RAISE EXCEPTION 'Pilih gudang pengiriman terlebih dahulu untuk mengurangi stok fisik.'
              USING ERRCODE = 'P0001';
        END IF;

        SELECT branch_id, is_active
        INTO v_warehouse_branch_id, v_warehouse_is_active
        FROM public.warehouses
        WHERE id = v_resolved_warehouse_id
          AND org_id = p_org_id;

        IF NOT FOUND OR v_warehouse_is_active IS DISTINCT FROM TRUE THEN
            RAISE EXCEPTION 'Gudang pengiriman tidak ditemukan atau tidak aktif.';
        END IF;

        IF v_sale.branch_id IS NOT NULL
           AND v_warehouse_branch_id IS DISTINCT FROM v_sale.branch_id THEN
            RAISE EXCEPTION 'Gudang pengiriman tidak berada pada unit yang sama dengan sales order.';
        END IF;
    END IF;

    SELECT id INTO v_acc_ar
    FROM public.accounts
    WHERE org_id = p_org_id AND code = '1201'
    LIMIT 1;

    SELECT id INTO v_acc_revenue
    FROM public.accounts
    WHERE org_id = p_org_id AND code = '4001'
    LIMIT 1;

    SELECT id INTO v_acc_tax
    FROM public.accounts
    WHERE org_id = p_org_id AND code = '2201'
    LIMIT 1;

    SELECT id INTO v_acc_cogs
    FROM public.accounts
    WHERE org_id = p_org_id AND code = '5001'
    LIMIT 1;

    IF v_is_salam THEN
      v_acc_hutang_salam := public.ensure_salam_liability_account(p_org_id);
      v_acc_debit_target := v_acc_hutang_salam;
    ELSIF v_is_istishna THEN
      v_acc_hutang_istishna := public.ensure_istishna_liability_account(p_org_id);
      
      SELECT COALESCE(SUM(amount + discount_amount), 0) 
      INTO v_total_paid_istishna 
      FROM public.sales_payments 
      WHERE sale_id = p_sale_id;

      v_istishna_debit := LEAST(v_total_paid_istishna, v_sale.grand_total);
      v_ar_debit := GREATEST(v_sale.grand_total - v_istishna_debit, 0);
    ELSE
      v_acc_debit_target := v_acc_ar;
    END IF;

    IF v_is_salam AND v_acc_hutang_salam IS NULL THEN
        RAISE EXCEPTION 'Akun pembukuan penjualan belum lengkap (Hutang Salam tidak ada).';
    END IF;
    IF v_is_istishna AND v_acc_hutang_istishna IS NULL THEN
        RAISE EXCEPTION 'Akun pembukuan penjualan belum lengkap (Hutang Istishna tidak ada).';
    END IF;
    IF NOT v_is_salam AND NOT v_is_istishna AND v_acc_debit_target IS NULL THEN
        RAISE EXCEPTION 'Akun pembukuan penjualan belum lengkap (Piutang 1201 tidak ada).';
    END IF;
    IF v_acc_revenue IS NULL OR v_acc_tax IS NULL OR v_acc_cogs IS NULL THEN
        RAISE EXCEPTION 'Akun pembukuan penjualan belum lengkap (4001, 2201, 5001).';
    END IF;

    FOR v_item IN
        SELECT
          si.*,
          p.type AS product_type,
          p.asset_account_id AS asset_account_id
        FROM public.sales_items si
        LEFT JOIN public.products p ON p.id = si.product_id
        WHERE si.sale_id = p_sale_id
    LOOP
        IF v_item.product_id IS NULL OR COALESCE(v_item.product_type, 'INVENTORY') <> 'INVENTORY' THEN
            CONTINUE;
        END IF;

        SELECT COALESCE(average_cost, 0)
        INTO v_hpp
        FROM public.products
        WHERE id = v_item.product_id;

        v_total_hpp := v_total_hpp + (v_hpp * v_item.quantity);

        v_item_inventory_account := COALESCE(
          v_item.asset_account_id,
          public.resolve_inventory_asset_account(p_org_id, v_item.product_id, '1301')
        );

        IF v_item_inventory_account IS NULL THEN
          RAISE EXCEPTION 'Akun persediaan produk % belum diatur.', v_item.product_id;
        END IF;

        v_inventory_credit_by_account := jsonb_set(
          v_inventory_credit_by_account,
          ARRAY[v_item_inventory_account::TEXT],
          to_jsonb(COALESCE((v_inventory_credit_by_account ->> v_item_inventory_account::TEXT)::NUMERIC, 0) + (v_hpp * v_item.quantity)),
          TRUE
        );

        INSERT INTO public.stock_movements (
          org_id,
          product_id,
          quantity,
          unit_price,
          reference_type,
          reference_id,
          notes,
          branch_id
        )
        VALUES (
          p_org_id,
          v_item.product_id,
          -(v_item.quantity),
          v_hpp,
          'SALE',
          p_sale_id,
          'Pengiriman SO ' || v_sale.sale_number,
          COALESCE(v_item.branch_id, v_sale.branch_id)
        );

        PERFORM public.adjust_inventory_stock(
          p_org_id,
          v_item.product_id,
          v_resolved_warehouse_id,
          -(v_item.quantity),
          NULL,
          NULL
        );
    END LOOP;

    UPDATE public.sales
    SET status = 'FINISHED',
        warehouse_id = COALESCE(v_resolved_warehouse_id, warehouse_id),
        updated_at = NOW()
    WHERE id = p_sale_id;

    INSERT INTO public.journal_entries (
      org_id,
      branch_id,
      entry_date,
      description,
      reference_id,
      reference_type,
      status,
      is_auto
    )
    VALUES (
      p_org_id,
      v_sale.branch_id,
      CURRENT_DATE,
      CASE 
        WHEN v_is_salam THEN 'Pengakuan Pendapatan & PPN atas Delivery SALAM SO ' || v_sale.sale_number
        WHEN v_is_istishna THEN 'Pengakuan Pendapatan & PPN atas Delivery ISTISHNA SO ' || v_sale.sale_number
        ELSE 'Pengakuan Laba, Piutang, & PPN atas Penjualan SO ' || v_sale.sale_number
      END,
      p_sale_id,
      'SALE',
      'POSTED',
      TRUE
    )
    RETURNING id INTO v_entry_id;

    IF v_is_istishna THEN
        IF v_istishna_debit > 0 THEN
            INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
            VALUES (v_entry_id, v_acc_hutang_istishna, v_istishna_debit, 0);
        END IF;
        IF v_ar_debit > 0 THEN
            INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
            VALUES (v_entry_id, v_acc_ar, v_ar_debit, 0);
        END IF;
    ELSE
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
        VALUES (v_entry_id, v_acc_debit_target, v_sale.grand_total, 0);
    END IF;

    IF v_sale.tax_amount > 0 THEN
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
        VALUES (v_entry_id, v_acc_tax, 0, v_sale.tax_amount);
    END IF;

    v_revenue := v_sale.total_amount - v_sale.discount_amount;
    IF v_revenue > 0 THEN
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
        VALUES (v_entry_id, v_acc_revenue, 0, v_revenue);
    END IF;

    IF v_total_hpp > 0 THEN
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
        VALUES (v_entry_id, v_acc_cogs, v_total_hpp, 0);

        FOR v_credit_line IN
          SELECT key, value
          FROM jsonb_each_text(v_inventory_credit_by_account)
        LOOP
          INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
          VALUES (v_entry_id, v_credit_line.key::UUID, 0, v_credit_line.value::NUMERIC);
        END LOOP;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_sales_delivery_atomic(UUID, UUID, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
