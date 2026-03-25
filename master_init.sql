-- ============================================================
-- MIGRATION 001: Organizations (Multi-Tenant Core)
-- Every row in NIZAM is scoped to an org_id.
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────
-- Table: organizations
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  logo_url      TEXT,
  settings      JSONB NOT NULL DEFAULT '{}',
  -- settings can store: currency, timezone, fiscal_year_start, address, npwp, etc.
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_organizations_slug ON organizations(slug);

-- ─────────────────────────────────────────────────────────────
-- Table: org_members
-- Links auth.users → organizations with a role
-- ─────────────────────────────────────────────────────────────
CREATE TYPE member_role AS ENUM ('owner', 'admin', 'manager', 'staff', 'viewer');

CREATE TABLE IF NOT EXISTS org_members (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role          member_role NOT NULL DEFAULT 'staff',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  invited_by    UUID REFERENCES auth.users(id),
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

CREATE INDEX idx_org_members_user_id ON org_members(user_id);
CREATE INDEX idx_org_members_org_id ON org_members(org_id);

-- ─────────────────────────────────────────────────────────────
-- Trigger: auto-update updated_at on organizations
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- RLS: organizations
-- ─────────────────────────────────────────────────────────────
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_can_view_their_org"
  ON organizations FOR SELECT
  USING (
    id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY "owners_can_update_org"
  ON organizations FOR UPDATE
  USING (
    id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = TRUE
    )
  );

-- ─────────────────────────────────────────────────────────────
-- RLS: org_members
-- ─────────────────────────────────────────────────────────────
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_can_view_org_members"
  ON org_members FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM org_members om2
      WHERE om2.user_id = auth.uid() AND om2.is_active = TRUE
    )
  );

CREATE POLICY "admins_can_manage_members"
  ON org_members FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM org_members om2
      WHERE om2.user_id = auth.uid() AND om2.role IN ('owner', 'admin') AND om2.is_active = TRUE
    )
  );

-- Allow new users to create their own org membership (during onboarding)
CREATE POLICY "users_can_insert_own_membership"
  ON org_members FOR INSERT
  WITH CHECK (user_id = auth.uid());
-- ============================================================
-- MIGRATION 002: RBAC (Role-Based Access Control)
-- Granular permission per feature/module per org
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Table: roles (custom roles per org)
-- Default roles will be seeded from org creation trigger
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  -- permissions: array of strings e.g. ["accounting:read", "accounting:write", "inventory:read"]
  permissions   TEXT[] NOT NULL DEFAULT '{}',
  is_system     BOOLEAN NOT NULL DEFAULT FALSE, -- system roles cannot be deleted
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, name)
);

CREATE INDEX idx_roles_org_id ON roles(org_id);

-- ─────────────────────────────────────────────────────────────
-- RLS: roles
-- ─────────────────────────────────────────────────────────────
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_can_view_roles"
  ON roles FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY "admins_can_manage_roles"
  ON roles FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = TRUE
    )
  );

