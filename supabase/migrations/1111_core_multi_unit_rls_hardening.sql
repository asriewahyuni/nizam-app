-- ============================================================
-- MIGRATION 1111: Core Multi-Unit RLS Hardening
-- Enforce branch-aware access on core transactional tables and
-- backfill a deterministic default branch for legacy orgs/data.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_default_branch_id(p_org_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id
  FROM public.branches b
  WHERE b.org_id = p_org_id
  ORDER BY
    CASE
      WHEN b.is_active = TRUE AND (b.code = 'MAIN' OR b.name = 'Unit Utama') THEN 0
      WHEN b.is_active = TRUE THEN 1
      WHEN b.code = 'MAIN' OR b.name = 'Unit Utama' THEN 2
      ELSE 3
    END,
    b.created_at ASC,
    b.id ASC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.can_access_branch_or_default(p_org_id UUID, p_branch_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_org_id IS NULL THEN FALSE
    WHEN COALESCE(p_branch_id, public.get_default_branch_id(p_org_id)) IS NULL THEN FALSE
    ELSE public.can_access_branch(
      p_org_id,
      COALESCE(p_branch_id, public.get_default_branch_id(p_org_id))
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.set_default_branch_context()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.branch_id IS NULL THEN
    NEW.branch_id := public.get_default_branch_id(NEW.org_id);
  END IF;

  IF NEW.branch_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.branches b
       WHERE b.id = NEW.branch_id
         AND b.org_id = NEW.org_id
     ) THEN
    RAISE EXCEPTION 'branch_id % tidak valid untuk organisasi %', NEW.branch_id, NEW.org_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_sales_item_branch_context()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_org_id UUID;
  v_sale_branch_id UUID;
BEGIN
  SELECT s.org_id, s.branch_id
  INTO v_sale_org_id, v_sale_branch_id
  FROM public.sales s
  WHERE s.id = NEW.sale_id;

  IF v_sale_org_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.org_id IS DISTINCT FROM v_sale_org_id THEN
    RAISE EXCEPTION 'sale_id % tidak valid untuk organisasi %', NEW.sale_id, NEW.org_id;
  END IF;

  IF NEW.branch_id IS NULL THEN
    NEW.branch_id := COALESCE(v_sale_branch_id, public.get_default_branch_id(NEW.org_id));
  END IF;

  IF v_sale_branch_id IS NOT NULL AND NEW.branch_id IS DISTINCT FROM v_sale_branch_id THEN
    RAISE EXCEPTION 'branch_id sales item % harus sama dengan branch sales %', NEW.branch_id, v_sale_branch_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure every organization has at least one usable branch.
INSERT INTO public.branches (org_id, name, code, address, is_active)
SELECT
  o.id,
  'Unit Utama',
  'MAIN',
  NULL,
  TRUE
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1
  FROM public.branches b
  WHERE b.org_id = o.id
);

WITH zero_active_branch_orgs AS (
  SELECT b.org_id
  FROM public.branches b
  GROUP BY b.org_id
  HAVING COUNT(*) FILTER (WHERE b.is_active = TRUE) = 0
),
preferred_branches AS (
  SELECT DISTINCT ON (b.org_id)
    b.id
  FROM public.branches b
  JOIN zero_active_branch_orgs z
    ON z.org_id = b.org_id
  ORDER BY
    b.org_id,
    CASE
      WHEN b.code = 'MAIN' OR b.name = 'Unit Utama' THEN 0
      ELSE 1
    END,
    b.created_at ASC,
    b.id ASC
)
UPDATE public.branches b
SET
  is_active = TRUE,
  updated_at = NOW()
FROM preferred_branches p
WHERE b.id = p.id;

-- Legacy backfill: make sure branch-aware tables point to a usable branch.
UPDATE public.warehouses w
SET branch_id = public.get_default_branch_id(w.org_id)
WHERE w.branch_id IS NULL
  AND public.get_default_branch_id(w.org_id) IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'purchases'
      AND column_name = 'warehouse_id'
  ) THEN
    UPDATE public.purchases p
    SET branch_id = COALESCE(
      w.branch_id,
      public.get_default_branch_id(p.org_id)
    )
    FROM public.warehouses w
    WHERE p.branch_id IS NULL
      AND p.warehouse_id = w.id;
  END IF;
