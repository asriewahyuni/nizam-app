-- ============================================================
-- MIGRATION 016: Sales Returns & Inventory Adjustment
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sales_returns (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sale_id             UUID REFERENCES sales(id) ON DELETE SET NULL,
  return_number       TEXT,
  return_date         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_amount        NUMERIC(20, 2) NOT NULL DEFAULT 0,
  tax_amount          NUMERIC(20, 2) NOT NULL DEFAULT 0,
  grand_total         NUMERIC(20, 2) NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'COMPLETED',
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.sales_return_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  return_id           UUID NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
  product_id          UUID REFERENCES products(id),
  description         TEXT,
  quantity            DECIMAL(15,2) NOT NULL DEFAULT 0,
  unit_price          DECIMAL(15,2) NOT NULL DEFAULT 0,
  tax_amount          DECIMAL(15,2) DEFAULT 0,
  total_amount        DECIMAL(15,2) GENERATED ALWAYS AS (quantity * unit_price + tax_amount) STORED,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.sales_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_return_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_can_view_returns" ON public.sales_returns FOR SELECT 
USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE));

CREATE POLICY "members_can_manage_returns" ON public.sales_returns FOR ALL 
USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE));

CREATE POLICY "members_can_view_return_items" ON public.sales_return_items FOR SELECT 
USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE));

CREATE POLICY "members_can_manage_return_items" ON public.sales_return_items FOR ALL 
USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE));

-- Sequence for Return Number
CREATE OR REPLACE FUNCTION set_return_number()
RETURNS TRIGGER AS $$
DECLARE
  v_count INT;
BEGIN
  IF NEW.return_number IS NULL OR NEW.return_number = '' THEN
    SELECT COUNT(*) + 1 INTO v_count FROM sales_returns WHERE org_id = NEW.org_id AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
    NEW.return_number = 'SR-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(v_count::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_return_number
  BEFORE INSERT ON sales_returns FOR EACH ROW EXECUTE FUNCTION set_return_number();
