import { queryPostgres } from '../lib/db/postgres'

async function run() {
  console.log('Running Cargo Pro Max Migrations...')
  
  const sql = `
    -- 1. Create fleet_cargo_tariffs table
    CREATE TABLE IF NOT EXISTS fleet_cargo_tariffs (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      origin_terminal_id UUID NOT NULL REFERENCES fleet_terminals(id),
      destination_terminal_id UUID NOT NULL REFERENCES fleet_terminals(id),
      base_price NUMERIC NOT NULL DEFAULT 0,
      price_per_kg NUMERIC NOT NULL DEFAULT 0,
      price_per_m3 NUMERIC NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(org_id, origin_terminal_id, destination_terminal_id)
    );

    -- 2. Alter fleet_cargo_shipments to add koli_count
    ALTER TABLE fleet_cargo_shipments
    ADD COLUMN IF NOT EXISTS koli_count INTEGER DEFAULT 1 NOT NULL;
  `
  
  try {
    await queryPostgres(sql)
    console.log('Migration successful!')
  } catch (e) {
    console.error('Migration failed:', e)
  }
}

run()
