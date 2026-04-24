-- ============================================================
-- MIGRATION 1227: Project & Construction Foundation
-- Fondasi modul arsitek/kontraktor:
-- - Master project
-- - Stage proyek
-- - RAB/BoQ item
-- - Progress log lapangan
-- - Termin billing
-- ============================================================

CREATE TABLE IF NOT EXISTS public.construction_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id),
  client_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  project_code TEXT NOT NULL,
  project_name TEXT NOT NULL,
  project_type TEXT NOT NULL DEFAULT 'CONTRACTOR'
    CHECK (project_type IN ('ARCHITECT', 'CONTRACTOR', 'DESIGN_BUILD', 'INTERIOR', 'CONSULTING')),
  project_status TEXT NOT NULL DEFAULT 'PLANNING'
    CHECK (project_status IN ('PLANNING', 'TENDER', 'DESIGN', 'EXECUTION', 'HANDOVER', 'COMPLETED', 'ON_HOLD', 'CANCELLED')),
  site_address TEXT,
  start_date DATE,
  target_end_date DATE,
  actual_end_date DATE,
  contract_value NUMERIC(20, 2) NOT NULL DEFAULT 0,
  estimated_cost NUMERIC(20, 2) NOT NULL DEFAULT 0,
  progress_percent NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, project_code)
);

CREATE TABLE IF NOT EXISTS public.construction_project_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.construction_projects(id) ON DELETE CASCADE,
  stage_code TEXT NOT NULL,
  stage_name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 1,
  weight_percent NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (weight_percent >= 0 AND weight_percent <= 100),
  status TEXT NOT NULL DEFAULT 'NOT_STARTED'
    CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE')),
  planned_start_date DATE,
  planned_end_date DATE,
  actual_start_date DATE,
  actual_end_date DATE,
  progress_percent NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, stage_code),
  UNIQUE(project_id, sort_order)
);

