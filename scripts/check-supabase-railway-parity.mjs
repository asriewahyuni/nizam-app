#!/usr/bin/env node
/**
 * Compare critical schema security parity between Supabase source DB and Railway DB.
 *
 * Default source mode uses linked Supabase project:
 *   node scripts/check-supabase-railway-parity.mjs
 *
 * Optional source override:
 *   SUPABASE_SOURCE_DB_URL=postgresql://... node scripts/check-supabase-railway-parity.mjs
 *
 * Target Railway DB URL resolution:
 *   1) --target-db-url
 *   2) RAILWAY_DATABASE_URL / DATABASE_PUBLIC_URL / DATABASE_URL
 *   3) npx @railway/cli variables --service <name> --json
 */
import { spawnSync } from 'node:child_process'

const CRITICAL_TABLES = [
  'organizations',
  'org_members',
  'branches',
  'employees',
  'attendance',
  'leave_requests',
  'payroll_runs',
  'payslips',
  'payslip_lines',
  'payroll_components',
  'employee_components',
  'roles',
]

const CRITICAL_FUNCTIONS = [
  'is_org_admin',
  'can_access_branch',
  'nizam_has_permission',
  'nizam_has_any_permission',
  'nizam_member_has_any_role',
]

function printHelp() {
  console.log(
    [
      'Usage: node scripts/check-supabase-railway-parity.mjs [options]',
      '',
      'Options:',
      '  --target-db-url <url>   Override Railway DB URL',
      '  --service <name>        Railway service name (default: Postgres)',
      '  --source-db-url <url>   Override source Supabase DB URL (skip --linked mode)',
      '  --help                  Show this help',
      '',
      'Exit code:',
      '  0 when parity checks pass',
      '  1 when any mismatch is found',
      '',
      'Requirements for linked source mode:',
      '  - `npx supabase link` already configured in this repo',
      '  - `SUPABASE_ACCESS_TOKEN` available or `supabase login` completed',
    ].join('\n')
  )
}

function parseArgs(argv) {
  const args = {
    targetDbUrl: '',
    sourceDbUrl: String(process.env.SUPABASE_SOURCE_DB_URL || '').trim(),
    service: 'Postgres',
    help: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--help' || token === '-h') args.help = true
    else if (token === '--target-db-url') {
      args.targetDbUrl = String(argv[i + 1] || '').trim()
      i += 1
    } else if (token.startsWith('--target-db-url=')) {
      args.targetDbUrl = token.slice('--target-db-url='.length).trim()
    } else if (token === '--source-db-url') {
      args.sourceDbUrl = String(argv[i + 1] || '').trim()
      i += 1
    } else if (token.startsWith('--source-db-url=')) {
      args.sourceDbUrl = token.slice('--source-db-url='.length).trim()
    } else if (token === '--service') {
      args.service = String(argv[i + 1] || '').trim() || 'Postgres'
      i += 1
    } else if (token.startsWith('--service=')) {
      args.service = token.slice('--service='.length).trim() || 'Postgres'
    } else {
      throw new Error(`Unknown argument: ${token}`)
    }
  }

  return args
}

