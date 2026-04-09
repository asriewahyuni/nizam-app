-- ============================================================
-- MIGRATION 1161: Fix factory finished-goods inventory account routing
-- ============================================================
-- Why:
-- 1. Sales delivery already credits segmented inventory accounts via
--    resolve_inventory_asset_account().
-- 2. Production completion still debited finished goods using the legacy
--    generic fallback 1301 when products.asset_account_id was NULL.
-- 3. That mismatch can make "Persediaan Barang Jadi" go negative even when
--    physical stock is correct.
--
-- This migration:
-- - upgrades inventory account resolution to also consider product category,
-- - auto-fills inventory asset accounts on product writes,
-- - aligns factory completion journal posting with segmented inventory logic,
-- - repairs historical production output journal lines posted to 1301.
-- ============================================================

CREATE OR REPLACE FUNCTION public.resolve_inventory_asset_account(
  p_org_id UUID,
  p_product_id UUID,
  p_fallback_code TEXT DEFAULT '1301'
)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_account_id UUID;
  v_fallback_code TEXT := p_fallback_code;
  v_is_bom_component BOOLEAN := FALSE;
  v_is_bom_output BOOLEAN := FALSE;
  v_product_category TEXT;
BEGIN
  SELECT asset_account_id, category
  INTO v_account_id, v_product_category
  FROM public.products
  WHERE id = p_product_id
    AND org_id = p_org_id
  LIMIT 1;

  IF v_account_id IS NOT NULL THEN
    RETURN v_account_id;
  END IF;

  IF v_product_category = 'Setengah Jadi' THEN
    v_fallback_code := '1302'; -- barang dalam proses / semi finished
  ELSIF v_product_category IN ('Bahan', 'Pelengkap') THEN
    v_fallback_code := '1303'; -- bahan baku & pendukung
  ELSIF v_product_category = 'Siap Jual' THEN
    v_fallback_code := '1304'; -- barang jadi
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM public.production_bom_items bi
      JOIN public.production_boms b ON b.id = bi.bom_id
      WHERE bi.product_id = p_product_id
        AND b.org_id = p_org_id
    )
    INTO v_is_bom_component;

    SELECT EXISTS (
      SELECT 1
      FROM public.production_boms b
      WHERE b.org_id = p_org_id
        AND b.product_id = p_product_id
    )
    INTO v_is_bom_output;

    IF v_is_bom_component AND v_is_bom_output THEN
      v_fallback_code := '1302';
    ELSIF v_is_bom_component THEN
      v_fallback_code := '1303';
    ELSIF v_is_bom_output THEN
      v_fallback_code := '1304';
    END IF;
  END IF;

  SELECT id
  INTO v_account_id
  FROM public.accounts
  WHERE org_id = p_org_id
    AND code = v_fallback_code
  LIMIT 1;

  IF v_account_id IS NOT NULL THEN
    RETURN v_account_id;
  END IF;

  SELECT id
  INTO v_account_id
  FROM public.accounts
  WHERE org_id = p_org_id
    AND type = 'ASSET'
  ORDER BY code
  LIMIT 1;

  RETURN v_account_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_inventory_asset_account_default()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_code TEXT := '1301';
  v_account_id UUID;
BEGIN
  IF COALESCE(NEW.type::TEXT, 'INVENTORY') <> 'INVENTORY' THEN
    RETURN NEW;
  END IF;

  IF NEW.asset_account_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.category = 'Setengah Jadi' THEN
    v_target_code := '1302';
  ELSIF NEW.category IN ('Bahan', 'Pelengkap') THEN
    v_target_code := '1303';
  ELSIF NEW.category = 'Siap Jual' THEN
    v_target_code := '1304';
  END IF;

  SELECT id
  INTO v_account_id
  FROM public.accounts
  WHERE org_id = NEW.org_id
    AND code = v_target_code
  LIMIT 1;

  IF v_account_id IS NULL THEN
    SELECT id
    INTO v_account_id
    FROM public.accounts
    WHERE org_id = NEW.org_id
      AND type = 'ASSET'
    ORDER BY code
    LIMIT 1;
  END IF;

  NEW.asset_account_id := v_account_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_inventory_asset_account_default ON public.products;
CREATE TRIGGER trg_products_inventory_asset_account_default
  BEFORE INSERT OR UPDATE OF org_id, type, category, asset_account_id
  ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_inventory_asset_account_default();