-- ─────────────────────────────────────────────────────────────
-- Helper function: check if current user has a permission
-- Usage: SELECT nizam_has_permission('accounting:write', org_id_here);
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION nizam_has_permission(
  p_permission TEXT,
  p_org_id     UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_role member_role;
BEGIN
  SELECT role INTO v_role
  FROM org_members
  WHERE user_id = auth.uid()
    AND org_id = p_org_id
    AND is_active = TRUE
  LIMIT 1;

  -- owner and admin have all permissions implicitly
  IF v_role IN ('owner', 'admin') THEN
    RETURN TRUE;
  END IF;

  -- for other roles, check the permissions array in roles table
  RETURN EXISTS (
    SELECT 1 FROM roles r
    JOIN org_members om ON om.org_id = r.org_id
    WHERE om.user_id = auth.uid()
      AND r.org_id = p_org_id
      AND p_permission = ANY(r.permissions)
      AND om.is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────
-- Trigger: seed default roles on org creation
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION seed_default_roles()
RETURNS TRIGGER AS $$
BEGIN
  -- Manager role
  INSERT INTO roles (org_id, name, permissions, is_system) VALUES
  (NEW.id, 'Manager', ARRAY[
    'accounting:read', 'accounting:write',
    'inventory:read', 'inventory:write',
    'sales:read', 'sales:write',
    'purchasing:read', 'purchasing:write',
    'reports:read'
  ], TRUE);

  -- Staff role (limited)
  INSERT INTO roles (org_id, name, permissions, is_system) VALUES
  (NEW.id, 'Staff', ARRAY[
    'accounting:read',
    'inventory:read',
    'sales:read', 'sales:write',
    'purchasing:read'
  ], TRUE);

  -- Viewer role (read-only)
  INSERT INTO roles (org_id, name, permissions, is_system) VALUES
  (NEW.id, 'Viewer', ARRAY[
    'accounting:read',
    'inventory:read',
    'reports:read'
  ], TRUE);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_seed_default_roles
  AFTER INSERT ON organizations
  FOR EACH ROW EXECUTE FUNCTION seed_default_roles();
-- ============================================================
-- MIGRATION 003: Chart of Accounts (CoA)
-- PSAK-compliant, hierarchical (parent/child), per org
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Enum: account types
-- ─────────────────────────────────────────────────────────────
CREATE TYPE account_type AS ENUM (
  'ASSET',      -- Aset
  'LIABILITY',  -- Liabilitas
  'EQUITY',     -- Ekuitas
  'REVENUE',    -- Pendapatan
  'EXPENSE'     -- Beban
);

-- Normal balance per type (debit increases ASSET/EXPENSE, credit increases the rest)
CREATE TYPE normal_balance AS ENUM ('DEBIT', 'CREDIT');

-- ─────────────────────────────────────────────────────────────
-- Table: accounts (Chart of Accounts)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accounts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code           TEXT NOT NULL,         -- e.g. "1101", "5001"
  name           TEXT NOT NULL,         -- e.g. "Kas Besar"
  type           account_type NOT NULL,
  normal_balance normal_balance NOT NULL,
  parent_id      UUID REFERENCES accounts(id),  -- for sub-accounts
  description    TEXT,
  is_system      BOOLEAN NOT NULL DEFAULT FALSE,  -- cannot be deleted
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, code)
);

CREATE INDEX idx_accounts_org_id ON accounts(org_id);
CREATE INDEX idx_accounts_parent_id ON accounts(parent_id);
CREATE INDEX idx_accounts_type ON accounts(type);

CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- RLS: accounts
-- ─────────────────────────────────────────────────────────────
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_can_view_accounts"
  ON accounts FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY "admins_can_manage_accounts"
  ON accounts FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager') AND is_active = TRUE
    )
  );

