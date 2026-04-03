-- ============================================================
-- MIGRATION 1108: Sales Delivery Inventory Sync
-- ============================================================
-- Fix physical stock not decreasing when sales are delivered by:
-- 1. storing source warehouse on sales documents
-- 2. syncing delivery and return flows to inventory_stocks
-- 3. preserving backwards compatibility for existing 2-arg RPC calls
-- ============================================================

ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_org_branch_warehouse_date
  ON public.sales(org_id, branch_id, warehouse_id, sale_date DESC);

CREATE OR REPLACE FUNCTION public.resolve_single_active_warehouse(
  p_org_id UUID,
  p_branch_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN COUNT(*) = 1 THEN MIN(id::text)::UUID
    ELSE NULL
  END
  FROM public.warehouses
  WHERE org_id = p_org_id
    AND is_active = TRUE
    AND (p_branch_id IS NULL OR branch_id = p_branch_id);
$$;

UPDATE public.sales s
SET warehouse_id = public.resolve_single_active_warehouse(s.org_id, s.branch_id)
WHERE s.warehouse_id IS NULL
  AND public.resolve_single_active_warehouse(s.org_id, s.branch_id) IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_sale_warehouse_context()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_warehouse_org_id UUID;
  v_warehouse_branch_id UUID;
  v_warehouse_is_active BOOLEAN;
BEGIN
  IF NEW.warehouse_id IS NULL THEN
    NEW.warehouse_id := public.resolve_single_active_warehouse(NEW.org_id, NEW.branch_id);
  END IF;

  IF NEW.warehouse_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT org_id, branch_id, is_active
  INTO v_warehouse_org_id, v_warehouse_branch_id, v_warehouse_is_active
  FROM public.warehouses
  WHERE id = NEW.warehouse_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gudang pengiriman % tidak ditemukan.', NEW.warehouse_id;
  END IF;

  IF v_warehouse_org_id IS DISTINCT FROM NEW.org_id THEN
    RAISE EXCEPTION 'Gudang % tidak berada pada organisasi %.', NEW.warehouse_id, NEW.org_id;
  END IF;

  IF v_warehouse_is_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Gudang % sudah tidak aktif.', NEW.warehouse_id;
  END IF;

  IF NEW.branch_id IS NOT NULL AND v_warehouse_branch_id IS DISTINCT FROM NEW.branch_id THEN
    RAISE EXCEPTION 'Gudang % tidak berada pada unit yang sama dengan sales order.', NEW.warehouse_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sales_warehouse_context ON public.sales;
CREATE TRIGGER trg_sales_warehouse_context
  BEFORE INSERT OR UPDATE OF org_id, branch_id, warehouse_id
  ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.set_sale_warehouse_context();

DROP FUNCTION IF EXISTS public.process_sales_delivery_atomic(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS public.process_sales_delivery_atomic(UUID, UUID);

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
    v_acc_revenue UUID;
    v_acc_tax UUID;
    v_acc_cogs UUID;
    v_acc_inventory UUID;
    v_requires_inventory_sync BOOLEAN;
    v_resolved_warehouse_id UUID;
    v_warehouse_branch_id UUID;
    v_warehouse_is_active BOOLEAN;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required'
          USING ERRCODE = '42501';
    END IF;

    IF NOT public.nizam_has_permission('sales:write', p_org_id) THEN
        RAISE EXCEPTION 'Insufficient permission to deliver sales for organization %', p_org_id
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

    SELECT id INTO v_acc_inventory
    FROM public.accounts
    WHERE org_id = p_org_id AND code = '1301'
    LIMIT 1;

    IF v_acc_ar IS NULL
       OR v_acc_revenue IS NULL
       OR v_acc_tax IS NULL
       OR v_acc_cogs IS NULL
       OR v_acc_inventory IS NULL THEN
        RAISE EXCEPTION 'Akun pembukuan penjualan (1201, 4001, 2201, 5001, 1301) belum lengkap.';
    END IF;

    FOR v_item IN
        SELECT
          si.*,
          p.type AS product_type
        FROM public.sales_items si
        LEFT JOIN public.products p ON p.id = si.product_id
        WHERE si.sale_id = p_sale_id
    LOOP
        IF v_item.product_id IS NULL OR COALESCE(v_item.product_type, 'INVENTORY') <> 'INVENTORY' THEN
            CONTINUE;
        END IF;

        SELECT average_cost
        INTO v_hpp
        FROM public.products
        WHERE id = v_item.product_id;

        IF v_hpp IS NULL THEN
            v_hpp := 0;
        END IF;

        v_total_hpp := v_total_hpp + (v_hpp * v_item.quantity);

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
      'Pengakuan Laba, Piutang, & PPN atas Penjualan SO ' || v_sale.sale_number,
      p_sale_id,
      'SALE',
      'POSTED',
      TRUE
    )
    RETURNING id INTO v_entry_id;

    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
    VALUES (v_entry_id, v_acc_ar, v_sale.grand_total, 0);

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

        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
        VALUES (v_entry_id, v_acc_inventory, 0, v_total_hpp);
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_sales_delivery_atomic(
    p_org_id UUID,
    p_sale_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public.process_sales_delivery_atomic(p_org_id, p_sale_id, NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_sales_delivery_atomic(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_sales_delivery_atomic(UUID, UUID) TO authenticated;

DROP FUNCTION IF EXISTS public.process_sales_return_atomic(UUID, UUID, TEXT, TEXT, JSONB, UUID);
DROP FUNCTION IF EXISTS public.process_sales_return_atomic(UUID, UUID, TEXT, TEXT, JSONB, UUID, UUID);

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
SET search_path = public
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
    v_sale_warehouse_id UUID;
    v_requires_inventory_sync BOOLEAN;
    acc_piutang UUID;
    acc_retur_penjualan UUID;
    acc_ppn_keluaran UUID;
    acc_persediaan UUID;
    acc_hpp UUID;
    v_target_credit_account UUID;
    v_product_type TEXT;
BEGIN
    SELECT id INTO acc_piutang FROM public.accounts WHERE code = '1201' AND org_id = p_org_id;
    SELECT id INTO acc_retur_penjualan FROM public.accounts WHERE code = '4003' AND org_id = p_org_id;
    SELECT id INTO acc_ppn_keluaran FROM public.accounts WHERE code = '2201' AND org_id = p_org_id;
    SELECT id INTO acc_persediaan FROM public.accounts WHERE code = '1301' AND org_id = p_org_id;
    SELECT id INTO acc_hpp FROM public.accounts WHERE code = '5001' AND org_id = p_org_id;

    SELECT branch_id, warehouse_id
    INTO v_sale_branch_id, v_sale_warehouse_id
    FROM public.sales
    WHERE id = p_sale_id
      AND org_id = p_org_id;

    v_sale_warehouse_id := COALESCE(
      v_sale_warehouse_id,
      public.resolve_single_active_warehouse(p_org_id, v_sale_branch_id)
    );

    SELECT EXISTS (
      SELECT 1
      FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity DECIMAL, unit_price DECIMAL, sale_item_id UUID)
      JOIN public.products p ON p.id = x.product_id
      WHERE COALESCE(p.type, 'INVENTORY') = 'INVENTORY'
    )
    INTO v_requires_inventory_sync;

    IF v_requires_inventory_sync AND v_sale_warehouse_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Gudang asal penjualan tidak ditemukan. Tidak bisa mengembalikan stok fisik.');
    END IF;

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

        SELECT COALESCE(average_cost, 0), type
        INTO v_avg_cost, v_product_type
        FROM public.products
        WHERE id = v_item.product_id;

        IF COALESCE(v_product_type, 'INVENTORY') = 'INVENTORY' THEN
            v_hpp_total := v_hpp_total + (v_avg_cost * v_item.quantity);

            INSERT INTO public.stock_movements (
              org_id, product_id, quantity, unit_price, reference_type, reference_id, notes, branch_id
            )
            VALUES (
              p_org_id, v_item.product_id, v_item.quantity, v_avg_cost, 'SALES_RETURN', v_return_id,
              'Retur dr ' || p_return_number, v_sale_branch_id
            );

            PERFORM public.adjust_inventory_stock(
              p_org_id,
              v_item.product_id,
              v_sale_warehouse_id,
              v_item.quantity,
              NULL,
              NULL
            );
        END IF;

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

CREATE OR REPLACE VIEW public.sales_delivery_warehouse_audit AS
SELECT
  s.org_id,
  o.name AS org_name,
  s.branch_id,
  COUNT(*) FILTER (WHERE s.warehouse_id IS NULL) AS unresolved_sales_count,
  COUNT(*) FILTER (WHERE s.status = 'FINISHED' AND s.warehouse_id IS NULL) AS unresolved_finished_sales_count
FROM public.sales s
LEFT JOIN public.organizations o ON o.id = s.org_id
GROUP BY s.org_id, o.name, s.branch_id
ORDER BY unresolved_finished_sales_count DESC, unresolved_sales_count DESC, org_name;

NOTIFY pgrst, 'reload schema';
