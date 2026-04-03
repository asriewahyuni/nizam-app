-- ============================================================
-- MIGRATION 1101: Factory Branch Context
-- Make manufacturing data and completion flows aware of active
-- branch/unit while preserving legacy shared BoM master data.
-- ============================================================

ALTER TABLE public.production_boms
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

ALTER TABLE public.production_work_orders
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_production_boms_org_branch_active
  ON public.production_boms(org_id, branch_id, is_active);

CREATE INDEX IF NOT EXISTS idx_production_work_orders_org_branch_status
  ON public.production_work_orders(org_id, branch_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_production_work_orders_bom_branch
  ON public.production_work_orders(bom_id, branch_id);

WITH wo_request_branch_map AS (
  SELECT
    pr.source_id AS wo_id,
    MIN(pr.branch_id::text)::UUID AS branch_id
  FROM public.purchase_requests pr
  WHERE pr.source_type = 'MANUFACTURING'
    AND pr.source_id IS NOT NULL
    AND pr.branch_id IS NOT NULL
  GROUP BY pr.source_id
  HAVING COUNT(DISTINCT pr.branch_id) = 1
)
UPDATE public.production_work_orders wo
SET branch_id = wo_request_branch_map.branch_id
FROM wo_request_branch_map
WHERE wo.id = wo_request_branch_map.wo_id
  AND wo.branch_id IS NULL;

WITH wo_stock_branch_map AS (
  SELECT
    sm.reference_id AS wo_id,
    MIN(sm.branch_id::text)::UUID AS branch_id
  FROM public.stock_movements sm
  WHERE sm.reference_type IN ('PRODUCTION_OUTPUT', 'PRODUCTION_CONSUMPTION')
    AND sm.reference_id IS NOT NULL
    AND sm.branch_id IS NOT NULL
  GROUP BY sm.reference_id
  HAVING COUNT(DISTINCT sm.branch_id) = 1
)
UPDATE public.production_work_orders wo
SET branch_id = wo_stock_branch_map.branch_id
FROM wo_stock_branch_map
WHERE wo.id = wo_stock_branch_map.wo_id
  AND wo.branch_id IS NULL;

WITH bom_wo_branch_map AS (
  SELECT
    wo.bom_id,
    MIN(wo.branch_id::text)::UUID AS branch_id
  FROM public.production_work_orders wo
  WHERE wo.branch_id IS NOT NULL
  GROUP BY wo.bom_id
  HAVING COUNT(DISTINCT wo.branch_id) = 1
)
UPDATE public.production_boms b
SET branch_id = bom_wo_branch_map.branch_id
FROM bom_wo_branch_map
WHERE b.id = bom_wo_branch_map.bom_id
  AND b.branch_id IS NULL;

UPDATE public.production_work_orders wo
SET branch_id = b.branch_id
FROM public.production_boms b
WHERE wo.bom_id = b.id
  AND wo.branch_id IS NULL
  AND b.branch_id IS NOT NULL;

UPDATE public.production_work_orders wo
SET branch_id = public.resolve_single_active_branch(wo.org_id)
WHERE wo.branch_id IS NULL
  AND public.resolve_single_active_branch(wo.org_id) IS NOT NULL;

WITH bom_wo_branch_map AS (
  SELECT
    wo.bom_id,
    MIN(wo.branch_id::text)::UUID AS branch_id
  FROM public.production_work_orders wo
  WHERE wo.branch_id IS NOT NULL
  GROUP BY wo.bom_id
  HAVING COUNT(DISTINCT wo.branch_id) = 1
)
UPDATE public.production_boms b
SET branch_id = bom_wo_branch_map.branch_id
FROM bom_wo_branch_map
WHERE b.id = bom_wo_branch_map.bom_id
  AND b.branch_id IS NULL;

UPDATE public.production_boms b
SET branch_id = public.resolve_single_active_branch(b.org_id)
WHERE b.branch_id IS NULL
  AND public.resolve_single_active_branch(b.org_id) IS NOT NULL;

UPDATE public.purchase_requests pr
SET branch_id = wo.branch_id
FROM public.production_work_orders wo
WHERE pr.source_type = 'MANUFACTURING'
  AND pr.source_id = wo.id
  AND pr.branch_id IS NULL
  AND wo.branch_id IS NOT NULL;

UPDATE public.journal_entries je
SET branch_id = wo.branch_id
FROM public.production_work_orders wo
WHERE je.reference_type = 'PRODUCTION'
  AND je.reference_id = wo.id
  AND (je.branch_id IS NULL OR je.branch_id IS DISTINCT FROM wo.branch_id)
  AND wo.branch_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.resolve_stock_movement_branch_id(
  p_reference_type TEXT,
  p_reference_id UUID,
  p_warehouse_id UUID DEFAULT NULL,
  p_org_id UUID DEFAULT NULL
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

    WHEN 'PRODUCTION_OUTPUT' THEN
      SELECT branch_id INTO v_branch_id
      FROM public.production_work_orders
      WHERE id = p_reference_id;

      IF v_branch_id IS NULL THEN
        SELECT
          CASE
            WHEN COUNT(DISTINCT branch_id) = 1 THEN MIN(branch_id::text)::UUID
            ELSE NULL
          END
        INTO v_branch_id
        FROM public.stock_movements
        WHERE reference_id = p_reference_id
          AND reference_type IN ('PRODUCTION_OUTPUT', 'PRODUCTION_CONSUMPTION')
          AND branch_id IS NOT NULL;
      END IF;

    WHEN 'PRODUCTION_CONSUMPTION' THEN
      SELECT branch_id INTO v_branch_id
      FROM public.production_work_orders
      WHERE id = p_reference_id;

      IF v_branch_id IS NULL THEN
        SELECT
          CASE
            WHEN COUNT(DISTINCT branch_id) = 1 THEN MIN(branch_id::text)::UUID
            ELSE NULL
          END
        INTO v_branch_id
        FROM public.stock_movements
        WHERE reference_id = p_reference_id
          AND reference_type IN ('PRODUCTION_OUTPUT', 'PRODUCTION_CONSUMPTION')
          AND branch_id IS NOT NULL;
      END IF;

    ELSE
      v_branch_id := NULL;
  END CASE;

  IF v_branch_id IS NULL AND p_org_id IS NOT NULL THEN
    v_branch_id := public.resolve_single_active_branch(p_org_id);
  END IF;

  RETURN v_branch_id;
END;
$$;

UPDATE public.stock_movements sm
SET branch_id = public.resolve_stock_movement_branch_id(
  sm.reference_type,
  sm.reference_id,
  NULL,
  sm.org_id
)
WHERE sm.reference_type IN ('PRODUCTION_OUTPUT', 'PRODUCTION_CONSUMPTION')
  AND (sm.branch_id IS NULL OR EXISTS (
    SELECT 1
    FROM public.production_work_orders wo
    WHERE wo.id = sm.reference_id
      AND wo.branch_id IS NOT NULL
      AND sm.branch_id IS DISTINCT FROM wo.branch_id
  ));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.production_work_orders
    WHERE branch_id IS NULL
  ) THEN
    ALTER TABLE public.production_work_orders
      ALTER COLUMN branch_id SET NOT NULL;
  END IF;
END $$;

DROP POLICY IF EXISTS "members_can_view_production" ON public.production_boms;
CREATE POLICY "members_can_view_production"
  ON public.production_boms FOR SELECT
  USING (
    org_id IN (SELECT get_my_org_ids())
    AND (branch_id IS NULL OR public.can_access_branch(org_id, branch_id))
  );

DROP POLICY IF EXISTS "admins_can_manage_production" ON public.production_boms;
CREATE POLICY "admins_can_manage_production"
  ON public.production_boms FOR ALL
  USING (
    org_id IN (
      SELECT org_id
      FROM public.org_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
        AND is_active = TRUE
    )
    AND (branch_id IS NULL OR public.can_access_branch(org_id, branch_id))
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id
      FROM public.org_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
        AND is_active = TRUE
    )
    AND (branch_id IS NULL OR public.can_access_branch(org_id, branch_id))
  );