-- ─────────────────────────────────────────────────────────────
-- Function: seed default PSAK Chart of Accounts per org
-- Called on organization creation
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION seed_default_coa(p_org_id UUID)
RETURNS VOID AS $$
DECLARE v_parent_id UUID;
BEGIN
  -- ══════════════════════════════════════════
  -- 1. ASET (ASSET / DEBIT)
  -- ══════════════════════════════════════════
  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
  (p_org_id, '1000', 'Aset', 'ASSET', 'DEBIT', TRUE)
  RETURNING id INTO v_parent_id;

  -- 1.1 Aset Lancar
  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, is_system) VALUES
  (p_org_id, '1100', 'Aset Lancar', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1101', 'Kas Besar', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1102', 'Kas Kecil (Petty Cash)', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1103', 'Bank - Rekening Operasional', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1104', 'Bank - Rekening Payroll', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1105', 'Bank - Rekening Lainnya', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1201', 'Piutang Usaha', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1202', 'Piutang Karyawan', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1203', 'Cadangan Kerugian Piutang', 'ASSET', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '1301', 'Persediaan Barang Dagangan', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1302', 'Persediaan Barang Dalam Proses', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1401', 'PPN Masukan (Pajak Dibayar)', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1402', 'Biaya Dibayar Dimuka', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1403', 'Uang Muka Pembelian', 'ASSET', 'DEBIT', v_parent_id, TRUE);

  -- 1.2 Aset Tetap
  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, is_system) VALUES
  (p_org_id, '1500', 'Aset Tetap', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1501', 'Tanah', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1502', 'Bangunan', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1503', 'Akumulasi Penyusutan Bangunan', 'ASSET', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '1504', 'Kendaraan', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1505', 'Akumulasi Penyusutan Kendaraan', 'ASSET', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '1506', 'Peralatan & Mesin', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1507', 'Akumulasi Penyusutan Peralatan', 'ASSET', 'CREDIT', v_parent_id, TRUE);

  -- ══════════════════════════════════════════
  -- 2. LIABILITAS (LIABILITY / CREDIT)
  -- ══════════════════════════════════════════
  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
  (p_org_id, '2000', 'Liabilitas', 'LIABILITY', 'CREDIT', TRUE)
  RETURNING id INTO v_parent_id;

  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, is_system) VALUES
  (p_org_id, '2101', 'Hutang Usaha', 'LIABILITY', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '2102', 'Hutang Bank Jangka Pendek', 'LIABILITY', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '2201', 'PPN Keluaran (Pajak Dipungut)', 'LIABILITY', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '2202', 'Hutang PPh 21', 'LIABILITY', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '2203', 'Hutang PPh 23', 'LIABILITY', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '2204', 'Hutang PPh Badan', 'LIABILITY', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '2301', 'Pendapatan Diterima di Muka', 'LIABILITY', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '2302', 'Uang Muka Penjualan', 'LIABILITY', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '2401', 'Hutang Gaji', 'LIABILITY', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '2501', 'Hutang Bank Jangka Panjang', 'LIABILITY', 'CREDIT', v_parent_id, TRUE);

  -- ══════════════════════════════════════════
  -- 3. EKUITAS (EQUITY / CREDIT)
  -- ══════════════════════════════════════════
  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
  (p_org_id, '3000', 'Ekuitas', 'EQUITY', 'CREDIT', TRUE)
  RETURNING id INTO v_parent_id;

  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, is_system) VALUES
  (p_org_id, '3001', 'Modal Disetor', 'EQUITY', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '3002', 'Laba Ditahan', 'EQUITY', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '3003', 'Laba Periode Berjalan', 'EQUITY', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '3004', 'Prive / Dividen', 'EQUITY', 'DEBIT', v_parent_id, TRUE);

  -- ══════════════════════════════════════════
  -- 4. PENDAPATAN (REVENUE / CREDIT)
  -- ══════════════════════════════════════════
  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
  (p_org_id, '4000', 'Pendapatan', 'REVENUE', 'CREDIT', TRUE)
  RETURNING id INTO v_parent_id;

  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, is_system) VALUES
  (p_org_id, '4001', 'Pendapatan Usaha', 'REVENUE', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '4002', 'Diskon Penjualan (Contra)', 'REVENUE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '4003', 'Retur Penjualan', 'REVENUE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '4101', 'Pendapatan Bunga', 'REVENUE', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '4102', 'Pendapatan Lain-lain', 'REVENUE', 'CREDIT', v_parent_id, TRUE);

  -- ══════════════════════════════════════════
  -- 5. BEBAN POKOK (COGS / DEBIT)
  -- ══════════════════════════════════════════
  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
  (p_org_id, '5000', 'Beban Pokok Penjualan', 'EXPENSE', 'DEBIT', TRUE)
  RETURNING id INTO v_parent_id;

  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, is_system) VALUES
  (p_org_id, '5001', 'HPP / Cost of Goods Sold', 'EXPENSE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '5002', 'Biaya Pengiriman Masuk (Freight In)', 'EXPENSE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '5003', 'Retur Pembelian (Contra)', 'EXPENSE', 'CREDIT', v_parent_id, TRUE);

  -- ══════════════════════════════════════════
  -- 6. BEBAN OPERASIONAL (EXPENSE / DEBIT)
  -- ══════════════════════════════════════════
  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
  (p_org_id, '6000', 'Beban Operasional', 'EXPENSE', 'DEBIT', TRUE)
  RETURNING id INTO v_parent_id;

  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, is_system) VALUES
  (p_org_id, '6001', 'Gaji & Tunjangan', 'EXPENSE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '6002', 'Sewa Tempat', 'EXPENSE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '6003', 'Utilitas (Listrik, Air, Internet)', 'EXPENSE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '6004', 'Perlengkapan Kantor', 'EXPENSE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '6005', 'Biaya Pemasaran & Iklan', 'EXPENSE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '6006', 'Biaya Transportasi', 'EXPENSE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '6007', 'Biaya Perbaikan & Pemeliharaan', 'EXPENSE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '6008', 'Biaya Asuransi', 'EXPENSE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '6009', 'Biaya Penyusutan', 'EXPENSE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '6010', 'Biaya Profesional & Konsultan', 'EXPENSE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '6099', 'Beban Lain-lain', 'EXPENSE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '6101', 'Biaya Bunga Pinjaman', 'EXPENSE', 'DEBIT', v_parent_id, TRUE);

END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────
-- Trigger: seed CoA on new org creation
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_seed_coa()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM seed_default_coa(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_seed_coa_on_org_create
  AFTER INSERT ON organizations
  FOR EACH ROW EXECUTE FUNCTION trigger_seed_coa();
-- ============================================================
-- MIGRATION 004: Journal Entries (Double-Entry Ledger)
-- Foundation of all financial transactions in NIZAM.
-- Principle: Every financial event = balanced debit/credit pair.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Enum: journal entry status
-- ─────────────────────────────────────────────────────────────
CREATE TYPE journal_status AS ENUM ('DRAFT', 'POSTED', 'VOIDED');

-- ─────────────────────────────────────────────────────────────
-- Enum: reference types (what triggered this entry)
-- Extensible — add new types as modules are added
-- ─────────────────────────────────────────────────────────────
CREATE TYPE journal_reference_type AS ENUM (
  'MANUAL',          -- Manual journal entry
  'CASH_IN',         -- Cash receipt
  'CASH_OUT',        -- Cash payment
  'SALE',            -- Sales invoice
  'PURCHASE',        -- Purchase order
  'GOODS_RECEIPT',   -- Inventory received
  'GOODS_SHIPMENT',  -- Inventory shipped
  'PAYMENT_IN',      -- Customer payment
  'PAYMENT_OUT',     -- Supplier payment
  'BANK_TRANSFER',   -- Inter-bank transfer
  'PAYROLL',         -- Staff salary
  'ADJUSTMENT',      -- Stock or value adjustment
  'TAX',             -- Tax payment / filing
  'DEPRECIATION'     -- Asset depreciation
);

-- ─────────────────────────────────────────────────────────────
-- Table: journal_entries (header)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journal_entries (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entry_number    TEXT NOT NULL,        -- auto-generated: JE-2024-000001
  entry_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  description     TEXT NOT NULL,
  reference_type  journal_reference_type NOT NULL DEFAULT 'MANUAL',
  reference_id    UUID,                 -- FK to source document (sale_id, po_id, etc.)
  status          journal_status NOT NULL DEFAULT 'DRAFT',
  is_auto         BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE = system-generated
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id),
  posted_at       TIMESTAMPTZ,
  voided_at       TIMESTAMPTZ,
  voided_by       UUID REFERENCES auth.users(id),
  void_reason     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, entry_number)
);

