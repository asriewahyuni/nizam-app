-- ============================================================
-- MIGRATION 1088: Inventory Branch Context
-- Make warehouses and stock movements aware of active branch/unit.
-- ============================================================

ALTER TABLE public.warehouses
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_warehouses_org_branch_active
  ON public.warehouses(org_id, branch_id, is_active);

CREATE INDEX IF NOT EXISTS idx_stock_movements_org_branch_product_date
  ON public.stock_movements(org_id, branch_id, product_id, movement_date DESC);

WITH purchase_branch_map AS (
  SELECT
    p.warehouse_id,
    MIN(p.branch_id::text)::UUID AS branch_id
  FROM public.purchases p
  WHERE p.warehouse_id IS NOT NULL
    AND p.branch_id IS NOT NULL
  GROUP BY p.warehouse_id
  HAVING COUNT(DISTINCT p.branch_id) = 1
)
UPDATE public.warehouses w
SET branch_id = purchase_branch_map.branch_id
FROM purchase_branch_map
WHERE w.id = purchase_branch_map.warehouse_id
  AND w.branch_id IS NULL;

WITH single_active_branch AS (
  SELECT
    org_id,
    MIN(id::text)::UUID AS branch_id
  FROM public.branches
  WHERE is_active = TRUE
  GROUP BY org_id
  HAVING COUNT(*) = 1
)
UPDATE public.warehouses w
SET branch_id = single_active_branch.branch_id
FROM single_active_branch
WHERE w.org_id = single_active_branch.org_id
  AND w.branch_id IS NULL;

