-- ==========================================
-- SCRIPT 1045: FLEET CREW & HR INTEGRATION
-- ==========================================

-- 1. Refactor Schedules to use Employees as Drivers
ALTER TABLE public.fleet_schedules DROP CONSTRAINT IF EXISTS fleet_schedules_driver_id_fkey;
ALTER TABLE public.fleet_schedules ADD CONSTRAINT fleet_schedules_driver_id_fkey 
    FOREIGN KEY (driver_id) REFERENCES public.employees(id) ON DELETE SET NULL;

-- 2. Add Helper (Kernet/Kondektur)
ALTER TABLE public.fleet_schedules ADD COLUMN IF NOT EXISTS helper_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;

-- 3. Add Driver License Info to Employees
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS license_number TEXT; -- Nomor SIM
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS license_expiry DATE; -- Masa Berlaku SIM
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS blood_type VARCHAR(5); -- Golongan Darah
