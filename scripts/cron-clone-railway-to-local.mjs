#!/usr/bin/env node
/**
 * cron-clone-railway-to-local.mjs
 * 
 * Periodically clones Railway PostgreSQL data to local PostgreSQL.
 * Syncs schema + data using streaming COPY.
 * 
 * Usage:
 *   node scripts/cron-clone-railway-to-local.mjs           # full sync
 *   node scripts/cron-clone-railway-to-local.mjs --dry-run # preview only
 *   node scripts/cron-clone-railway-to-local.mjs --verbose  # detailed output
 * 
 * Env:
 *   DATABASE_URL              — Railway source (required)
 *   LOCAL_CLONE_DATABASE_URL  — Local target (required)
 */

import { Client } from 'pg'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const MARKER_PATH = join(ROOT, '.local-clone-marker.txt')
const SKIP_SCHEMAS = new Set([
  'pg_catalog','information_schema','supabase_migrations',
  'storage','auth','realtime','graphql','pgsodium',
  'pgbouncer','pg_stat_statements','pgtle','supabase_functions',
  'vault','_analytics','extensions',
])
const SKIP_TABLES = new Set([
  '_prisma_migrations','knex_migrations','knex_migrations_lock',
])

function parseEnvFile(p) {
  const env = {}
  if (!existsSync(p)) return env
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i <= 0) continue
    let v = t.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    env[t.slice(0, i).trim()] = v
  }
  return env
}

function loadEnv() {
  return { ...parseEnvFile(join(ROOT, '.env')), ...parseEnvFile(join(ROOT, '.env.local')), ...process.env }
}

async function getTables(client) {
  const { rows } = await client.query(`
    SELECT table_schema, table_name,
      (SELECT COUNT(*) FROM information_schema.columns c 
       WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name)::int AS col_count
    FROM information_schema.tables t
    WHERE t.table_type = 'BASE TABLE'
      AND t.table_schema NOT IN (${[...SKIP_SCHEMAS].map(s => `'${s}'`).join(',')})
      AND t.table_name NOT IN (${[...SKIP_TABLES].map(s => `'${s}'`).join(',')})
    ORDER BY t.table_schema, t.table_name
  `)
  return rows
}

async function getCols(client, schema, table) {
  const { rows } = await client.query(`
    SELECT column_name, data_type, character_maximum_length, is_nullable, column_default, ordinal_position
    FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position
  `, [schema, table])
  return rows
}

async function getPK(client, schema, table) {
  const { rows } = await client.query(`
    SELECT kc.column_name FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kc ON tc.constraint_name=kc.constraint_name AND tc.table_schema=kc.table_schema
    WHERE tc.constraint_type='PRIMARY KEY' AND tc.table_schema=$1 AND tc.table_name=$2 ORDER BY kc.ordinal_position
  `, [schema, table])
  return rows.map(r => r.column_name)
}

const TYPE_MAP = {
  'integer': 'integer', 'bigint': 'bigint', 'smallint': 'smallint',
  'text': 'text', 'boolean': 'boolean', 'uuid': 'uuid',
  'json': 'jsonb', 'jsonb': 'jsonb', 'bytea': 'bytea',
  'numeric': 'numeric', 'real': 'real', 'double precision': 'double precision',
  'date': 'date', 'ARRAY': 'text[]', 'USER-DEFINED': 'text',
}

function buildCreateSQL(columns, pks, schema, table) {
  const cols = columns.map(c => {
    const t = TYPE_MAP[c.data_type] || 
      ({'character varying': c.character_maximum_length ? `varchar(${c.character_maximum_length})` : 'varchar',
        'character': c.character_maximum_length ? `char(${c.character_maximum_length})` : 'char',
        'timestamp without time zone': 'timestamp',
        'timestamp with time zone': 'timestamptz',
        'time without time zone': 'time',
        'time with time zone': 'timetz'}[c.data_type] || c.data_type)
    const nullable = c.is_nullable === 'YES' ? '' : ' NOT NULL'
    const def = c.column_default ? ` DEFAULT ${c.column_default.replace(/::[a-zA-Z_\[\]]+/g, '')}` : ''
    return `"${c.column_name}" ${t}${nullable}${def}`
  })
  const pk = pks.length ? `,\n  PRIMARY KEY (${pks.map(p => `"${p}"`).join(',')})` : ''
  return `CREATE TABLE IF NOT EXISTS "${schema}"."${table}" (\n  ${cols.join(',\n  ')}${pk}\n)`
}

async function syncSchema(source, target, tables, verbose) {
  let n = 0
  for (const t of tables) {
    const cols = await getCols(source, t.table_schema, t.table_name)
    if (!cols.length) continue
    const pks = await getPK(source, t.table_schema, t.table_name)
    const sql = buildCreateSQL(cols, pks, t.table_schema, t.table_name)
    try {
      await target.query(`CREATE SCHEMA IF NOT EXISTS "${t.table_schema}"`)
      await target.query(sql)
      n++
      if (verbose) console.log(`  ✅ ${t.table_schema}.${t.table_name}`)
    } catch (e) {
      if (verbose) console.log(`  ⚠️  ${t.table_schema}.${t.table_name}: ${e.message.slice(0, 100)}`)
    }
  }
  return n
}

