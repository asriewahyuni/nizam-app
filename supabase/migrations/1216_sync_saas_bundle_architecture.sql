-- ============================================================
-- MIGRATION 1216: Sync SaaS bundle architecture
-- ============================================================
-- Goal:
-- - Menyelaraskan seed paket SaaS dengan model produk terbaru:
--   Platform Core, Lite Core, Starter Core, Full Core, Vertical Modules, Add-ons.
-- - Memastikan capability core seperti Pengaturan Bisnis, Cabang,
--   Migrasi Data, dan Support Ticket benar-benar aktif lewat entitlement `Config`.
-- - Menjaga nama plan existing tetap sama agar kompatibel dengan tenant lama.

-- Demo: eksplorasi penuh seluruh core + vertical module + add-on utama.
INSERT INTO public.saas_packages (name, price, billing, is_active, modules, addons, duration_days)
VALUES (
  'Demo',
  0,
  'Sekali',
  TRUE,
  '[
    "Accounting",
    "Finance",
    "Inventory",
    "Purchasing",
    "Sales",
    "POS",
    "CRM",
    "Reports",
    "HRIS",
    "Manufacturing",
    "Audit",
    "Config",
    "Fleet & Rental",
    "Job Order (Jasa)",
    "Syirkah",
    "Warehouse",
    "Sales Page",
    "Integrasi API"
  ]'::jsonb,
  '[
    "Multi-Entity (PT/CV)",
    "Quick Bill",
    "Fleet Maintenance Pack",
    "Package Tracking",
    "Sales AR Cockpit",
    "Sales AR Seat Pack"
  ]'::jsonb,
  1
)
ON CONFLICT (name) DO UPDATE
SET
  modules = EXCLUDED.modules,
  addons = EXCLUDED.addons,
  duration_days = EXCLUDED.duration_days,
  is_active = TRUE,
  updated_at = NOW();

-- Trial: Lite Core + Platform Core.
INSERT INTO public.saas_packages (name, price, billing, is_active, modules, addons, duration_days)
VALUES (
  'Trial',
  149000,
  'Sekali',
  TRUE,
  '[
    "Sales",
    "POS",
    "CRM",
    "Reports",
    "Config"
  ]'::jsonb,
  '[
    "Accounting",
    "Finance",
    "Inventory",
    "Purchasing",
    "HRIS",
    "Manufacturing",
    "Audit",
    "Fleet & Rental",
    "Job Order (Jasa)",
    "Syirkah",
    "Warehouse",
    "Sales Page",
    "Integrasi API",
    "Multi-Entity (PT/CV)",
    "Quick Bill",
    "Fleet Maintenance Pack",
    "Package Tracking",
    "Sales AR Cockpit",
    "Sales AR Seat Pack"
  ]'::jsonb,
  30
)
ON CONFLICT (name) DO UPDATE
SET
  modules = EXCLUDED.modules,
  addons = EXCLUDED.addons,
  duration_days = EXCLUDED.duration_days,
  updated_at = NOW();

-- Lite: bundle transaksi bisnis paling sederhana.
INSERT INTO public.saas_packages (name, price, billing, is_active, modules, addons, duration_days)
VALUES (
  'Lite',
  199000,
  'Bulan',
  TRUE,
  '[
    "Sales",
    "POS",
    "CRM",
    "Reports",
    "Config"
  ]'::jsonb,
  '[
    "Accounting",
    "Finance",
    "Inventory",
    "Purchasing",
    "HRIS",
    "Manufacturing",
    "Audit",
    "Fleet & Rental",
    "Job Order (Jasa)",
    "Syirkah",
    "Warehouse",
    "Sales Page",
    "Integrasi API",
    "Multi-Entity (PT/CV)",
    "Quick Bill",
    "Fleet Maintenance Pack",
    "Package Tracking",
    "Sales AR Cockpit",
    "Sales AR Seat Pack"
  ]'::jsonb,
  30
)
ON CONFLICT (name) DO UPDATE
SET
  modules = EXCLUDED.modules,
  addons = EXCLUDED.addons,
  duration_days = EXCLUDED.duration_days,
  updated_at = NOW();