CREATE OR REPLACE FUNCTION public.process_work_order_completion(
    p_wo_id UUID,
    p_user_id UUID,
    p_warehouse_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_wo RECORD;
    v_bom RECORD;
    v_item RECORD;
    v_je_id UUID;
    v_total_rm_cost NUMERIC(20, 2) := 0;
    v_fg_asset_account_id UUID;
    v_org_id UUID;
    v_branch_id UUID;
    v_warehouse_branch_id UUID;
    v_warehouse_is_active BOOLEAN;
BEGIN
    SELECT * INTO v_wo
    FROM public.production_work_orders
    WHERE id = p_wo_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'SPK tidak ditemukan.');
    END IF;

    IF v_wo.status != 'RELEASED' THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Hanya SPK berstatus RELEASED yang bisa diselesaikan.');
    END IF;

    IF p_warehouse_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Gudang hasil produksi wajib dipilih.');
    END IF;

    IF COALESCE(v_wo.quantity_planned, 0) <= 0 THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Jumlah target produksi tidak valid.');
    END IF;

    v_org_id := v_wo.org_id;
    v_branch_id := COALESCE(v_wo.branch_id, public.resolve_single_active_branch(v_wo.org_id));

    SELECT branch_id, is_active
    INTO v_warehouse_branch_id, v_warehouse_is_active
    FROM public.warehouses
    WHERE id = p_warehouse_id
      AND org_id = v_org_id;

    IF v_warehouse_branch_id IS NULL OR v_warehouse_is_active IS DISTINCT FROM TRUE THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Gudang hasil produksi tidak valid.');
    END IF;

    IF v_branch_id IS NOT NULL AND v_warehouse_branch_id IS DISTINCT FROM v_branch_id THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Gudang hasil produksi tidak berada pada unit SPK.');
    END IF;

    SELECT b.*
    INTO v_bom
    FROM public.production_boms b
    WHERE b.id = v_wo.bom_id;

    v_fg_asset_account_id := public.resolve_inventory_asset_account(v_org_id, v_bom.product_id, '1301');

    INSERT INTO public.journal_entries (
        org_id, branch_id, entry_date, description, reference_type, reference_id, status, is_auto, created_by
    ) VALUES (
        v_org_id, v_branch_id, NOW(),
        'Produksi Selesai: ' || v_wo.wo_number || ' (' || v_bom.code || ')',
        'PRODUCTION', v_wo.id, 'POSTED', TRUE, p_user_id
    ) RETURNING id INTO v_je_id;

    FOR v_item IN (
      SELECT bi.*, p.name as product_name, p.unit as product_unit
      FROM public.production_bom_items bi
      JOIN public.products p ON p.id = bi.product_id
      WHERE bi.bom_id = v_wo.bom_id
    ) LOOP
        DECLARE
            v_qty_formula NUMERIC(20, 6) := COALESCE(v_item.quantity, 0) * COALESCE(v_wo.quantity_planned, 0);
            v_qty_to_consume NUMERIC(20, 6);
            v_unit_cost NUMERIC(20, 2);
            v_rm_account UUID;
            v_rm_warehouse_id UUID;
        BEGIN
            v_qty_to_consume := public.convert_measurement_quantity(
              v_qty_formula,
              v_item.unit,
              v_item.product_unit
            );

            IF COALESCE(v_qty_to_consume, 0) <= 0 THEN
              CONTINUE;
            END IF;

            SELECT COALESCE(average_cost, purchase_price, 0) INTO v_unit_cost
            FROM public.products
            WHERE id = v_item.product_id;

            v_total_rm_cost := v_total_rm_cost + (v_qty_to_consume * v_unit_cost);

            INSERT INTO public.stock_movements (
                org_id, branch_id, product_id, movement_date, quantity, unit_price,
                reference_type, reference_id, notes
            ) VALUES (
                v_org_id, v_branch_id, v_item.product_id, NOW(), -v_qty_to_consume, v_unit_cost,
                'PRODUCTION_CONSUMPTION', v_wo.id, 'Consumed for ' || v_wo.wo_number
            );

            SELECT s.warehouse_id
            INTO v_rm_warehouse_id
            FROM public.inventory_stocks s
            JOIN public.warehouses w ON w.id = s.warehouse_id
            WHERE s.org_id = v_org_id
              AND s.product_id = v_item.product_id
              AND s.quantity > 0
              AND w.org_id = v_org_id
              AND w.is_active = TRUE
              AND (v_branch_id IS NULL OR w.branch_id = v_branch_id)
            ORDER BY s.quantity DESC, s.updated_at DESC NULLS LAST
            LIMIT 1;

            IF v_rm_warehouse_id IS NULL THEN
              v_rm_warehouse_id := p_warehouse_id;
            END IF;

            PERFORM public.adjust_inventory_stock(
              v_org_id,
              v_item.product_id,
              v_rm_warehouse_id,
              -v_qty_to_consume,
              NULL,
              NULL
            );

            v_rm_account := public.resolve_inventory_asset_account(v_org_id, v_item.product_id, '1301');

            INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
            VALUES (v_je_id, v_rm_account, 0, v_qty_to_consume * v_unit_cost, 'Bahan Baku: ' || v_item.product_name);
        END;
    END LOOP;

    DECLARE
        v_fg_unit_cost NUMERIC(20, 2) := v_total_rm_cost / v_wo.quantity_planned;
    BEGIN
        INSERT INTO public.stock_movements (
            org_id, branch_id, product_id, movement_date, quantity, unit_price,
            reference_type, reference_id, notes
        ) VALUES (
            v_org_id, v_branch_id, v_bom.product_id, NOW(), v_wo.quantity_planned, v_fg_unit_cost,
            'PRODUCTION_OUTPUT', v_wo.id, 'Produced via ' || v_wo.wo_number
        );

        INSERT INTO public.inventory_stocks (org_id, product_id, warehouse_id, quantity)
        VALUES (v_org_id, v_bom.product_id, p_warehouse_id, v_wo.quantity_planned)
        ON CONFLICT (product_id, warehouse_id, COALESCE(bin_id, '00000000-0000-0000-0000-000000000000'), COALESCE(batch_number, '')) DO UPDATE
        SET quantity = public.inventory_stocks.quantity + EXCLUDED.quantity;

        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
        VALUES (v_je_id, v_fg_asset_account_id, v_total_rm_cost, 0, 'Produk Jadi: ' || v_wo.wo_number);

        UPDATE public.products SET
            asset_account_id = COALESCE(asset_account_id, v_fg_asset_account_id),
            average_cost = v_fg_unit_cost,
            purchase_price = v_fg_unit_cost,
            selling_price = CASE
                WHEN COALESCE(selling_price, 0) = 0 THEN ROUND(v_fg_unit_cost / 0.7 / 100) * 100
                ELSE selling_price
            END,
            updated_at = NOW()
        WHERE id = v_bom.product_id;
    END;

    UPDATE public.production_work_orders SET
        status = 'COMPLETED',
        completed_at = NOW(),
        quantity_actual = quantity_planned
    WHERE id = p_wo_id;

    RETURN jsonb_build_object('success', TRUE, 'total_cost', v_total_rm_cost);