DROP POLICY IF EXISTS "members_can_view_bom_items" ON public.production_bom_items;
CREATE POLICY "members_can_view_bom_items"
  ON public.production_bom_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.production_boms b
      WHERE b.id = bom_id
        AND b.org_id IN (SELECT get_my_org_ids())
        AND (b.branch_id IS NULL OR public.can_access_branch(b.org_id, b.branch_id))
    )
  );

DROP POLICY IF EXISTS "admins_can_manage_bom_items" ON public.production_bom_items;
CREATE POLICY "admins_can_manage_bom_items"
  ON public.production_bom_items FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.production_boms b
      JOIN public.org_members om ON om.org_id = b.org_id
      WHERE b.id = bom_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'manager')
        AND om.is_active = TRUE
        AND (b.branch_id IS NULL OR public.can_access_branch(b.org_id, b.branch_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.production_boms b
      JOIN public.org_members om ON om.org_id = b.org_id
      WHERE b.id = bom_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'manager')
        AND om.is_active = TRUE
        AND (b.branch_id IS NULL OR public.can_access_branch(b.org_id, b.branch_id))
    )
  );

DROP POLICY IF EXISTS "members_can_view_wo" ON public.production_work_orders;
CREATE POLICY "members_can_view_wo"
  ON public.production_work_orders FOR SELECT
  USING (
    org_id IN (SELECT get_my_org_ids())
    AND branch_id IS NOT NULL
    AND public.can_access_branch(org_id, branch_id)
  );

