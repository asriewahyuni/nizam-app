-- ============================================================
-- MIGRATION 1169: Fix Factory Custom Role Policies
-- ============================================================
-- Why:
-- Policy manufaktur lama masih mengandalkan role legacy ('owner','admin','manager')
-- di tabel org_members.role, sehingga custom role berbasis permission
-- (mis. staff dengan factory:write) tetap ditolak RLS saat insert/update SPK/BoM.
--
-- This migration:
-- 1) Mengaktifkan write policy Factory berbasis permission `factory:write`.
-- 2) Menjaga backward compatibility untuk member legacy role `manager`.
-- 3) Tetap menghormati branch access via can_access_branch().

-- BoM header
DROP POLICY IF EXISTS "admins_can_manage_production" ON public.production_boms;
CREATE POLICY "admins_can_manage_production"
  ON public.production_boms
  FOR ALL
  USING (
    (
      public.nizam_has_permission('factory:write', org_id)
      OR EXISTS (
        SELECT 1
        FROM public.org_members om
        WHERE om.user_id = auth.uid()
          AND om.org_id = production_boms.org_id
          AND om.is_active = TRUE
          AND om.role IN ('manager')
      )
    )
    AND (branch_id IS NULL OR public.can_access_branch(org_id, branch_id))
  )
  WITH CHECK (
    (
      public.nizam_has_permission('factory:write', org_id)
      OR EXISTS (
        SELECT 1
        FROM public.org_members om
        WHERE om.user_id = auth.uid()
          AND om.org_id = production_boms.org_id
          AND om.is_active = TRUE
          AND om.role IN ('manager')
      )
    )
    AND (branch_id IS NULL OR public.can_access_branch(org_id, branch_id))
  );

-- BoM items
DROP POLICY IF EXISTS "admins_can_manage_bom_items" ON public.production_bom_items;
CREATE POLICY "admins_can_manage_bom_items"
  ON public.production_bom_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.production_boms b
      WHERE b.id = production_bom_items.bom_id
        AND (
          public.nizam_has_permission('factory:write', b.org_id)
          OR EXISTS (
            SELECT 1
            FROM public.org_members om
            WHERE om.user_id = auth.uid()
              AND om.org_id = b.org_id
              AND om.is_active = TRUE
              AND om.role IN ('manager')
          )
        )
        AND (b.branch_id IS NULL OR public.can_access_branch(b.org_id, b.branch_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.production_boms b
      WHERE b.id = production_bom_items.bom_id
        AND (
          public.nizam_has_permission('factory:write', b.org_id)
          OR EXISTS (
            SELECT 1
            FROM public.org_members om
            WHERE om.user_id = auth.uid()
              AND om.org_id = b.org_id
              AND om.is_active = TRUE
              AND om.role IN ('manager')
          )
        )
        AND (b.branch_id IS NULL OR public.can_access_branch(b.org_id, b.branch_id))
    )
  );

-- Work orders (SPK)
DROP POLICY IF EXISTS "admins_can_manage_wo" ON public.production_work_orders;
CREATE POLICY "admins_can_manage_wo"
  ON public.production_work_orders
  FOR ALL
  USING (
    (
      public.nizam_has_permission('factory:write', org_id)
      OR EXISTS (
        SELECT 1
        FROM public.org_members om
        WHERE om.user_id = auth.uid()
          AND om.org_id = production_work_orders.org_id
          AND om.is_active = TRUE
          AND om.role IN ('manager')
      )
    )
    AND branch_id IS NOT NULL
    AND public.can_access_branch(org_id, branch_id)
  )
  WITH CHECK (
    (
      public.nizam_has_permission('factory:write', org_id)
      OR EXISTS (
        SELECT 1
        FROM public.org_members om
        WHERE om.user_id = auth.uid()
          AND om.org_id = production_work_orders.org_id
          AND om.is_active = TRUE
          AND om.role IN ('manager')
      )
    )
    AND branch_id IS NOT NULL
    AND public.can_access_branch(org_id, branch_id)
  );

-- Work order costs
DROP POLICY IF EXISTS "admins_can_manage_wo_costs" ON public.production_wo_costs;
CREATE POLICY "admins_can_manage_wo_costs"
  ON public.production_wo_costs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.production_work_orders wo
      WHERE wo.id = production_wo_costs.wo_id
        AND (
          public.nizam_has_permission('factory:write', wo.org_id)
          OR EXISTS (
            SELECT 1
            FROM public.org_members om
            WHERE om.user_id = auth.uid()
              AND om.org_id = wo.org_id
              AND om.is_active = TRUE
              AND om.role IN ('manager')
          )
        )
        AND wo.branch_id IS NOT NULL
        AND public.can_access_branch(wo.org_id, wo.branch_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.production_work_orders wo
      WHERE wo.id = production_wo_costs.wo_id
        AND (
          public.nizam_has_permission('factory:write', wo.org_id)
          OR EXISTS (
            SELECT 1
            FROM public.org_members om
            WHERE om.user_id = auth.uid()
              AND om.org_id = wo.org_id
              AND om.is_active = TRUE
              AND om.role IN ('manager')
          )
        )
        AND wo.branch_id IS NOT NULL
        AND public.can_access_branch(wo.org_id, wo.branch_id)
    )
  );

NOTIFY pgrst, 'reload schema';