CREATE INDEX idx_journal_entries_org_id ON journal_entries(org_id);
CREATE INDEX idx_journal_entries_entry_date ON journal_entries(entry_date);
CREATE INDEX idx_journal_entries_reference ON journal_entries(reference_type, reference_id);
CREATE INDEX idx_journal_entries_status ON journal_entries(status);

CREATE TRIGGER trg_journal_entries_updated_at
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- Table: journal_lines (detail lines — the actual debits/credits)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journal_lines (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id    UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id  UUID NOT NULL REFERENCES accounts(id),
  debit       NUMERIC(20, 2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit      NUMERIC(20, 2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  memo        TEXT,
  -- Either debit OR credit must be non-zero
  CONSTRAINT chk_debit_or_credit CHECK (debit > 0 OR credit > 0),
  CONSTRAINT chk_not_both CHECK (NOT (debit > 0 AND credit > 0))
);

CREATE INDEX idx_journal_lines_entry_id ON journal_lines(entry_id);
CREATE INDEX idx_journal_lines_account_id ON journal_lines(account_id);

-- ─────────────────────────────────────────────────────────────
-- Constraint: balanced entry (debit = credit) on POSTED status
-- Implemented as a trigger to allow line-by-line insertion
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION validate_journal_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_total_debit  NUMERIC;
  v_total_credit NUMERIC;
BEGIN
  -- Only validate when posting (status changing to POSTED)
  IF NEW.status = 'POSTED' AND OLD.status != 'POSTED' THEN
    SELECT
      COALESCE(SUM(debit), 0),
      COALESCE(SUM(credit), 0)
    INTO v_total_debit, v_total_credit
    FROM journal_lines
    WHERE entry_id = NEW.id;

    -- Must have at least 2 lines
    IF (SELECT COUNT(*) FROM journal_lines WHERE entry_id = NEW.id) < 2 THEN
      RAISE EXCEPTION 'Journal entry must have at least 2 lines';
    END IF;

    -- Debit must equal credit
    IF ABS(v_total_debit - v_total_credit) > 0.01 THEN
      RAISE EXCEPTION 'Journal entry is not balanced: debit=% credit=%',
        v_total_debit, v_total_credit;
    END IF;

    -- Set posted_at timestamp
    NEW.posted_at = NOW();
  END IF;

  -- Voided entries cannot be modified
  IF OLD.status = 'VOIDED' THEN
    RAISE EXCEPTION 'Cannot modify a voided journal entry';
  END IF;

  -- Posted entries: only allow status change to VOIDED
  IF OLD.status = 'POSTED' AND NEW.status NOT IN ('VOIDED', 'POSTED') THEN
    RAISE EXCEPTION 'Cannot change a posted entry back to draft';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_journal_balance
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION validate_journal_balance();

-- ─────────────────────────────────────────────────────────────
-- Function: auto-generate entry number (JE-YYYY-NNNNNN)
-- ─────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS journal_entry_seq START 1;

CREATE OR REPLACE FUNCTION generate_entry_number(p_org_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_year  TEXT := TO_CHAR(NOW(), 'YYYY');
  v_count INT;
BEGIN
  SELECT COUNT(*) + 1 INTO v_count
  FROM journal_entries
  WHERE org_id = p_org_id
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());

  RETURN 'JE-' || v_year || '-' || LPAD(v_count::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_entry_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.entry_number IS NULL OR NEW.entry_number = '' THEN
    NEW.entry_number = generate_entry_number(NEW.org_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_entry_number
  BEFORE INSERT ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION set_entry_number();

-- ─────────────────────────────────────────────────────────────
-- RLS: journal_entries
-- ─────────────────────────────────────────────────────────────
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_can_view_journal"
  ON journal_entries FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY "staff_can_create_draft_journal"
  ON journal_entries FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager', 'staff')
        AND is_active = TRUE
    )
  );

CREATE POLICY "managers_can_post_or_void"
  ON journal_entries FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
        AND is_active = TRUE
    )
  );

