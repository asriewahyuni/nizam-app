-- Migration 1040: Vehicle Medical Record Enhancement (Rekam Medis Lengkap)
-- Handles detailed history for maintenance, spareparts, and technician notes.

-- 1. Extend fleet_maintenance_labs with medical-grade tracking
ALTER TABLE public.fleet_maintenance_labs 
ADD COLUMN IF NOT EXISTS maintenance_number TEXT, -- Format MT-2024-001
ADD COLUMN IF NOT EXISTS maintenance_type TEXT DEFAULT 'ROUTINE', -- ROUTINE, CORRECTIVE, EMERGENCY
ADD COLUMN IF NOT EXISTS vendor_name TEXT, -- Nama bengkel/workshop
ADD COLUMN IF NOT EXISTS technician_name TEXT, -- Nama teknisi
ADD COLUMN IF NOT EXISTS parts_replaced JSONB DEFAULT '[]', -- List of parts: [{name: 'Oil Filter', qty: 1, cost: 50000}]
ADD COLUMN IF NOT EXISTS lab_notes TEXT, -- Detailed medical-like diagnostic notes
ADD COLUMN IF NOT EXISTS next_service_date DATE,
ADD COLUMN IF NOT EXISTS attachment_url TEXT, -- Nota/Invoice/Photo evidence
ADD COLUMN IF NOT EXISTS technician_rating INTEGER CHECK (technician_rating >= 1 AND technician_rating <= 5);

-- 2. Index for fast medical record retrieval
CREATE INDEX IF NOT EXISTS idx_fleet_maintenance_asset ON public.fleet_maintenance_labs(asset_id);
CREATE INDEX IF NOT EXISTS idx_fleet_maintenance_org ON public.fleet_maintenance_labs(org_id);

-- 3. Function to automatically generate maintenance number (MT-YYYY-001)
CREATE OR REPLACE FUNCTION public.generate_maintenance_number()
RETURNS TRIGGER AS $$
DECLARE
  v_year TEXT := TO_CHAR(NOW(), 'YYYY');
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO v_count 
  FROM public.fleet_maintenance_labs 
  WHERE org_id = NEW.org_id 
    AND TO_CHAR(created_at, 'YYYY') = v_year;
    
  NEW.maintenance_number := 'MT-' || v_year || '-' || LPAD(v_count::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_mt_number ON public.fleet_maintenance_labs;
CREATE TRIGGER trg_generate_mt_number
BEFORE INSERT ON public.fleet_maintenance_labs
FOR EACH ROW
EXECUTE FUNCTION public.generate_maintenance_number();

COMMENT ON TABLE public.fleet_maintenance_labs IS 'Table for Vehicle Medical Records (Kardeks Kendaraan)';
