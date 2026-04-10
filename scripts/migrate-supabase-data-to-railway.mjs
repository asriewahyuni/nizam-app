#!/usr/bin/env node
/**
 * Dump data from Supabase source and restore it into Railway Postgres.
 *
 * Default mode is dry-run:
 *   node scripts/migrate-supabase-data-to-railway.mjs
 *
 * Apply mode:
 *   node scripts/migrate-supabase-data-to-railway.mjs --apply
 *
 * Notes:
 * - This script syncs table data (default schema: public), not schema migrations.
 * - This script does NOT migrate Supabase Auth users or Supabase Storage objects.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import nextEnv from '@next/env'

const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd())

function printHelp() {
  console.log(
    [
      'Usage: node scripts/migrate-supabase-data-to-railway.mjs [options]',
      '',
      'Options:',
      '  --apply                      Apply changes (default is dry-run only)',
      '  --keep-files                 Keep temporary SQL files for inspection',
      '  --target-db-url <url>        Override Railway target DB URL',
      '  --source-db-url <url>        Override Supabase source DB URL (skip --linked mode)',
      '  --service <name>             Railway service name (default: Postgres)',
      '  --schema <schema[,schema]>   Schemas to include in data dump (default: public)',
      '  --exclude <schema.table>     Exclude tables from data dump (repeatable)',
      '  --help                       Show this help',
      '',
      'Source mode:',
      '  - default: linked Supabase project (`supabase db dump --linked`)',
      '  - override: provide --source-db-url or SUPABASE_SOURCE_DB_URL',
      '',
      'Target DB URL fallback:',
      '  1) --target-db-url',
      '  2) RAILWAY_DATABASE_URL / DATABASE_PUBLIC_URL / DATABASE_URL',
      '  3) npx @railway/cli variables --service <name> --json',
    ].join('\n')
  )
}

function splitCsvArg(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseArgs(argv) {
  const args = {
    apply: false,
    keepFiles: false,
    targetDbUrl: '',
    sourceDbUrl: String(process.env.SUPABASE_SOURCE_DB_URL || '').trim(),
    service: 'Postgres',
    schemas: ['public'],
    excludes: [],
    help: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--apply') args.apply = true
    else if (token === '--keep-files') args.keepFiles = true
    else if (token === '--help' || token === '-h') args.help = true
    else if (token === '--target-db-url' || token === '--db-url') {
      args.targetDbUrl = String(argv[i + 1] || '').trim()
      i += 1
    } else if (token.startsWith('--target-db-url=')) {
      args.targetDbUrl = token.slice('--target-db-url='.length).trim()
    } else if (token.startsWith('--db-url=')) {
      args.targetDbUrl = token.slice('--db-url='.length).trim()
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
    } else if (token === '--schema') {
      args.schemas = splitCsvArg(argv[i + 1] || '')
      i += 1
    } else if (token.startsWith('--schema=')) {
      args.schemas = splitCsvArg(token.slice('--schema='.length))
    } else if (token === '--exclude') {
      args.excludes.push(...splitCsvArg(argv[i + 1] || ''))
      i += 1
    } else if (token.startsWith('--exclude=')) {
      args.excludes.push(...splitCsvArg(token.slice('--exclude='.length)))
    } else {
      throw new Error(`Unknown argument: ${token}`)
    }
  }

  if (args.schemas.length === 0) {
    args.schemas = ['public']
  }

  return args
}

function runCommand(cmd, argv, options = {}) {
  const { inherit = false } = options
  const safeArgs = argv.map((value) => {
    const raw = String(value || '')
    if (/^postgres(ql)?:\/\//i.test(raw)) {
      return maskDbUrl(raw)
    }
    return raw
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

function resolveRailwayDbUrlCandidates(serviceName) {
  const candidates = []
  const envUrl =
    String(process.env.RAILWAY_DATABASE_URL || '').trim() ||
    String(process.env.DATABASE_PUBLIC_URL || '').trim() ||
    String(process.env.DATABASE_URL || '').trim()

  if (envUrl) {
    candidates.push({ source: 'env', url: envUrl })
  }

  const stdout = runCommand('npx', ['@railway/cli', 'variables', '--service', serviceName, '--json'])
  let parsed
  try {
    parsed = JSON.parse(stdout)
  } catch (error) {
    throw new Error(`Failed to parse Railway variables JSON: ${String(error)}`)
  }

  const fromRailway =
    String(parsed?.DATABASE_PUBLIC_URL || '').trim() || String(parsed?.DATABASE_URL || '').trim()

  if (fromRailway) {
    const alreadyExists = candidates.some((candidate) => candidate.url === fromRailway)
    if (!alreadyExists) {
      candidates.push({ source: 'railway-cli', url: fromRailway })
    }
  }

  if (candidates.length === 0) {
    throw new Error(
      [
        `Could not resolve Railway DB URL for service "${serviceName}".`,
        'Set --target-db-url or RAILWAY_DATABASE_URL manually.',
      ].join('\n')
    )
  }

  return candidates
}

function quoteLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

function quoteIdent(value) {
  return `"${String(value).replace(/"/g, '""')}"`
}

function parseCsvLine(line) {
  const cells = []
  let current = ''
  let index = 0
  let inQuotes = false

  while (index < line.length) {
    const char = line[index]
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"'
        index += 2
        continue
      }
      inQuotes = !inQuotes
      index += 1
      continue
    }
    if (char === ',' && !inQuotes) {
      cells.push(current)
      current = ''
      index += 1
      continue
    }
    current += char
    index += 1
  }

  cells.push(current)
  return cells
}

function parseCsv(raw) {
  const lines = String(raw || '')
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) {
    return { headers: [], rows: [] }
  }

  const headers = parseCsvLine(lines[0])
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    const row = {}
    for (let i = 0; i < headers.length; i += 1) {
      row[headers[i]] = values[i] || ''
    }
    return row
  })

  return { headers, rows }
}

function runDbQueryCsv({ sql, linked, dbUrl }) {
  const args = ['supabase', 'db', 'query', '-o', 'csv', '--agent', 'no']
  if (linked) args.push('--linked')
  else args.push('--db-url', dbUrl)
  args.push(sql)
  return runCommand('npx', args)
}

function runDbQueryFile({ filePath, dbUrl }) {
  runCommand(
    'npx',
    ['supabase', 'db', 'query', '--db-url', dbUrl, '--file', filePath, '--agent', 'no'],
    { inherit: true }
  )
}

function listTargetTables({ targetDbUrl, schemas }) {
  const schemaList = schemas.map(quoteLiteral).join(', ')
  const sql = [
    'select schemaname, tablename',
    'from pg_tables',
    `where schemaname in (${schemaList})`,
    "  and tablename <> 'schema_migrations'",
    'order by schemaname, tablename;',
  ].join('\n')

  const parsed = parseCsv(runDbQueryCsv({ sql, linked: false, dbUrl: targetDbUrl }))
  return parsed.rows
    .map((row) => ({
      schema: String(row.schemaname || '').trim(),
      table: String(row.tablename || '').trim(),
    }))
    .filter((row) => row.schema && row.table)
}

function tableRef(entry) {
  return `${quoteIdent(entry.schema)}.${quoteIdent(entry.table)}`
}

function buildTriggerSql(tables, mode) {
  return tables.map((entry) => `ALTER TABLE ${tableRef(entry)} ${mode} TRIGGER USER;`)
}

function buildTruncateSql(tables) {
  if (tables.length === 0) return []
  return [`TRUNCATE TABLE ${tables.map(tableRef).join(', ')} CASCADE;`]
}

function writeSqlFile(filePath, statements) {
  const body = `${statements.join('\n')}\n`
  writeFileSync(filePath, body, 'utf8')
}

function buildDumpArgs({ sourceDbUrl, schemas, excludes, filePath, dryRun }) {
  const args = ['supabase', 'db', 'dump', '--data-only', '--use-copy', '--file', filePath, '--yes']

  if (sourceDbUrl) args.push('--db-url', sourceDbUrl)
  else args.push('--linked')

  for (const schema of schemas) {
    args.push('--schema', schema)
  }

  for (const table of excludes) {
    args.push('--exclude', table)
  }

  if (dryRun) args.push('--dry-run')
  return args
}

function formatDumpError(error, sourceMode) {
  const baseMessage = String(error?.message || error)
  if (sourceMode !== 'linked') {
    return baseMessage
  }

  if (
    /Invalid access token format|unexpected login role status 401|SUPABASE_DB_PASSWORD|Unauthorized/i.test(
      baseMessage
    )
  ) {
    return [
      baseMessage,
      '',
      'Linked source mode gagal. Pilih salah satu:',
      '1) Jalankan `npx supabase login` atau set `SUPABASE_ACCESS_TOKEN` valid (format `sbp_...`).',
      '2) Pakai `--source-db-url` / `SUPABASE_SOURCE_DB_URL` agar tidak bergantung linked mode.',
    ].join('\n')
  }

  return baseMessage
}

function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.help) {
    printHelp()
    return
  }

  const sourceMode = args.sourceDbUrl ? 'db-url' : 'linked'
  const targetCandidates = args.targetDbUrl
    ? [{ source: 'argument', url: args.targetDbUrl }]
    : resolveRailwayDbUrlCandidates(args.service)

  let targetDbUrl = ''
  let targetTables = []
  let lastTargetError = null

  for (const candidate of targetCandidates) {
    try {
      const tables = listTargetTables({
        targetDbUrl: candidate.url,
        schemas: args.schemas,
      })
      targetDbUrl = candidate.url
      targetTables = tables
      console.log(`Target resolver: ${candidate.source}`)
      break
    } catch (error) {
      lastTargetError = error
      console.error(`Target candidate failed (${candidate.source}): ${String(error?.message || error)}`)
    }
  }

  if (!targetDbUrl) {
    throw new Error(
      [
        'Failed to connect to target Railway DB with all available candidates.',
        lastTargetError ? String(lastTargetError?.message || lastTargetError) : '',
      ]
        .filter(Boolean)
        .join('\n')
    )
  }

  console.log('Supabase -> Railway data sync')
  console.log(`Source mode : ${sourceMode}`)
  if (sourceMode === 'db-url') {
    console.log(`Source DB   : ${maskDbUrl(args.sourceDbUrl)}`)
  } else {
    console.log('Source DB   : linked Supabase project')
  }
  console.log(`Target DB   : ${maskDbUrl(targetDbUrl)}`)
  console.log(`Schemas     : ${args.schemas.join(', ')}`)
  if (args.excludes.length > 0) {
    console.log(`Exclude     : ${args.excludes.join(', ')}`)
  }
  console.log('Scope note  : only SQL table data is migrated (no Supabase Auth users / Storage objects).')

  if (targetTables.length === 0) {
    throw new Error(`No target tables found for schemas: ${args.schemas.join(', ')}`)
  }
  console.log(`Target tables matched: ${targetTables.length}`)

  const tempDir = mkdtempSync(join(tmpdir(), 'nizam-supa-railway-data-'))
  const dumpFile = join(tempDir, 'supabase_data_dump.sql')
  const disableFile = join(tempDir, 'disable_user_triggers.sql')
  const truncateFile = join(tempDir, 'truncate_tables.sql')
  const enableFile = join(tempDir, 'enable_user_triggers.sql')

  writeSqlFile(disableFile, buildTriggerSql(targetTables, 'DISABLE'))
  writeSqlFile(truncateFile, buildTruncateSql(targetTables))
  writeSqlFile(enableFile, buildTriggerSql(targetTables, 'ENABLE'))

  try {
    console.log('\nStep 1/3: Dump preview...')
    try {
      runCommand(
        'npx',
        buildDumpArgs({
          sourceDbUrl: args.sourceDbUrl,
          schemas: args.schemas,
          excludes: args.excludes,
          filePath: dumpFile,
          dryRun: true,
        }),
        { inherit: true }
      )
    } catch (error) {
      throw new Error(formatDumpError(error, sourceMode))
    }

    if (!args.apply) {
      console.log('\nDry-run completed. No DB changes were applied.')
      console.log('Apply for real with:')
      console.log('  node scripts/migrate-supabase-data-to-railway.mjs --apply')
      return
    }

    console.log('\nStep 2/3: Create data dump...')
    try {
      runCommand(
        'npx',
        buildDumpArgs({
          sourceDbUrl: args.sourceDbUrl,
          schemas: args.schemas,
          excludes: args.excludes,
          filePath: dumpFile,
          dryRun: false,
        }),
        { inherit: true }
      )
    } catch (error) {
      throw new Error(formatDumpError(error, sourceMode))
    }

    let triggersDisabled = false
    try {
      console.log('\nStep 3/3: Restore data into Railway...')
      runDbQueryFile({ filePath: disableFile, dbUrl: targetDbUrl })
      triggersDisabled = true
      runDbQueryFile({ filePath: truncateFile, dbUrl: targetDbUrl })
      runDbQueryFile({ filePath: dumpFile, dbUrl: targetDbUrl })
    } finally {
      if (triggersDisabled) {
        try {
          runDbQueryFile({ filePath: enableFile, dbUrl: targetDbUrl })
        } catch (error) {
          console.error('WARNING: failed to re-enable triggers automatically.')
          console.error(String(error?.message || error))
        }
      }
    }

    console.log('\nData sync to Railway completed.')
    console.log('Next recommended check:')
    console.log('  npm run db:railway:parity')
  } finally {
    if (args.keepFiles) {
      console.log(`Temporary files kept at: ${tempDir}`)
    } else {
      rmSync(tempDir, { recursive: true, force: true })
    }
  }
}

try {
  main()
} catch (error) {
  console.error(String(error?.message || error))
  process.exit(1)
}