-- ─────────────────────────────────────────────────────────────
-- RLS: journal_lines
-- ─────────────────────────────────────────────────────────────
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_can_view_journal_lines"
  ON journal_lines FOR SELECT
  USING (
    entry_id IN (
      SELECT je.id FROM journal_entries je
      JOIN org_members om ON om.org_id = je.org_id
      WHERE om.user_id = auth.uid() AND om.is_active = TRUE
    )
  );

CREATE POLICY "staff_can_manage_draft_lines"
  ON journal_lines FOR ALL
  USING (
    entry_id IN (
      SELECT je.id FROM journal_entries je
      JOIN org_members om ON om.org_id = je.org_id
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'manager', 'staff')
        AND om.is_active = TRUE
        AND je.status = 'DRAFT'
    )
  );

-- ─────────────────────────────────────────────────────────────
-- View: account_balances (running balance per account per org)
-- Used by dashboard and reports
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW account_balances AS
SELECT
  a.org_id,
  a.id AS account_id,
  a.code,
  a.name,
  a.type,
  a.normal_balance,
  COALESCE(SUM(jl.debit), 0)  AS total_debit,
  COALESCE(SUM(jl.credit), 0) AS total_credit,
  CASE
    WHEN a.normal_balance = 'DEBIT'
      THEN COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0)
    ELSE
      COALESCE(SUM(jl.credit), 0) - COALESCE(SUM(jl.debit), 0)
  END AS balance
FROM accounts a
LEFT JOIN journal_lines jl ON jl.account_id = a.id
LEFT JOIN journal_entries je ON je.id = jl.entry_id AND je.status = 'POSTED'
WHERE a.is_active = TRUE
GROUP BY a.org_id, a.id, a.code, a.name, a.type, a.normal_balance;

-- FIX: Allow authenticated users to create organizations
CREATE POLICY "authenticated_users_can_insert_orgs"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- FIX: Set security definer on trigger functions to allow setup
ALTER FUNCTION seed_default_roles() SECURITY DEFINER;
ALTER FUNCTION seed_default_coa(p_org_id UUID) SECURITY DEFINER;
ALTER FUNCTION trigger_seed_coa() SECURITY DEFINER;

