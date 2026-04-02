-- ============================================================
-- MIGRATION 1094: Services + Fleet Branch Context
-- Makes service orders and fleet operations branch-aware.
-- Also adds branch ownership to fleet crew attendance records.
-- ============================================================

ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);

ALTER TABLE public.fleet_assets
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);

ALTER TABLE public.fleet_bookings
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);

ALTER TABLE public.fleet_routes
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);

ALTER TABLE public.fleet_schedules
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);

ALTER TABLE public.fleet_tickets
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);

ALTER TABLE public.fleet_maintenance_labs
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);

CREATE TABLE IF NOT EXISTS public.fleet_terminals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location_name TEXT,
  gps_coords TEXT,
  radius_meters INTEGER DEFAULT 200,
  qr_code_token TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.fleet_terminals
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_service_orders_org_branch ON public.service_orders(org_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_fleet_assets_org_branch ON public.fleet_assets(org_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_fleet_bookings_org_branch ON public.fleet_bookings(org_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_fleet_routes_org_branch ON public.fleet_routes(org_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_fleet_schedules_org_branch_departure ON public.fleet_schedules(org_id, branch_id, departure_time);
CREATE INDEX IF NOT EXISTS idx_fleet_tickets_org_branch ON public.fleet_tickets(org_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_fleet_maintenance_org_branch_date ON public.fleet_maintenance_labs(org_id, branch_id, service_date);
CREATE INDEX IF NOT EXISTS idx_fleet_terminals_org_branch ON public.fleet_terminals(org_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_employees_org_branch ON public.employees(org_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_attendance_org_branch_date ON public.attendance(org_id, branch_id, record_date);

UPDATE public.service_orders so
SET branch_id = public.resolve_single_active_branch(so.org_id)
WHERE so.branch_id IS NULL
  AND public.resolve_single_active_branch(so.org_id) IS NOT NULL;

UPDATE public.fleet_assets fa
SET branch_id = public.resolve_single_active_branch(fa.org_id)
WHERE fa.branch_id IS NULL
  AND public.resolve_single_active_branch(fa.org_id) IS NOT NULL;

UPDATE public.fleet_routes fr
SET branch_id = public.resolve_single_active_branch(fr.org_id)
WHERE fr.branch_id IS NULL
  AND public.resolve_single_active_branch(fr.org_id) IS NOT NULL;

UPDATE public.fleet_terminals ft
SET branch_id = public.resolve_single_active_branch(ft.org_id)
WHERE ft.branch_id IS NULL
  AND public.resolve_single_active_branch(ft.org_id) IS NOT NULL;

UPDATE public.employees e
SET branch_id = public.resolve_single_active_branch(e.org_id)
WHERE e.branch_id IS NULL
  AND public.resolve_single_active_branch(e.org_id) IS NOT NULL;

UPDATE public.fleet_bookings fb
SET branch_id = COALESCE(
  (SELECT fa.branch_id FROM public.fleet_assets fa WHERE fa.id = fb.asset_id),
  public.resolve_single_active_branch(fb.org_id)
)
WHERE fb.branch_id IS NULL;

UPDATE public.fleet_schedules fs
SET branch_id = COALESCE(
  (SELECT fa.branch_id FROM public.fleet_assets fa WHERE fa.id = fs.asset_id),
  (SELECT fr.branch_id FROM public.fleet_routes fr WHERE fr.id = fs.route_id),
  public.resolve_single_active_branch(fs.org_id)
)
WHERE fs.branch_id IS NULL;

UPDATE public.fleet_tickets ft
SET branch_id = COALESCE(
  (SELECT fs.branch_id FROM public.fleet_schedules fs WHERE fs.id = ft.schedule_id),
  public.resolve_single_active_branch(ft.org_id)
)
WHERE ft.branch_id IS NULL;

UPDATE public.fleet_maintenance_labs fml
SET branch_id = COALESCE(
  (SELECT fa.branch_id FROM public.fleet_assets fa WHERE fa.id = fml.asset_id),
  public.resolve_single_active_branch(fml.org_id)
)
WHERE fml.branch_id IS NULL;

UPDATE public.attendance a
SET branch_id = COALESCE(
  (SELECT e.branch_id FROM public.employees e WHERE e.id = a.employee_id),
  public.resolve_single_active_branch(a.org_id)
)
WHERE a.branch_id IS NULL;

ALTER TABLE public.service_orders
  ALTER COLUMN branch_id SET NOT NULL;

ALTER TABLE public.fleet_assets
  ALTER COLUMN branch_id SET NOT NULL;

ALTER TABLE public.fleet_bookings
  ALTER COLUMN branch_id SET NOT NULL;

ALTER TABLE public.fleet_routes
  ALTER COLUMN branch_id SET NOT NULL;

ALTER TABLE public.fleet_schedules
  ALTER COLUMN branch_id SET NOT NULL;

ALTER TABLE public.fleet_tickets
  ALTER COLUMN branch_id SET NOT NULL;

ALTER TABLE public.fleet_maintenance_labs
  ALTER COLUMN branch_id SET NOT NULL;

ALTER TABLE public.fleet_terminals
  ALTER COLUMN branch_id SET NOT NULL;

CREATE OR REPLACE FUNCTION public.set_fleet_branch_context()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_branch_id UUID;
  v_route_branch_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'fleet_bookings' THEN
    SELECT branch_id INTO v_branch_id
    FROM public.fleet_assets
    WHERE id = NEW.asset_id
      AND org_id = NEW.org_id;

    IF v_branch_id IS NULL THEN
      RAISE EXCEPTION 'Armada tidak ditemukan atau belum memiliki unit.';
    END IF;

    NEW.branch_id := v_branch_id;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'fleet_schedules' THEN
    SELECT branch_id INTO v_branch_id
    FROM public.fleet_assets
    WHERE id = NEW.asset_id
      AND org_id = NEW.org_id;

    SELECT branch_id INTO v_route_branch_id
    FROM public.fleet_routes
    WHERE id = NEW.route_id
      AND org_id = NEW.org_id;

    IF v_branch_id IS NULL OR v_route_branch_id IS NULL THEN
      RAISE EXCEPTION 'Rute atau armada tidak ditemukan atau belum memiliki unit.';
    END IF;

    IF v_branch_id IS DISTINCT FROM v_route_branch_id THEN
      RAISE EXCEPTION 'Rute dan armada harus berada pada unit yang sama.';
    END IF;

    NEW.branch_id := v_branch_id;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'fleet_tickets' THEN
    SELECT branch_id INTO v_branch_id
    FROM public.fleet_schedules
    WHERE id = NEW.schedule_id
      AND org_id = NEW.org_id;

    IF v_branch_id IS NULL THEN
      RAISE EXCEPTION 'Jadwal tidak ditemukan atau belum memiliki unit.';
    END IF;

    NEW.branch_id := v_branch_id;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'fleet_maintenance_labs' THEN
    SELECT branch_id INTO v_branch_id
    FROM public.fleet_assets
    WHERE id = NEW.asset_id
      AND org_id = NEW.org_id;

    IF v_branch_id IS NULL THEN
      RAISE EXCEPTION 'Armada tidak ditemukan atau belum memiliki unit.';
    END IF;

    NEW.branch_id := v_branch_id;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_attendance_branch_context()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_branch_id UUID;
BEGIN
  SELECT branch_id INTO v_branch_id
  FROM public.employees
  WHERE id = NEW.employee_id
    AND org_id = NEW.org_id;

  NEW.branch_id := COALESCE(v_branch_id, NEW.branch_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fleet_bookings_branch_context ON public.fleet_bookings;
CREATE TRIGGER trg_fleet_bookings_branch_context
BEFORE INSERT OR UPDATE OF org_id, asset_id
ON public.fleet_bookings
FOR EACH ROW
EXECUTE FUNCTION public.set_fleet_branch_context();

DROP TRIGGER IF EXISTS trg_fleet_schedules_branch_context ON public.fleet_schedules;
CREATE TRIGGER trg_fleet_schedules_branch_context
BEFORE INSERT OR UPDATE OF org_id, route_id, asset_id
ON public.fleet_schedules
FOR EACH ROW
EXECUTE FUNCTION public.set_fleet_branch_context();

DROP TRIGGER IF EXISTS trg_fleet_tickets_branch_context ON public.fleet_tickets;
CREATE TRIGGER trg_fleet_tickets_branch_context
BEFORE INSERT OR UPDATE OF org_id, schedule_id
ON public.fleet_tickets
FOR EACH ROW
EXECUTE FUNCTION public.set_fleet_branch_context();

DROP TRIGGER IF EXISTS trg_fleet_maintenance_branch_context ON public.fleet_maintenance_labs;
CREATE TRIGGER trg_fleet_maintenance_branch_context
BEFORE INSERT OR UPDATE OF org_id, asset_id
ON public.fleet_maintenance_labs
FOR EACH ROW
EXECUTE FUNCTION public.set_fleet_branch_context();

DROP TRIGGER IF EXISTS trg_attendance_branch_context ON public.attendance;
CREATE TRIGGER trg_attendance_branch_context
BEFORE INSERT OR UPDATE OF org_id, employee_id
ON public.attendance
FOR EACH ROW
EXECUTE FUNCTION public.set_attendance_branch_context();

DROP POLICY IF EXISTS "members_can_view_service_orders" ON public.service_orders;
DROP POLICY IF EXISTS "admins_can_manage_service_orders" ON public.service_orders;
DROP POLICY IF EXISTS "Allow full access to members within same org" ON public.service_orders;
DROP POLICY IF EXISTS "members_can_manage_service_orders" ON public.service_orders;
CREATE POLICY "members_can_view_service_orders"
ON public.service_orders
FOR SELECT
USING (
  public.can_access_branch(org_id, branch_id)
);
CREATE POLICY "members_can_manage_service_orders"
ON public.service_orders
FOR ALL
USING (
  public.can_access_branch(org_id, branch_id)
)
WITH CHECK (
  public.can_access_branch(org_id, branch_id)
);

DROP POLICY IF EXISTS "members_can_view_fleet" ON public.fleet_assets;
DROP POLICY IF EXISTS "admins_can_manage_fleet" ON public.fleet_assets;
CREATE POLICY "members_can_view_fleet"
ON public.fleet_assets
FOR SELECT
USING (
  public.can_access_branch(org_id, branch_id)
);
CREATE POLICY "admins_can_manage_fleet"
ON public.fleet_assets
FOR ALL
USING (
  public.can_access_branch(org_id, branch_id)
  AND org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
      AND is_active = TRUE
  )
)
WITH CHECK (
  public.can_access_branch(org_id, branch_id)
  AND org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
      AND is_active = TRUE
  )
);

DROP POLICY IF EXISTS "members_can_view_bookings" ON public.fleet_bookings;
DROP POLICY IF EXISTS "admins_can_manage_bookings" ON public.fleet_bookings;
CREATE POLICY "members_can_view_bookings"
ON public.fleet_bookings
FOR SELECT
USING (
  public.can_access_branch(org_id, branch_id)
);
CREATE POLICY "admins_can_manage_bookings"
ON public.fleet_bookings
FOR ALL
USING (
  public.can_access_branch(org_id, branch_id)
  AND org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
      AND is_active = TRUE
  )
)
WITH CHECK (
  public.can_access_branch(org_id, branch_id)
  AND org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
      AND is_active = TRUE
  )
);

DROP POLICY IF EXISTS "members_view_routes" ON public.fleet_routes;
DROP POLICY IF EXISTS "admins_manage_routes" ON public.fleet_routes;
CREATE POLICY "members_view_routes"
ON public.fleet_routes
FOR SELECT
USING (
  public.can_access_branch(org_id, branch_id)
);
CREATE POLICY "admins_manage_routes"
ON public.fleet_routes
FOR ALL
USING (
  public.can_access_branch(org_id, branch_id)
  AND org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
      AND is_active = TRUE
  )
)
WITH CHECK (
  public.can_access_branch(org_id, branch_id)
  AND org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
      AND is_active = TRUE
  )
);

DROP POLICY IF EXISTS "members_view_schedules" ON public.fleet_schedules;
DROP POLICY IF EXISTS "admins_manage_schedules" ON public.fleet_schedules;
CREATE POLICY "members_view_schedules"
ON public.fleet_schedules
FOR SELECT
USING (
  public.can_access_branch(org_id, branch_id)
);
CREATE POLICY "admins_manage_schedules"
ON public.fleet_schedules
FOR ALL
USING (
  public.can_access_branch(org_id, branch_id)
  AND org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
      AND is_active = TRUE
  )
)
WITH CHECK (
  public.can_access_branch(org_id, branch_id)
  AND org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
      AND is_active = TRUE
  )
);

