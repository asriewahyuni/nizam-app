-- Migration 1047: Ensure RLS for inventory_stocks
-- Table was created but policies were missing, potentially causing empty joins.

ALTER TABLE public.inventory_stocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_can_view_inventory_stocks" ON public.inventory_stocks;
CREATE POLICY "members_can_view_inventory_stocks" ON public.inventory_stocks FOR SELECT 
USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE));

DROP POLICY IF EXISTS "managers_can_manage_inventory_stocks" ON public.inventory_stocks;
CREATE POLICY "managers_can_manage_inventory_stocks" ON public.inventory_stocks FOR ALL 
USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager') AND is_active = TRUE));
