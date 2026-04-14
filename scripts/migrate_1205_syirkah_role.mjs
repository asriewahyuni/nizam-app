import { Client } from 'pg'

async function run() {
  const client = new Client({
    connectionString: process.env.RAILWAY_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  })

  try {
    await client.connect()
    console.log('Connected to Railway DB')

    // Drop existing constraint and re-add with new value
    await client.query(`
      ALTER TABLE public.syirkah_members
        DROP CONSTRAINT IF EXISTS syirkah_members_role_check;

      ALTER TABLE public.syirkah_members
        ADD CONSTRAINT syirkah_members_role_check
          CHECK (role IN ('PEMODAL', 'PENGELOLA', 'PEMODAL_PENGELOLA'));
    `)

    console.log('Migration 1205 done: added PEMODAL_PENGELOLA role')
  } catch (err) {
    console.error('Migration failed:', err)
    process.exit(1)
  } finally {
    await client.end()
  }
}

run()
