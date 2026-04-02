-- ============================================================
-- MIGRATION 1086: Fix line item permission names
-- ============================================================
-- Root cause:
-- sales_items and purchase_items policies used dot-based permission names
-- (`sales.view`, `sales.manage`, `purchasing.view`, `purchasing.manage`)
-- while RBAC permissions in this codebase use colon-based names
-- (`sales:read`, `sales:write`, `purchasing:read`, `purchasing:write`).
--
-- Impact:
-- Staff/custom-role users can read purchase/sales headers via org membership,
-- but nested line items are filtered out by RLS.
-- ============================================================

ALTER TABLE public.sales_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view sales items" ON public.sales_items;
DROP POLICY IF EXISTS "Org members can manage sales items" ON public.sales_items;

CREATE POLICY "Org members can view sales items"
ON public.sales_items
FOR SELECT
USING (public.nizam_has_permission('sales:read', org_id));

CREATE POLICY "Org members can manage sales items"
ON public.sales_items
FOR ALL
USING (public.nizam_has_permission('sales:write', org_id))
WITH CHECK (public.nizam_has_permission('sales:write', org_id));

DROP POLICY IF EXISTS "Org members can view purchase items" ON public.purchase_items;
DROP POLICY IF EXISTS "Org members can manage purchase items" ON public.purchase_items;

CREATE POLICY "Org members can view purchase items"
ON public.purchase_items
FOR SELECT
USING (public.nizam_has_permission('purchasing:read', org_id));

CREATE POLICY "Org members can manage purchase items"
ON public.purchase_items
FOR ALL
USING (public.nizam_has_permission('purchasing:write', org_id))
WITH CHECK (public.nizam_has_permission('purchasing:write', org_id));
