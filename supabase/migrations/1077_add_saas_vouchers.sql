-- SAAS VOUCHER SYSTEM: Free Access for Special Participants (Ex: ABS)

-- 1. Create saas_vouchers table
CREATE TABLE IF NOT EXISTS saas_vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    discount_percent NUMERIC DEFAULT 0,
    package_id UUID REFERENCES saas_packages(id),
    max_uses INTEGER DEFAULT 1,
    uses_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ DEFAULT (now() + interval '30 days'),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add ABS Special Package
-- Package ini 0 rupiah tapi 'hidden' (bisa dibikin hidden lewat UI, atau hanya bisa di-apply lewat voucher)
INSERT INTO saas_packages (name, price, billing, is_active, modules, duration_days)
VALUES (
    'ABS Special', 0, 'Sekali', true, 
    '["Accounting", "Finance", "Inventory", "Purchasing", "Sales", "Marketing", "POS", "HRIS", "Warehouse"]'::jsonb, 
    30
) ON CONFLICT (name) DO NOTHING;

-- 3. Seed initial ABS Voucher
-- Voucher name: ABS2024, Discount 100%, Max uses: 100 participants
INSERT INTO saas_vouchers (code, discount_percent, max_uses, is_active)
VALUES ('ABS2024', 100, 100, true)
ON CONFLICT (code) DO NOTHING;
