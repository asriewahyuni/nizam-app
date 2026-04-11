#!/usr/bin/env node
/**
 * Verify whether Railway is ready to replace Supabase for SQL data + auth.
 *
 * What this checks:
 * - public table row counts between Supabase and Railway
 * - auth.users coverage in Railway for public foreign keys
 * - internal_auth_users coverage in Railway for auth cutover
 * - Supabase Storage usage summary (advisory only)
 *
 * Default source:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 *
 * Default target:
 * - --target-db-url
 * - RAILWAY_DATABASE_URL / DATABASE_PUBLIC_URL / DATABASE_URL
 * - railway CLI variables lookup
 */
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'
import { Client as PgClient } from 'pg'
import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'

const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd())

const DEFAULT_EXCLUDES = [
  'public.internal_auth_users',
  'public.internal_auth_sessions',
]
const RAILWAY_CLI_CANDIDATES = [
  process.env.RAILWAY_CLI_PATH,
  '/Users/manbook/.npm/_npx/79fa66f96c8fdacf/node_modules/@railway/cli/bin/railway',
].filter(Boolean)
const REST_RETRY_ATTEMPTS = Number(process.env.SUPABASE_MIGRATION_RETRY_ATTEMPTS || 3)
const REST_RETRY_DELAY_MS = Number(process.env.SUPABASE_MIGRATION_RETRY_DELAY_MS || 500)

function printHelp() {
  console.log(
    [
      'Usage: node scripts/check-railway-cutover-readiness.mjs [options]',
      '',
      'Options:',
      '  --target-db-url <url>        Override Railway target DB URL',
      '  --service <name>             Railway service name (default: Postgres)',
      '  --schema <schema[,schema]>   Schemas to check (default: public)',
      '  --exclude <schema.table>     Exclude table(s), repeatable or CSV',
      '  --help                       Show this help',
      '',
      'Source env required:',
      '  NEXT_PUBLIC_SUPABASE_URL',
      '  SUPABASE_SERVICE_ROLE_KEY',
    ].join('\n')
  )
}

function requireEnv(name, value) {
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseArgs(argv) {
  const args = {
    targetDbUrl: '',
    service: 'Postgres',
    schemas: ['public'],
    excludes: [],
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || '').trim()
    if (!token) continue

    if (token === '--help' || token === '-h') {
      args.help = true
      continue
    }

    if (token === '--target-db-url' || token === '--db-url') {
      args.targetDbUrl = String(argv[index + 1] || '').trim()
      index += 1
      continue
    }

    if (token.startsWith('--target-db-url=')) {
      args.targetDbUrl = token.slice('--target-db-url='.length).trim()
      continue
    }

    if (token.startsWith('--db-url=')) {
      args.targetDbUrl = token.slice('--db-url='.length).trim()
      continue
    }

    if (token === '--service') {
      args.service = String(argv[index + 1] || '').trim() || 'Postgres'
      index += 1
      continue
    }

    if (token.startsWith('--service=')) {
      args.service = token.slice('--service='.length).trim() || 'Postgres'
      continue
    }

    if (token === '--schema') {
      args.schemas = splitCsv(argv[index + 1] || '')
      index += 1
      continue
    }

    if (token.startsWith('--schema=')) {
      args.schemas = splitCsv(token.slice('--schema='.length))
      continue
    }

    if (token === '--exclude') {
      args.excludes.push(...splitCsv(argv[index + 1] || ''))
      index += 1
      continue
    }

    if (token.startsWith('--exclude=')) {
      args.excludes.push(...splitCsv(token.slice('--exclude='.length)))
      continue
    }

    throw new Error(`Unknown argument: ${token}`)
  }

  if (args.schemas.length === 0) args.schemas = ['public']
  args.excludes = Array.from(new Set([...DEFAULT_EXCLUDES, ...args.excludes]))
  return args
}

function maskDbUrl(dbUrl) {
  try {
    const url = new URL(dbUrl)
    if (url.password) url.password = '***'
    return url.toString()
  } catch {
    return dbUrl
  }
}