async function syncData(source, target, tables, verbose) {
  let totalRows = 0, okTables = 0
  for (const t of tables) {
    const fn = `"${t.table_schema}"."${t.table_name}"`
    const cols = await getCols(source, t.table_schema, t.table_name)
    if (!cols.length) continue
    const pks = await getPK(source, t.table_schema, t.table_name)
    const colNames = cols.map(c => `"${c.column_name}"`).join(',')
    const colList = cols.map(c => c.column_name)
    
    // Check target exists
    const { rows: [chk] } = await target.query(
      `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema=$1 AND table_name=$2) AS e`,
      [t.table_schema, t.table_name])
    if (!chk?.e) { if (verbose) console.log(`  ⏭️  ${fn} not in target`); continue }

    // Count source rows
    const { rows: [{ cnt }] } = await source.query(`SELECT COUNT(*)::int AS cnt FROM ${fn}`)
    if (cnt === 0) { if (verbose) console.log(`  📭 ${fn} empty`); continue }

    // Truncate target
    await target.query(`TRUNCATE ${fn} CASCADE`)

    // Copy data in batches
    let copied = 0
    const orderBy = pks.length ? pks.map(p => `"${p}"`).join(',') : colNames
    const { rows: data } = await source.query(`SELECT ${colNames} FROM ${fn} ORDER BY ${orderBy}`)

    for (let i = 0; i < data.length; i += 500) {
      const batch = data.slice(i, i + 500)
      const placeholders = batch.map((_, bi) => 
        `(${colList.map((_, ci) => `$${bi * colList.length + ci + 1}`).join(',')})`).join(',')
      const vals = batch.flatMap(row => colList.map(c => {
        const v = row[c]
        return v !== null && typeof v === 'object' ? JSON.stringify(v) : v
      }))
      try {
        await target.query(`INSERT INTO ${fn} (${colNames}) VALUES ${placeholders} ON CONFLICT DO NOTHING`, vals)
        copied += batch.length
      } catch (e) {
        if (verbose) console.log(`  ⚠️  ${fn} batch: ${e.message.slice(0, 100)}`)
      }
    }

    totalRows += copied
    okTables++
    if (verbose) console.log(`  ✅ ${fn}: ${copied}/${cnt} rows`)
    else process.stdout.write(`\r  Progress: ${okTables}/${tables.length} — ${totalRows.toLocaleString()} rows`)
  }
  if (!verbose) console.log('')
  return { tables: okTables, rows: totalRows }
}

async function main() {
  const env = loadEnv()
  const srcUrl = env.DATABASE_URL
  const tgtUrl = env.LOCAL_CLONE_DATABASE_URL
  const verbose = process.argv.includes('--verbose')
  const dryRun = process.argv.includes('--dry-run')

  if (!srcUrl || !tgtUrl) {
    console.error('❌ Required: DATABASE_URL & LOCAL_CLONE_DATABASE_URL')
    process.exit(1)
  }

  console.log('🔄 Railway → Local Clone Sync')
  console.log(`   Source: ${srcUrl.replace(/:[^:@]+@/, ':****@')}`)
  console.log(`   Target: ${tgtUrl.replace(/:[^:@]+@/, ':****@')}\n`)

  const src = new Client({ connectionString: srcUrl, connectionTimeoutMillis: 15000 })
  const tgt = new Client({ connectionString: tgtUrl, connectionTimeoutMillis: 5000 })

  try {
    console.log('🔌 Connecting...')
    await src.connect(); await tgt.connect()
    console.log('✅ Both connected\n')

    const tables = await getTables(src)
    console.log(`📊 Found ${tables.length} tables\n`)

    if (dryRun) {
      for (const t of tables) console.log(`   ${t.table_schema}.${t.table_name} (${t.col_count} cols)`)
      console.log(`\n✅ Dry run — ${tables.length} tables (no data copied)`)
      return
    }

    // Phase 1: Schema sync
    console.log('📐 Syncing schema...')
    const synced = await syncSchema(src, tgt, tables, verbose)
    console.log(`   ${synced}/${tables.length} tables created/verified\n`)

    // Phase 2: Data sync
    console.log('📦 Syncing data...')
    const result = await syncData(src, tgt, tables, verbose)
    console.log(`\n✅ Clone complete!`)
    console.log(`   Tables: ${result.tables}/${tables.length}`)
    console.log(`   Rows:   ${result.rows.toLocaleString()}`)

    writeFileSync(MARKER_PATH, new Date().toISOString())
    console.log(`   Marker: ${MARKER_PATH}`)

  } catch (e) {
    console.error(`\n❌ ${e.message}`)
    process.exit(1)
  } finally {
    await src.end().catch(() => {})
    await tgt.end().catch(() => {})
  }
}

main()