DROP POLICY IF EXISTS "admins_can_manage_wo" ON public.production_work_orders;
CREATE POLICY "admins_can_manage_wo"
  ON public.production_work_orders FOR ALL
  USING (
    org_id IN (
      SELECT org_id
      FROM public.org_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
        AND is_active = TRUE
    )
    AND branch_id IS NOT NULL
    AND public.can_access_branch(org_id, branch_id)
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id
      FROM public.org_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
        AND is_active = TRUE
    )
    AND branch_id IS NOT NULL
    AND public.can_access_branch(org_id, branch_id)
  );

DROP POLICY IF EXISTS "members_can_view_wo_costs" ON public.production_wo_costs;
CREATE POLICY "members_can_view_wo_costs"
  ON public.production_wo_costs FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.production_work_orders wo
      WHERE wo.id = production_wo_costs.wo_id
        AND wo.org_id IN (SELECT get_my_org_ids())
        AND wo.branch_id IS NOT NULL
        AND public.can_access_branch(wo.org_id, wo.branch_id)
    )
  );

DROP POLICY IF EXISTS "admins_can_manage_wo_costs" ON public.production_wo_costs;
CREATE POLICY "admins_can_manage_wo_costs"
  ON public.production_wo_costs FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.production_work_orders wo
      JOIN public.org_members om ON om.org_id = wo.org_id
      WHERE wo.id = production_wo_costs.wo_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'manager')
        AND om.is_active = TRUE
        AND wo.branch_id IS NOT NULL
        AND public.can_access_branch(wo.org_id, wo.branch_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.production_work_orders wo
      JOIN public.org_members om ON om.org_id = wo.org_id
      WHERE wo.id = production_wo_costs.wo_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'manager')
        AND om.is_active = TRUE
        AND wo.branch_id IS NOT NULL
        AND public.can_access_branch(wo.org_id, wo.branch_id)
    )
  );

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
      SELECT bi.*, p.asset_account_id as rm_account, p.name as product_name
      FROM public.production_bom_items bi
      JOIN public.products p ON p.id = bi.product_id
      WHERE bi.bom_id = v_wo.bom_id
    ) LOOP
        DECLARE
            v_qty_to_consume NUMERIC(20, 4) := v_item.quantity * v_wo.quantity_planned;
            v_unit_cost NUMERIC(20, 2);
            v_rm_account UUID := v_item.rm_account;
        BEGIN
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
        ON CONFLICT (product_id, warehouse_id, batch_number) DO UPDATE
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
      SELECT bi.*, p.asset_account_id as rm_account, p.name as product_name
      FROM public.production_bom_items bi
      JOIN public.products p ON p.id = bi.product_id
      WHERE bi.bom_id = v_wo.bom_id
    ) LOOP
        DECLARE
            v_qty_to_consume NUMERIC(20, 4) := v_item.quantity * v_wo.quantity_planned;
            v_unit_cost NUMERIC(20, 2);
            v_rm_account UUID := v_item.rm_account;
        BEGIN
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

CREATE OR REPLACE VIEW public.factory_branch_backfill_audit AS
SELECT
  'production_work_orders'::TEXT AS source_table,
  wo.org_id,
  NULL::TEXT AS reference_type,
  COUNT(*)::BIGINT AS unresolved_count
FROM public.production_work_orders wo
WHERE wo.branch_id IS NULL
GROUP BY wo.org_id

UNION ALL

SELECT
  'journal_entries'::TEXT AS source_table,
  wo.org_id,
  'PRODUCTION'::TEXT AS reference_type,
  COUNT(*)::BIGINT AS unresolved_count
FROM public.journal_entries je
JOIN public.production_work_orders wo ON wo.id = je.reference_id
WHERE je.reference_type = 'PRODUCTION'
  AND (wo.branch_id IS NULL OR je.branch_id IS DISTINCT FROM wo.branch_id)
GROUP BY wo.org_id

UNION ALL

SELECT
  'stock_movements'::TEXT AS source_table,
  wo.org_id,
  sm.reference_type,
  COUNT(*)::BIGINT AS unresolved_count
FROM public.stock_movements sm
JOIN public.production_work_orders wo ON wo.id = sm.reference_id
WHERE sm.reference_type IN ('PRODUCTION_OUTPUT', 'PRODUCTION_CONSUMPTION')
  AND (wo.branch_id IS NULL OR sm.branch_id IS DISTINCT FROM wo.branch_id)
GROUP BY wo.org_id, sm.reference_type;

NOTIFY pgrst, 'reload schema';
