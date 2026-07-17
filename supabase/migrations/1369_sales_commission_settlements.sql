-- Pencairan komisi reseller per invoice.
-- Menggantikan settleCommission() lama yang dead code & pakai kode akun hardcode salah.
-- Tidak pakai kolom status: keberadaan baris di sales_commission_settlement_items = sudah dicairkan.
-- Tidak pakai RLS (koneksi app selalu connect sebagai role postgres yang bypass RLS,
-- lihat pola sales_resellers vs bus_pool_settlements yang lebih baru & sudah tidak pakai RLS).

CREATE TABLE IF NOT EXISTS public.sales_commission_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reseller_id UUID NOT NULL REFERENCES public.sales_resellers(id) ON DELETE RESTRICT,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  settlement_date DATE NOT NULL,
  total_commission_amount NUMERIC(20, 2) NOT NULL CHECK (total_commission_amount > 0),
  payment_method TEXT,
  reference_no TEXT,
  debit_account_id UUID NOT NULL REFERENCES public.accounts(id),
  credit_account_id UUID NOT NULL REFERENCES public.accounts(id),
  journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sales_commission_settlement_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id UUID NOT NULL REFERENCES public.sales_commission_settlements(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE RESTRICT,
  commission_amount NUMERIC(20, 2) NOT NULL CHECK (commission_amount >= 0),
  net_sales_amount NUMERIC(20, 2) NOT NULL DEFAULT 0,
  UNIQUE (sale_id)
);

CREATE INDEX IF NOT EXISTS idx_sales_commission_settlements_org_reseller
  ON public.sales_commission_settlements(org_id, reseller_id);

CREATE INDEX IF NOT EXISTS idx_sales_commission_settlement_items_settlement
  ON public.sales_commission_settlement_items(settlement_id);