END $$;

UPDATE public.purchases p
SET branch_id = public.get_default_branch_id(p.org_id)
WHERE p.branch_id IS NULL
  AND public.get_default_branch_id(p.org_id) IS NOT NULL;

UPDATE public.purchase_requests pr
SET branch_id = public.get_default_branch_id(pr.org_id)
WHERE pr.branch_id IS NULL
  AND public.get_default_branch_id(pr.org_id) IS NOT NULL;

UPDATE public.sales s
SET branch_id = public.get_default_branch_id(s.org_id)
WHERE s.branch_id IS NULL
  AND public.get_default_branch_id(s.org_id) IS NOT NULL;

UPDATE public.sales_items si
SET branch_id = COALESCE(
  s.branch_id,
  public.get_default_branch_id(si.org_id)
)
FROM public.sales s
WHERE si.sale_id = s.id
  AND si.branch_id IS NULL;

UPDATE public.sales_returns sr
SET branch_id = COALESCE(
  s.branch_id,
  public.get_default_branch_id(sr.org_id)
)
FROM public.sales s
WHERE sr.sale_id = s.id
  AND sr.branch_id IS NULL;

UPDATE public.sales_returns sr
SET branch_id = public.get_default_branch_id(sr.org_id)
WHERE sr.branch_id IS NULL
  AND public.get_default_branch_id(sr.org_id) IS NOT NULL;

UPDATE public.sales_payments sp
SET branch_id = COALESCE(
  s.branch_id,
  public.get_default_branch_id(sp.org_id)
)
FROM public.sales s
WHERE sp.sale_id = s.id
  AND sp.branch_id IS NULL;

UPDATE public.sales_payments sp
SET branch_id = public.get_default_branch_id(sp.org_id)
WHERE sp.branch_id IS NULL
  AND public.get_default_branch_id(sp.org_id) IS NOT NULL;

UPDATE public.approval_requests ar
SET branch_id = p.branch_id
FROM public.purchases p
WHERE ar.source_type = 'PURCHASE_ORDER'
  AND ar.source_id = p.id
  AND ar.branch_id IS NULL
  AND p.branch_id IS NOT NULL;

UPDATE public.approval_requests ar
SET branch_id = s.branch_id
FROM public.sales s
WHERE ar.source_type = 'SALES_ORDER'
  AND ar.source_id = s.id
  AND ar.branch_id IS NULL
  AND s.branch_id IS NOT NULL;

UPDATE public.approval_requests ar
SET branch_id = sr.branch_id
FROM public.sales_returns sr
WHERE ar.source_type = 'SALES_RETURN'
  AND ar.source_id = sr.id
  AND ar.branch_id IS NULL
  AND sr.branch_id IS NOT NULL;

UPDATE public.approval_requests ar
SET branch_id = sp.branch_id
FROM public.sales_payments sp
WHERE ar.source_type = 'PAYMENT_IN'
  AND ar.source_id = sp.id
  AND ar.branch_id IS NULL
  AND sp.branch_id IS NOT NULL;

UPDATE public.approval_requests ar
SET branch_id = pr.branch_id
FROM public.purchase_requests pr
WHERE ar.source_type = 'PURCHASE_REQUEST'
  AND ar.source_id = pr.id
  AND ar.branch_id IS NULL
  AND pr.branch_id IS NOT NULL;

UPDATE public.approval_requests ar
SET branch_id = public.get_default_branch_id(ar.org_id)
WHERE ar.branch_id IS NULL
  AND public.get_default_branch_id(ar.org_id) IS NOT NULL;

UPDATE public.journal_entries je
SET branch_id = s.branch_id
FROM public.sales s
WHERE je.reference_type = 'SALE'
  AND je.reference_id = s.id
  AND je.branch_id IS NULL
  AND s.branch_id IS NOT NULL;

UPDATE public.journal_entries je
SET branch_id = sr.branch_id
FROM public.sales_returns sr
WHERE je.reference_type = 'SALES_RETURN'
  AND je.reference_id = sr.id
  AND je.branch_id IS NULL
  AND sr.branch_id IS NOT NULL;

