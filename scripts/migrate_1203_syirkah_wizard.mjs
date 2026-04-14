import { Client } from 'pg'

async function run() {
  const client = new Client({
    connectionString: process.env.RAILWAY_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  })

  try {
    await client.connect()
    console.log('Connected to Railway DB')

    const sql = `
      -- Kolom baru untuk syirkah_contracts
      ALTER TABLE public.syirkah_contracts
        ADD COLUMN IF NOT EXISTS business_name VARCHAR(255),
        ADD COLUMN IF NOT EXISTS business_description TEXT,
        ADD COLUMN IF NOT EXISTS business_document_url TEXT,
        ADD COLUMN IF NOT EXISTS duration_months INTEGER DEFAULT 12,
        ADD COLUMN IF NOT EXISTS clauses JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS signed_by JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS wizard_step INTEGER DEFAULT 1;

      -- Kolom baru untuk syirkah_members
      ALTER TABLE public.syirkah_members
        ADD COLUMN IF NOT EXISTS nik VARCHAR(50),
        ADD COLUMN IF NOT EXISTS address TEXT,
        ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
        ADD COLUMN IF NOT EXISTS email VARCHAR(255),
        ADD COLUMN IF NOT EXISTS sign_token VARCHAR(255) DEFAULT encode(gen_random_bytes(12), 'hex'),
        ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP WITH TIME ZONE;
    `
    await client.query(sql)
    console.log('Migration 1203 done: syirkah wizard fields added')
  } catch (err) {
    console.error('Migration failed:', err)
    process.exit(1)
  } finally {
    await client.end()
  }
}

run()
