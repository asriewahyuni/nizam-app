-- ============================================================
-- MIGRATION 1105: Fix sales delivery journal posting under RLS
-- ============================================================
-- Root cause:
-- process_sales_delivery_atomic still runs as SECURITY INVOKER.
-- During delivery it inserts POSTED journal entries and journal lines.
-- In environments that still enforce restrictive journal_lines RLS,
-- the insert can fail with:
--   new row violates row-level security policy for table "journal_lines"
--
-- Fix:
-- Recreate the RPC as SECURITY DEFINER so system journal posting can
-- complete atomically, while keeping explicit permission and branch
-- checks inside the function.
-- ============================================================

CREATE OR REPLACE FUNCTION public.process_sales_delivery_atomic(
    p_org_id UUID,
    p_sale_id UUID
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
        SELECT *
        FROM public.sales_items
        WHERE sale_id = p_sale_id
    LOOP
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
    END LOOP;

    UPDATE public.sales
    SET status = 'FINISHED',
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

GRANT EXECUTE ON FUNCTION public.process_sales_delivery_atomic(UUID, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
