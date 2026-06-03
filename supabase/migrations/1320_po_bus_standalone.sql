-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 1320: PO Bus Standalone — Lepas dari Fleet Management
-- Semua tabel PO Bus berdiri sendiri, tidak bergantung fleet_*.
-- Tabel baru: bus_units, bus_crew, bus_routes, bus_schedules, bus_tickets,
--             bus_checkpoints
-- Rekreasi: bus_tire_records, bus_emergency_calls (FK → bus_units)
-- Tetap: bus_mechanics, bus_agents (tidak ada perubahan)
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Drop tabel lama yang masih bergantung ke fleet_assets ───────────────────
DROP TABLE IF EXISTS bus_tire_records;
DROP TABLE IF EXISTS bus_emergency_calls;

-- ─── bus_units ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bus_units (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id        UUID REFERENCES branches(id) ON DELETE SET NULL,

  -- Identitas kendaraan
  plate_number     VARCHAR(20) NOT NULL,
  brand            VARCHAR(100) NOT NULL,
  model            VARCHAR(100) NOT NULL,
  year             INTEGER,
  capacity         INTEGER,          -- jumlah kursi
  body_type        VARCHAR(50),      -- e.g. "Patas", "Ekonomi", "Executive"
  engine_number    VARCHAR(100),
  chassis_number   VARCHAR(100),
  color            VARCHAR(50),

  -- Operasional
  status           VARCHAR(20) NOT NULL DEFAULT 'TERSEDIA',
  -- TERSEDIA | BEROPERASI | SERVIS | TIDAK_AKTIF
  odometer         INTEGER DEFAULT 0,

  -- Finansial (integrasi aset tetap)
  purchase_price   NUMERIC(20,2),
  purchase_date    DATE,
  fixed_asset_id   UUID,             -- FK ke fixed_assets (soft ref)

  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(org_id, plate_number)
);

