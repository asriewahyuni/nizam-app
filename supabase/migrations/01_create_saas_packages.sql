-- Migration: create_saas_packages.sql
-- Description: Membuat tabel saas_packages untuk menyimpan data paket harga secara dinamis.

CREATE TABLE IF NOT EXISTS public.saas_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    price DECIMAL(15, 2) NOT NULL DEFAULT 0,
    billing VARCHAR(50) NOT NULL DEFAULT 'Bulan',
    is_active BOOLEAN NOT NULL DEFAULT true,
    modules JSONB NOT NULL DEFAULT '[]'::jsonb,
    addons JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure name is unique for ON CONFLICT (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'saas_packages_name_key') THEN
        ALTER TABLE public.saas_packages ADD CONSTRAINT saas_packages_name_key UNIQUE (name);
    END IF;
END $$;

-- RLS (Row Level Security) Policies
ALTER TABLE public.saas_packages ENABLE ROW LEVEL SECURITY;

-- Hanya Admin / Service Role yang bisa edit, tapi public auth bisa baca
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.saas_packages;
CREATE POLICY "Public profiles are viewable by everyone." 
ON public.saas_packages FOR SELECT 
USING ( true );

-- Masukkan default packages
INSERT INTO public.saas_packages (name, price, billing, is_active, modules, addons)
VALUES 
    ('Basic', 150000, 'Bulan', true, '["Accounting", "Cash"]'::jsonb, '[]'::jsonb),
    ('Pro', 350000, 'Bulan', true, '["Accounting", "Cash", "POS", "Inventory"]'::jsonb, '["CRM"]'::jsonb),
    ('Enterprise', 950000, 'Bulan', true, '["Accounting", "Cash", "POS", "Inventory", "HRIS", "Factory"]'::jsonb, '["Full API", "Priority Support"]'::jsonb),
    ('Custom ERP', 0, 'Custom', false, '[]'::jsonb, '[]'::jsonb)
ON CONFLICT (name) DO NOTHING;