DROP POLICY IF EXISTS "members_view_tickets" ON public.fleet_tickets;
DROP POLICY IF EXISTS "admins_manage_tickets" ON public.fleet_tickets;
CREATE POLICY "members_view_tickets"
ON public.fleet_tickets
FOR SELECT
USING (
  public.can_access_branch(org_id, branch_id)
);
CREATE POLICY "admins_manage_tickets"
ON public.fleet_tickets
FOR ALL
USING (
  public.can_access_branch(org_id, branch_id)
  AND org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
      AND is_active = TRUE
  )
)
WITH CHECK (
  public.can_access_branch(org_id, branch_id)
  AND org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
      AND is_active = TRUE
  )
);

DROP POLICY IF EXISTS "members_can_view_fleet_medical_records" ON public.fleet_maintenance_labs;
DROP POLICY IF EXISTS "admins_can_manage_fleet_medical_records" ON public.fleet_maintenance_labs;
CREATE POLICY "members_can_view_fleet_medical_records"
ON public.fleet_maintenance_labs
FOR SELECT
USING (
  public.can_access_branch(org_id, branch_id)
);
CREATE POLICY "admins_can_manage_fleet_medical_records"
ON public.fleet_maintenance_labs
FOR ALL
USING (
  public.can_access_branch(org_id, branch_id)
  AND org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
      AND is_active = TRUE
  )
)
WITH CHECK (
  public.can_access_branch(org_id, branch_id)
  AND org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
      AND is_active = TRUE
  )
);

