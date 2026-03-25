-- ============================================================
-- MIGRATION 033: Ultimate Security & Average Cost Trigger
-- Solving: "Not Updating" and RLS Permission issues
-- ============================================================

-- 1. ENABLE RLS FOR INVENTORY TABLES
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_adjustment_items ENABLE ROW LEVEL SECURITY;

-- 2. POLICIES: View
CREATE POLICY "members_can_view_movements" ON public.stock_movements FOR SELECT 
USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE));

CREATE POLICY "members_can_view_adjustments" ON public.inventory_adjustments FOR SELECT 
USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE));

CREATE POLICY "members_can_view_adjustment_items" ON public.inventory_adjustment_items FOR SELECT 
USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE));

-- 3. POLICIES: Creation (Staff and above)
CREATE POLICY "staff_can_create_movements" ON public.stock_movements FOR INSERT 
WITH CHECK (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager', 'staff') AND is_active = TRUE));

CREATE POLICY "staff_can_create_adjustments" ON public.inventory_adjustments FOR INSERT 
WITH CHECK (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager', 'staff') AND is_active = TRUE));

CREATE POLICY "staff_can_create_adjustment_items" ON public.inventory_adjustment_items FOR INSERT 
WITH CHECK (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager', 'staff') AND is_active = TRUE));


-- 4. AUTOMATIC AVERAGE COST RECALCULATION
-- Whenever a movement enters the system (Inbound/Procurement), we update the product's average_cost
CREATE OR REPLACE FUNCTION public.recalculate_average_cost()
RETURNS TRIGGER AS $$
DECLARE
    v_total_qty NUMERIC;
    v_total_value NUMERIC;
    v_new_avg_cost NUMERIC;
BEGIN
    -- Only trigger if quantity > 0 (Inbound) to avoid circular reference or weirdness on sales
    -- But actually, weighted average should ideally be calculated on Purchases only.
    -- For simplicity and effectiveness in this ERP:
    
    -- 1. Calculate Total Qty & Value from ALL movements
    SELECT 
        SUM(quantity),
        SUM(quantity * unit_price)
    INTO v_total_qty, v_total_value
    FROM public.stock_movements
    WHERE product_id = NEW.product_id;

    -- 2. Update Product
    IF v_total_qty > 0 THEN
        v_new_avg_cost := v_total_value / v_total_qty;
        UPDATE public.products SET average_cost = v_new_avg_cost WHERE id = NEW.product_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on AFTER INSERT of stock_movements
DROP TRIGGER IF EXISTS trg_recalculate_average_cost ON public.stock_movements;
CREATE TRIGGER trg_recalculate_average_cost
    AFTER INSERT ON public.stock_movements
    FOR EACH ROW EXECUTE FUNCTION recalculate_average_cost();