END;
$$;

CREATE OR REPLACE FUNCTION public.process_work_order_completion_v2(
    p_wo_id UUID,
    p_user_id UUID,
    p_warehouse_id UUID,
    p_bin_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_wo RECORD;
    v_bom RECORD;
    v_item RECORD;
    v_je_id UUID;
    v_total_rm_cost NUMERIC(20, 2) := 0;
    v_total_overhead_cost NUMERIC(20, 2) := 0;
    v_grand_total_cost NUMERIC(20, 2) := 0;
    v_fg_asset_account_id UUID;
    v_org_id UUID;
    v_overhead_account_id UUID;
    v_branch_id UUID;
    v_warehouse_branch_id UUID;
    v_warehouse_is_active BOOLEAN;
BEGIN
    SELECT * INTO v_wo
    FROM public.production_work_orders
    WHERE id = p_wo_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'SPK tidak ditemukan.');
    END IF;

    IF v_wo.status != 'RELEASED' THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Hanya SPK berstatus RELEASED yang bisa diselesaikan.');
    END IF;

    IF p_warehouse_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Gudang hasil produksi wajib dipilih.');
    END IF;

    IF COALESCE(v_wo.quantity_planned, 0) <= 0 THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Jumlah target produksi tidak valid.');
    END IF;

    v_org_id := v_wo.org_id;
    v_branch_id := COALESCE(v_wo.branch_id, public.resolve_single_active_branch(v_wo.org_id));

    SELECT branch_id, is_active
    INTO v_warehouse_branch_id, v_warehouse_is_active
    FROM public.warehouses
    WHERE id = p_warehouse_id
      AND org_id = v_org_id;

    IF v_warehouse_branch_id IS NULL OR v_warehouse_is_active IS DISTINCT FROM TRUE THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Gudang hasil produksi tidak valid.');
    END IF;

    IF v_branch_id IS NOT NULL AND v_warehouse_branch_id IS DISTINCT FROM v_branch_id THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Gudang hasil produksi tidak berada pada unit SPK.');
    END IF;

    IF p_bin_id IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM public.warehouse_bins
        WHERE id = p_bin_id
          AND warehouse_id = p_warehouse_id
          AND org_id = v_org_id
          AND is_active = TRUE
    ) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Rak hasil produksi tidak valid untuk gudang terpilih.');
    END IF;

    SELECT COALESCE(SUM(amount), 0) INTO v_total_overhead_cost
    FROM public.production_wo_costs
    WHERE wo_id = p_wo_id;

    SELECT b.*
    INTO v_bom
    FROM public.production_boms b
    WHERE b.id = v_wo.bom_id;

    v_fg_asset_account_id := public.resolve_inventory_asset_account(v_org_id, v_bom.product_id, '1301');

    INSERT INTO public.journal_entries (
        org_id, branch_id, entry_date, description, reference_type, reference_id, status, is_auto, created_by
    ) VALUES (
        v_org_id, v_branch_id, NOW(),
        'Produksi Selesai: ' || v_wo.wo_number || ' (Inc. Overhead)',
        'PRODUCTION', v_wo.id, 'POSTED', TRUE, p_user_id
    ) RETURNING id INTO v_je_id;

    FOR v_item IN (
      SELECT bi.*, p.name as product_name, p.unit as product_unit
      FROM public.production_bom_items bi
      JOIN public.products p ON p.id = bi.product_id
      WHERE bi.bom_id = v_wo.bom_id
    ) LOOP
        DECLARE
            v_qty_formula NUMERIC(20, 6) := COALESCE(v_item.quantity, 0) * COALESCE(v_wo.quantity_planned, 0);
            v_qty_to_consume NUMERIC(20, 6);
            v_unit_cost NUMERIC(20, 2);
            v_rm_account UUID;
            v_rm_warehouse_id UUID;
        BEGIN
            v_qty_to_consume := public.convert_measurement_quantity(
              v_qty_formula,
              v_item.unit,
              v_item.product_unit
            );

            IF COALESCE(v_qty_to_consume, 0) <= 0 THEN
              CONTINUE;
            END IF;

            SELECT COALESCE(average_cost, purchase_price, 0) INTO v_unit_cost
            FROM public.products
            WHERE id = v_item.product_id;

            v_total_rm_cost := v_total_rm_cost + (v_qty_to_consume * v_unit_cost);

            INSERT INTO public.stock_movements (
                org_id, branch_id, product_id, movement_date, quantity, unit_price,
                reference_type, reference_id, notes
            ) VALUES (
                v_org_id, v_branch_id, v_item.product_id, NOW(), -v_qty_to_consume, v_unit_cost,
                'PRODUCTION_CONSUMPTION', v_wo.id, 'Consumed for ' || v_wo.wo_number
            );

            SELECT s.warehouse_id
            INTO v_rm_warehouse_id
            FROM public.inventory_stocks s
            JOIN public.warehouses w ON w.id = s.warehouse_id
            WHERE s.org_id = v_org_id
              AND s.product_id = v_item.product_id
              AND s.quantity > 0
              AND w.org_id = v_org_id
              AND w.is_active = TRUE
              AND (v_branch_id IS NULL OR w.branch_id = v_branch_id)
            ORDER BY s.quantity DESC, s.updated_at DESC NULLS LAST
            LIMIT 1;

            IF v_rm_warehouse_id IS NULL THEN
              v_rm_warehouse_id := p_warehouse_id;
            END IF;

            PERFORM public.adjust_inventory_stock(
              v_org_id,
              v_item.product_id,
              v_rm_warehouse_id,
              -v_qty_to_consume,
              NULL,
              NULL
            );

            v_rm_account := public.resolve_inventory_asset_account(v_org_id, v_item.product_id, '1301');

            INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
            VALUES (v_je_id, v_rm_account, 0, v_qty_to_consume * v_unit_cost, 'Bahan Baku: ' || v_item.product_name);
        END;
    END LOOP;

    IF v_total_overhead_cost > 0 THEN
        SELECT id INTO v_overhead_account_id FROM public.accounts WHERE org_id = v_org_id AND code = '6100' LIMIT 1;

        IF v_overhead_account_id IS NULL THEN
            SELECT id INTO v_overhead_account_id FROM public.accounts WHERE org_id = v_org_id AND code = '6001' LIMIT 1;
        END IF;
        IF v_overhead_account_id IS NULL THEN
            SELECT id INTO v_overhead_account_id FROM public.accounts WHERE org_id = v_org_id AND type = 'EXPENSE' ORDER BY code LIMIT 1;
        END IF;

        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
        VALUES (v_je_id, v_overhead_account_id, 0, v_total_overhead_cost, 'Biaya Overhead/Tenaga Kerja Produksi');
    END IF;

    v_grand_total_cost := v_total_rm_cost + v_total_overhead_cost;

    DECLARE
        v_fg_unit_cost NUMERIC(20, 2) := v_grand_total_cost / v_wo.quantity_planned;
    BEGIN
        INSERT INTO public.stock_movements (
            org_id, branch_id, product_id, movement_date, quantity, unit_price,
            reference_type, reference_id, notes
        ) VALUES (
            v_org_id, v_branch_id, v_bom.product_id, NOW(), v_wo.quantity_planned, v_fg_unit_cost,
            'PRODUCTION_OUTPUT', v_wo.id, 'Produced via ' || v_wo.wo_number
        );

        INSERT INTO public.inventory_stocks (org_id, product_id, warehouse_id, bin_id, quantity)
        VALUES (v_org_id, v_bom.product_id, p_warehouse_id, p_bin_id, v_wo.quantity_planned)
        ON CONFLICT (product_id, warehouse_id, COALESCE(bin_id, '00000000-0000-0000-0000-000000000000'), COALESCE(batch_number, '')) DO UPDATE
        SET quantity = public.inventory_stocks.quantity + EXCLUDED.quantity;

        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
        VALUES (v_je_id, v_fg_asset_account_id, v_grand_total_cost, 0, 'Produk Jadi: ' || v_wo.wo_number);

        UPDATE public.products SET
            asset_account_id = COALESCE(asset_account_id, v_fg_asset_account_id),
            average_cost = v_fg_unit_cost,
            purchase_price = v_fg_unit_cost,
            selling_price = CASE
                WHEN COALESCE(selling_price, 0) = 0 THEN ROUND(v_fg_unit_cost / 0.7 / 100) * 100
                ELSE selling_price
            END,
            updated_at = NOW()
        WHERE id = v_bom.product_id;
    END;

    UPDATE public.production_work_orders SET
        status = 'COMPLETED',
        completed_at = NOW(),
        quantity_actual = quantity_planned
    WHERE id = p_wo_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'rm_cost', v_total_rm_cost,
        'overhead_cost', v_total_overhead_cost,
        'total_cost', v_grand_total_cost,
        'fg_unit_cost', v_grand_total_cost / v_wo.quantity_planned
    );
