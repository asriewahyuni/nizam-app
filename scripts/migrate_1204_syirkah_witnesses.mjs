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
      CREATE TABLE IF NOT EXISTS public.syirkah_witnesses (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        contract_id UUID NOT NULL REFERENCES public.syirkah_contracts(id) ON DELETE CASCADE,
        witness_name VARCHAR(255) NOT NULL,
        gender VARCHAR(10) NOT NULL CHECK (gender IN ('LAKI-LAKI', 'PEREMPUAN')),
        nik VARCHAR(50),
        address TEXT,
        phone VARCHAR(50),
        sign_token VARCHAR(255) DEFAULT encode(gen_random_bytes(12), 'hex') UNIQUE,
        signed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_syirkah_witnesses_contract_id ON public.syirkah_witnesses(contract_id);
      CREATE INDEX IF NOT EXISTS idx_syirkah_witnesses_sign_token ON public.syirkah_witnesses(sign_token);
    `
    await client.query(sql)
    console.log('Migration 1204 done: syirkah_witnesses table created')
  } catch (err) {
    console.error('Migration failed:', err)
    process.exit(1)
  } finally {
    await client.end()
  }
}

run()
