-- NIZAM GRAND SLAM OFFER: Indonesian Market Edition
-- Strategi Harga: Terjangkau, Bernilai Tinggi, Komitmen Bertahap

DELETE FROM saas_packages; -- Refresh paket agar sesuai strategi baru

-- 1. DEMO (Pintu Eksplorasi)
INSERT INTO saas_packages (name, price, billing, is_active, modules, duration_days)
VALUES (
    'Demo', 0, 'Sekali', true, 
    '["Accounting", "Finance", "Inventory", "Purchasing", "Sales", "Marketing", "POS", "HRIS", "Manufacturing", "Fleet", "Audit", "Job Order", "CRM", "Warehouse"]'::jsonb, 
    1
);

-- 2. PAID TRIAL (Langkah Berkah) - Entry Level untuk pindah data
INSERT INTO saas_packages (name, price, billing, is_active, modules, duration_days)
VALUES (
    'Trial', 149000, 'Sekali', true, 
    '["Accounting", "Finance", "Inventory", "Purchasing", "Sales", "Marketing", "POS"]'::jsonb, 
    30
);

-- 3. BASIC (Tumbuh Bersama) - Fokus ke Operasional & Keuangan
INSERT INTO saas_packages (name, price, billing, is_active, modules, duration_days)
VALUES (
    'Basic', 299000, 'Bulan', true, 
    '["Accounting", "Finance", "Inventory", "Purchasing", "Sales", "Marketing", "POS"]'::jsonb, 
    30
);

-- 4. PRO (Ekspansi Hebat) - Full Power untuk Manufaktur & Fleet
INSERT INTO saas_packages (name, price, billing, is_active, modules, duration_days)
VALUES (
    'Pro', 999000, 'Bulan', true, 
    '["Accounting", "Finance", "Inventory", "Purchasing", "Sales", "Marketing", "POS", "HRIS", "Manufacturing", "Fleet", "Audit", "Job Order", "Warehouse"]'::jsonb, 
    30
);

-- 5. ENTERPRISE (Sultan Custom) - Untuk Korporasi
INSERT INTO saas_packages (name, price, billing, is_active, modules, duration_days)
VALUES (
    'Enterprise', 2500000, 'Tahun', true, 
    '["Accounting", "Finance", "Inventory", "Purchasing", "Sales", "Marketing", "POS", "HRIS", "Manufacturing", "Fleet", "Audit", "Job Order", "CRM", "Warehouse"]'::jsonb, 
    365
);