-- Basic: bundle Starter Core bulanan.
INSERT INTO public.saas_packages (name, price, billing, is_active, modules, addons, duration_days)
VALUES (
  'Basic',
  299000,
  'Bulan',
  TRUE,
  '[
    "Accounting",
    "Finance",
    "Inventory",
    "Purchasing",
    "Sales",
    "POS",
    "CRM",
    "Reports",
    "Config"
  ]'::jsonb,
  '[
    "HRIS",
    "Manufacturing",
    "Audit",
    "Fleet & Rental",
    "Job Order (Jasa)",
    "Syirkah",
    "Warehouse",
    "Sales Page",
    "Integrasi API",
    "Multi-Entity (PT/CV)",
    "Quick Bill",
    "Fleet Maintenance Pack",
    "Package Tracking",
    "Sales AR Cockpit",
    "Sales AR Seat Pack"
  ]'::jsonb,
  30
)
ON CONFLICT (name) DO UPDATE
SET
  modules = EXCLUDED.modules,
  addons = EXCLUDED.addons,
  duration_days = EXCLUDED.duration_days,
  updated_at = NOW();

-- Pro: Full Core tanpa vertical module bawaan.
INSERT INTO public.saas_packages (name, price, billing, is_active, modules, addons, duration_days)
VALUES (
  'Pro',
  999000,
  'Bulan',
  TRUE,
  '[
    "Accounting",
    "Finance",
    "Inventory",
    "Purchasing",
    "Sales",
    "POS",
    "CRM",
    "Reports",
    "HRIS",
    "Manufacturing",
    "Audit",
    "Config"
  ]'::jsonb,
  '[
    "Fleet & Rental",
    "Job Order (Jasa)",
    "Syirkah",
    "Warehouse",
    "Sales Page",
    "Integrasi API",
    "Multi-Entity (PT/CV)",
    "Quick Bill",
    "Fleet Maintenance Pack",
    "Package Tracking",
    "Sales AR Cockpit",
    "Sales AR Seat Pack"
  ]'::jsonb,
  30
)
ON CONFLICT (name) DO UPDATE
SET
  modules = EXCLUDED.modules,
  addons = EXCLUDED.addons,
  duration_days = EXCLUDED.duration_days,
  updated_at = NOW();

-- Enterprise: Full Core + limit tinggi, vertical module/add-on tetap fleksibel.
INSERT INTO public.saas_packages (name, price, billing, is_active, modules, addons, duration_days)
VALUES (
  'Enterprise',
  2500000,
  'Tahun',
  TRUE,
  '[
    "Accounting",
    "Finance",
    "Inventory",
    "Purchasing",
    "Sales",
    "POS",
    "CRM",
    "Reports",
    "HRIS",
    "Manufacturing",
    "Audit",
    "Config"
  ]'::jsonb,
  '[
    "Fleet & Rental",
    "Job Order (Jasa)",
    "Syirkah",
    "Warehouse",
    "Sales Page",
    "Integrasi API",
    "Multi-Entity (PT/CV)",
    "Quick Bill",
    "Fleet Maintenance Pack",
    "Package Tracking",
    "Sales AR Cockpit",
    "Sales AR Seat Pack"
  ]'::jsonb,
  365
)
ON CONFLICT (name) DO UPDATE
SET
  modules = EXCLUDED.modules,
  addons = EXCLUDED.addons,
  duration_days = EXCLUDED.duration_days,
  updated_at = NOW();

-- ABS Special: starter core + HRIS + Warehouse untuk kebutuhan khusus.
INSERT INTO public.saas_packages (name, price, billing, is_active, modules, addons, duration_days)
VALUES (
  'ABS Special',
  0,
  'Bulan',
  TRUE,
  '[
    "Accounting",
    "Finance",
    "Inventory",
    "Purchasing",
    "Sales",
    "POS",
    "CRM",
    "Reports",
    "HRIS",
    "Warehouse",
    "Config"
  ]'::jsonb,
  '[
    "Manufacturing",
    "Audit",
    "Fleet & Rental",
    "Job Order (Jasa)",
    "Syirkah",
    "Sales Page",
    "Integrasi API",
    "Multi-Entity (PT/CV)",
    "Quick Bill",
    "Fleet Maintenance Pack",
    "Package Tracking",
    "Sales AR Cockpit",
    "Sales AR Seat Pack"
  ]'::jsonb,
  30
)
ON CONFLICT (name) DO UPDATE
SET
  modules = EXCLUDED.modules,
  addons = EXCLUDED.addons,
  duration_days = EXCLUDED.duration_days,
  is_active = TRUE,
  updated_at = NOW();