function runCommand(cmd, argv) {
  const result = spawnSync(cmd, argv, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  if (result.error) throw result.error

  if (typeof result.status === 'number' && result.status !== 0) {
    throw new Error(
      [
        `Command failed: ${cmd} ${argv.join(' ')}`,
        String(result.stdout || '').trim(),
        String(result.stderr || '').trim(),
      ]
        .filter(Boolean)
        .join('\n\n')
    )
  }

  return String(result.stdout || '')
}

function resolveCliBinary(candidates, fallback) {
  const resolved = candidates.find((candidate) => existsSync(String(candidate)))
  return resolved || fallback
}

function runRailwayCommand(argv) {
  const binary = resolveCliBinary(RAILWAY_CLI_CANDIDATES, 'npx')
  return runCommand(binary, binary === 'npx' ? ['@railway/cli', ...argv] : argv)
}

function resolveRailwayDbUrlCandidates(serviceName) {
  const candidates = []
  const envUrl =
    String(process.env.RAILWAY_DATABASE_URL || '').trim() ||
    String(process.env.DATABASE_PUBLIC_URL || '').trim() ||
    String(process.env.DATABASE_URL || '').trim()

  if (envUrl) {
    candidates.push({ source: 'env', url: envUrl })
  }

  try {
    const stdout = runRailwayCommand(['variables', '--service', serviceName, '--json'])
    const parsed = JSON.parse(stdout)
    const fromRailway =
      String(parsed?.DATABASE_PUBLIC_URL || '').trim() ||
      String(parsed?.DATABASE_URL || '').trim()

    if (fromRailway && !candidates.some((candidate) => candidate.url === fromRailway)) {
      candidates.push({ source: 'railway-cli', url: fromRailway })
    }
  } catch (error) {
    if (!envUrl) {
      throw error
    }

    console.warn(`Railway CLI lookup skipped: ${String(error?.message || error)}`)
  }

  if (candidates.length === 0) {
    throw new Error(`Could not resolve Railway DB URL for service "${serviceName}".`)
  }

  return candidates
}

function quoteIdent(value) {
  return `"${String(value).replace(/"/g, '""')}"`
}

function tableKey(schema, table) {
  return `${schema}.${table}`
}

async function connectTarget(url) {
  const client = new PgClient({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()
  return client
}

async function resolveTargetConnection(args) {
  const candidates = args.targetDbUrl
    ? [{ source: 'argument', url: args.targetDbUrl }]
    : resolveRailwayDbUrlCandidates(args.service)

  let lastError = null
  for (const candidate of candidates) {
    try {
      const client = await connectTarget(candidate.url)
      return {
        client,
        dbUrl: candidate.url,
        source: candidate.source,
      }
    } catch (error) {
      lastError = error
      console.error(`Target candidate failed (${candidate.source}): ${String(error?.message || error)}`)
    }
  }

  throw new Error(
    [
      'Failed to connect to target Railway DB.',
      lastError ? String(lastError?.message || lastError) : '',
    ]
      .filter(Boolean)
      .join('\n')
  )
}

async function listTargetTables(client, schemas, excludes) {
  const excludeSet = new Set(excludes.map((item) => item.toLowerCase()))
  const { rows } = await client.query(
    `
      select schemaname, tablename
      from pg_tables
      where schemaname = any($1::text[])
        and tablename <> 'schema_migrations'
      order by schemaname, tablename
    `,
    [schemas]
  )

  return rows
    .map((row) => ({
      schema: String(row.schemaname || '').trim(),
      table: String(row.tablename || '').trim(),
    }))
    .filter((row) => row.schema && row.table)
    .filter((row) => !excludeSet.has(tableKey(row.schema, row.table).toLowerCase()))
}

async function countTargetRows(client, schema, table) {
  const sql = `select count(*)::bigint as total from ${quoteIdent(schema)}.${quoteIdent(table)}`
  const { rows } = await client.query(sql)
  return Number(rows[0]?.total || 0)
}

async function countSourceRows(sourceClient, schema, table) {
  for (let attempt = 1; attempt <= REST_RETRY_ATTEMPTS; attempt += 1) {
    const query = sourceClient.schema(schema).from(table).select('*', { count: 'exact', head: true })
    const { count, error } = await query
    if (!error) {
      return {
        total: Number(count || 0),
        error: null,
      }
    }

    const message = String(error.message || '').trim() || 'Unknown Supabase error'
    if (attempt === REST_RETRY_ATTEMPTS) {
      return {
        total: null,
        error: message,
      }
    }

    console.warn(
      `Retrying source count for ${tableKey(schema, table)} (${attempt}/${REST_RETRY_ATTEMPTS - 1} retries used): ${message}`
    )
    await delay(REST_RETRY_DELAY_MS * attempt)
  }

  return {
    total: null,
    error: 'Unknown retry failure',
  }
}

async function listSupabaseObjectsRecursively(client, bucket, prefix = '') {
  const items = []
  let offset = 0

  while (true) {
    const { data, error } = await client.storage.from(bucket).list(prefix, {
      limit: 100,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })

    if (error) throw error

    const batch = data || []
    for (const item of batch) {
      const path = prefix ? `${prefix}/${item.name}` : item.name
      if (!item.id) {
        items.push(...await listSupabaseObjectsRecursively(client, bucket, path))
      } else {
        items.push(path)
      }
    }

    if (batch.length < 100) break
    offset += 100
  }

  return items
}

async function buildStorageSummary(sourceClient) {
  const { data: buckets, error } = await sourceClient.storage.listBuckets()
  if (error) {
    return {
      buckets: [],
      totalBuckets: 0,
      totalObjects: 0,
      error: error.message,
    }
  }

  const rows = []
  let totalObjects = 0
  for (const bucket of buckets || []) {
    const objects = await listSupabaseObjectsRecursively(sourceClient, bucket.id)
    totalObjects += objects.length
    rows.push({
      id: String(bucket.id),
      public: Boolean(bucket.public),
      objectCount: objects.length,
    })
  }

  return {
    buckets: rows.sort((left, right) => right.objectCount - left.objectCount || left.id.localeCompare(right.id)),
    totalBuckets: rows.length,
    totalObjects,
    error: null,
  }
}

async function buildAuthSummary(client) {
  const { rows } = await client.query(`
    select
      (select count(*)::int from auth.users) as auth_users_total,
      (select count(*)::int from public.org_members m left join auth.users u on u.id = m.user_id where m.user_id is not null and m.is_active = true and u.id is null) as orphan_active_org_members,
      (select count(*)::int from public.employees e left join auth.users u on u.id = e.user_id where e.user_id is not null and u.id is null) as orphan_employees,
      (
        select case
          when to_regclass('public.internal_auth_users') is null then 0
          else (select count(*)::int from public.internal_auth_users)
        end
      ) as internal_auth_users_total,
      (
        select case
          when to_regclass('public.internal_auth_users') is null then 0
          else (
            select count(*)::int
            from auth.users u
            left join public.internal_auth_users iau on iau.legacy_user_id = u.id
            where iau.id is null
          )
        end
      ) as auth_users_missing_internal_auth
  `)

  return rows[0] || {
    auth_users_total: 0,
    orphan_active_org_members: 0,
    orphan_employees: 0,
    internal_auth_users_total: 0,
    auth_users_missing_internal_auth: 0,
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    return
  }

  const sourceUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL)
  const sourceServiceRole = requireEnv('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY)
  const sourceClient = createClient(sourceUrl, sourceServiceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const target = await resolveTargetConnection(args)
  const targetClient = target.client

  try {
    const tables = await listTargetTables(targetClient, args.schemas, args.excludes)
    if (tables.length === 0) {
      throw new Error('No target tables found for selected schema(s).')
    }

    console.log('Railway cutover readiness')
    console.log(`Source URL       : ${sourceUrl}`)
    console.log(`Target DB        : ${maskDbUrl(target.dbUrl)}`)
    console.log(`Target resolver  : ${target.source}`)
    console.log(`Schemas          : ${args.schemas.join(', ')}`)
    if (args.excludes.length > 0) {
      console.log(`Exclude          : ${args.excludes.join(', ')}`)
    }
    console.log(`Tables to verify : ${tables.length}`)

    const mismatches = []
    const sourceErrors = []

    for (const item of tables) {
      const key = tableKey(item.schema, item.table)
      const [source, targetCount] = await Promise.all([
        countSourceRows(sourceClient, item.schema, item.table),
        countTargetRows(targetClient, item.schema, item.table),
      ])

      if (source.error) {
        sourceErrors.push({
          table: key,
          error: source.error,
        })
        continue
      }

      const sourceCount = Number(source.total || 0)
      if (sourceCount !== targetCount) {
        mismatches.push({
          table: key,
          sourceCount,
          targetCount,
          delta: targetCount - sourceCount,
        })
      }
    }

    const authSummary = await buildAuthSummary(targetClient)
    const storageSummary = await buildStorageSummary(sourceClient)

    console.log('\n=== Public Table Parity ===')
    console.log(`Matched tables : ${tables.length - mismatches.length - sourceErrors.length}`)
    console.log(`Mismatches     : ${mismatches.length}`)
    console.log(`Source errors  : ${sourceErrors.length}`)

    if (mismatches.length > 0) {
      console.table(mismatches.slice(0, 30))
    }

    if (sourceErrors.length > 0) {
      console.table(sourceErrors.slice(0, 30))
    }

    console.log('\n=== Railway Auth Readiness ===')
    console.log(`auth.users total               : ${Number(authSummary.auth_users_total || 0)}`)
    console.log(`orphan active org_members      : ${Number(authSummary.orphan_active_org_members || 0)}`)
    console.log(`orphan employees               : ${Number(authSummary.orphan_employees || 0)}`)
    console.log(`internal_auth_users total      : ${Number(authSummary.internal_auth_users_total || 0)}`)
    console.log(`auth.users missing internal    : ${Number(authSummary.auth_users_missing_internal_auth || 0)}`)

    console.log('\n=== Supabase Storage Summary ===')
    if (storageSummary.error) {
      console.log(`storage audit error            : ${storageSummary.error}`)
    } else {
      console.log(`buckets                        : ${storageSummary.totalBuckets}`)
      console.log(`objects                        : ${storageSummary.totalObjects}`)
      if (storageSummary.buckets.length > 0) {
        console.table(storageSummary.buckets.slice(0, 10))
      }
    }

    const hasAuthGap =
      Number(authSummary.orphan_active_org_members || 0) > 0 ||
      Number(authSummary.orphan_employees || 0) > 0 ||
      Number(authSummary.auth_users_missing_internal_auth || 0) > 0

    if (mismatches.length > 0 || sourceErrors.length > 0 || hasAuthGap) {
      console.log('\nResult: NOT READY')
      process.exitCode = 1
      return
    }

    console.log('\nResult: READY for Railway SQL/auth cutover')
    if (!storageSummary.error && storageSummary.totalObjects > 0) {
      console.log('Advisory: Supabase Storage masih dipakai. SQL/auth siap, tetapi runtime belum 100% lepas dari Supabase Storage.')
    }
  } finally {
    await targetClient.end()
  }
}

main().catch((error) => {
  console.error(String(error?.message || error))
  process.exit(1)
})
