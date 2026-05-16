-- Migration: ABS Trial Package (30 hari) untuk peserta Akademi Bisnis Syariah
-- Paket ini tidak ditampilkan di halaman pricing publik (is_active = false).
-- Diaktifkan otomatis saat pendaftaran dengan planParam = 'abs'.

INSERT INTO saas_packages (
  name,
  price,
  billing,
  is_active,
  duration_days,
  modules,
  addons,
  max_orgs,
  max_warehouses,
  created_at,
  updated_at
)
VALUES (
  'ABS Trial',
  0,
  'Sekali',
  false,
  30,
  '["Accounting","Finance","Inventory","Purchasing","Sales","POS","CRM","Reports","HRIS","Config"]'::jsonb,
  '[]'::jsonb,
  1,
  1,
  now(),
  now()
)
ON CONFLICT (name) DO UPDATE SET
  price          = 0,
  billing        = 'Sekali',
  duration_days  = 30,
  modules        = '["Accounting","Finance","Inventory","Purchasing","Sales","POS","CRM","Reports","HRIS","Config"]'::jsonb,
  addons         = '[]'::jsonb,
  max_orgs       = 1,
  max_warehouses = 1,
  updated_at     = now();