DROP POLICY IF EXISTS "members_view_terminals" ON public.fleet_terminals;
DROP POLICY IF EXISTS "admins_manage_terminals" ON public.fleet_terminals;
ALTER TABLE public.fleet_terminals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_view_terminals"
ON public.fleet_terminals
FOR SELECT
USING (
  public.can_access_branch(org_id, branch_id)
);
CREATE POLICY "admins_manage_terminals"
ON public.fleet_terminals
FOR ALL
USING (
  public.can_access_branch(org_id, branch_id)
  AND org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
      AND is_active = TRUE
  )
)
WITH CHECK (
  public.can_access_branch(org_id, branch_id)
  AND org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
      AND is_active = TRUE
  )
);

DROP POLICY IF EXISTS "branch_managers_manage_branch_employees" ON public.employees;
CREATE POLICY "branch_managers_manage_branch_employees"
ON public.employees
FOR ALL
USING (
  branch_id IS NOT NULL
  AND public.can_access_branch(org_id, branch_id)
  AND org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager', 'hr')
      AND is_active = TRUE
  )
)
WITH CHECK (
  branch_id IS NOT NULL
  AND public.can_access_branch(org_id, branch_id)
  AND org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager', 'hr')
      AND is_active = TRUE
  )
);

DROP POLICY IF EXISTS "branch_managers_manage_branch_attendance" ON public.attendance;
CREATE POLICY "branch_managers_manage_branch_attendance"
ON public.attendance
FOR ALL
USING (
  branch_id IS NOT NULL
  AND public.can_access_branch(org_id, branch_id)
  AND org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager', 'hr')
      AND is_active = TRUE
  )
)
WITH CHECK (
  branch_id IS NOT NULL
  AND public.can_access_branch(org_id, branch_id)
  AND org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager', 'hr')
      AND is_active = TRUE
  )
);

NOTIFY pgrst, 'reload schema';
