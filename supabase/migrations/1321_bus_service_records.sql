-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 1321: Bus Service Records — Standalone
-- Membuat tabel bus_service_records yang berdiri sendiri (FK → bus_units),
-- menggantikan penggunaan fleet_maintenance_labs untuk modul PO Bus.
-- Alasan: Sejak migration 1320 (PO Bus Standalone), bus_units tidak lagi
-- bergantung pada fleet_assets. fleet_maintenance_labs.asset_id mereferensi
-- fleet_assets(id), sehingga menyisipkan bus_unit.id ke sana menyebabkan
-- error FK/trigger.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bus_service_records (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id        UUID REFERENCES branches(id) ON DELETE SET NULL,
  bus_id           UUID NOT NULL REFERENCES bus_units(id) ON DELETE CASCADE,

  service_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  description      TEXT NOT NULL,
  maintenance_type VARCHAR(50) NOT NULL DEFAULT 'ROUTINE',
  -- ROUTINE | CORRECTIVE | PREVENTIVE | EMERGENCY

  cost             NUMERIC(20,2) NOT NULL DEFAULT 0,
  odometer_at      INTEGER,
  technician_name  VARCHAR(150),
  next_service_km  INTEGER,
  next_service_date DATE,

  notes            TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bus_service_records_org_id
  ON bus_service_records(org_id);

CREATE INDEX IF NOT EXISTS idx_bus_service_records_bus
  ON bus_service_records(org_id, bus_id);

CREATE INDEX IF NOT EXISTS idx_bus_service_records_date
  ON bus_service_records(org_id, service_date DESC);
