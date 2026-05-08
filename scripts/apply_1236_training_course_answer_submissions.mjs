import fs from 'fs'
import pg from 'pg'
import nextEnv from '@next/env'

const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd())

const MIGRATION_FILE = 'supabase/migrations/1236_training_course_answer_submissions.sql'

const dbUrl =
  process.env.RAILWAY_DATABASE_URL ||
  process.env.DATABASE_PUBLIC_URL ||
  process.env.DATABASE_URL

if (!dbUrl) {
  console.error('❌ Tidak ada DATABASE_URL ditemukan di environment lokal')
  process.exit(1)
}

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
})

async function run() {
  await client.connect()
  console.log('✅ Terhubung ke Railway PostgreSQL...')

  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8')
  await client.query(sql)

  const verification = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'training_course_answer_submissions'
    ORDER BY ordinal_position
  `)

  const columnNames = verification.rows.map((row) => String(row.column_name || ''))
  const requiredColumns = [
    'id',
    'org_id',
    'course_slug',
    'participant_name',
    'theory_answers',
    'practical_answers',
    'status',
    'created_at',
    'updated_at',
  ]

  const missingColumns = requiredColumns.filter((columnName) => !columnNames.includes(columnName))
  if (missingColumns.length) {
    throw new Error(`Verifikasi gagal: kolom berikut belum terbentuk: ${missingColumns.join(', ')}`)
  }

  console.log(`✅ Migration ${MIGRATION_FILE} berhasil dijalankan!`)
  console.log('✅ Verifikasi tabel training_course_answer_submissions berhasil.')
}

run().catch(async (error) => {
  console.error('❌ Migration gagal:', error?.message || error)
  process.exitCode = 1
}).finally(async () => {
  try {
    await client.end()
  } catch {}
})
