-- Sistem Invoicing SaaS (Penagihan Paket NIZAM)
CREATE TABLE IF NOT EXISTS saas_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  package_id UUID REFERENCES saas_packages(id) ON DELETE SET NULL,
  invoice_number TEXT UNIQUE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  status TEXT DEFAULT 'UNPAID' CHECK (status IN ('UNPAID', 'PAID', 'CANCELLED', 'EXPIRED')),
  payment_method TEXT, -- e.g., 'MANUAL_TRANSFER', 'XENDIT_VA'
  payment_proof_url TEXT, -- Untuk konfirmasi manual
  due_date TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies untuk Invoice
ALTER TABLE saas_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view invoices for their own org"
ON saas_invoices
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM org_members 
  WHERE org_members.org_id = saas_invoices.org_id 
  AND org_members.user_id = auth.uid()
));

-- Indexing
CREATE INDEX IF NOT EXISTS idx_saas_invoices_org ON saas_invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_saas_invoices_status ON saas_invoices(status);
