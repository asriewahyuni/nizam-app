-- ============================================================
-- MIGRATION 010: Products & Inventory Base
-- ============================================================

CREATE TYPE product_type AS ENUM ('INVENTORY', 'NON_INVENTORY', 'SERVICE');

CREATE TABLE IF NOT EXISTS public.products (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sku                 TEXT,
  name                TEXT NOT NULL,
  type                product_type NOT NULL DEFAULT 'INVENTORY',
  description         TEXT,
  unit                TEXT NOT NULL DEFAULT 'Pcs',
  purchase_price      NUMERIC(20, 2) NOT NULL DEFAULT 0,
  selling_price       NUMERIC(20, 2) NOT NULL DEFAULT 0,
  
  -- Pemetaan ke Akun Buku Besar (Penting untuk Jurnal Otomatis)
  asset_account_id    UUID REFERENCES accounts(id),  -- Akun Persediaan
  income_account_id   UUID REFERENCES accounts(id),  -- Akun Pendapatan
  expense_account_id  UUID REFERENCES accounts(id),  -- Akun HPP (COGS)
  
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, sku)
);

CREATE INDEX idx_products_org_id ON public.products(org_id);
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update tabel sales_items & purchase_items untuk pindah relasi dari accounts ke products
ALTER TABLE public.sales_items DROP CONSTRAINT IF EXISTS sales_items_product_id_fkey;
ALTER TABLE public.sales_items ADD CONSTRAINT sales_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);

ALTER TABLE public.purchase_items DROP CONSTRAINT IF EXISTS purchase_items_product_id_fkey;
ALTER TABLE public.purchase_items ADD CONSTRAINT purchase_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);

-- RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_can_view_products" ON public.products FOR SELECT 
USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE));

CREATE POLICY "managers_can_manage_products" ON public.products FOR ALL 
USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager', 'staff') AND is_active = TRUE));