UPDATE public.purchases p
SET branch_id = w.branch_id
FROM public.warehouses w
WHERE p.warehouse_id = w.id
  AND p.branch_id IS NULL
  AND w.branch_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.resolve_stock_movement_branch_id(
  p_reference_type TEXT,
  p_reference_id UUID,
  p_warehouse_id UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_branch_id UUID;
BEGIN
  IF p_warehouse_id IS NOT NULL THEN
    SELECT branch_id INTO v_branch_id
    FROM public.warehouses
    WHERE id = p_warehouse_id;

    IF v_branch_id IS NOT NULL THEN
      RETURN v_branch_id;
    END IF;
  END IF;

  CASE UPPER(COALESCE(p_reference_type, ''))
    WHEN 'PURCHASE' THEN
      SELECT branch_id INTO v_branch_id
      FROM public.purchases
      WHERE id = p_reference_id;

    WHEN 'PURCHASE_RETURN' THEN
      SELECT p.branch_id INTO v_branch_id
      FROM public.purchase_returns pr
      JOIN public.purchases p ON p.id = pr.purchase_id
      WHERE pr.id = p_reference_id;

    WHEN 'SALE' THEN
      SELECT
        CASE
          WHEN COUNT(DISTINCT branch_id) = 1 THEN MIN(branch_id::text)::UUID
          ELSE NULL
        END
      INTO v_branch_id
      FROM public.sales_items
      WHERE sale_id = p_reference_id
        AND branch_id IS NOT NULL;

    WHEN 'SALES_RETURN' THEN
      SELECT
        CASE
          WHEN COUNT(DISTINCT si.branch_id) = 1 THEN MIN(si.branch_id::text)::UUID
          ELSE NULL
        END
      INTO v_branch_id
      FROM public.sales_return_items sri
      JOIN public.sales_items si ON si.id = sri.sale_item_id
      WHERE sri.return_id = p_reference_id
        AND si.branch_id IS NOT NULL;

    WHEN 'ADJUSTMENT' THEN
      SELECT
        CASE
          WHEN COUNT(DISTINCT w.branch_id) = 1 THEN MIN(w.branch_id::text)::UUID
          ELSE NULL
        END
      INTO v_branch_id
      FROM public.inventory_adjustment_items iai
      JOIN public.warehouses w ON w.id = iai.warehouse_id
      WHERE iai.adjustment_id = p_reference_id
        AND w.branch_id IS NOT NULL;

    ELSE
      v_branch_id := NULL;
  END CASE;

  RETURN v_branch_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_stock_movement_branch_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.branch_id IS NULL THEN
    NEW.branch_id := public.resolve_stock_movement_branch_id(
      NEW.reference_type,
      NEW.reference_id
    );
  END IF;

  IF NEW.branch_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.branches
    WHERE id = NEW.branch_id
      AND org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'branch_id % tidak valid untuk organisasi %', NEW.branch_id, NEW.org_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_movements_branch_id ON public.stock_movements;
CREATE TRIGGER trg_stock_movements_branch_id
  BEFORE INSERT OR UPDATE ON public.stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.set_stock_movement_branch_id();

UPDATE public.stock_movements
SET branch_id = public.resolve_stock_movement_branch_id(reference_type, reference_id)
WHERE branch_id IS NULL;

DROP FUNCTION IF EXISTS process_work_order_completion(uuid, uuid);
DROP FUNCTION IF EXISTS process_work_order_completion(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS process_work_order_completion_v2(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS process_work_order_completion_v2(uuid, uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION process_work_order_completion(
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
BEGIN
    SELECT * INTO v_wo FROM production_work_orders WHERE id = p_wo_id;
    IF v_wo.status != 'RELEASED' THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Hanya SPK berstatus RELEASED yang bisa diselesaikan.');
    END IF;

    v_org_id := v_wo.org_id;

    IF p_warehouse_id IS NOT NULL THEN
        SELECT branch_id INTO v_branch_id
        FROM public.warehouses
        WHERE id = p_warehouse_id
          AND org_id = v_org_id;
    END IF;

    SELECT b.*, p.asset_account_id as fg_account
    INTO v_bom
    FROM production_boms b
    JOIN products p ON p.id = b.product_id
    WHERE b.id = v_wo.bom_id;

    v_fg_asset_account_id := v_bom.fg_account;

    IF v_fg_asset_account_id IS NULL THEN
        SELECT id INTO v_fg_asset_account_id FROM accounts WHERE org_id = v_org_id AND code = '1301' LIMIT 1;
    END IF;
    IF v_fg_asset_account_id IS NULL THEN
        SELECT id INTO v_fg_asset_account_id FROM accounts WHERE org_id = v_org_id AND type = 'ASSET' ORDER BY code LIMIT 1;
    END IF;

    INSERT INTO journal_entries (
        org_id, entry_date, description, reference_type, reference_id, status, is_auto, created_by
    ) VALUES (
        v_org_id, NOW(),
        'Produksi Selesai: ' || v_wo.wo_number || ' (' || v_bom.code || ')',
        'PRODUCTION', v_wo.id, 'POSTED', TRUE, p_user_id
    ) RETURNING id INTO v_je_id;

    FOR v_item IN (
      SELECT bi.*, p.asset_account_id as rm_account, p.name as product_name
      FROM production_bom_items bi
      JOIN products p ON p.id = bi.product_id
      WHERE bi.bom_id = v_wo.bom_id
    ) LOOP
        DECLARE
            v_qty_to_consume NUMERIC(20, 4) := v_item.quantity * v_wo.quantity_planned;
            v_unit_cost NUMERIC(20, 2);
            v_rm_account UUID := v_item.rm_account;
        BEGIN
            SELECT COALESCE(average_cost, purchase_price, 0) INTO v_unit_cost FROM products WHERE id = v_item.product_id;
            v_total_rm_cost := v_total_rm_cost + (v_qty_to_consume * v_unit_cost);

            INSERT INTO stock_movements (
                org_id, product_id, movement_date, quantity, unit_price,
                reference_type, reference_id, notes, branch_id
            ) VALUES (
                v_org_id, v_item.product_id, NOW(), -v_qty_to_consume, v_unit_cost,
                'PRODUCTION_CONSUMPTION', v_wo.id, 'Consummed for ' || v_wo.wo_number, v_branch_id
            );

            IF p_warehouse_id IS NOT NULL THEN
                UPDATE inventory_stocks
                SET quantity = quantity - v_qty_to_consume
                WHERE product_id = v_item.product_id AND warehouse_id = p_warehouse_id;
            END IF;

            IF v_rm_account IS NULL THEN
                SELECT id INTO v_rm_account FROM accounts WHERE org_id = v_org_id AND code = '1301' LIMIT 1;
            END IF;
            IF v_rm_account IS NULL THEN
                SELECT id INTO v_rm_account FROM accounts WHERE org_id = v_org_id AND type = 'ASSET' ORDER BY code LIMIT 1;
            END IF;

            INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo)
            VALUES (v_je_id, v_rm_account, 0, v_qty_to_consume * v_unit_cost, 'Bahan Baku: ' || v_item.product_name);
        END;
    END LOOP;

    DECLARE
        v_fg_unit_cost NUMERIC(20, 2) := v_total_rm_cost / v_wo.quantity_planned;
    BEGIN
        INSERT INTO stock_movements (
            org_id, product_id, movement_date, quantity, unit_price,
            reference_type, reference_id, notes, branch_id
        ) VALUES (
            v_org_id, v_bom.product_id, NOW(), v_wo.quantity_planned, v_fg_unit_cost,
            'PRODUCTION_OUTPUT', v_wo.id, 'Produced via ' || v_wo.wo_number, v_branch_id
        );

        IF p_warehouse_id IS NOT NULL THEN
            INSERT INTO inventory_stocks (org_id, product_id, warehouse_id, quantity)
            VALUES (v_org_id, v_bom.product_id, p_warehouse_id, v_wo.quantity_planned)
            ON CONFLICT (product_id, warehouse_id, batch_number) DO UPDATE
            SET quantity = inventory_stocks.quantity + EXCLUDED.quantity;
        END IF;

        INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo)
        VALUES (v_je_id, v_fg_asset_account_id, v_total_rm_cost, 0, 'Produk Jadi: ' || v_wo.wo_number);

        UPDATE public.products SET
            purchase_price = v_fg_unit_cost,
            selling_price = CASE
                WHEN COALESCE(selling_price, 0) = 0 THEN ROUND(v_fg_unit_cost / 0.7 / 100) * 100
                ELSE selling_price
            END,
            updated_at = NOW()
        WHERE id = v_bom.product_id;
    END;

    UPDATE production_work_orders SET
        status = 'COMPLETED',
        completed_at = NOW(),
        quantity_actual = quantity_planned
    WHERE id = p_wo_id;

    RETURN jsonb_build_object('success', TRUE, 'total_cost', v_total_rm_cost);
END;
$$;


CREATE OR REPLACE FUNCTION process_work_order_completion_v2(
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
BEGIN
    SELECT * INTO v_wo FROM production_work_orders WHERE id = p_wo_id;
    IF v_wo.status != 'RELEASED' THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Hanya SPK berstatus RELEASED yang bisa diselesaikan.');
    END IF;

    v_org_id := v_wo.org_id;

    SELECT branch_id INTO v_branch_id
    FROM public.warehouses
    WHERE id = p_warehouse_id
      AND org_id = v_org_id;

    SELECT COALESCE(SUM(amount), 0) INTO v_total_overhead_cost
    FROM production_wo_costs
    WHERE wo_id = p_wo_id;

    SELECT b.*, p.asset_account_id as fg_account
    INTO v_bom
    FROM production_boms b
    JOIN products p ON p.id = b.product_id
    WHERE b.id = v_wo.bom_id;

    v_fg_asset_account_id := v_bom.fg_account;

    IF v_fg_asset_account_id IS NULL THEN
        SELECT id INTO v_fg_asset_account_id FROM accounts WHERE org_id = v_org_id AND code = '1301' LIMIT 1;
    END IF;
    IF v_fg_asset_account_id IS NULL THEN
        SELECT id INTO v_fg_asset_account_id FROM accounts WHERE org_id = v_org_id AND type = 'ASSET' ORDER BY code LIMIT 1;
    END IF;

    INSERT INTO journal_entries (
        org_id, entry_date, description, reference_type, reference_id, status, is_auto, created_by
    ) VALUES (
        v_org_id, NOW(),
        'Produksi Selesai: ' || v_wo.wo_number || ' (Inc. Overhead)',
        'PRODUCTION', v_wo.id, 'POSTED', TRUE, p_user_id
    ) RETURNING id INTO v_je_id;

    FOR v_item IN (
      SELECT bi.*, p.asset_account_id as rm_account, p.name as product_name
      FROM production_bom_items bi
      JOIN products p ON p.id = bi.product_id
      WHERE bi.bom_id = v_wo.bom_id
    ) LOOP
        DECLARE
            v_qty_to_consume NUMERIC(20, 4) := v_item.quantity * v_wo.quantity_planned;
            v_unit_cost NUMERIC(20, 2);
            v_rm_account UUID := v_item.rm_account;
        BEGIN
            SELECT COALESCE(average_cost, purchase_price, 0) INTO v_unit_cost FROM products WHERE id = v_item.product_id;
            v_total_rm_cost := v_total_rm_cost + (v_qty_to_consume * v_unit_cost);

            INSERT INTO stock_movements (
                org_id, product_id, movement_date, quantity, unit_price,
                reference_type, reference_id, notes, branch_id
            ) VALUES (
                v_org_id, v_item.product_id, NOW(), -v_qty_to_consume, v_unit_cost,
                'PRODUCTION_CONSUMPTION', v_wo.id, 'Consummed for ' || v_wo.wo_number, v_branch_id
            );

            IF v_rm_account IS NULL THEN
                SELECT id INTO v_rm_account FROM accounts WHERE org_id = v_org_id AND code = '1301' LIMIT 1;
            END IF;
            IF v_rm_account IS NULL THEN
                SELECT id INTO v_rm_account FROM accounts WHERE org_id = v_org_id AND type = 'ASSET' ORDER BY code LIMIT 1;
            END IF;

            INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo)
            VALUES (v_je_id, v_rm_account, 0, v_qty_to_consume * v_unit_cost, 'Bahan Baku: ' || v_item.product_name);
        END;
    END LOOP;

    IF v_total_overhead_cost > 0 THEN
        SELECT id INTO v_overhead_account_id FROM accounts WHERE org_id = v_org_id AND code = '6100' LIMIT 1;

        IF v_overhead_account_id IS NULL THEN
            SELECT id INTO v_overhead_account_id FROM accounts WHERE org_id = v_org_id AND code = '6001' LIMIT 1;
        END IF;
        IF v_overhead_account_id IS NULL THEN
            SELECT id INTO v_overhead_account_id FROM accounts WHERE org_id = v_org_id AND type = 'EXPENSE' ORDER BY code LIMIT 1;
        END IF;

        INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo)
        VALUES (v_je_id, v_overhead_account_id, 0, v_total_overhead_cost, 'Biaya Overhead/Tenaga Kerja Produksi');
    END IF;

    v_grand_total_cost := v_total_rm_cost + v_total_overhead_cost;

    DECLARE
        v_fg_unit_cost NUMERIC(20, 2) := v_grand_total_cost / v_wo.quantity_planned;
    BEGIN
        INSERT INTO stock_movements (
            org_id, product_id, movement_date, quantity, unit_price,
            reference_type, reference_id, notes, branch_id
        ) VALUES (
            v_org_id, v_bom.product_id, NOW(), v_wo.quantity_planned, v_fg_unit_cost,
            'PRODUCTION_OUTPUT', v_wo.id, 'Produced via ' || v_wo.wo_number, v_branch_id
        );

        INSERT INTO inventory_stocks (org_id, product_id, warehouse_id, bin_id, quantity)
        VALUES (v_org_id, v_bom.product_id, p_warehouse_id, p_bin_id, v_wo.quantity_planned)
        ON CONFLICT (product_id, warehouse_id, COALESCE(bin_id, '00000000-0000-0000-0000-000000000000'), COALESCE(batch_number, '')) DO UPDATE
        SET quantity = inventory_stocks.quantity + EXCLUDED.quantity;

        INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo)
        VALUES (v_je_id, v_fg_asset_account_id, v_grand_total_cost, 0, 'Produk Jadi: ' || v_wo.wo_number);

        UPDATE public.products SET
            purchase_price = v_fg_unit_cost,
            selling_price = CASE
                WHEN COALESCE(selling_price, 0) = 0 THEN ROUND(v_fg_unit_cost / 0.7 / 100) * 100
                ELSE selling_price
            END,
            updated_at = NOW()
        WHERE id = v_bom.product_id;
    END;

    UPDATE production_work_orders SET
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