function runCommand(cmd, argv, options = {}) {
  const result = spawnSync(cmd, argv, {
    encoding: 'utf8',
    ...options,
  })

  if (result.error) throw result.error

  if (typeof result.status === 'number' && result.status !== 0) {
    const stdout = String(result.stdout || '')
    const stderr = String(result.stderr || '')
    throw new Error(
      [
        `Command failed: ${cmd} ${argv.join(' ')}`,
        stdout ? `stdout:\n${stdout}` : '',
        stderr ? `stderr:\n${stderr}` : '',
      ]
        .filter(Boolean)
        .join('\n\n')
    )
  }

  return String(result.stdout || '')
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

function resolveRailwayDbUrl(serviceName) {
  const envUrl =
    String(process.env.RAILWAY_DATABASE_URL || '').trim() ||
    String(process.env.DATABASE_PUBLIC_URL || '').trim() ||
    String(process.env.DATABASE_URL || '').trim()

  if (envUrl) return envUrl

  const stdout = runCommand('npx', ['@railway/cli', 'variables', '--service', serviceName, '--json'])
  let parsed
  try {
    parsed = JSON.parse(stdout)
  } catch (error) {
    throw new Error(`Failed to parse Railway variables JSON: ${String(error)}`)
  }

  const fromRailway =
    String(parsed?.DATABASE_PUBLIC_URL || '').trim() || String(parsed?.DATABASE_URL || '').trim()

  if (!fromRailway) {
    throw new Error(
      [
        `Could not resolve Railway DB URL for service "${serviceName}".`,
        'Set --target-db-url or RAILWAY_DATABASE_URL manually.',
      ].join('\n')
    )
  }

  return fromRailway
}

function tableListSql(items) {
  return items.map((name) => `'${name.replace(/'/g, "''")}'`).join(', ')
}

function parseDbQueryJson(raw) {
  const trimmed = String(raw || '').trim()
  const idxArray = trimmed.indexOf('[')
  const idxObject = trimmed.indexOf('{')
  const startIndexes = [idxArray, idxObject].filter((idx) => idx >= 0)

  if (startIndexes.length === 0) {
    throw new Error(`Cannot parse JSON output from supabase db query:\n${trimmed}`)
  }

  const start = Math.min(...startIndexes)
  const jsonText = trimmed.slice(start)
  const parsed = JSON.parse(jsonText)

  if (Array.isArray(parsed)) return parsed
  if (Array.isArray(parsed?.data)) return parsed.data
  if (Array.isArray(parsed?.result)) return parsed.result

  throw new Error(`Unexpected JSON shape from supabase db query: ${jsonText.slice(0, 200)}`)
}

function runDbQuery({ sql, linked, dbUrl }) {
  const args = ['supabase', 'db', 'query', '-o', 'json', '--agent', 'no']
  if (linked) args.push('--linked')
  else args.push('--db-url', dbUrl)
  args.push(sql)

  const stdout = runCommand('npx', args)
  return parseDbQueryJson(stdout)
}

function rowsToMap(rows, keyField, valueField, defaultValue) {
  const map = new Map()
  for (const row of rows) {
    map.set(String(row[keyField]), row[valueField])
  }
  return {
    get(key) {
      return map.has(key) ? map.get(key) : defaultValue
    },
    map,
  }
}

function setDiff(leftSet, rightSet) {
  const onlyLeft = []
  const onlyRight = []
  for (const item of leftSet) {
    if (!rightSet.has(item)) onlyLeft.push(item)
  }
  for (const item of rightSet) {
    if (!leftSet.has(item)) onlyRight.push(item)
  }
  return { onlyLeft, onlyRight }
}

function buildColumnSignature(rows) {
  const byTable = new Map()
  for (const row of rows) {
    const table = String(row.table_name)
    const sig = [
      String(row.column_name),
      String(row.data_type),
      String(row.is_nullable),
      String(row.column_default || ''),
    ].join('|')

    if (!byTable.has(table)) byTable.set(table, [])
    byTable.get(table).push(sig)
  }
  return byTable
}

function printMismatchSection(title, entries, limit = 20) {
  if (entries.length === 0) return
  console.log(`\n[${title}] ${entries.length} mismatch(es)`)
  for (const line of entries.slice(0, limit)) {
    console.log(`- ${line}`)
  }
  if (entries.length > limit) {
    console.log(`- ... ${entries.length - limit} more`)
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    return
  }

  const sourceMode = args.sourceDbUrl ? 'db-url' : 'linked'
  if (sourceMode === 'linked') {
    const token = String(process.env.SUPABASE_ACCESS_TOKEN || '').trim()
    if (!token) {
      throw new Error(
        [
          'SUPABASE_ACCESS_TOKEN is required for linked source mode.',
          'Run one of these first:',
          '  1) npx supabase login',
          '  2) export SUPABASE_ACCESS_TOKEN=<your-token>',
          '',
          'Or bypass linked mode:',
          '  npm run db:railway:parity -- --source-db-url "<supabase-db-url>"',
        ].join('\n')
      )
    }
  }
  const targetDbUrl = args.targetDbUrl || resolveRailwayDbUrl(args.service)

  console.log('Checking Supabase vs Railway parity...')
  console.log(`Source mode: ${sourceMode}`)
  if (sourceMode === 'db-url') {
    console.log(`Source DB : ${maskDbUrl(args.sourceDbUrl)}`)
  } else {
    console.log('Source DB : linked Supabase project')
  }
  console.log(`Target DB : ${maskDbUrl(targetDbUrl)}`)

  const tableList = tableListSql(CRITICAL_TABLES)
  const functionList = tableListSql(CRITICAL_FUNCTIONS)

  const sqlRls = `
    select tablename, rowsecurity
    from pg_tables
    where schemaname = 'public'
      and tablename in (${tableList})
    order by tablename;
  `

  const sqlPolicyCount = `
    select tablename, count(*)::int as policy_count
    from pg_policies
    where schemaname = 'public'
      and tablename in (${tableList})
    group by tablename
    order by tablename;
  `

  const sqlFunctions = `
    select proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and proname in (${functionList})
    order by proname, args;
  `

  const sqlColumns = `
    select
      table_name,
      column_name,
      data_type,
      is_nullable,
      coalesce(column_default, '') as column_default
    from information_schema.columns
    where table_schema = 'public'
      and table_name in (${tableList})
    order by table_name, ordinal_position;
  `

  const sourceQueryContext = args.sourceDbUrl
    ? { linked: false, dbUrl: args.sourceDbUrl }
    : { linked: true, dbUrl: '' }
  const targetQueryContext = { linked: false, dbUrl: targetDbUrl }

  const sourceRls = runDbQuery({ ...sourceQueryContext, sql: sqlRls })
  const targetRls = runDbQuery({ ...targetQueryContext, sql: sqlRls })
  const sourcePolicies = runDbQuery({ ...sourceQueryContext, sql: sqlPolicyCount })
  const targetPolicies = runDbQuery({ ...targetQueryContext, sql: sqlPolicyCount })
  const sourceFunctions = runDbQuery({ ...sourceQueryContext, sql: sqlFunctions })
  const targetFunctions = runDbQuery({ ...targetQueryContext, sql: sqlFunctions })
  const sourceColumns = runDbQuery({ ...sourceQueryContext, sql: sqlColumns })
  const targetColumns = runDbQuery({ ...targetQueryContext, sql: sqlColumns })

  const rlsSourceMap = rowsToMap(sourceRls, 'tablename', 'rowsecurity', false)
  const rlsTargetMap = rowsToMap(targetRls, 'tablename', 'rowsecurity', false)
  const policySourceMap = rowsToMap(sourcePolicies, 'tablename', 'policy_count', 0)
  const policyTargetMap = rowsToMap(targetPolicies, 'tablename', 'policy_count', 0)

  const rlsDiffs = []
  const policyDiffs = []
  for (const tableName of CRITICAL_TABLES) {
    const sourceValue = Boolean(rlsSourceMap.get(tableName))
    const targetValue = Boolean(rlsTargetMap.get(tableName))
    if (sourceValue !== targetValue) {
      rlsDiffs.push(`${tableName} -> source=${sourceValue}, target=${targetValue}`)
    }

    const sourcePolicyCount = Number(policySourceMap.get(tableName) || 0)
    const targetPolicyCount = Number(policyTargetMap.get(tableName) || 0)
    if (sourcePolicyCount !== targetPolicyCount) {
      policyDiffs.push(
        `${tableName} -> source=${sourcePolicyCount}, target=${targetPolicyCount}`
      )
    }
  }

  const sourceFnSet = new Set(
    sourceFunctions.map((row) => `${String(row.proname)}(${String(row.args || '')})`)
  )
  const targetFnSet = new Set(
    targetFunctions.map((row) => `${String(row.proname)}(${String(row.args || '')})`)
  )
  const functionSetDiff = setDiff(sourceFnSet, targetFnSet)
  const functionDiffs = [
    ...functionSetDiff.onlyLeft.map((v) => `missing in target: ${v}`),
    ...functionSetDiff.onlyRight.map((v) => `extra in target: ${v}`),
  ]

  const sourceColumnSignatures = buildColumnSignature(sourceColumns)
  const targetColumnSignatures = buildColumnSignature(targetColumns)
  const columnDiffs = []
  for (const tableName of CRITICAL_TABLES) {
    const sourceSet = new Set(sourceColumnSignatures.get(tableName) || [])
    const targetSet = new Set(targetColumnSignatures.get(tableName) || [])
    const diff = setDiff(sourceSet, targetSet)
    if (diff.onlyLeft.length === 0 && diff.onlyRight.length === 0) continue

    const missing = diff.onlyLeft.slice(0, 5).join(', ') || '-'
    const extra = diff.onlyRight.slice(0, 5).join(', ') || '-'
    columnDiffs.push(
      `${tableName} -> missing_in_target=[${missing}] extra_in_target=[${extra}]`
    )
  }

  console.log('\nParity summary:')
  console.log(`- RLS mismatches        : ${rlsDiffs.length}`)
  console.log(`- Policy count mismatches: ${policyDiffs.length}`)
  console.log(`- Function mismatches   : ${functionDiffs.length}`)
  console.log(`- Column mismatches     : ${columnDiffs.length}`)

  printMismatchSection('RLS', rlsDiffs)
  printMismatchSection('POLICY_COUNT', policyDiffs)
  printMismatchSection('FUNCTIONS', functionDiffs)
  printMismatchSection('COLUMNS', columnDiffs)

  const totalDiffs =
    rlsDiffs.length + policyDiffs.length + functionDiffs.length + columnDiffs.length

  if (totalDiffs > 0) {
    console.log('\nResult: NOT IN PARITY')
    process.exit(1)
  }

  console.log('\nResult: IN PARITY')
}

try {
  main()
} catch (error) {
  console.error(String(error?.message || error))
  process.exit(1)
}
