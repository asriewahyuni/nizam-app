/**
 * scripts/apply_1244_child_local_coa_and_consolidation_mapping.mjs
 *
 * Menerapkan migration 1244 ke database aktif, lalu memverifikasi:
 * - organizations.coa_management_mode
 * - tabel coa_consolidation_mappings
 * - function get_org_coa_management_mode
 * - function can_manage_finance_master
 */

import fs from 'node:fs'
import pg from 'pg'
import nextEnv from '@next/env'

const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd())

const dbUrl =
  process.env.RAILWAY_DATABASE_URL ||
  process.env.DATABASE_PUBLIC_URL ||
  process.env.DATABASE_URL

if (!dbUrl) {
  throw new Error('DATABASE_URL / RAILWAY_DATABASE_URL / DATABASE_PUBLIC_URL tidak ditemukan')
}

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
})

async function verifyColumn() {
  const result = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organizations'
      AND column_name = 'coa_management_mode'
    LIMIT 1
  `)

  if (!result.rowCount) {
    throw new Error('Kolom organizations.coa_management_mode tidak ditemukan setelah migrasi.')
  }

  return result.rows[0]
}

async function verifyTable() {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'coa_consolidation_mappings'
    ) AS exists
  `)

  if (!result.rows[0]?.exists) {
    throw new Error('Tabel public.coa_consolidation_mappings tidak ditemukan setelah migrasi.')
  }
}

async function verifyFunction(functionName) {
  const result = await client.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname = $1
      ) AS exists
    `,
    [functionName]
  )

  if (!result.rows[0]?.exists) {
    throw new Error(`Function public.${functionName} tidak ditemukan setelah migrasi.`)
  }
}

async function summarizeSeededMappings() {
  const result = await client.query(`
    SELECT COUNT(*)::int AS total
    FROM public.coa_consolidation_mappings
    WHERE is_active = TRUE
  `)

  return Number(result.rows[0]?.total || 0)
}

async function run() {
  await client.connect()
  console.log('Terhubung ke database aktif.')

  const migrationSql = fs.readFileSync(
    'supabase/migrations/1244_child_local_coa_and_consolidation_mapping.sql',
    'utf8'
  )

  console.log('Menjalankan migration 1244...')
  await client.query(migrationSql)
  console.log('Migration 1244 selesai dijalankan.')

  const column = await verifyColumn()
  await verifyTable()
  await verifyFunction('get_org_coa_management_mode')
  await verifyFunction('can_manage_finance_master')
  const mappingCount = await summarizeSeededMappings()

  console.log(
    [
      `Kolom terverifikasi: organizations.${column.column_name}`,
      `Tipe: ${column.data_type}`,
      `Nullable: ${column.is_nullable}`,
      `Default: ${column.column_default ?? 'null'}`,
      `Mapping aktif saat ini: ${mappingCount}`,
    ].join('\n')
  )
  console.log('Migration 1244 terverifikasi.')
}

run()
  .catch((error) => {
    console.error(`Gagal: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
  .finally(() => client.end())
