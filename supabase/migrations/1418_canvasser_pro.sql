-- ==========================================
-- MIGRATION 1418: Tirta Canvasser Pro
-- Field-sales / van-distribution module: daily van sessions, outlet visits,
-- on-site orders with HQ-locked pricing, AR/credit-limit display with
-- auto-block, and cash/AR collection consolidated into one closing journal.
-- Wires into the existing 'Mobile Canvassing' module slot (/sales/co-sales).
--
-- Note: no RLS on these tables — matches the sibling workshop_* tables
-- (migration 1243), the most recent precedent in this schema. RLS policies
-- keyed on auth.uid()/get_my_org_ids() are inert under internal auth (the
-- app's Postgres connection does not carry a Supabase JWT session), so
-- authorization here — like everywhere else post-migration — is enforced by
-- explicit org_id filtering in application code, not by the database.
-- ==========================================

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(20,2) NOT NULL DEFAULT 0;

-- ─── canvasser_vans: Unit kendaraan canvasser ─────────────────────────────────
CREATE TABLE IF NOT EXISTS canvasser_vans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id       UUID REFERENCES branches(id) ON DELETE SET NULL,

  code            VARCHAR(20) NOT NULL,
  name            VARCHAR(100) NOT NULL,
  plate_number    VARCHAR(20),
  driver_name     VARCHAR(150) NOT NULL,
  driver_phone    VARCHAR(50),

  fixed_asset_id  UUID REFERENCES fixed_assets(id) ON DELETE SET NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  notes           TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(org_id, code)
);

-- ─── canvasser_sessions: Sesi harian per van ──────────────────────────────────
CREATE TABLE IF NOT EXISTS canvasser_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  van_id          UUID NOT NULL REFERENCES canvasser_vans(id) ON DELETE CASCADE,

  session_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  status          VARCHAR(20) NOT NULL DEFAULT 'AKTIF',
  -- AKTIF | SELESAI

  opening_stock   JSONB NOT NULL DEFAULT '[]',
  -- [{ product_id, product_name, qty_loaded, unit }]
  closing_stock   JSONB DEFAULT NULL,
  -- [{ product_id, product_name, qty_return, unit }]

  total_cash_collected  NUMERIC(20,2) NOT NULL DEFAULT 0,
  total_ar_collected    NUMERIC(20,2) NOT NULL DEFAULT 0,
  total_sales           NUMERIC(20,2) NOT NULL DEFAULT 0,

  closing_journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,

  notes           TEXT,
  closed_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── canvasser_visits: Kunjungan per outlet ───────────────────────────────────
CREATE TABLE IF NOT EXISTS canvasser_visits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id      UUID NOT NULL REFERENCES canvasser_sessions(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,

  visit_order     INTEGER NOT NULL DEFAULT 0,
  contact_name    VARCHAR(200) NOT NULL,
  address         TEXT,

  status          VARCHAR(20) NOT NULL DEFAULT 'BELUM',
  -- BELUM | DALAM_PERJALANAN | SELESAI | SKIP

  ar_outstanding  NUMERIC(20,2) NOT NULL DEFAULT 0,
  credit_limit    NUMERIC(20,2) NOT NULL DEFAULT 0,
  ar_status       VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
  -- NORMAL | MENDEKATI_LIMIT | BLOKIR

  arrived_at      TIMESTAMPTZ,
  departed_at     TIMESTAMPTZ,
  gps_lat         NUMERIC(10,6),
  gps_lng         NUMERIC(10,6),

  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── canvasser_orders: Pesanan yang diambil saat kunjungan ───────────────────
CREATE TABLE IF NOT EXISTS canvasser_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id      UUID NOT NULL REFERENCES canvasser_sessions(id) ON DELETE CASCADE,
  visit_id        UUID NOT NULL REFERENCES canvasser_visits(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,

  order_number    VARCHAR(30) NOT NULL,
  payment_method  VARCHAR(20) NOT NULL DEFAULT 'TUNAI',
  -- TUNAI | TRANSFER | KREDIT

  subtotal        NUMERIC(20,2) NOT NULL DEFAULT 0,
  discount        NUMERIC(20,2) NOT NULL DEFAULT 0,
  total           NUMERIC(20,2) NOT NULL DEFAULT 0,

  status          VARCHAR(20) NOT NULL DEFAULT 'SELESAI',
  -- SELESAI | BATAL

  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(org_id, order_number)
);

-- ─── canvasser_order_items: Item per pesanan ──────────────────────────────────
CREATE TABLE IF NOT EXISTS canvasser_order_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES canvasser_orders(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES products(id) ON DELETE SET NULL,

  product_name    VARCHAR(200) NOT NULL,
  qty             NUMERIC(10,2) NOT NULL,
  unit            VARCHAR(30) NOT NULL DEFAULT 'pcs',
  unit_price      NUMERIC(20,2) NOT NULL,
  subtotal        NUMERIC(20,2) NOT NULL
);

-- ─── canvasser_ar_collections: Tagihan AR yang berhasil dikumpulkan ───────────
CREATE TABLE IF NOT EXISTS canvasser_ar_collections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id      UUID NOT NULL REFERENCES canvasser_sessions(id) ON DELETE CASCADE,
  visit_id        UUID NOT NULL REFERENCES canvasser_visits(id) ON DELETE CASCADE,
  contact_id      UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

  amount          NUMERIC(20,2) NOT NULL CHECK (amount > 0),
  payment_method  VARCHAR(20) NOT NULL DEFAULT 'TUNAI',
  reference_no    VARCHAR(100),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_canvasser_vans_org ON canvasser_vans(org_id, is_active);
CREATE INDEX IF NOT EXISTS idx_canvasser_sessions_van ON canvasser_sessions(van_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_canvasser_sessions_date ON canvasser_sessions(org_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_canvasser_visits_session ON canvasser_visits(session_id, visit_order);
CREATE INDEX IF NOT EXISTS idx_canvasser_orders_session ON canvasser_orders(session_id);
CREATE INDEX IF NOT EXISTS idx_canvasser_orders_visit ON canvasser_orders(visit_id);
CREATE INDEX IF NOT EXISTS idx_canvasser_ar_collections_session ON canvasser_ar_collections(session_id);

-- New journal reference type for the consolidated session-close entry.
ALTER TYPE journal_reference_type ADD VALUE IF NOT EXISTS 'CANVASSER_SESSION_CLOSE';