UPDATE public.journal_entries je
SET branch_id = sp.branch_id
FROM public.sales_payments sp
WHERE je.reference_type = 'PAYMENT_IN'
  AND je.reference_id = sp.id
  AND je.branch_id IS NULL
  AND sp.branch_id IS NOT NULL;

UPDATE public.journal_entries je
SET branch_id = p.branch_id
FROM public.purchases p
WHERE je.reference_type = 'PURCHASE'
  AND je.reference_id = p.id
  AND je.branch_id IS NULL
  AND p.branch_id IS NOT NULL;

UPDATE public.journal_entries je
SET branch_id = p.branch_id
FROM public.purchase_returns pr
JOIN public.purchases p
  ON p.id = pr.purchase_id
WHERE je.reference_type = 'PURCHASE_RETURN'
  AND je.reference_id = pr.id
  AND je.branch_id IS NULL
  AND p.branch_id IS NOT NULL;

UPDATE public.journal_entries je
SET branch_id = public.get_default_branch_id(je.org_id)
WHERE je.branch_id IS NULL
  AND public.get_default_branch_id(je.org_id) IS NOT NULL;

-- Legacy membership safety: if a non-admin member still has no unit
-- assignment, pin them to the org default branch.
INSERT INTO public.org_member_units (org_member_id, org_id, branch_id)
SELECT
  om.id,
  om.org_id,
  public.get_default_branch_id(om.org_id)
FROM public.org_members om
WHERE om.is_active = TRUE
  AND om.role NOT IN ('owner', 'admin')
  AND public.get_default_branch_id(om.org_id) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.org_member_units omu
    WHERE omu.org_member_id = om.id
  )
ON CONFLICT (org_member_id, branch_id) DO NOTHING;

-- Default branch context for future legacy inserts.
CREATE OR REPLACE FUNCTION public.set_journal_entry_default_branch_context()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.branch_id IS NULL THEN
    NEW.branch_id := public.get_default_branch_id(NEW.org_id);
  END IF;

  IF NEW.branch_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.branches b
       WHERE b.id = NEW.branch_id
         AND b.org_id = NEW.org_id
     ) THEN
    RAISE EXCEPTION 'branch_id % tidak valid untuk organisasi %', NEW.branch_id, NEW.org_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sales_default_branch_context ON public.sales;
CREATE TRIGGER trg_sales_default_branch_context
  BEFORE INSERT OR UPDATE OF org_id, branch_id
  ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.set_default_branch_context();

DROP TRIGGER IF EXISTS trg_purchases_default_branch_context ON public.purchases;
CREATE TRIGGER trg_purchases_default_branch_context
  BEFORE INSERT OR UPDATE OF org_id, branch_id
  ON public.purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.set_default_branch_context();

DROP TRIGGER IF EXISTS trg_purchase_requests_default_branch_context ON public.purchase_requests;
CREATE TRIGGER trg_purchase_requests_default_branch_context
  BEFORE INSERT OR UPDATE OF org_id, branch_id
  ON public.purchase_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_default_branch_context();

DROP TRIGGER IF EXISTS trg_sales_returns_default_branch_context ON public.sales_returns;
CREATE TRIGGER trg_sales_returns_default_branch_context
  BEFORE INSERT OR UPDATE OF org_id, branch_id
  ON public.sales_returns
  FOR EACH ROW
  EXECUTE FUNCTION public.set_default_branch_context();

DROP TRIGGER IF EXISTS trg_sales_payments_default_branch_context ON public.sales_payments;
CREATE TRIGGER trg_sales_payments_default_branch_context
  BEFORE INSERT OR UPDATE OF org_id, branch_id
  ON public.sales_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_default_branch_context();

DROP TRIGGER IF EXISTS trg_approval_requests_default_branch_context ON public.approval_requests;
CREATE TRIGGER trg_approval_requests_default_branch_context
  BEFORE INSERT OR UPDATE OF org_id, branch_id
  ON public.approval_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_default_branch_context();