END;
$$;

DO $$
DECLARE
  v_org RECORD;
BEGIN
  FOR v_org IN
    SELECT id FROM public.organizations
  LOOP
    UPDATE public.products p
    SET asset_account_id = public.resolve_inventory_asset_account(v_org.id, p.id, '1301')
    WHERE p.org_id = v_org.id
      AND COALESCE(p.type::TEXT, 'INVENTORY') = 'INVENTORY'
      AND p.asset_account_id IS NULL;
  END LOOP;
END;
$$;

WITH misposted_fg_lines AS (
  SELECT
    jl.id AS journal_line_id,
    public.resolve_inventory_asset_account(wo.org_id, b.product_id, '1301') AS expected_account_id
  FROM public.journal_lines jl
  JOIN public.journal_entries je ON je.id = jl.entry_id
  JOIN public.production_work_orders wo ON wo.id = je.reference_id
  JOIN public.production_boms b ON b.id = wo.bom_id
  JOIN public.accounts acc
    ON acc.id = jl.account_id
   AND acc.org_id = wo.org_id
  WHERE je.reference_type = 'PRODUCTION'
    AND jl.debit > 0
    AND COALESCE(jl.memo, '') ILIKE 'Produk Jadi:%'
    AND acc.code = '1301'
)
UPDATE public.journal_lines jl
SET account_id = m.expected_account_id
FROM misposted_fg_lines m
WHERE jl.id = m.journal_line_id
  AND m.expected_account_id IS NOT NULL
  AND jl.account_id IS DISTINCT FROM m.expected_account_id;

NOTIFY pgrst, 'reload schema';
