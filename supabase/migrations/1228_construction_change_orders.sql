-- ============================================================
-- MIGRATION 1228: Construction Change Orders
-- Menambahkan register change order untuk proyek konstruksi:
-- - pekerjaan tambah/kurang
-- - revisi desain / substitusi
-- - dampak nilai kontrak, cost, dan waktu
-- ============================================================

CREATE TABLE IF NOT EXISTS public.construction_change_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.construction_projects(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES public.construction_project_stages(id) ON DELETE SET NULL,
  reference_no TEXT,
  title TEXT NOT NULL,
  change_type TEXT NOT NULL DEFAULT 'ADDITIONAL_WORK'
    CHECK (change_type IN ('ADDITIONAL_WORK', 'DEDUCTION', 'SUBSTITUTION', 'TIME_EXTENSION', 'DESIGN_REVISION')),
  status TEXT NOT NULL DEFAULT 'PROPOSED'
    CHECK (status IN ('PROPOSED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'IMPLEMENTED')),
  requested_date DATE NOT NULL DEFAULT CURRENT_DATE,
  approved_date DATE,
  effective_date DATE,
  contract_value_delta NUMERIC(20, 2) NOT NULL DEFAULT 0,
  estimated_cost_delta NUMERIC(20, 2) NOT NULL DEFAULT 0,
  schedule_delta_days INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, reference_no)
);

CREATE INDEX IF NOT EXISTS idx_construction_change_orders_project_status
  ON public.construction_change_orders(project_id, status, requested_date DESC);

CREATE INDEX IF NOT EXISTS idx_construction_change_orders_org_requested
  ON public.construction_change_orders(org_id, requested_date DESC);

CREATE OR REPLACE FUNCTION public.set_construction_child_org_context()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_project_org_id UUID;
  v_stage_project_id UUID;
BEGIN
  SELECT org_id
  INTO v_project_org_id
  FROM public.construction_projects
  WHERE id = NEW.project_id;

  IF v_project_org_id IS NULL THEN
    RAISE EXCEPTION 'Project konstruksi tidak ditemukan.';
  END IF;

  NEW.org_id := v_project_org_id;

  IF TG_TABLE_NAME IN ('construction_budget_items', 'construction_progress_logs', 'construction_change_orders')
     AND NEW.stage_id IS NOT NULL THEN
    SELECT project_id
    INTO v_stage_project_id
    FROM public.construction_project_stages
    WHERE id = NEW.stage_id;

    IF v_stage_project_id IS NULL OR v_stage_project_id IS DISTINCT FROM NEW.project_id THEN
      RAISE EXCEPTION 'Tahap proyek tidak valid untuk project ini.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_construction_change_orders_org_context ON public.construction_change_orders;
CREATE TRIGGER trg_construction_change_orders_org_context
BEFORE INSERT OR UPDATE ON public.construction_change_orders
FOR EACH ROW EXECUTE FUNCTION public.set_construction_child_org_context();

DROP TRIGGER IF EXISTS trg_construction_change_orders_updated_at ON public.construction_change_orders;
CREATE TRIGGER trg_construction_change_orders_updated_at
BEFORE UPDATE ON public.construction_change_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.construction_change_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_can_view_construction_change_orders" ON public.construction_change_orders;
CREATE POLICY "members_can_view_construction_change_orders"
ON public.construction_change_orders
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.org_members
    WHERE public.org_members.org_id = construction_change_orders.org_id
      AND public.org_members.user_id = auth.uid()
      AND public.org_members.is_active = true
  )
);

DROP POLICY IF EXISTS "members_can_manage_construction_change_orders" ON public.construction_change_orders;
CREATE POLICY "members_can_manage_construction_change_orders"
ON public.construction_change_orders
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.org_members
    WHERE public.org_members.org_id = construction_change_orders.org_id
      AND public.org_members.user_id = auth.uid()
      AND public.org_members.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.org_members
    WHERE public.org_members.org_id = construction_change_orders.org_id
      AND public.org_members.user_id = auth.uid()
      AND public.org_members.is_active = true
  )
);
