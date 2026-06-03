-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 1319: PO Bus Foundation — Bintang Marwah
-- Tabel spesifik untuk manajemen Perusahaan Otobus:
--   bus_mechanics      — daftar mekanik internal/eksternal
--   bus_tire_records   — rekam ban per unit bus
--   bus_emergency_calls — log emergency call (bus mogok/kecelakaan)
--   bus_agents         — agen penjualan tiket
-- Catatan: Unit bus, crew, servis, rute, jadwal, tiket, checkpoint
--          menggunakan tabel fleet yang sudah ada (fleet_assets, employees,
--          fleet_maintenance_labs, fleet_routes, fleet_schedules,
--          fleet_tickets, fleet_terminals).
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── bus_mechanics ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bus_mechanics (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id        UUID REFERENCES branches(id) ON DELETE SET NULL,

  -- Identitas
  name             VARCHAR(150) NOT NULL,
  phone            VARCHAR(50),
  specialization   VARCHAR(150),  -- e.g. "Mesin Diesel", "Elektrikal", "Rem & Kopling"
  is_active        BOOLEAN NOT NULL DEFAULT true,
  notes            TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── bus_tire_records ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bus_tire_records (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id        UUID REFERENCES branches(id) ON DELETE SET NULL,
  asset_id         UUID NOT NULL REFERENCES fleet_assets(id) ON DELETE CASCADE,

  -- Posisi ban
  position         VARCHAR(10) NOT NULL,
  -- FL (Front Left) | FR (Front Right) | RL (Rear Left) | RR (Rear Right)
  -- RLL (Rear Left Luar) | RLT (Rear Left Tengah) | RLI (Rear Left Dalam)
  -- RRL (Rear Right Luar) | RRT (Rear Right Tengah) | RRI (Rear Right Dalam)
  -- SPARE

  -- Detail ban
  brand            VARCHAR(100),
  size             VARCHAR(50),   -- e.g. "11.00R20", "295/80R22.5"
  installed_at     DATE,
  odometer_at      INTEGER,       -- km saat pemasangan
  mileage_limit_km INTEGER,       -- estimasi batas pemakaian km
  notes            TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── bus_emergency_calls ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bus_emergency_calls (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id            UUID REFERENCES branches(id) ON DELETE SET NULL,

  -- Armada & Kru yang melaporkan
  asset_id             UUID REFERENCES fleet_assets(id) ON DELETE SET NULL,
  reporter_name        VARCHAR(150) NOT NULL,  -- nama pelapor (driver/kernet)

  -- Waktu & Lokasi
  call_time            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  location_description TEXT,
  location_gps         VARCHAR(100),  -- "lat,lng"

  -- Jenis kejadian
  issue_type           VARCHAR(30) NOT NULL DEFAULT 'MOGOK',
  -- MOGOK | KECELAKAAN | BAN_BOCOR | OVERHEAT | LAINNYA

  description          TEXT,

  -- Penanganan
  assigned_mechanic_id UUID REFERENCES bus_mechanics(id) ON DELETE SET NULL,
  status               VARCHAR(20) NOT NULL DEFAULT 'BUKA',
  -- BUKA | DALAM_PROSES | SELESAI

  resolved_at          TIMESTAMPTZ,
  resolution_notes     TEXT,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── bus_agents ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bus_agents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id        UUID REFERENCES branches(id) ON DELETE SET NULL,

  -- Identitas agen
  name             VARCHAR(150) NOT NULL,
  phone            VARCHAR(50),
  email            VARCHAR(255),
  address          TEXT,
  city             VARCHAR(100),

  -- Komisi & Status
  commission_pct   NUMERIC(5, 2) DEFAULT 0,  -- persentase komisi tiket
  is_active        BOOLEAN NOT NULL DEFAULT true,
  notes            TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bus_mechanics_org_id
  ON bus_mechanics(org_id);

CREATE INDEX IF NOT EXISTS idx_bus_mechanics_org_active
  ON bus_mechanics(org_id, is_active);

CREATE INDEX IF NOT EXISTS idx_bus_tire_records_org_id
  ON bus_tire_records(org_id);

CREATE INDEX IF NOT EXISTS idx_bus_tire_records_asset
  ON bus_tire_records(org_id, asset_id);

CREATE INDEX IF NOT EXISTS idx_bus_emergency_calls_org_id
  ON bus_emergency_calls(org_id);

CREATE INDEX IF NOT EXISTS idx_bus_emergency_calls_status
  ON bus_emergency_calls(org_id, status);

CREATE INDEX IF NOT EXISTS idx_bus_emergency_calls_asset
  ON bus_emergency_calls(org_id, asset_id)
  WHERE asset_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bus_agents_org_id
  ON bus_agents(org_id);

CREATE INDEX IF NOT EXISTS idx_bus_agents_org_active
  ON bus_agents(org_id, is_active);
