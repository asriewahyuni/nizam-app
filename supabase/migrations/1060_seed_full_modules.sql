-- Migrasi Gabungan Penentu: Mendukung Durasi Paket & Sinkronisasi Modul Penuh
-- Pastikan kolom duration_days ada sebelum dipakai
ALTER TABLE saas_packages ADD COLUMN IF NOT EXISTS duration_days INTEGER DEFAULT 30;

-- Pastikan paket Enterprise tersedia dan lengkap modulnya
INSERT INTO saas_packages (name, price, billing, is_active, modules, duration_days)
VALUES (
    'Enterprise', 
    1500000, 
    'Tahun', 
    true, 
    '["Accounting", "Finance", "Inventory", "Purchasing", "Sales", "Marketing", "POS", "HRIS", "Manufacturing", "Fleet", "Audit", "Job Order", "CRM", "Warehouse"]'::jsonb, 
    365
)
ON CONFLICT (name) DO UPDATE 
SET modules = EXCLUDED.modules, 
    duration_days = EXCLUDED.duration_days;

-- Pastikan paket Trial tersedia dan lengkap modulnya
INSERT INTO saas_packages (name, price, billing, is_active, modules, duration_days)
VALUES (
    'Trial', 
    0, 
    'Sekali', 
    true, 
    '["Accounting", "Finance", "Inventory", "Purchasing", "Sales", "Marketing", "POS", "HRIS", "Manufacturing", "Fleet", "Audit", "Job Order", "CRM", "Warehouse"]'::jsonb, 
    30
)
ON CONFLICT (name) DO UPDATE 
SET modules = EXCLUDED.modules, 
    duration_days = EXCLUDED.duration_days;
