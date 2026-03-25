-- ==========================================
-- MIGRATION 013: Fixed Asset Management
-- ==========================================

CREATE TYPE depreciation_method AS ENUM ('STRAIGHT_LINE', 'DOUBLE_DECLINING_BALANCE', 'NON_DEPRECIABLE');

CREATE TABLE IF NOT EXISTS fixed_assets (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code                TEXT NOT NULL, -- e.g. "AST-001"
  name                TEXT NOT NULL,
  description         TEXT,
  category            TEXT, -- e.g. "Kendaraan", "Bangunan", "Peralatan"
  
  -- Financial Info
  purchase_date       DATE NOT NULL,
  purchase_price      DECIMAL(19,4) NOT NULL DEFAULT 0,
  salvage_value       DECIMAL(19,4) NOT NULL DEFAULT 0, -- Nilai sisa
  useful_life_months  INTEGER NOT NULL DEFAULT 0, -- Umur ekonomis (bulan)
  
  -- Accounts Tracking
  asset_account_id    UUID REFERENCES accounts(id), -- Akun Aset (e.g. 1504)
  accum_dep_account_id UUID REFERENCES accounts(id), -- Akun Akumulasi (e.g. 1505)
  dep_expense_account_id UUID REFERENCES accounts(id), -- Akun Biaya (e.g. 6009)
  
  -- Status
  depreciation_method depreciation_method NOT NULL DEFAULT 'STRAIGHT_LINE',
  status              TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, DISPOSED, SOLD
  
  -- Current state (Aggregated)
  accumulated_depreciation DECIMAL(19,4) NOT NULL DEFAULT 0,
  current_book_value      DECIMAL(19,4) NOT NULL DEFAULT 0,
  last_depreciation_date  DATE,
  
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, code)
);

-- Table track history penyusutan bulanan
CREATE TABLE IF NOT EXISTS asset_depreciation_logs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id            UUID NOT NULL REFERENCES fixed_assets(id) ON DELETE CASCADE,
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_date         DATE NOT NULL, -- Bulan penyusutan
  amount              DECIMAL(19,4) NOT NULL,
  journal_entry_id    UUID, -- Linked ke jurnal akuntansi jika sudah terposting
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger Audit CCTV (using log_audit_event from migration 012)
DROP TRIGGER IF EXISTS audit_fixed_assets_trigger ON public.fixed_assets;
CREATE TRIGGER audit_fixed_assets_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.fixed_assets
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- RLS: fixed_assets
ALTER TABLE fixed_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_can_view_assets"
  ON fixed_assets FOR SELECT
  USING (org_id IN (SELECT get_my_org_ids()));

CREATE POLICY "admins_can_manage_assets"
  ON fixed_assets FOR ALL
  USING (is_org_admin(org_id));
