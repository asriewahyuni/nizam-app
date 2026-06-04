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

-- bus_tire_records dan bus_emergency_calls dihapus dari sini.
-- Keduanya dibuat ulang di migration 1320 dengan FK ke bus_units (standalone).

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


CREATE INDEX IF NOT EXISTS idx_bus_agents_org_id
  ON bus_agents(org_id);

CREATE INDEX IF NOT EXISTS idx_bus_agents_org_active
  ON bus_agents(org_id, is_active);
