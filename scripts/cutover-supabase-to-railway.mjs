#!/usr/bin/env node
/**
 * Orchestrate the Railway cutover flow from existing repo scripts.
 *
 * Steps:
 * 1. Sync schema migrations to Railway
 * 2. Sync public SQL data from Supabase to Railway
 * 3. Backfill Railway auth.users from public data
 * 4. Bootstrap internal_auth_users for auth cutover
 * 5. Verify SQL/auth readiness
 *
 * Notes:
 * - Default mode is dry-run / preview only.
 * - Storage migration is not performed here; readiness output still reports it.
 */
import process from 'node:process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import nextEnv from '@next/env'

const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd())

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const DEFAULT_SQL_EXCLUDES = [
  'public.internal_auth_users',
  'public.internal_auth_sessions',
]

function printHelp() {
  console.log(
    [
      'Usage: node scripts/cutover-supabase-to-railway.mjs [options]',
      '',
      'Options:',
      '  --apply                         Apply changes (default: dry-run only)',
      '  --service <name>                Railway service name (default: Postgres)',
      '  --target-db-url <url>           Override Railway target DB URL',
      '  --schema <schema[,schema]>      Schemas for SQL data/readiness (default: public)',
      '  --exclude <schema.table>        Exclude table(s), repeatable or CSV',
      '  --keep-files                    Keep temporary SQL files from data sync',
      '  --bootstrap-password <value>    Password for internal auth bootstrap apply',
      '  --reset-internal-passwords      Reset existing internal auth password hashes during apply',
      '  --skip-schema                   Skip schema migration sync step',
      '  --skip-sql-data                 Skip Supabase -> Railway SQL data sync step',
      '  --skip-auth-backfill            Skip auth.users backfill step',
      '  --skip-internal-auth            Skip internal_auth_users bootstrap step',
      '  --skip-readiness                Skip final readiness verification step',
      '  --help                          Show this help',
      '',
      'Source env required:',
      '  NEXT_PUBLIC_SUPABASE_URL',
      '  SUPABASE_SERVICE_ROLE_KEY',
      '',
      'Apply mode reminder:',
      '  - SQL data sync truncates target public tables before re-inserting source rows.',
      '  - internal auth apply only requires --bootstrap-password when inserting new users',
      '    or when --reset-internal-passwords is enabled.',
    ].join('\n')
  )
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
    bootstrapPassword: '',
    resetInternalPasswords: false,
    skipSchema: false,
    skipSqlData: false,
    skipAuthBackfill: false,
    skipInternalAuth: false,
    skipReadiness: false,
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || '').trim()
    if (!token) continue

    if (token === '--help' || token === '-h') {
      args.help = true
      continue
    }

    if (token === '--apply') {
      args.apply = true
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

    if (token === '--keep-files') {
      args.keepFiles = true
      continue
    }

    if (token === '--bootstrap-password') {
      args.bootstrapPassword = String(argv[index + 1] || '').trim()
      index += 1
      continue
    }

    if (token.startsWith('--bootstrap-password=')) {
      args.bootstrapPassword = token.slice('--bootstrap-password='.length).trim()
      continue
    }

    if (token === '--reset-internal-passwords') {
      args.resetInternalPasswords = true
      continue
    }

    if (token === '--skip-schema') {
      args.skipSchema = true
      continue
    }

    if (token === '--skip-sql-data') {
      args.skipSqlData = true
      continue
    }

    if (token === '--skip-auth-backfill') {
      args.skipAuthBackfill = true
      continue
    }

    if (token === '--skip-internal-auth') {
      args.skipInternalAuth = true
      continue
    }

    if (token === '--skip-readiness') {
      args.skipReadiness = true
      continue
    }

    throw new Error(`Unknown argument: ${token}`)
  }

  if (args.schemas.length === 0) args.schemas = ['public']
  args.excludes = Array.from(new Set([...DEFAULT_SQL_EXCLUDES, ...args.excludes]))
  return args
}

