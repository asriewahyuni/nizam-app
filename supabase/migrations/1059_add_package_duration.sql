-- Menambahkan dukungan durasi/batas waktu untuk paket SaaS
-- Legacy note:
-- saas_packages used to be introduced by an out-of-order migration (01).
-- Keep the bootstrap here so fresh databases can still reach the later
-- SaaS package migrations in a valid order.
CREATE TABLE IF NOT EXISTS public.saas_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    price DECIMAL(15, 2) NOT NULL DEFAULT 0,
    billing VARCHAR(50) NOT NULL DEFAULT 'Bulan',
    is_active BOOLEAN NOT NULL DEFAULT true,
    modules JSONB NOT NULL DEFAULT '[]'::jsonb,
    addons JSONB NOT NULL DEFAULT '[]'::jsonb,
    duration_days INTEGER DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'saas_packages_name_key'
    ) THEN
        ALTER TABLE public.saas_packages
          ADD CONSTRAINT saas_packages_name_key UNIQUE (name);
    END IF;
END $$;

ALTER TABLE saas_packages ADD COLUMN IF NOT EXISTS duration_days INTEGER DEFAULT 30;

-- Tambahkan paket Trial default jika belum ada
INSERT INTO saas_packages (name, price, billing, is_active, modules, duration_days)
SELECT 'Trial', 0, 'Sekali', true, '["Accounting", "Inventory", "Sales", "POS"]'::jsonb, 14
WHERE NOT EXISTS (SELECT 1 FROM saas_packages WHERE name = 'Trial');

-- Tambahkan kolom subscription_end di tabel organizations untuk melacak batas waktu tenant
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS subscription_end TIMESTAMP WITH TIME ZONE;