CREATE TABLE IF NOT EXISTS public.construction_budget_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.construction_projects(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES public.construction_project_stages(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'MATERIAL'
    CHECK (category IN ('MATERIAL', 'LABOR', 'SUBCON', 'EQUIPMENT', 'OTHER')),
  description TEXT NOT NULL,
  uom TEXT,
  planned_quantity NUMERIC(18, 3) NOT NULL DEFAULT 0,
  planned_unit_cost NUMERIC(20, 2) NOT NULL DEFAULT 0,
  planned_total NUMERIC(20, 2) NOT NULL DEFAULT 0,
  actual_quantity NUMERIC(18, 3) NOT NULL DEFAULT 0,
  actual_unit_cost NUMERIC(20, 2) NOT NULL DEFAULT 0,
  actual_total NUMERIC(20, 2) NOT NULL DEFAULT 0,
  vendor_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.construction_progress_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.construction_projects(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES public.construction_project_stages(id) ON DELETE SET NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  progress_percent NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  weather TEXT,
  summary TEXT NOT NULL,
  issue_notes TEXT,
  evidence_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.construction_billing_terms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.construction_projects(id) ON DELETE CASCADE,
  term_label TEXT NOT NULL,
  sequence_no INTEGER NOT NULL DEFAULT 1,
  basis_type TEXT NOT NULL DEFAULT 'PROGRESS'
    CHECK (basis_type IN ('DOWN_PAYMENT', 'PROGRESS', 'FINAL', 'RETENTION', 'CUSTOM')),
  progress_target_percent NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (progress_target_percent >= 0 AND progress_target_percent <= 100),
  billing_percent NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (billing_percent >= 0 AND billing_percent <= 100),
  billing_amount NUMERIC(20, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PLANNED'
    CHECK (status IN ('PLANNED', 'READY_TO_BILL', 'BILLED', 'PAID')),
  invoice_reference TEXT,
  due_date DATE,
  paid_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, sequence_no)
);

CREATE INDEX IF NOT EXISTS idx_construction_projects_org_branch
  ON public.construction_projects(org_id, branch_id);

CREATE INDEX IF NOT EXISTS idx_construction_projects_org_status
  ON public.construction_projects(org_id, project_status);

CREATE INDEX IF NOT EXISTS idx_construction_projects_org_type
  ON public.construction_projects(org_id, project_type);

CREATE INDEX IF NOT EXISTS idx_construction_project_stages_project
  ON public.construction_project_stages(project_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_construction_budget_items_project
  ON public.construction_budget_items(project_id, category);

CREATE INDEX IF NOT EXISTS idx_construction_progress_logs_project_date
  ON public.construction_progress_logs(project_id, entry_date DESC);

CREATE INDEX IF NOT EXISTS idx_construction_billing_terms_project
  ON public.construction_billing_terms(project_id, sequence_no);

CREATE INDEX IF NOT EXISTS idx_construction_billing_terms_org_status
  ON public.construction_billing_terms(org_id, status);

CREATE OR REPLACE FUNCTION public.set_construction_project_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF NEW.project_code IS NULL OR btrim(NEW.project_code) = '' THEN
    SELECT COUNT(*) + 1
    INTO v_count
    FROM public.construction_projects
    WHERE org_id = NEW.org_id
      AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());

    NEW.project_code := 'PRJ-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(v_count::TEXT, 5, '0');
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_construction_budget_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.planned_total := COALESCE(NEW.planned_quantity, 0) * COALESCE(NEW.planned_unit_cost, 0);
  NEW.actual_total := COALESCE(NEW.actual_quantity, 0) * COALESCE(NEW.actual_unit_cost, 0);
  RETURN NEW;
END;
$$;

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

  IF TG_TABLE_NAME IN ('construction_budget_items', 'construction_progress_logs') AND NEW.stage_id IS NOT NULL THEN
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

DROP TRIGGER IF EXISTS trg_construction_projects_project_code ON public.construction_projects;
CREATE TRIGGER trg_construction_projects_project_code
BEFORE INSERT ON public.construction_projects
FOR EACH ROW EXECUTE FUNCTION public.set_construction_project_code();

DROP TRIGGER IF EXISTS trg_construction_projects_updated_at ON public.construction_projects;
CREATE TRIGGER trg_construction_projects_updated_at
BEFORE UPDATE ON public.construction_projects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_construction_project_stages_org_context ON public.construction_project_stages;
CREATE TRIGGER trg_construction_project_stages_org_context
BEFORE INSERT OR UPDATE ON public.construction_project_stages
FOR EACH ROW EXECUTE FUNCTION public.set_construction_child_org_context();

DROP TRIGGER IF EXISTS trg_construction_project_stages_updated_at ON public.construction_project_stages;
CREATE TRIGGER trg_construction_project_stages_updated_at
BEFORE UPDATE ON public.construction_project_stages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_construction_budget_items_org_context ON public.construction_budget_items;
CREATE TRIGGER trg_construction_budget_items_org_context
BEFORE INSERT OR UPDATE ON public.construction_budget_items
FOR EACH ROW EXECUTE FUNCTION public.set_construction_child_org_context();

DROP TRIGGER IF EXISTS trg_construction_budget_items_totals ON public.construction_budget_items;
CREATE TRIGGER trg_construction_budget_items_totals
BEFORE INSERT OR UPDATE ON public.construction_budget_items
FOR EACH ROW EXECUTE FUNCTION public.set_construction_budget_totals();

DROP TRIGGER IF EXISTS trg_construction_budget_items_updated_at ON public.construction_budget_items;
CREATE TRIGGER trg_construction_budget_items_updated_at
BEFORE UPDATE ON public.construction_budget_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_construction_progress_logs_org_context ON public.construction_progress_logs;
CREATE TRIGGER trg_construction_progress_logs_org_context
BEFORE INSERT OR UPDATE ON public.construction_progress_logs
FOR EACH ROW EXECUTE FUNCTION public.set_construction_child_org_context();

DROP TRIGGER IF EXISTS trg_construction_billing_terms_org_context ON public.construction_billing_terms;
CREATE TRIGGER trg_construction_billing_terms_org_context
BEFORE INSERT OR UPDATE ON public.construction_billing_terms
FOR EACH ROW EXECUTE FUNCTION public.set_construction_child_org_context();

DROP TRIGGER IF EXISTS trg_construction_billing_terms_updated_at ON public.construction_billing_terms;
CREATE TRIGGER trg_construction_billing_terms_updated_at
BEFORE UPDATE ON public.construction_billing_terms
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.construction_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.construction_project_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.construction_budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.construction_progress_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.construction_billing_terms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_can_view_construction_projects" ON public.construction_projects;
CREATE POLICY "members_can_view_construction_projects"
ON public.construction_projects
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.org_members
    WHERE public.org_members.org_id = construction_projects.org_id
      AND public.org_members.user_id = auth.uid()
      AND public.org_members.is_active = true
  )
);