function runNodeScript(scriptName, scriptArgs, extraEnv = {}) {
  const scriptPath = join(SCRIPT_DIR, scriptName)
  const result = spawnSync(process.execPath, [scriptPath, ...scriptArgs], {
    stdio: 'inherit',
    env: {
      ...process.env,
      ...extraEnv,
    },
  })

  if (result.error) throw result.error
  if (typeof result.status === 'number' && result.status !== 0) {
    throw new Error(`${scriptName} failed with exit code ${result.status}`)
  }
}

function buildSharedArgs(args) {
  const sharedArgs = []
  if (args.targetDbUrl) {
    sharedArgs.push('--target-db-url', args.targetDbUrl)
  }
  if (args.service) {
    sharedArgs.push('--service', args.service)
  }
  return sharedArgs
}

function buildSchemaArgs(args) {
  return buildSharedArgs(args)
}

function buildSqlDataArgs(args) {
  const scriptArgs = buildSharedArgs(args)
  for (const schema of args.schemas) {
    scriptArgs.push('--schema', schema)
  }
  for (const excludedTable of args.excludes) {
    scriptArgs.push('--exclude', excludedTable)
  }
  if (args.keepFiles) {
    scriptArgs.push('--keep-files')
  }
  return scriptArgs
}

function buildAuthArgs(args) {
  return buildSharedArgs(args)
}

function buildReadinessArgs(args) {
  const scriptArgs = buildSharedArgs(args)
  for (const schema of args.schemas) {
    scriptArgs.push('--schema', schema)
  }
  for (const excludedTable of args.excludes) {
    scriptArgs.push('--exclude', excludedTable)
  }
  return scriptArgs
}

function stepLabel(title, mode) {
  return `\n=== ${title} (${mode}) ===\n`
}

function resolveBootstrapPassword(args) {
  const password = args.bootstrapPassword || String(process.env.INTERNAL_AUTH_BOOTSTRAP_PASSWORD || '').trim()
  return password.length >= 8 ? password : ''
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    return
  }

  const mode = args.apply ? 'apply' : 'dry-run'
  console.log(`Railway cutover orchestrator (${mode})`)

  if (!args.skipSchema) {
    console.log(stepLabel('Schema Sync', mode))
    const scriptArgs = buildSchemaArgs(args)
    if (args.apply) scriptArgs.push('--apply')
    runNodeScript('sync-supabase-to-railway.mjs', scriptArgs)
  }

  if (!args.skipSqlData) {
    console.log(stepLabel('SQL Data Sync', mode))
    const scriptArgs = buildSqlDataArgs(args)
    if (args.apply) scriptArgs.push('--apply')
    runNodeScript('sync-supabase-rest-to-railway.mjs', scriptArgs)
  }

  if (!args.skipAuthBackfill) {
    console.log(stepLabel('Auth Users Backfill', mode))
    const scriptArgs = buildAuthArgs(args)
    if (args.apply) scriptArgs.push('--apply')
    runNodeScript('backfill-railway-auth-users.mjs', scriptArgs)
  }

  if (!args.skipInternalAuth) {
    console.log(stepLabel('Internal Auth Bootstrap', mode))
    const scriptArgs = buildAuthArgs(args)
    const extraEnv = {}
    if (args.apply) {
      scriptArgs.push('--apply')
      const bootstrapPassword = resolveBootstrapPassword(args)
      if (bootstrapPassword) {
        extraEnv.INTERNAL_AUTH_BOOTSTRAP_PASSWORD = bootstrapPassword
      }
      if (args.resetInternalPasswords) {
        scriptArgs.push('--reset-passwords')
      }
    }
    runNodeScript('bootstrap-railway-internal-auth-users.mjs', scriptArgs, extraEnv)
  }

  if (!args.skipReadiness) {
    console.log(stepLabel('Readiness Check', 'report'))
    runNodeScript('check-railway-cutover-readiness.mjs', buildReadinessArgs(args))
  }

  console.log('\nCutover flow finished.')
  console.log('Reminder: Supabase Storage masih harus dipindah ke storage pengganti sebelum runtime benar-benar lepas dari Supabase.')
}

try {
  main()
} catch (error) {
  console.error(String(error?.message || error))
  process.exit(1)
}
