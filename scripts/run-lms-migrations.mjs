import fs from 'fs'
import path from 'path'
import { Client } from 'pg'

const DATABASE_URL = 'postgresql://postgres:WizrKrHnupxehsBQmpqnlxOgMANBAbVB@maglev.proxy.rlwy.net:25780/railway'

async function runMigrations() {
  const client = new Client({ connectionString: DATABASE_URL })
  
  try {
    await client.connect()
    console.log('Connected to database')

    const migrationsDir = path.join(process.cwd(), 'supabase/migrations')
    const filesToRun = [
      '1248_lms_commercial_schema.sql'
    ]

    for (const file of filesToRun) {
      console.log(`Running migration: ${file}`)
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
      await client.query(sql)
      console.log(`Successfully executed ${file}`)
    }

  } catch (error) {
    console.error('Migration failed:', error)
  } finally {
    await client.end()
    console.log('Disconnected')
  }
}

runMigrations()