DROP POLICY IF EXISTS "members_can_manage_construction_projects" ON public.construction_projects;
CREATE POLICY "members_can_manage_construction_projects"
ON public.construction_projects
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.org_members
    WHERE public.org_members.org_id = construction_projects.org_id
      AND public.org_members.user_id = auth.uid()
      AND public.org_members.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.org_members
    WHERE public.org_members.org_id = construction_projects.org_id
      AND public.org_members.user_id = auth.uid()
      AND public.org_members.is_active = true
  )
);

DROP POLICY IF EXISTS "members_can_view_construction_project_stages" ON public.construction_project_stages;
CREATE POLICY "members_can_view_construction_project_stages"
ON public.construction_project_stages
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.org_members
    WHERE public.org_members.org_id = construction_project_stages.org_id
      AND public.org_members.user_id = auth.uid()
      AND public.org_members.is_active = true
  )
);

DROP POLICY IF EXISTS "members_can_manage_construction_project_stages" ON public.construction_project_stages;
CREATE POLICY "members_can_manage_construction_project_stages"
ON public.construction_project_stages
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.org_members
    WHERE public.org_members.org_id = construction_project_stages.org_id
      AND public.org_members.user_id = auth.uid()
      AND public.org_members.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.org_members
    WHERE public.org_members.org_id = construction_project_stages.org_id
      AND public.org_members.user_id = auth.uid()
      AND public.org_members.is_active = true
  )
);

DROP POLICY IF EXISTS "members_can_view_construction_budget_items" ON public.construction_budget_items;
CREATE POLICY "members_can_view_construction_budget_items"
ON public.construction_budget_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.org_members
    WHERE public.org_members.org_id = construction_budget_items.org_id
      AND public.org_members.user_id = auth.uid()
      AND public.org_members.is_active = true
  )
);

DROP POLICY IF EXISTS "members_can_manage_construction_budget_items" ON public.construction_budget_items;
CREATE POLICY "members_can_manage_construction_budget_items"
ON public.construction_budget_items
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.org_members
    WHERE public.org_members.org_id = construction_budget_items.org_id
      AND public.org_members.user_id = auth.uid()
      AND public.org_members.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.org_members
    WHERE public.org_members.org_id = construction_budget_items.org_id
      AND public.org_members.user_id = auth.uid()
      AND public.org_members.is_active = true
  )
);

DROP POLICY IF EXISTS "members_can_view_construction_progress_logs" ON public.construction_progress_logs;
CREATE POLICY "members_can_view_construction_progress_logs"
ON public.construction_progress_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.org_members
    WHERE public.org_members.org_id = construction_progress_logs.org_id
      AND public.org_members.user_id = auth.uid()
      AND public.org_members.is_active = true
  )
);

DROP POLICY IF EXISTS "members_can_manage_construction_progress_logs" ON public.construction_progress_logs;
CREATE POLICY "members_can_manage_construction_progress_logs"
ON public.construction_progress_logs
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.org_members
    WHERE public.org_members.org_id = construction_progress_logs.org_id
      AND public.org_members.user_id = auth.uid()
      AND public.org_members.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.org_members
    WHERE public.org_members.org_id = construction_progress_logs.org_id
      AND public.org_members.user_id = auth.uid()
      AND public.org_members.is_active = true
  )
);

DROP POLICY IF EXISTS "members_can_view_construction_billing_terms" ON public.construction_billing_terms;
CREATE POLICY "members_can_view_construction_billing_terms"
ON public.construction_billing_terms
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.org_members
    WHERE public.org_members.org_id = construction_billing_terms.org_id
      AND public.org_members.user_id = auth.uid()
      AND public.org_members.is_active = true
  )
);

DROP POLICY IF EXISTS "members_can_manage_construction_billing_terms" ON public.construction_billing_terms;
CREATE POLICY "members_can_manage_construction_billing_terms"
ON public.construction_billing_terms
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.org_members
    WHERE public.org_members.org_id = construction_billing_terms.org_id
      AND public.org_members.user_id = auth.uid()
      AND public.org_members.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.org_members
    WHERE public.org_members.org_id = construction_billing_terms.org_id
      AND public.org_members.user_id = auth.uid()
      AND public.org_members.is_active = true
  )
);
