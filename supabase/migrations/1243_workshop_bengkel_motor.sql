-- Modul Operasional Bengkel Motor
-- Menyediakan tabel untuk manajemen kendaraan, SPK, dan item pekerjaan bengkel.

-- Tabel kendaraan milik pelanggan
CREATE TABLE IF NOT EXISTS workshop_vehicles (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id      UUID        REFERENCES branches(id),
  contact_id     UUID        REFERENCES contacts(id),
  plate_number   TEXT        NOT NULL,
  brand          TEXT        NOT NULL,
  model          TEXT        NOT NULL,
  year           INTEGER,
  color          TEXT,
  engine_number  TEXT,
  chassis_number TEXT,
  fuel_type      TEXT        NOT NULL DEFAULT 'BENSIN',
  transmission   TEXT        NOT NULL DEFAULT 'MANUAL',
  last_odometer  INTEGER     NOT NULL DEFAULT 0,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indeks untuk pencarian kendaraan
CREATE INDEX IF NOT EXISTS idx_workshop_vehicles_org_id       ON workshop_vehicles(org_id);
CREATE INDEX IF NOT EXISTS idx_workshop_vehicles_contact_id   ON workshop_vehicles(contact_id);
CREATE INDEX IF NOT EXISTS idx_workshop_vehicles_plate_number ON workshop_vehicles(plate_number);

-- Tabel Surat Perintah Kerja (SPK) bengkel
CREATE TABLE IF NOT EXISTS workshop_work_orders (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id           UUID        REFERENCES branches(id),
  spk_number          TEXT        NOT NULL,
  vehicle_id          UUID        REFERENCES workshop_vehicles(id),
  contact_id          UUID        REFERENCES contacts(id),
  mechanic_name       TEXT,
  status              TEXT        NOT NULL DEFAULT 'ANTRI',
    -- Status: ANTRI | DIKERJAKAN | MENUNGGU_PART | SELESAI | DISERAHKAN | CANCEL
  customer_complaint  TEXT,
  diagnosis           TEXT,
  odometer_in         INTEGER,
  odometer_out        INTEGER,
  estimated_finish    TIMESTAMPTZ,
  actual_finish       TIMESTAMPTZ,
  subtotal            NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount            NUMERIC(15,2) NOT NULL DEFAULT 0,
  total               NUMERIC(15,2) NOT NULL DEFAULT 0,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_workshop_spk_number UNIQUE (org_id, spk_number),
  CONSTRAINT chk_workshop_status CHECK (status IN ('ANTRI','DIKERJAKAN','MENUNGGU_PART','SELESAI','DISERAHKAN','CANCEL'))
);

-- Indeks untuk SPK
CREATE INDEX IF NOT EXISTS idx_workshop_work_orders_org_id     ON workshop_work_orders(org_id);
CREATE INDEX IF NOT EXISTS idx_workshop_work_orders_vehicle_id ON workshop_work_orders(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_workshop_work_orders_contact_id ON workshop_work_orders(contact_id);
CREATE INDEX IF NOT EXISTS idx_workshop_work_orders_status     ON workshop_work_orders(status);

-- Tabel item pekerjaan (jasa servis + spare part)
CREATE TABLE IF NOT EXISTS workshop_work_order_items (
  id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id  UUID           NOT NULL REFERENCES workshop_work_orders(id) ON DELETE CASCADE,
  item_type      TEXT           NOT NULL DEFAULT 'JASA',
    -- JASA | PART
  name           TEXT           NOT NULL,
  quantity       NUMERIC(10,2)  NOT NULL DEFAULT 1,
  unit_price     NUMERIC(15,2)  NOT NULL DEFAULT 0,
  subtotal       NUMERIC(15,2)  GENERATED ALWAYS AS (quantity * unit_price) STORED,
  notes          TEXT,
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_workshop_item_type CHECK (item_type IN ('JASA','PART'))
);

CREATE INDEX IF NOT EXISTS idx_workshop_items_work_order_id ON workshop_work_order_items(work_order_id);

-- Fungsi update timestamp otomatis
CREATE OR REPLACE FUNCTION update_workshop_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_workshop_vehicles_updated_at
  BEFORE UPDATE ON workshop_vehicles
  FOR EACH ROW EXECUTE FUNCTION update_workshop_updated_at();

CREATE TRIGGER trg_workshop_work_orders_updated_at
  BEFORE UPDATE ON workshop_work_orders
  FOR EACH ROW EXECUTE FUNCTION update_workshop_updated_at();
