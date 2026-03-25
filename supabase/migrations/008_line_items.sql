-- Phase 3 Expansion: Sales & Purchasing Line Items
-- This completes the core data structure for transactional inventory integration.

-- SALES ITEMS
CREATE TABLE IF NOT EXISTS public.sales_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES accounts(id), -- For now linking to accounts, but ideally a products table
    description TEXT NOT NULL,
    quantity DECIMAL(15,2) NOT NULL DEFAULT 1,
    unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) GENERATED ALWAYS AS (quantity * unit_price - discount_amount + tax_amount) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PURCHASE ITEMS
CREATE TABLE IF NOT EXISTS public.purchase_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    product_id UUID REFERENCES accounts(id), 
    description TEXT NOT NULL,
    quantity DECIMAL(15,2) NOT NULL DEFAULT 1,
    unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) GENERATED ALWAYS AS (quantity * unit_price - discount_amount + tax_amount) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.sales_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view sales items" ON public.sales_items
    FOR SELECT USING (nizam_has_permission('sales.view', org_id));

CREATE POLICY "Org members can manage sales items" ON public.sales_items
    FOR ALL USING (nizam_has_permission('sales.manage', org_id));

CREATE POLICY "Org members can view purchase items" ON public.purchase_items
    FOR SELECT USING (nizam_has_permission('purchasing.view', org_id));

CREATE POLICY "Org members can manage purchase items" ON public.purchase_items
    FOR ALL USING (nizam_has_permission('purchasing.manage', org_id));

-- TRIGGER for updated_at
CREATE TRIGGER set_updated_at_sales_items
    BEFORE UPDATE ON public.sales_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_purchase_items
    BEFORE UPDATE ON public.purchase_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
