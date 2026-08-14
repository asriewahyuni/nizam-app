-- ==========================================
-- MIGRATION 1421: Canvasser employee identity + van GPS location
-- Links canvasser_vans to a real employees record (canvasser is no longer
-- just a free-text driver_name) so AR/transaction ledgers can be queried
-- per canvasser, not just per van code. Also adds a lightweight last-known
-- location table for the supervisor dashboard's GPS view.
-- ==========================================

ALTER TABLE canvasser_vans
  ADD COLUMN IF NOT EXISTS canvasser_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_canvasser_vans_employee ON canvasser_vans(canvasser_employee_id);

-- ─── canvasser_van_locations: Lokasi terakhir per van (last-known GPS ping) ───
CREATE TABLE IF NOT EXISTS canvasser_van_locations (
  van_id      UUID PRIMARY KEY REFERENCES canvasser_vans(id) ON DELETE CASCADE,
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  lat         NUMERIC(10,6) NOT NULL,
  lng         NUMERIC(10,6) NOT NULL,
  accuracy_m  NUMERIC(8,2),

  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- No RLS — matches sibling canvasser_* tables (migration 1418 precedent).

CREATE INDEX IF NOT EXISTS idx_canvasser_van_locations_org ON canvasser_van_locations(org_id);
