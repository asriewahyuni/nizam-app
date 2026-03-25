-- ============================================================
-- MIGRATION 007: Sales & Purchasing (Phase 3 Start)
-- Full flow: PO -> GR -> AP and SO -> DO -> AR.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Enum: statuses for purchase/sales documents
-- ─────────────────────────────────────────────────────────────
CREATE TYPE document_status AS ENUM ('DRAFT', 'ORDERED', 'RECEIVED', 'FINISHED', 'VOIDED');
CREATE TYPE payment_status AS ENUM ('UNPAID', 'PARTIAL', 'PAID', 'OVERDUE');

-- ─────────────────────────────────────────────────────────────
-- Table: contact (Customers & Suppliers)
-- Generic table for all business partners.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL, -- Enum 'CUSTOMER', 'SUPPLIER', 'BOTH'
  email           TEXT,
  phone           TEXT,
  address         TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contacts_org_id ON contacts(org_id);
CREATE INDEX idx_contacts_type ON contacts(type);

-- ─────────────────────────────────────────────────────────────
-- Table: purchases (Purchase Orders)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchases (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  purchase_number TEXT NOT NULL,         -- PO-2024-000001
  purchase_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  vendor_id       UUID NOT NULL REFERENCES contacts(id),
  total_amount    NUMERIC(20, 2) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(20, 2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(20, 2) NOT NULL DEFAULT 0,
  grand_total     NUMERIC(20, 2) NOT NULL DEFAULT 0,
  status          document_status NOT NULL DEFAULT 'DRAFT',
  payment_status  payment_status NOT NULL DEFAULT 'UNPAID',
  due_date        DATE,
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, purchase_number)
);

CREATE INDEX idx_purchases_org_id ON purchases(org_id);
CREATE INDEX idx_purchases_vendor_id ON purchases(vendor_id);

-- ─────────────────────────────────────────────────────────────
-- Table: sales (Sales Orders)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sale_number     TEXT NOT NULL,         -- SO-2024-000001
  sale_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_id     UUID NOT NULL REFERENCES contacts(id),
  total_amount    NUMERIC(20, 2) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(20, 2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(20, 2) NOT NULL DEFAULT 0,
  grand_total     NUMERIC(20, 2) NOT NULL DEFAULT 0,
  status          document_status NOT NULL DEFAULT 'DRAFT',
  payment_status  payment_status NOT NULL DEFAULT 'UNPAID',
  due_date        DATE,
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, sale_number)
);

CREATE INDEX idx_sales_org_id ON sales(org_id);
CREATE INDEX idx_sales_customer_id ON sales(customer_id);

-- ─────────────────────────────────────────────────────────────
-- Trigger/Seq: auto-number generations (PO & SO)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_purchase_number()
RETURNS TRIGGER AS $$
DECLARE
  v_count INT;
BEGIN
  IF NEW.purchase_number IS NULL OR NEW.purchase_number = '' THEN
    SELECT COUNT(*) + 1 INTO v_count FROM purchases WHERE org_id = NEW.org_id AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
    NEW.purchase_number = 'PO-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(v_count::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_purchase_number
  BEFORE INSERT ON purchases FOR EACH ROW EXECUTE FUNCTION set_purchase_number();

CREATE OR REPLACE FUNCTION set_sale_number()
RETURNS TRIGGER AS $$
DECLARE
  v_count INT;
BEGIN
  IF NEW.sale_number IS NULL OR NEW.sale_number = '' THEN
    SELECT COUNT(*) + 1 INTO v_count FROM sales WHERE org_id = NEW.org_id AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
    NEW.sale_number = 'SO-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(v_count::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_sale_number
  BEFORE INSERT ON sales FOR EACH ROW EXECUTE FUNCTION set_sale_number();

-- ─────────────────────────────────────────────────────────────
-- RLS (Basic)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_can_view_sales_purchases"
  ON contacts FOR SELECT USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE));
CREATE POLICY "members_can_view_purchases"
  ON purchases FOR SELECT USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE));
CREATE POLICY "members_can_view_sales"
  ON sales FOR SELECT USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE));