-- ─── bus_crew ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bus_crew (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id        UUID REFERENCES branches(id) ON DELETE SET NULL,

  name             VARCHAR(150) NOT NULL,
  role             VARCHAR(30) NOT NULL DEFAULT 'DRIVER',
  -- DRIVER | CO_DRIVER | KERNET | KONDEKTUR

  phone            VARCHAR(50),
  nik              VARCHAR(20),
  license_number   VARCHAR(50),
  license_expiry   DATE,
  blood_type       VARCHAR(5),
  join_date        DATE,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  notes            TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── bus_routes ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bus_routes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id        UUID REFERENCES branches(id) ON DELETE SET NULL,

  name             VARCHAR(200) NOT NULL,
  origin           VARCHAR(100) NOT NULL,
  destination      VARCHAR(100) NOT NULL,
  distance_km      NUMERIC(10,2),
  duration_hours   NUMERIC(5,2),     -- estimasi lama perjalanan
  base_price       NUMERIC(20,2) NOT NULL DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT true,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── bus_schedules ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bus_schedules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id        UUID REFERENCES branches(id) ON DELETE SET NULL,

  route_id         UUID NOT NULL REFERENCES bus_routes(id) ON DELETE RESTRICT,
  bus_id           UUID NOT NULL REFERENCES bus_units(id) ON DELETE RESTRICT,
  driver_id        UUID REFERENCES bus_crew(id) ON DELETE SET NULL,
  helper_id        UUID REFERENCES bus_crew(id) ON DELETE SET NULL,

  departure_time   TIMESTAMPTZ NOT NULL,
  arrival_time     TIMESTAMPTZ,
  status           VARCHAR(20) NOT NULL DEFAULT 'TERJADWAL',
  -- TERJADWAL | BERANGKAT | TIBA | BATAL

  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── bus_tickets ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bus_tickets (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id        UUID REFERENCES branches(id) ON DELETE SET NULL,

  schedule_id      UUID NOT NULL REFERENCES bus_schedules(id) ON DELETE RESTRICT,
  agent_id         UUID REFERENCES bus_agents(id) ON DELETE SET NULL,

  -- Data penumpang (tidak perlu FK ke contacts, bisa walk-in)
  passenger_name   VARCHAR(150) NOT NULL,
  passenger_phone  VARCHAR(50),
  seat_number      VARCHAR(10) NOT NULL,
  price            NUMERIC(20,2) NOT NULL DEFAULT 0,

  status           VARCHAR(20) NOT NULL DEFAULT 'DIPESAN',
  -- DIPESAN | DIBAYAR | DIGUNAKAN | BATAL

  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── bus_checkpoints ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bus_checkpoints (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id        UUID REFERENCES branches(id) ON DELETE SET NULL,

  name             VARCHAR(150) NOT NULL,
  location_name    VARCHAR(255),
  gps_coords       VARCHAR(100),     -- "lat,lng"
  is_active        BOOLEAN NOT NULL DEFAULT true,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── bus_tire_records (rekreasi → FK ke bus_units) ───────────────────────────
CREATE TABLE IF NOT EXISTS bus_tire_records (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id        UUID REFERENCES branches(id) ON DELETE SET NULL,
  bus_id           UUID NOT NULL REFERENCES bus_units(id) ON DELETE CASCADE,

  position         VARCHAR(10) NOT NULL,
  -- FL | FR | RL | RR | RLL | RLT | RLI | RRL | RRT | RRI | SPARE

  brand            VARCHAR(100),
  size             VARCHAR(50),
  installed_at     DATE,
  odometer_at      INTEGER,
  mileage_limit_km INTEGER,
  notes            TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── bus_emergency_calls (rekreasi → FK ke bus_units) ────────────────────────
CREATE TABLE IF NOT EXISTS bus_emergency_calls (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id            UUID REFERENCES branches(id) ON DELETE SET NULL,

  bus_id               UUID REFERENCES bus_units(id) ON DELETE SET NULL,
  reporter_name        VARCHAR(150) NOT NULL,

  call_time            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  location_description TEXT,
  location_gps         VARCHAR(100),

  issue_type           VARCHAR(30) NOT NULL DEFAULT 'MOGOK',
  -- MOGOK | KECELAKAAN | BAN_BOCOR | OVERHEAT | LAINNYA

  description          TEXT,
  assigned_mechanic_id UUID REFERENCES bus_mechanics(id) ON DELETE SET NULL,

  status               VARCHAR(20) NOT NULL DEFAULT 'BUKA',
  -- BUKA | DALAM_PROSES | SELESAI

  resolved_at          TIMESTAMPTZ,
  resolution_notes     TEXT,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bus_units_org_id ON bus_units(org_id);
CREATE INDEX IF NOT EXISTS idx_bus_units_org_status ON bus_units(org_id, status);

CREATE INDEX IF NOT EXISTS idx_bus_crew_org_id ON bus_crew(org_id);
CREATE INDEX IF NOT EXISTS idx_bus_crew_org_active ON bus_crew(org_id, is_active);

CREATE INDEX IF NOT EXISTS idx_bus_routes_org_id ON bus_routes(org_id);

CREATE INDEX IF NOT EXISTS idx_bus_schedules_org_id ON bus_schedules(org_id);
CREATE INDEX IF NOT EXISTS idx_bus_schedules_org_status ON bus_schedules(org_id, status);
CREATE INDEX IF NOT EXISTS idx_bus_schedules_departure ON bus_schedules(org_id, departure_time DESC);

CREATE INDEX IF NOT EXISTS idx_bus_tickets_org_id ON bus_tickets(org_id);
CREATE INDEX IF NOT EXISTS idx_bus_tickets_schedule ON bus_tickets(schedule_id);

CREATE INDEX IF NOT EXISTS idx_bus_checkpoints_org_id ON bus_checkpoints(org_id);

CREATE INDEX IF NOT EXISTS idx_bus_tire_records_bus ON bus_tire_records(org_id, bus_id);

CREATE INDEX IF NOT EXISTS idx_bus_emergency_calls_org ON bus_emergency_calls(org_id);
CREATE INDEX IF NOT EXISTS idx_bus_emergency_calls_status ON bus_emergency_calls(org_id, status);
