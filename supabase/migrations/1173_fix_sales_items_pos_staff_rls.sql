-- ============================================================
-- MIGRATION 1173: Fix Sales Items RLS for POS Staff
-- ============================================================
-- Why:
-- Pada flow POS, header penjualan (sales) bisa lolos karena policy branch-aware,
-- tetapi insert line item (sales_items) masih bisa ditolak RLS untuk beberapa
-- kombinasi role legacy/custom role, sehingga muncul error:
-- "new row violates row-level security policy for table sales_items".
--
-- This migration:
-- 1) Menyelaraskan policy sales_items dengan pola branch-aware.
-- 2) Tetap mendukung custom role berbasis permission sales:read/sales:write.
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
        public.nizam_has_any_permission(s.org_id, ARRAY['sales:read', 'sales:write'])
        OR public.nizam_member_has_any_role(s.org_id, ARRAY['owner', 'admin', 'manager', 'staff'])
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
        public.nizam_has_any_permission(s.org_id, ARRAY['sales:write'])
        OR public.nizam_member_has_any_role(s.org_id, ARRAY['owner', 'admin', 'manager', 'staff'])
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
        public.nizam_has_any_permission(s.org_id, ARRAY['sales:write'])
        OR public.nizam_member_has_any_role(s.org_id, ARRAY['owner', 'admin', 'manager', 'staff'])
      )
  )
);

NOTIFY pgrst, 'reload schema';
