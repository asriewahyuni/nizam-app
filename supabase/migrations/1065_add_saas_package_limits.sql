-- Menambah kolom Limitasi Bisnis & Cabang ke Paket SaaS
ALTER TABLE saas_packages ADD COLUMN IF NOT EXISTS max_orgs INTEGER DEFAULT 1;
ALTER TABLE saas_packages ADD COLUMN IF NOT EXISTS max_warehouses INTEGER DEFAULT 1;

-- Update paket default sesuai strategi Grand Slam
UPDATE saas_packages SET max_orgs = 1, max_warehouses = 1 WHERE name != 'Enterprise';
UPDATE saas_packages SET max_orgs = 999, max_warehouses = 999 WHERE name = 'Enterprise';
