-- ============================================================
-- MIGRATION 1117: Factory UoM Conversion + Stock Sync Hardening
-- ============================================================
-- Goals:
-- 1) Normalize unit aliases (Kg/Kilogram/Gram/etc.)
-- 2) Convert BoM quantities to product base unit during SPK completion
-- 3) Keep stock_movements and inventory_stocks synchronized for raw materials
-- ============================================================

CREATE OR REPLACE FUNCTION public.normalize_measurement_unit(p_unit TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_unit TEXT := lower(trim(COALESCE(p_unit, '')));
BEGIN
  v_unit := regexp_replace(v_unit, '\s+', '', 'g');
  v_unit := replace(v_unit, '.', '');

  IF v_unit = '' THEN
    RETURN '';
  END IF;

  IF v_unit IN ('kg', 'kilo', 'kilogram') THEN
    RETURN 'kg';
  ELSIF v_unit IN ('g', 'gr', 'gram', 'grams') THEN
    RETURN 'gram';
  ELSIF v_unit IN ('l', 'lt', 'ltr', 'liter', 'litre') THEN
    RETURN 'liter';
  ELSIF v_unit IN ('ml', 'milliliter', 'millilitre', 'cc') THEN
    RETURN 'ml';
  ELSIF v_unit IN ('m', 'meter', 'metre') THEN
    RETURN 'meter';
  ELSIF v_unit IN ('cm', 'centimeter', 'centimetre') THEN
    RETURN 'cm';
  ELSIF v_unit IN ('pcs', 'pc', 'piece', 'pieces') THEN
    RETURN 'pcs';
  ELSIF v_unit IN ('unit', 'units', 'satuan') THEN
    RETURN 'unit';
  END IF;

  RETURN v_unit;
END;
$$;

CREATE OR REPLACE FUNCTION public.convert_measurement_quantity(
  p_quantity NUMERIC,
  p_from_unit TEXT,
  p_to_unit TEXT
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_from TEXT := public.normalize_measurement_unit(COALESCE(p_from_unit, p_to_unit));
  v_to TEXT := public.normalize_measurement_unit(COALESCE(p_to_unit, p_from_unit));
BEGIN
  IF p_quantity IS NULL THEN
    RETURN 0;
  END IF;

  IF v_from = '' OR v_to = '' OR v_from = v_to THEN
    RETURN p_quantity;
  END IF;

  IF v_from = 'kg' AND v_to = 'gram' THEN
    RETURN p_quantity * 1000;
  ELSIF v_from = 'gram' AND v_to = 'kg' THEN
    RETURN p_quantity * 0.001;
  ELSIF v_from = 'liter' AND v_to = 'ml' THEN
    RETURN p_quantity * 1000;
  ELSIF v_from = 'ml' AND v_to = 'liter' THEN
    RETURN p_quantity * 0.001;
  ELSIF v_from = 'meter' AND v_to = 'cm' THEN
    RETURN p_quantity * 100;
  ELSIF v_from = 'cm' AND v_to = 'meter' THEN
    RETURN p_quantity * 0.01;
  ELSIF (v_from = 'pcs' AND v_to = 'unit') OR (v_from = 'unit' AND v_to = 'pcs') THEN
    RETURN p_quantity;
  END IF;

  RAISE EXCEPTION 'Konversi satuan tidak didukung: % -> %', COALESCE(p_from_unit, '-'), COALESCE(p_to_unit, '-');
END;
$$;

CREATE OR REPLACE FUNCTION public.process_work_order_completion(
    p_wo_id UUID,
    p_user_id UUID,
    p_warehouse_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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

    SELECT b.*, p.asset_account_id as fg_account
    INTO v_bom
    FROM public.production_boms b
    JOIN public.products p ON p.id = b.product_id
    WHERE b.id = v_wo.bom_id;

    v_fg_asset_account_id := v_bom.fg_account;

    IF v_fg_asset_account_id IS NULL THEN
        SELECT id INTO v_fg_asset_account_id FROM public.accounts WHERE org_id = v_org_id AND code = '1301' LIMIT 1;
    END IF;
    IF v_fg_asset_account_id IS NULL THEN
        SELECT id INTO v_fg_asset_account_id FROM public.accounts WHERE org_id = v_org_id AND type = 'ASSET' ORDER BY code LIMIT 1;
    END IF;

    INSERT INTO public.journal_entries (
        org_id, branch_id, entry_date, description, reference_type, reference_id, status, is_auto, created_by
    ) VALUES (
        v_org_id, v_branch_id, NOW(),
        'Produksi Selesai: ' || v_wo.wo_number || ' (' || v_bom.code || ')',
        'PRODUCTION', v_wo.id, 'POSTED', TRUE, p_user_id
    ) RETURNING id INTO v_je_id;

    FOR v_item IN (
      SELECT bi.*, p.asset_account_id as rm_account, p.name as product_name, p.unit as product_unit
      FROM public.production_bom_items bi
      JOIN public.products p ON p.id = bi.product_id
      WHERE bi.bom_id = v_wo.bom_id
    ) LOOP
        DECLARE
            v_qty_formula NUMERIC(20, 6) := COALESCE(v_item.quantity, 0) * COALESCE(v_wo.quantity_planned, 0);
            v_qty_to_consume NUMERIC(20, 6);
            v_unit_cost NUMERIC(20, 2);
            v_rm_account UUID := v_item.rm_account;
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

            IF v_rm_account IS NULL THEN
                SELECT id INTO v_rm_account FROM public.accounts WHERE org_id = v_org_id AND code = '1301' LIMIT 1;
            END IF;
            IF v_rm_account IS NULL THEN
                SELECT id INTO v_rm_account FROM public.accounts WHERE org_id = v_org_id AND type = 'ASSET' ORDER BY code LIMIT 1;
            END IF;

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

    SELECT b.*, p.asset_account_id as fg_account
    INTO v_bom
    FROM public.production_boms b
    JOIN public.products p ON p.id = b.product_id
    WHERE b.id = v_wo.bom_id;

    v_fg_asset_account_id := v_bom.fg_account;

    IF v_fg_asset_account_id IS NULL THEN
        SELECT id INTO v_fg_asset_account_id FROM public.accounts WHERE org_id = v_org_id AND code = '1301' LIMIT 1;
    END IF;
    IF v_fg_asset_account_id IS NULL THEN
        SELECT id INTO v_fg_asset_account_id FROM public.accounts WHERE org_id = v_org_id AND type = 'ASSET' ORDER BY code LIMIT 1;
    END IF;

    INSERT INTO public.journal_entries (
        org_id, branch_id, entry_date, description, reference_type, reference_id, status, is_auto, created_by
    ) VALUES (
        v_org_id, v_branch_id, NOW(),
        'Produksi Selesai: ' || v_wo.wo_number || ' (Inc. Overhead)',
        'PRODUCTION', v_wo.id, 'POSTED', TRUE, p_user_id
    ) RETURNING id INTO v_je_id;

    FOR v_item IN (
      SELECT bi.*, p.asset_account_id as rm_account, p.name as product_name, p.unit as product_unit
      FROM public.production_bom_items bi
      JOIN public.products p ON p.id = bi.product_id
      WHERE bi.bom_id = v_wo.bom_id
    ) LOOP
        DECLARE
            v_qty_formula NUMERIC(20, 6) := COALESCE(v_item.quantity, 0) * COALESCE(v_wo.quantity_planned, 0);
            v_qty_to_consume NUMERIC(20, 6);
            v_unit_cost NUMERIC(20, 2);
            v_rm_account UUID := v_item.rm_account;
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

            IF v_rm_account IS NULL THEN
                SELECT id INTO v_rm_account FROM public.accounts WHERE org_id = v_org_id AND code = '1301' LIMIT 1;
            END IF;
            IF v_rm_account IS NULL THEN
                SELECT id INTO v_rm_account FROM public.accounts WHERE org_id = v_org_id AND type = 'ASSET' ORDER BY code LIMIT 1;
            END IF;

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

NOTIFY pgrst, 'reload schema';
