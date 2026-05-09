-- ============================================================
-- MIGRATION 1219: Ensure Trial package exists and backfill expiry
-- ============================================================
-- Goal:
-- - Pastikan row paket Trial tersedia di saas_packages.
-- - Standardkan durasi Trial menjadi 3 hari.
-- - Backfill subscription_end untuk tenant Trial lama yang masih NULL.

INSERT INTO public.saas_packages (
  name,
  price,
  billing,
  is_active,
  modules,
  addons,
  duration_days,
  max_branches,
  max_child_orgs,
  max_users
)
VALUES (
  'Trial',
  49000,
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
  3,
  1,
  0,
  3
)
ON CONFLICT (name) DO UPDATE
SET
  price = EXCLUDED.price,
  billing = EXCLUDED.billing,
  is_active = TRUE,
  modules = EXCLUDED.modules,
  addons = EXCLUDED.addons,
  duration_days = EXCLUDED.duration_days,
  max_branches = EXCLUDED.max_branches,
  max_child_orgs = EXCLUDED.max_child_orgs,
  max_users = EXCLUDED.max_users,
  updated_at = NOW();

UPDATE public.organizations
SET subscription_end = created_at + INTERVAL '3 days',
    updated_at = NOW()
WHERE lower(COALESCE(settings->>'plan', '')) = 'trial'
  AND subscription_end IS NULL;

NOTIFY pgrst, 'reload schema';
