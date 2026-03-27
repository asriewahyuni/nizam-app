-- Menambahkan dukungan durasi/batas waktu untuk paket SaaS
ALTER TABLE saas_packages ADD COLUMN IF NOT EXISTS duration_days INTEGER DEFAULT 30;

-- Tambahkan paket Trial default jika belum ada
INSERT INTO saas_packages (name, price, billing, is_active, modules, duration_days)
SELECT 'Trial', 0, 'Sekali', true, '["Accounting", "Inventory", "Sales", "POS"]'::jsonb, 14
WHERE NOT EXISTS (SELECT 1 FROM saas_packages WHERE name = 'Trial');

-- Tambahkan kolom subscription_end di tabel organizations untuk melacak batas waktu tenant
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS subscription_end TIMESTAMP WITH TIME ZONE;