DROP TRIGGER IF EXISTS trg_warehouses_default_branch_context ON public.warehouses;
CREATE TRIGGER trg_warehouses_default_branch_context
  BEFORE INSERT OR UPDATE OF org_id, branch_id
  ON public.warehouses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_default_branch_context();

DROP TRIGGER IF EXISTS trg_sales_items_branch_context ON public.sales_items;
CREATE TRIGGER trg_sales_items_branch_context
  BEFORE INSERT OR UPDATE OF org_id, sale_id, branch_id
  ON public.sales_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_sales_item_branch_context();

-- Branch-aware policies for core transactional tables.
DROP POLICY IF EXISTS "members_can_view_sales" ON public.sales;
DROP POLICY IF EXISTS "members_can_insert_sales" ON public.sales;
DROP POLICY IF EXISTS "members_can_update_sales" ON public.sales;
DROP POLICY IF EXISTS "members_can_delete_sales" ON public.sales;

CREATE POLICY "members_can_view_sales"
  ON public.sales FOR SELECT
  USING (public.can_access_branch_or_default(org_id, branch_id));

CREATE POLICY "members_can_insert_sales"
  ON public.sales FOR INSERT
  WITH CHECK (public.can_access_branch_or_default(org_id, branch_id));

CREATE POLICY "members_can_update_sales"
  ON public.sales FOR UPDATE
  USING (public.can_access_branch_or_default(org_id, branch_id))
  WITH CHECK (public.can_access_branch_or_default(org_id, branch_id));

CREATE POLICY "members_can_delete_sales"
  ON public.sales FOR DELETE
  USING (public.can_access_branch_or_default(org_id, branch_id));

DROP POLICY IF EXISTS "members_can_view_purchases" ON public.purchases;
DROP POLICY IF EXISTS "members_can_insert_purchases" ON public.purchases;
DROP POLICY IF EXISTS "members_can_update_purchases" ON public.purchases;
DROP POLICY IF EXISTS "members_can_delete_purchases" ON public.purchases;

CREATE POLICY "members_can_view_purchases"
  ON public.purchases FOR SELECT
  USING (public.can_access_branch_or_default(org_id, branch_id));

CREATE POLICY "members_can_insert_purchases"
  ON public.purchases FOR INSERT
  WITH CHECK (public.can_access_branch_or_default(org_id, branch_id));

CREATE POLICY "members_can_update_purchases"
  ON public.purchases FOR UPDATE
  USING (public.can_access_branch_or_default(org_id, branch_id))
  WITH CHECK (public.can_access_branch_or_default(org_id, branch_id));

CREATE POLICY "members_can_delete_purchases"
  ON public.purchases FOR DELETE
  USING (public.can_access_branch_or_default(org_id, branch_id));

DROP POLICY IF EXISTS "members_can_view_requests" ON public.purchase_requests;
DROP POLICY IF EXISTS "members_can_create_requests" ON public.purchase_requests;
DROP POLICY IF EXISTS "members_can_update_requests" ON public.purchase_requests;

CREATE POLICY "members_can_view_requests"
  ON public.purchase_requests FOR SELECT
  USING (public.can_access_branch_or_default(org_id, branch_id));

CREATE POLICY "members_can_create_requests"
  ON public.purchase_requests FOR INSERT
  WITH CHECK (public.can_access_branch_or_default(org_id, branch_id));

CREATE POLICY "members_can_update_requests"
  ON public.purchase_requests FOR UPDATE
  USING (public.can_access_branch_or_default(org_id, branch_id))
  WITH CHECK (public.can_access_branch_or_default(org_id, branch_id));

DROP POLICY IF EXISTS "members_can_view_relevant_approvals" ON public.approval_requests;
DROP POLICY IF EXISTS "members_can_create_approvals" ON public.approval_requests;

CREATE POLICY "members_can_view_relevant_approvals"
  ON public.approval_requests FOR SELECT
  USING (public.can_access_branch_or_default(org_id, branch_id));

CREATE POLICY "members_can_create_approvals"
  ON public.approval_requests FOR INSERT
  WITH CHECK (public.can_access_branch_or_default(org_id, branch_id));

