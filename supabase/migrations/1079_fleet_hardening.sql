-- Migration 1079: Fleet hardening
-- Adds missing RLS for maintenance logs, guards overlapping bookings,
-- and provides an atomic RPC for vehicle maintenance writes.

DROP POLICY IF EXISTS "members_can_view_fleet_medical_records" ON public.fleet_maintenance_labs;
CREATE POLICY "members_can_view_fleet_medical_records"
ON public.fleet_maintenance_labs
FOR SELECT
USING (
  org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid()
      AND is_active = TRUE
  )
);

DROP POLICY IF EXISTS "admins_can_manage_fleet_medical_records" ON public.fleet_maintenance_labs;
CREATE POLICY "admins_can_manage_fleet_medical_records"
ON public.fleet_maintenance_labs
FOR ALL
USING (
  org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
      AND is_active = TRUE
  )
)
WITH CHECK (
  org_id IN (
    SELECT org_id
    FROM public.org_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
      AND is_active = TRUE
  )
);

CREATE OR REPLACE FUNCTION public.prevent_overlapping_fleet_bookings()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.end_date <= NEW.start_date THEN
    RAISE EXCEPTION 'Tanggal selesai harus lebih besar dari tanggal mulai.';
  END IF;

  IF NEW.status <> 'CANCELLED'
    AND EXISTS (
      SELECT 1
      FROM public.fleet_bookings existing_booking
      WHERE existing_booking.org_id = NEW.org_id
        AND existing_booking.asset_id = NEW.asset_id
        AND existing_booking.status <> 'CANCELLED'
        AND existing_booking.start_date < NEW.end_date
        AND existing_booking.end_date > NEW.start_date
        AND (TG_OP = 'INSERT' OR existing_booking.id <> NEW.id)
    ) THEN
    RAISE EXCEPTION 'Armada sudah memiliki booking aktif di periode tersebut.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_overlapping_fleet_bookings ON public.fleet_bookings;
CREATE TRIGGER trg_prevent_overlapping_fleet_bookings
BEFORE INSERT OR UPDATE OF org_id, asset_id, start_date, end_date, status
ON public.fleet_bookings
FOR EACH ROW
EXECUTE FUNCTION public.prevent_overlapping_fleet_bookings();

CREATE OR REPLACE FUNCTION public.create_fleet_medical_record(
  p_org_id UUID,
  p_asset_id UUID,
  p_service_date DATE,
  p_description TEXT,
  p_maintenance_type TEXT,
  p_cost NUMERIC,
  p_odometer_at NUMERIC,
  p_technician_name TEXT DEFAULT NULL,
  p_vendor_name TEXT DEFAULT NULL,
  p_parts_replaced JSONB DEFAULT '[]'::jsonb,
  p_next_service_km NUMERIC DEFAULT NULL,
  p_next_service_date DATE DEFAULT NULL,
  p_attachment_url TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_record_id UUID;
BEGIN
  UPDATE public.fleet_assets
  SET status = 'MAINTENANCE',
      updated_at = NOW()
  WHERE org_id = p_org_id
    AND id = p_asset_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Armada tidak ditemukan atau tidak dapat diakses.';
  END IF;

  INSERT INTO public.fleet_maintenance_labs (
    org_id,
    asset_id,
    service_date,
    description,
    maintenance_type,
    cost,
    odometer_at,
    technician_name,
    vendor_name,
    parts_replaced,
    next_service_km,
    next_service_date,
    attachment_url
  )
  VALUES (
    p_org_id,
    p_asset_id,
    p_service_date,
    p_description,
    p_maintenance_type,
    p_cost,
    p_odometer_at,
    p_technician_name,
    p_vendor_name,
    COALESCE(p_parts_replaced, '[]'::jsonb),
    p_next_service_km,
    p_next_service_date,
    p_attachment_url
  )
  RETURNING id INTO v_record_id;

  RETURN v_record_id;
END;
$$;
