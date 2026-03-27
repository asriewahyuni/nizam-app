-- Tambah paket Demo: Full Access, Auto-Destroy setiap logout
-- Paket ini khusus untuk akun yang masuk melalui /demo

ALTER TABLE saas_packages ADD COLUMN IF NOT EXISTS duration_days INTEGER DEFAULT 30;

INSERT INTO saas_packages (name, price, billing, is_active, modules, duration_days)
VALUES (
    'Demo', 
    0, 
    'Sekali', 
    true, 
    '["Accounting", "Finance", "Inventory", "Purchasing", "Sales", "Marketing", "POS", "HRIS", "Manufacturing", "Fleet", "Audit", "Job Order", "CRM", "Warehouse"]'::jsonb, 
    1
)
ON CONFLICT (name) DO UPDATE 
SET modules = EXCLUDED.modules, 
    duration_days = EXCLUDED.duration_days,
    is_active = true;