DROP POLICY IF EXISTS "members_can_view_warehouses" ON public.warehouses;
DROP POLICY IF EXISTS "admins_can_manage_warehouses" ON public.warehouses;

CREATE POLICY "members_can_view_warehouses"
  ON public.warehouses FOR SELECT
  USING (public.can_access_branch_or_default(org_id, branch_id));

CREATE POLICY "admins_can_manage_warehouses"
  ON public.warehouses FOR ALL
  USING (
    public.can_access_branch_or_default(org_id, branch_id)
    AND EXISTS (
      SELECT 1
      FROM public.org_members om
      WHERE om.org_id = public.warehouses.org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'manager')
        AND om.is_active = TRUE
    )
  )
  WITH CHECK (
    public.can_access_branch_or_default(org_id, branch_id)
    AND EXISTS (
      SELECT 1
      FROM public.org_members om
      WHERE om.org_id = public.warehouses.org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'manager')
        AND om.is_active = TRUE
    )
  );

DROP POLICY IF EXISTS "members_can_view_journal" ON public.journal_entries;
DROP POLICY IF EXISTS "staff_can_create_draft_journal" ON public.journal_entries;
DROP POLICY IF EXISTS "managers_can_post_or_void" ON public.journal_entries;

CREATE POLICY "members_can_view_journal"
  ON public.journal_entries FOR SELECT
  USING (public.can_access_branch_or_default(org_id, branch_id));

CREATE POLICY "staff_can_create_draft_journal"
  ON public.journal_entries FOR INSERT
  WITH CHECK (
    public.can_access_branch_or_default(org_id, branch_id)
    AND EXISTS (
      SELECT 1
      FROM public.org_members om
      WHERE om.org_id = public.journal_entries.org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'manager', 'staff')
        AND om.is_active = TRUE
    )
  );

CREATE POLICY "managers_can_post_or_void"
  ON public.journal_entries FOR UPDATE
  USING (
    public.can_access_branch_or_default(org_id, branch_id)
    AND EXISTS (
      SELECT 1
      FROM public.org_members om
      WHERE om.org_id = public.journal_entries.org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'manager')
        AND om.is_active = TRUE
    )
  )
  WITH CHECK (
    public.can_access_branch_or_default(org_id, branch_id)
    AND EXISTS (
      SELECT 1
      FROM public.org_members om
      WHERE om.org_id = public.journal_entries.org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'manager')
        AND om.is_active = TRUE
    )
  );

DROP POLICY IF EXISTS "members_can_view_journal_lines" ON public.journal_lines;
DROP POLICY IF EXISTS "staff_can_manage_draft_lines" ON public.journal_lines;

CREATE POLICY "members_can_view_journal_lines"
  ON public.journal_lines FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.journal_entries je
      WHERE je.id = public.journal_lines.entry_id
        AND public.can_access_branch_or_default(je.org_id, je.branch_id)
    )
  );

CREATE POLICY "staff_can_manage_draft_lines"
  ON public.journal_lines FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.journal_entries je
      JOIN public.org_members om
        ON om.org_id = je.org_id
      WHERE je.id = public.journal_lines.entry_id
        AND je.status = 'DRAFT'
        AND public.can_access_branch_or_default(je.org_id, je.branch_id)
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'manager', 'staff')
        AND om.is_active = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.journal_entries je
      JOIN public.org_members om
        ON om.org_id = je.org_id
      WHERE je.id = public.journal_lines.entry_id
        AND je.status = 'DRAFT'
        AND public.can_access_branch_or_default(je.org_id, je.branch_id)
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'manager', 'staff')
        AND om.is_active = TRUE
    )
  );

DROP POLICY IF EXISTS "members_can_view_payments" ON public.sales_payments;
CREATE POLICY "members_can_view_payments"
  ON public.sales_payments FOR SELECT
  USING (public.can_access_branch_or_default(org_id, branch_id));

DROP POLICY IF EXISTS "members_can_view_returns" ON public.sales_returns;
DROP POLICY IF EXISTS "members_can_manage_returns" ON public.sales_returns;
DROP POLICY IF EXISTS "members_can_view_return_items" ON public.sales_return_items;
DROP POLICY IF EXISTS "members_can_manage_return_items" ON public.sales_return_items;

