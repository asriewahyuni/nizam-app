-- ========================================================
-- SAAS BILLING & ACTIVATION ENGINE (INVOICES & ADDONS)
-- ========================================================

-- 1. Ensure Invoices Table exists (Fallback if 1067 not run)
CREATE TABLE IF NOT EXISTS saas_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  package_id UUID REFERENCES saas_packages(id) ON DELETE SET NULL,
  invoice_number TEXT UNIQUE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  status TEXT DEFAULT 'UNPAID' CHECK (status IN ('UNPAID', 'PAID', 'CANCELLED', 'EXPIRED')),
  payment_method TEXT,
  payment_proof_url TEXT,
  due_date TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add Active Add-ons tracking to organizations settings JSON if needed,
-- Or better, a dedicated column to easily query/update.
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='active_addons') THEN
        ALTER TABLE organizations ADD COLUMN active_addons JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- 3. Invoices RLS
ALTER TABLE saas_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view invoices for their own org" ON saas_invoices;
CREATE POLICY "Users can view invoices for their own org"
ON saas_invoices FOR SELECT
USING (EXISTS (
  SELECT 1 FROM org_members 
  WHERE org_members.org_id = saas_invoices.org_id 
  AND org_members.user_id = auth.uid()
));

-- 4. Indexing
CREATE INDEX IF NOT EXISTS idx_saas_invoices_org ON saas_invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_saas_invoices_status ON saas_invoices(status);
