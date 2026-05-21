#!/usr/bin/env node
/**
 * Sync SQL table data from Supabase REST API to Railway Postgres.
 *
 * Why this exists:
 * - Works without `supabase login` linked mode.
 * - Works without local Docker / local Supabase stack.
 *
 * Source:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 *
 * Target:
 * - --target-db-url, or
 * - RAILWAY_DATABASE_URL / DATABASE_PUBLIC_URL / DATABASE_URL, or
 * - railway CLI variables lookup.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'

const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd())

const PAGE_SIZE = Number(process.env.SUPABASE_MIGRATION_PAGE_SIZE || 500)
const INSERT_CHUNK = Number(process.env.RAILWAY_DATA_SYNC_INSERT_CHUNK || 200)
const REST_RETRY_ATTEMPTS = Number(process.env.SUPABASE_MIGRATION_RETRY_ATTEMPTS || 3)
const REST_RETRY_DELAY_MS = Number(process.env.SUPABASE_MIGRATION_RETRY_DELAY_MS || 500)
const DEFAULT_EXCLUDES = [
  'public.internal_auth_users',
  'public.internal_auth_sessions',
]
const SUPABASE_CLI_CANDIDATES = [
  process.env.SUPABASE_CLI_PATH,
  '/Users/manbook/.npm/_npx/aa8e5c70f9d8d161/node_modules/supabase/bin/supabase',
].filter(Boolean)
const RAILWAY_CLI_CANDIDATES = [
  process.env.RAILWAY_CLI_PATH,
  '/Users/manbook/.npm/_npx/79fa66f96c8fdacf/node_modules/@railway/cli/bin/railway',
].filter(Boolean)
const ENUM_FALLBACKS = {
  nizam_department: 'CONFIG',
}

function printHelp() {
  console.log(
    [
      'Usage: node scripts/sync-supabase-rest-to-railway.mjs [options]',
      '',
      'Options:',
      '  --apply                      Apply changes (default: dry-run only)',
      '  --service <name>             Railway service name (default: Postgres)',
      '  --target-db-url <url>        Override Railway target DB URL',
      '  --schema <schema[,schema]>   Schemas to include (default: public)',
      '  --exclude <schema.table>     Exclude table(s), repeatable or CSV',
      '  --keep-files                 Keep temporary SQL files',
      '  --help                       Show this help',
      '',
      'Default excludes:',
      '  public.internal_auth_users',
      '  public.internal_auth_sessions',
      '',
      'Source env required:',
      '  NEXT_PUBLIC_SUPABASE_URL',
      '  SUPABASE_SERVICE_ROLE_KEY',
    ].join('\n')
  )
}

function requireEnv(name, value) {
  if (!value) {
    throw new Error(`Missing ${name}`)
  }
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
    apply: false,
    service: 'Postgres',
    targetDbUrl: '',
    schemas: ['public'],
    excludes: [],
    keepFiles: false,
    help: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--apply') args.apply = true
    else if (token === '--keep-files') args.keepFiles = true
    else if (token === '--help' || token === '-h') args.help = true
    else if (token === '--service') {
      args.service = String(argv[i + 1] || '').trim() || 'Postgres'
      i += 1
    } else if (token.startsWith('--service=')) {
      args.service = token.slice('--service='.length).trim() || 'Postgres'
    } else if (token === '--target-db-url' || token === '--db-url') {
      args.targetDbUrl = String(argv[i + 1] || '').trim()
      i += 1
    } else if (token.startsWith('--target-db-url=')) {
      args.targetDbUrl = token.slice('--target-db-url='.length).trim()
    } else if (token.startsWith('--db-url=')) {
      args.targetDbUrl = token.slice('--db-url='.length).trim()
    } else if (token === '--schema') {
      args.schemas = splitCsv(argv[i + 1] || '')
      i += 1
    } else if (token.startsWith('--schema=')) {
      args.schemas = splitCsv(token.slice('--schema='.length))
    } else if (token === '--exclude') {
      args.excludes.push(...splitCsv(argv[i + 1] || ''))
      i += 1
    } else if (token.startsWith('--exclude=')) {
      args.excludes.push(...splitCsv(token.slice('--exclude='.length)))
    } else {
      throw new Error(`Unknown argument: ${token}`)
    }
  }

  if (args.schemas.length === 0) args.schemas = ['public']
  args.excludes = Array.from(new Set([...DEFAULT_EXCLUDES, ...args.excludes]))
  return args
}

function maskDbUrl(dbUrl) {
  try {
    const u = new URL(dbUrl)
    if (u.password) u.password = '***'
    return u.toString()
  } catch {
    return dbUrl
  }
}

function parseDbQueryJson(raw) {
  const trimmed = String(raw || '').trim()
  const idxArray = trimmed.indexOf('[')
  const idxObject = trimmed.indexOf('{')
  const starts = [idxArray, idxObject].filter((i) => i >= 0)
  if (starts.length === 0) {
    throw new Error(`Cannot parse JSON output:\n${trimmed}`)
  }
  const jsonText = trimmed.slice(Math.min(...starts))
  const parsed = JSON.parse(jsonText)
  if (Array.isArray(parsed)) return parsed
  if (Array.isArray(parsed?.data)) return parsed.data
  if (Array.isArray(parsed?.result)) return parsed.result
  throw new Error(`Unexpected JSON shape: ${jsonText.slice(0, 200)}`)
}

function runCommand(cmd, argv, options = {}) {
  const { inherit = false } = options
  const safeArgs = argv.map((arg) => {
    const text = String(arg || '')
    return /^postgres(ql)?:\/\//i.test(text) ? maskDbUrl(text) : text
  })

  const result = spawnSync(cmd, argv, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  if (result.error) throw result.error

  const stdout = String(result.stdout || '')
  const stderr = String(result.stderr || '')

  if (inherit) {
    if (stdout) process.stdout.write(stdout)
    if (stderr) process.stderr.write(stderr)
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    throw new Error(
      [
        `Command failed: ${cmd} ${safeArgs.join(' ')}`,
        stdout ? `stdout:\n${stdout}` : '',
        stderr ? `stderr:\n${stderr}` : '',
      ]
        .filter(Boolean)
        .join('\n\n')
    )
  }

  return stdout
}

function resolveCliBinary(candidates, fallback) {
  const resolved = candidates.find((candidate) => existsSync(String(candidate)))
  return resolved || fallback
}

function runSupabaseCommand(argv, options = {}) {
  const binary = resolveCliBinary(SUPABASE_CLI_CANDIDATES, 'npx')
  return runCommand(binary, binary === 'npx' ? ['supabase', ...argv] : argv, options)
}

function runRailwayCommand(argv, options = {}) {
  const binary = resolveCliBinary(RAILWAY_CLI_CANDIDATES, 'npx')
  return runCommand(binary, binary === 'npx' ? ['@railway/cli', ...argv] : argv, options)
}

function runDbQueryJson({ sql, dbUrl }) {
  const stdout = runSupabaseCommand([
    'db',
    'query',
    '-o',
    'json',
    '--agent',
    'no',
    '--db-url',
    dbUrl,
    sql,
  ])
  return parseDbQueryJson(stdout)
}

function runDbQuerySql({ sql, dbUrl }) {
  runSupabaseCommand(['db', 'query', '--agent', 'no', '--db-url', dbUrl, sql], {
    inherit: true,
  })
}

function runDbQueryFile({ dbUrl, filePath }) {
  runSupabaseCommand(['db', 'query', '--agent', 'no', '--db-url', dbUrl, '--file', filePath], {
    inherit: true,
  })
}

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`
}

function quoteLiteral(name) {
  return `'${String(name).replace(/'/g, "''")}'`
}

function tableKey(schema, table) {
  return `${schema}.${table}`
}

function tableRef(schema, table) {
  return `${quoteIdent(schema)}.${quoteIdent(table)}`
}

function resolveRailwayDbUrlCandidates(serviceName) {
  const candidates = []
  const envUrl =
    String(process.env.RAILWAY_DATABASE_URL || '').trim() ||
    String(process.env.DATABASE_PUBLIC_URL || '').trim() ||
    String(process.env.DATABASE_URL || '').trim()

  if (envUrl) candidates.push({ source: 'env', url: envUrl })

  try {
    const stdout = runRailwayCommand(['variables', '--service', serviceName, '--json'])
    const parsed = JSON.parse(stdout)
    const fromRailway =
      String(parsed?.DATABASE_PUBLIC_URL || '').trim() || String(parsed?.DATABASE_URL || '').trim()
    if (fromRailway && !candidates.some((item) => item.url === fromRailway)) {
      candidates.push({ source: 'railway-cli', url: fromRailway })
    }
  } catch (error) {
    if (!envUrl) {
      throw error
    }

    console.warn(`Railway CLI lookup skipped: ${String(error?.message || error)}`)
  }

  if (candidates.length === 0) {
    throw new Error('Could not resolve Railway DB URL.')
  }

  return candidates
}

function listTables({ dbUrl, schemas, excludes }) {
  const schemaList = schemas.map(quoteLiteral).join(', ')
  const excludeSet = new Set(excludes.map((item) => item.toLowerCase()))

  const rows = runDbQueryJson({
    dbUrl,
    sql: [
      'select schemaname, tablename',
      'from pg_tables',
      `where schemaname in (${schemaList})`,
      "  and tablename <> 'schema_migrations'",
      'order by schemaname, tablename;',
    ].join('\n'),
  })

  return rows
    .map((row) => ({
      schema: String(row.schemaname || '').trim(),
      table: String(row.tablename || '').trim(),
    }))
    .filter((row) => row.schema && row.table)
    .filter((row) => !excludeSet.has(tableKey(row.schema, row.table).toLowerCase()))
}

function listColumns({ dbUrl, schemas }) {
  const schemaList = schemas.map(quoteLiteral).join(', ')
  const rows = runDbQueryJson({
    dbUrl,
    sql: [
      'select table_schema, table_name, column_name, ordinal_position',
      'from information_schema.columns',
      `where table_schema in (${schemaList})`,
      "  and coalesce(is_generated, 'NEVER') = 'NEVER'",
      'order by table_schema, table_name, ordinal_position;',
    ].join('\n'),
  })

  const map = new Map()
  for (const row of rows) {
    const schema = String(row.table_schema || '').trim()
    const table = String(row.table_name || '').trim()
    const column = String(row.column_name || '').trim()
    if (!schema || !table || !column) continue
    const key = tableKey(schema, table)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(column)
  }
  return map
}

function listForeignKeys({ dbUrl, schemas }) {
  const schemaList = schemas.map(quoteLiteral).join(', ')
  const rows = runDbQueryJson({
    dbUrl,
    sql: [
      'select',
      '  tc.table_schema as child_schema,',
      '  tc.table_name as child_table,',
      '  ccu.table_schema as parent_schema,',
      '  ccu.table_name as parent_table',
      'from information_schema.table_constraints tc',
      'join information_schema.constraint_column_usage ccu',
      '  on ccu.constraint_name = tc.constraint_name',
      ' and ccu.constraint_schema = tc.constraint_schema',
      "where tc.constraint_type = 'FOREIGN KEY'",
      `  and tc.table_schema in (${schemaList})`,
      `  and ccu.table_schema in (${schemaList})`,
      'order by tc.table_schema, tc.table_name;',
    ].join('\n'),
  })

  return rows
    .map((row) => ({
      child: tableKey(String(row.child_schema || '').trim(), String(row.child_table || '').trim()),
      parent: tableKey(String(row.parent_schema || '').trim(), String(row.parent_table || '').trim()),
    }))
    .filter((row) => row.child.includes('.') && row.parent.includes('.'))
}

function listEnumColumns({ dbUrl, schemas }) {
  const schemaList = schemas.map(quoteLiteral).join(', ')
  const rows = runDbQueryJson({
    dbUrl,
    sql: [
      'select',
      '  n.nspname as table_schema,',
      '  c.relname as table_name,',
      '  a.attname as column_name,',
      '  et.typname as enum_name,',
      '  (at.typcategory = \'A\') as is_array,',
      '  e.enumlabel as enum_label',
      'from pg_attribute a',
      'join pg_class c on c.oid = a.attrelid',
      'join pg_namespace n on n.oid = c.relnamespace',
      'join pg_type at on at.oid = a.atttypid',
      'join pg_type et on et.oid = case',
      '  when at.typtype = \'e\' then at.oid',
      '  when at.typelem <> 0 then at.typelem',
      '  else 0 end',
      'join pg_enum e on e.enumtypid = et.oid',
      `where n.nspname in (${schemaList})`,
      '  and a.attnum > 0',
      '  and not a.attisdropped',
      '  and (at.typtype = \'e\' or (at.typcategory = \'A\' and et.typtype = \'e\'))',
      'order by n.nspname, c.relname, a.attname, e.enumsortorder;',
    ].join('\n'),
  })

  const byTable = new Map()
  for (const row of rows) {
    const schema = String(row.table_schema || '').trim()
    const table = String(row.table_name || '').trim()
    const column = String(row.column_name || '').trim()
    const enumName = String(row.enum_name || '').trim()
    const label = String(row.enum_label || '').trim()
    const isArray =
      row.is_array === true || String(row.is_array || '').toLowerCase() === 't'

    if (!schema || !table || !column || !enumName || !label) continue
    const key = tableKey(schema, table)
    if (!byTable.has(key)) byTable.set(key, new Map())
    const tableMap = byTable.get(key)
    if (!tableMap.has(column)) {
      tableMap.set(column, {
        enumName,
        isArray,
        labels: new Set(),
      })
    }
    tableMap.get(column).labels.add(label)
  }

  return byTable
}

function sanitizeEnumScalar(value, info) {
  if (value == null) return value
  const text = String(value)
  if (info.labels.has(text)) return text
  const preferred = ENUM_FALLBACKS[info.enumName]
  if (preferred && info.labels.has(preferred)) return preferred
  const first = Array.from(info.labels)[0]
  return first || null
}

function sanitizeRowsForEnums(rows, tableEnumInfo, tableName) {
  if (!tableEnumInfo || rows.length === 0) {
    return rows
  }

  const entries = Array.from(tableEnumInfo.entries())
  const warningCounts = new Map()

  return rows.map((row) => {
    const next = { ...row }
    for (const [column, info] of entries) {
      const current = next[column]
      if (current == null) continue

      if (info.isArray) {
        if (!Array.isArray(current)) {
          next[column] = []
          continue
        }

        const normalized = current
          .map((item) => sanitizeEnumScalar(item, info))
          .filter((item) => item != null)
        if (JSON.stringify(normalized) !== JSON.stringify(current)) {
          const warningKey = `${tableName}.${column}`
          const currentCount = warningCounts.get(warningKey) || 0
          if (currentCount < 3) {
            console.log(
              `  warning: normalized enum array for ${warningKey} (${JSON.stringify(current)} -> ${JSON.stringify(normalized)})`
            )
          }
          warningCounts.set(warningKey, currentCount + 1)
        }
        next[column] = normalized
      } else {
        const normalized = sanitizeEnumScalar(current, info)
        if (normalized !== current) {
          const warningKey = `${tableName}.${column}`
          const currentCount = warningCounts.get(warningKey) || 0
          if (currentCount < 3) {
            console.log(
              `  warning: normalized enum value for ${warningKey} (${JSON.stringify(current)} -> ${JSON.stringify(normalized)})`
            )
          }
          warningCounts.set(warningKey, currentCount + 1)
        }
        next[column] = normalized
      }
    }
    return next
  })
}

function sanitizeRowsForTimestamps(rows, columns, tableName) {
  if (rows.length === 0) {
    return rows
  }

  const hasCreatedAt = columns.includes('created_at')
  const hasUpdatedAt = columns.includes('updated_at')
  if (!hasCreatedAt && !hasUpdatedAt) {
    return rows
  }

  const warningCounts = new Map()

  return rows.map((row) => {
    const next = { ...row }
    const fallbackNow = new Date().toISOString()

    if (hasCreatedAt && next.created_at == null) {
      const fallbackCreatedAt =
        (hasUpdatedAt && next.updated_at != null ? next.updated_at : null) || fallbackNow
      next.created_at = fallbackCreatedAt

      const warningKey = `${tableName}.created_at`
      const currentCount = warningCounts.get(warningKey) || 0
      if (currentCount < 3) {
        console.log(
          `  warning: filled missing timestamp for ${warningKey} (${JSON.stringify(row.created_at)} -> ${JSON.stringify(fallbackCreatedAt)})`
        )
      }
      warningCounts.set(warningKey, currentCount + 1)
    }

    if (hasUpdatedAt && next.updated_at == null) {
      const fallbackUpdatedAt =
        (hasCreatedAt && next.created_at != null ? next.created_at : null) || fallbackNow
      next.updated_at = fallbackUpdatedAt

      const warningKey = `${tableName}.updated_at`
      const currentCount = warningCounts.get(warningKey) || 0
      if (currentCount < 3) {
        console.log(
          `  warning: filled missing timestamp for ${warningKey} (${JSON.stringify(row.updated_at)} -> ${JSON.stringify(fallbackUpdatedAt)})`
        )
      }
      warningCounts.set(warningKey, currentCount + 1)
    }

    return next
  })
}

async function fetchSalesReturnParents(sourceClient, returnIds) {
  const rows = []

  for (const ids of chunk(Array.from(new Set(returnIds)), PAGE_SIZE)) {
    if (ids.length === 0) continue

    for (let attempt = 1; attempt <= REST_RETRY_ATTEMPTS; attempt += 1) {
      const { data, error } = await sourceClient
        .schema('public')
        .from('sales_returns')
        .select('id, org_id, created_at')
        .in('id', ids)

      if (!error) {
        rows.push(...(data || []))
        break
      }

      const text = String(error.message || '')
      if (attempt === REST_RETRY_ATTEMPTS) {
        throw new Error(`Failed to fetch parent sales_returns rows: ${text}`)
      }

      console.warn(
        `Retrying parent fetch for public.sales_return_items (${attempt}/${REST_RETRY_ATTEMPTS - 1} retries used): ${text}`
      )
      await delay(REST_RETRY_DELAY_MS * attempt)
    }
  }

  return rows
}

async function enrichRowsForTargetCompatibility(sourceClient, { schema, table, columns, rows }) {
  if (rows.length === 0) {
    return rows
  }

  const key = tableKey(schema, table)
  if (key !== 'public.sales_return_items') {
    return rows
  }

  const needsOrgId = columns.includes('org_id') && rows.some((row) => row.org_id == null && row.return_id != null)
  const needsCreatedAt = columns.includes('created_at') && rows.some((row) => row.created_at == null && row.return_id != null)
  if (!needsOrgId && !needsCreatedAt) {
    return rows
  }

  const parentRows = await fetchSalesReturnParents(
    sourceClient,
    rows
      .map((row) => row.return_id)
      .filter((value) => value != null)
      .map((value) => String(value))
  )

  const parentById = new Map(
    parentRows.map((row) => [
      String(row.id || '').trim(),
      {
        orgId: row.org_id ?? null,
        createdAt: row.created_at ?? null,
      },
    ])
  )

  const warningCounts = new Map()

  return rows.map((row) => {
    const parent = parentById.get(String(row.return_id || '').trim())
    if (!parent) return row

    const next = { ...row }

    if (needsOrgId && next.org_id == null && parent.orgId != null) {
      next.org_id = parent.orgId
      const warningKey = `${key}.org_id`
      const currentCount = warningCounts.get(warningKey) || 0
      if (currentCount < 3) {
        console.log(
          `  warning: derived missing value for ${warningKey} (${JSON.stringify(row.org_id)} -> ${JSON.stringify(parent.orgId)})`
        )
      }
      warningCounts.set(warningKey, currentCount + 1)
    }

    if (needsCreatedAt && next.created_at == null && parent.createdAt != null) {
      next.created_at = parent.createdAt
      const warningKey = `${key}.created_at`
      const currentCount = warningCounts.get(warningKey) || 0
      if (currentCount < 3) {
        console.log(
          `  warning: derived missing value for ${warningKey} (${JSON.stringify(row.created_at)} -> ${JSON.stringify(parent.createdAt)})`
        )
      }
      warningCounts.set(warningKey, currentCount + 1)
    }

    return next
  })
}

function topologicalSort(tableKeys, foreignKeys) {
  const known = new Set(tableKeys)
  const incoming = new Map(tableKeys.map((key) => [key, new Set()]))
  const outgoing = new Map(tableKeys.map((key) => [key, new Set()]))

  for (const edge of foreignKeys) {
    if (edge.child === edge.parent) continue
    if (!known.has(edge.child) || !known.has(edge.parent)) continue
    incoming.get(edge.child).add(edge.parent)
    outgoing.get(edge.parent).add(edge.child)
  }

  const queue = tableKeys.filter((key) => incoming.get(key).size === 0).sort()
  const order = []

  while (queue.length > 0) {
    const key = queue.shift()
    order.push(key)
    for (const child of outgoing.get(key)) {
      incoming.get(child).delete(key)
      if (incoming.get(child).size === 0) {
        queue.push(child)
        queue.sort()
      }
    }
  }

  const unresolved = tableKeys.filter((key) => !order.includes(key)).sort()
  return order.concat(unresolved)
}

function chunk(items, size) {
  const out = []
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size))
  }
  return out
}

function filterRow(row, columns) {
  const result = {}
  for (const column of columns) {
    if (Object.prototype.hasOwnProperty.call(row, column)) {
      result[column] = row[column]
    } else {
      result[column] = null
    }
  }
  return result
}

function buildInsertSql({ schema, table, columns, rows }) {
  if (rows.length === 0) return ''
  const quotedColumns = columns.map(quoteIdent)
  const escapedJson = JSON.stringify(rows).replace(/'/g, "''")
  return [
    `INSERT INTO ${tableRef(schema, table)} (${quotedColumns.join(', ')})`,
    `SELECT ${quotedColumns.map((name) => `r.${name}`).join(', ')}`,
    `FROM jsonb_populate_recordset(NULL::${tableRef(schema, table)}, '${escapedJson}'::jsonb) AS r;`,
  ].join('\n')
}

async function fetchAllRows(sourceClient, { schema, table, columns }) {
  const rows = []
  let from = 0
  const orderColumn = columns.includes('id')
    ? 'id'
    : columns.includes('created_at')
      ? 'created_at'
      : columns[0]

  while (true) {
    let query = sourceClient.schema(schema).from(table).select('*').range(from, from + PAGE_SIZE - 1)
    if (orderColumn) {
      query = query.order(orderColumn, { ascending: true })
    }

    let data = null
    let error = null

    for (let attempt = 1; attempt <= REST_RETRY_ATTEMPTS; attempt += 1) {
      const response = await query
      data = response.data
      error = response.error
      if (!error) break

      const text = String(error.message || '')
      if (text.includes(`Could not find the table '${schema}.${table}'`)) {
        return []
      }

      if (attempt === REST_RETRY_ATTEMPTS) {
        throw new Error(`Failed to fetch source table ${schema}.${table}: ${text}`)
      }

      console.warn(
        `Retrying source fetch for ${schema}.${table} page ${from}-${from + PAGE_SIZE - 1} (${attempt}/${REST_RETRY_ATTEMPTS - 1} retries used): ${text}`
      )
      await delay(REST_RETRY_DELAY_MS * attempt)
      query = sourceClient.schema(schema).from(table).select('*').range(from, from + PAGE_SIZE - 1)
      if (orderColumn) {
        query = query.order(orderColumn, { ascending: true })
      }
    }

    const batch = (data || []).map((row) => filterRow(row, columns))
    rows.push(...batch)

    if (batch.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return rows
}

function buildDisableTriggerSql(tables) {
  return tables.map((item) => `ALTER TABLE ${tableRef(item.schema, item.table)} DISABLE TRIGGER USER;`).join('\n')
}

function buildEnableTriggerSql(tables) {
  return tables.map((item) => `ALTER TABLE ${tableRef(item.schema, item.table)} ENABLE TRIGGER USER;`).join('\n')
}

function buildDisableAllTriggerSql(tables) {
  if (tables.length === 0) return 'select 1;'
  const lines = tables.map((item) => `ALTER TABLE ${tableRef(item.schema, item.table)} DISABLE TRIGGER ALL;`)
  return `DO $$ BEGIN\n${lines.join('\n')}\nEND $$;`
}

function buildEnableAllTriggerSql(tables) {
  if (tables.length === 0) return 'select 1;'
  const lines = tables.map((item) => `ALTER TABLE ${tableRef(item.schema, item.table)} ENABLE TRIGGER ALL;`)
  return `DO $$ BEGIN\n${lines.join('\n')}\nEND $$;`
}

function buildTruncateSql(tables) {
  if (tables.length === 0) return ''
  return `TRUNCATE TABLE ${tables.map((item) => tableRef(item.schema, item.table)).join(', ')} CASCADE;`
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

  const targetCandidates = args.targetDbUrl
    ? [{ source: 'argument', url: args.targetDbUrl }]
    : resolveRailwayDbUrlCandidates(args.service)

  let targetDbUrl = ''
  let tables = []
  let columnsByTable = new Map()
  let enumsByTable = new Map()
  let lastError = null

  for (const candidate of targetCandidates) {
    try {
      const foundTables = listTables({
        dbUrl: candidate.url,
        schemas: args.schemas,
        excludes: args.excludes,
      })
      const foundColumns = listColumns({
        dbUrl: candidate.url,
        schemas: args.schemas,
      })
      const foundEnums = listEnumColumns({
        dbUrl: candidate.url,
        schemas: args.schemas,
      })
      targetDbUrl = candidate.url
      tables = foundTables
      columnsByTable = foundColumns
      enumsByTable = foundEnums
      console.log(`Target resolver: ${candidate.source}`)
      break
    } catch (error) {
      lastError = error
      console.error(`Target candidate failed (${candidate.source}): ${String(error?.message || error)}`)
    }
  }

  if (!targetDbUrl) {
    throw new Error(
      [
        'Failed to connect to target Railway DB.',
        lastError ? String(lastError?.message || lastError) : '',
      ]
        .filter(Boolean)
        .join('\n')
    )
  }

  if (tables.length === 0) {
    throw new Error('No target tables found for selected schema(s).')
  }

  const fkEdges = listForeignKeys({
    dbUrl: targetDbUrl,
    schemas: args.schemas,
  })
  const orderKeys = topologicalSort(
    tables.map((item) => tableKey(item.schema, item.table)),
    fkEdges
  )

  const tableByKey = new Map(tables.map((item) => [tableKey(item.schema, item.table), item]))
  const orderedTables = orderKeys.map((key) => tableByKey.get(key)).filter(Boolean)

  console.log('Supabase REST -> Railway data sync')
  console.log(`Source URL  : ${sourceUrl}`)
  console.log(`Target DB   : ${maskDbUrl(targetDbUrl)}`)
  console.log(`Schemas     : ${args.schemas.join(', ')}`)
  if (args.excludes.length > 0) {
    console.log(`Exclude     : ${args.excludes.join(', ')}`)
  }
  console.log(`Tables      : ${orderedTables.length}`)
  console.log(`Page size   : ${PAGE_SIZE}`)
  console.log(`Insert chunk: ${INSERT_CHUNK}`)

  if (!args.apply) {
    console.log('\nDry-run completed. No DB changes were applied.')
    console.log('Apply for real with:')
    console.log('  node scripts/sync-supabase-rest-to-railway.mjs --apply')
    return
  }

  const tmpDir = mkdtempSync(join(tmpdir(), 'nizam-rest-to-railway-'))

  try {
    console.log('\nStep 1/3: Prepare target (disable triggers + truncate)...')
    runDbQuerySql({
      dbUrl: targetDbUrl,
      sql: buildDisableAllTriggerSql(orderedTables),
    })
    runDbQuerySql({
      dbUrl: targetDbUrl,
      sql: buildTruncateSql(orderedTables),
    })

    console.log('\nStep 2/3: Copy source rows into Railway...')
    for (const table of orderedTables) {
      const key = tableKey(table.schema, table.table)
      const columns = columnsByTable.get(key) || []
      if (columns.length === 0) {
        console.log(`- ${key}: skip (no insertable columns)`)
        continue
      }

      const rows = await fetchAllRows(sourceClient, {
        schema: table.schema,
        table: table.table,
        columns,
      })
      const enrichedRows = await enrichRowsForTargetCompatibility(sourceClient, {
        schema: table.schema,
        table: table.table,
        columns,
        rows,
      })
      const timestampSanitizedRows = sanitizeRowsForTimestamps(enrichedRows, columns, key)
      const sanitizedRows = sanitizeRowsForEnums(timestampSanitizedRows, enumsByTable.get(key), key)

      if (sanitizedRows.length === 0) {
        console.log(`- ${key}: 0 rows`)
        continue
      }

      let written = 0
      for (const [index, values] of chunk(sanitizedRows, INSERT_CHUNK).entries()) {
        const sql = buildInsertSql({
          schema: table.schema,
          table: table.table,
          columns,
          rows: values,
        })
        const chunkFile = join(tmpDir, `${table.schema}_${table.table}_${index + 1}.sql`)
        writeFileSync(chunkFile, `${sql}\n`, 'utf8')
        runDbQueryFile({ dbUrl: targetDbUrl, filePath: chunkFile })
        written += values.length
      }

      console.log(`- ${key}: ${written} rows`)
    }

    console.log('\nStep 3/3: Re-enable triggers...')
    runDbQuerySql({
      dbUrl: targetDbUrl,
      sql: buildEnableAllTriggerSql(orderedTables),
    })

    console.log('\nData sync completed.')
  } catch (error) {
    console.error('\nSync failed. Attempting to re-enable triggers...')
    try {
      runDbQuerySql({
        dbUrl: targetDbUrl,
        sql: buildEnableAllTriggerSql(orderedTables),
      })
    } catch (restoreError) {
      console.error(`Failed to re-enable triggers: ${String(restoreError?.message || restoreError)}`)
    }
    throw error
  } finally {
    if (args.keepFiles) {
      console.log(`Temporary SQL files kept at: ${tmpDir}`)
    } else {
      rmSync(tmpDir, { recursive: true, force: true })
    }
  }
}

main().catch((error) => {
  console.error(String(error?.message || error))
  process.exit(1)
})