CREATE POLICY "members_can_view_returns"
  ON public.sales_returns FOR SELECT
  USING (public.can_access_branch_or_default(org_id, branch_id));

CREATE POLICY "members_can_manage_returns"
  ON public.sales_returns FOR ALL
  USING (public.can_access_branch_or_default(org_id, branch_id))
  WITH CHECK (public.can_access_branch_or_default(org_id, branch_id));

CREATE POLICY "members_can_view_return_items"
  ON public.sales_return_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.sales_returns sr
      WHERE sr.id = public.sales_return_items.return_id
        AND public.can_access_branch_or_default(sr.org_id, sr.branch_id)
    )
  );

CREATE POLICY "members_can_manage_return_items"
  ON public.sales_return_items FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.sales_returns sr
      WHERE sr.id = public.sales_return_items.return_id
        AND public.can_access_branch_or_default(sr.org_id, sr.branch_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sales_returns sr
      WHERE sr.id = public.sales_return_items.return_id
        AND public.can_access_branch_or_default(sr.org_id, sr.branch_id)
    )
  );

DROP POLICY IF EXISTS "Org members can view sales items" ON public.sales_items;
DROP POLICY IF EXISTS "Org members can manage sales items" ON public.sales_items;
DROP POLICY IF EXISTS "Org members can view purchase items" ON public.purchase_items;
DROP POLICY IF EXISTS "Org members can manage purchase items" ON public.purchase_items;

CREATE POLICY "Org members can view sales items"
  ON public.sales_items FOR SELECT
  USING (
    public.nizam_has_permission('sales:read', org_id)
    AND EXISTS (
      SELECT 1
      FROM public.sales s
      WHERE s.id = public.sales_items.sale_id
        AND s.org_id = public.sales_items.org_id
        AND public.can_access_branch_or_default(
          s.org_id,
          COALESCE(public.sales_items.branch_id, s.branch_id)
        )
    )
  );

CREATE POLICY "Org members can manage sales items"
  ON public.sales_items FOR ALL
  USING (
    public.nizam_has_permission('sales:write', org_id)
    AND EXISTS (
      SELECT 1
      FROM public.sales s
      WHERE s.id = public.sales_items.sale_id
        AND s.org_id = public.sales_items.org_id
        AND public.can_access_branch_or_default(
          s.org_id,
          COALESCE(public.sales_items.branch_id, s.branch_id)
        )
    )
  )
  WITH CHECK (
    public.nizam_has_permission('sales:write', org_id)
    AND EXISTS (
      SELECT 1
      FROM public.sales s
      WHERE s.id = public.sales_items.sale_id
        AND s.org_id = public.sales_items.org_id
        AND public.can_access_branch_or_default(
          s.org_id,
          COALESCE(public.sales_items.branch_id, s.branch_id)
        )
    )
  );

CREATE POLICY "Org members can view purchase items"
  ON public.purchase_items FOR SELECT
  USING (
    public.nizam_has_permission('purchasing:read', org_id)
    AND EXISTS (
      SELECT 1
      FROM public.purchases p
      WHERE p.id = public.purchase_items.purchase_id
        AND p.org_id = public.purchase_items.org_id
        AND public.can_access_branch_or_default(p.org_id, p.branch_id)
    )
  );

CREATE POLICY "Org members can manage purchase items"
  ON public.purchase_items FOR ALL
  USING (
    public.nizam_has_permission('purchasing:write', org_id)
    AND EXISTS (
      SELECT 1
      FROM public.purchases p
      WHERE p.id = public.purchase_items.purchase_id
        AND p.org_id = public.purchase_items.org_id
        AND public.can_access_branch_or_default(p.org_id, p.branch_id)
    )
  )
  WITH CHECK (
    public.nizam_has_permission('purchasing:write', org_id)
    AND EXISTS (
      SELECT 1
      FROM public.purchases p
      WHERE p.id = public.purchase_items.purchase_id
        AND p.org_id = public.purchase_items.org_id
        AND public.can_access_branch_or_default(p.org_id, p.branch_id)
    )
  );

NOTIFY pgrst, 'reload schema';
