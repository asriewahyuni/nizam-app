-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 1322: Bus Pools (Pool / Agen Resmi PO Bus)
-- Pool adalah kantor agen atau titik penjualan tiket yang terafiliasi dengan PO.
-- Fitur: registrasi pool, deposit saldo, settlement komisi.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── bus_pools ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bus_pools (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id        UUID REFERENCES branches(id) ON DELETE SET NULL,

  -- Identitas pool
  code             VARCHAR(30) NOT NULL,
  name             VARCHAR(200) NOT NULL,
  pool_type        VARCHAR(20) NOT NULL DEFAULT 'AGEN_RESMI',
  -- POOL_UTAMA | AGEN_RESMI | SUB_AGEN

  -- Penanggung jawab
  owner_name       VARCHAR(150),
  pic_name         VARCHAR(150),          -- Person In Charge / koordinator harian
  phone            VARCHAR(50),
  whatsapp         VARCHAR(50),
  email            VARCHAR(255),

  -- Lokasi
  address          TEXT,
  city             VARCHAR(100),
  province         VARCHAR(100),
  gps_coords       VARCHAR(100),          -- "lat,lng"

  -- Keuangan
  commission_pct   NUMERIC(5,2) NOT NULL DEFAULT 0,  -- % komisi per tiket
  deposit_balance  NUMERIC(20,2) NOT NULL DEFAULT 0,  -- saldo deposit saat ini
  credit_limit     NUMERIC(20,2) NOT NULL DEFAULT 0,  -- limit kredit (alternatif deposit)

  -- Rekening bank untuk pembayaran komisi
  bank_name        VARCHAR(100),
  bank_account     VARCHAR(50),
  bank_account_name VARCHAR(150),

  is_active        BOOLEAN NOT NULL DEFAULT true,
  notes            TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(org_id, code)
);

-- ─── bus_pool_top_ups (top-up saldo deposit pool) ─────────────────────────────
CREATE TABLE IF NOT EXISTS bus_pool_top_ups (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  pool_id          UUID NOT NULL REFERENCES bus_pools(id) ON DELETE CASCADE,

  amount           NUMERIC(20,2) NOT NULL CHECK (amount > 0),
  payment_method   VARCHAR(30) NOT NULL DEFAULT 'TRANSFER',
  -- TRANSFER | TUNAI | CAIR_KOMISI
  reference_no     VARCHAR(100),
  notes            TEXT,

  recorded_by      UUID REFERENCES internal_auth_users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── bus_pool_settlements (settlement komisi ke pool) ─────────────────────────
CREATE TABLE IF NOT EXISTS bus_pool_settlements (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  pool_id          UUID NOT NULL REFERENCES bus_pools(id) ON DELETE CASCADE,

  period_start     DATE NOT NULL,
  period_end       DATE NOT NULL,
  total_tickets    INTEGER NOT NULL DEFAULT 0,
  total_revenue    NUMERIC(20,2) NOT NULL DEFAULT 0,
  commission_pct   NUMERIC(5,2) NOT NULL DEFAULT 0,
  commission_amount NUMERIC(20,2) NOT NULL DEFAULT 0,

  payment_method   VARCHAR(30) DEFAULT 'TRANSFER',
  reference_no     VARCHAR(100),
  status           VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  -- PENDING | DIBAYAR

  notes            TEXT,
  paid_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Tambah pool_id ke bus_agents ─────────────────────────────────────────────
ALTER TABLE bus_agents
  ADD COLUMN IF NOT EXISTS pool_id UUID REFERENCES bus_pools(id) ON DELETE SET NULL;

-- ─── Tambah pool_id ke bus_tickets ────────────────────────────────────────────
ALTER TABLE bus_tickets
  ADD COLUMN IF NOT EXISTS pool_id UUID REFERENCES bus_pools(id) ON DELETE SET NULL;

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bus_pools_org_id
  ON bus_pools(org_id);

CREATE INDEX IF NOT EXISTS idx_bus_pools_org_active
  ON bus_pools(org_id, is_active);

CREATE INDEX IF NOT EXISTS idx_bus_pool_top_ups_pool
  ON bus_pool_top_ups(pool_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bus_pool_settlements_pool
  ON bus_pool_settlements(pool_id, period_start DESC);

CREATE INDEX IF NOT EXISTS idx_bus_agents_pool_id
  ON bus_agents(pool_id)
  WHERE pool_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bus_tickets_pool_id
  ON bus_tickets(pool_id)
  WHERE pool_id IS NOT NULL;
