-- Modul Service Orders (Job Orders untuk Jasa & Servis)
CREATE TABLE IF NOT EXISTS service_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  job_number TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completion_date TIMESTAMP WITH TIME ZONE,
  estimated_cost DECIMAL(15,2) DEFAULT 0,
  actual_cost DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE service_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to members within same org"
ON service_orders
FOR ALL
USING (EXISTS (
  SELECT 1 FROM org_members 
  WHERE org_members.org_id = service_orders.org_id 
  AND org_members.user_id = auth.uid()
));

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_service_orders_org ON service_orders(org_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_status ON service_orders(status);
