#!/usr/bin/env node
/**
 * migrate-pending.mjs
 * Apply semua file migrasi di supabase/migrations/ yang belum pernah dijalankan ke Railway.
 * Tracking dilakukan via tabel `schema_migrations` di database target.
 *
 * Urutan prioritas koneksi:
 *   1. RAILWAY_DATABASE_URL (env)
 *   2. DATABASE_URL (env)
 *   3. Baca dari .env.local
 */

import fs from 'fs'
import path from 'path'
import { Client } from 'pg'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations')

// ─── Load .env.local jika variabel belum ada di environment ──────────────────

function loadEnvLocal() {
  const envFile = path.join(ROOT, '.env.local')
  if (!fs.existsSync(envFile)) return
  const lines = fs.readFileSync(envFile, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx < 0) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const raw = trimmed.slice(eqIdx + 1).trim()
    const val = raw.replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnvLocal()

// ─── Resolve connection string ────────────────────────────────────────────────

const DB_URL = process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL

if (!DB_URL) {
  console.error('❌ Tidak ada DATABASE_URL atau RAILWAY_DATABASE_URL.')
  console.error('   Tambahkan ke .env.local atau export ke environment.')
  process.exit(1)
}

// ─── Sorting numerik file migrasi ─────────────────────────────────────────────

function getMigrationNumber(filename) {
  const match = filename.match(/^(\d+)/)
  return match ? parseInt(match[1], 10) : 0
}

function getSortedMigrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort((a, b) => getMigrationNumber(a) - getMigrationNumber(b))
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const client = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false },
  })

  try {
    await client.connect()
    console.log('✅ Terhubung ke Railway database.')

    // Pastikan tabel tracking ada
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        filename   TEXT        PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    // Ambil daftar migrasi yang sudah diterapkan
    const { rows } = await client.query(
      'SELECT filename FROM public.schema_migrations'
    )
    const applied = new Set(rows.map(r => r.filename))

    // Cari migrasi yang belum diterapkan
    const allFiles = getSortedMigrationFiles()
    const pending = allFiles.filter(f => !applied.has(f))

    if (pending.length === 0) {
      console.log('✅ Tidak ada migrasi baru. Database sudah up-to-date.')
      return
    }

    console.log(`\n📋 ${pending.length} migrasi pending:\n`)
    pending.forEach(f => console.log(`   • ${f}`))
    console.log('')

    let successCount = 0
    let failCount = 0

    for (const filename of pending) {
      const filePath = path.join(MIGRATIONS_DIR, filename)
      const sql = fs.readFileSync(filePath, 'utf8')

      process.stdout.write(`   ⏳ ${filename} ... `)

      try {
        await client.query('BEGIN')
        await client.query(sql)
        await client.query(
          'INSERT INTO public.schema_migrations (filename) VALUES ($1)',
          [filename]
        )
        await client.query('COMMIT')
        console.log('✅ OK')
        successCount++
      } catch (err) {
        await client.query('ROLLBACK')
        console.log(`❌ GAGAL`)
        console.error(`      ${err.message}\n`)
        failCount++

        // Hentikan jika ada migrasi yang gagal — jangan skip
        console.error(`\n⛔ Migrasi dihentikan di "${filename}". Perbaiki error di atas.`)
        break
      }
    }

    console.log(`\n─────────────────────────────────────────`)
    console.log(`✅ Berhasil : ${successCount}`)
    if (failCount > 0) {
      console.log(`❌ Gagal    : ${failCount}`)
      process.exit(1)
    }
    console.log(`─────────────────────────────────────────\n`)

  } finally {
    await client.end()
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
