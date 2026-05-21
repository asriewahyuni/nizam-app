#!/usr/bin/env node
/**
 * Sync local Supabase migrations into Railway Postgres safely.
 *
 * Default mode is dry-run so we can inspect pending migrations first:
 *   node scripts/sync-supabase-to-railway.mjs
 *
 * Apply mode:
 *   node scripts/sync-supabase-to-railway.mjs --apply
 *
 * Optional (only for first-time baselining or recovery):
 *   node scripts/sync-supabase-to-railway.mjs --apply --include-all
 */
import { spawnSync } from 'node:child_process'

function printHelp() {
  console.log(
    [
      'Usage: node scripts/sync-supabase-to-railway.mjs [options]',
      '',
      'Options:',
      '  --apply             Apply migrations (default is dry-run only)',
      '  --include-all       Pass --include-all to supabase db push',
      '  --db-url <url>      Override target database URL',
      '  --service <name>    Railway service name (default: Postgres)',
      '  --help              Show this help',
      '',
      'Env fallback for DB URL:',
      '  1) RAILWAY_DATABASE_URL',
      '  2) DATABASE_PUBLIC_URL',
      '  3) DATABASE_URL',
      '',
      'If env fallback is empty, URL is resolved from:',
      '  npx @railway/cli variables --service <name> --json',
    ].join('\n')
  )
}

function parseArgs(argv) {
  const args = {
    apply: false,
    includeAll: false,
    dbUrl: '',
    service: 'Postgres',
    help: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--apply') args.apply = true
    else if (token === '--include-all') args.includeAll = true
    else if (token === '--help' || token === '-h') args.help = true
    else if (token === '--db-url') {
      args.dbUrl = String(argv[i + 1] || '').trim()
      i += 1
    } else if (token.startsWith('--db-url=')) {
      args.dbUrl = token.slice('--db-url='.length).trim()
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

  if (result.error) {
    throw result.error
  }

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
        'Set RAILWAY_DATABASE_URL manually, or ensure Railway Postgres variables exist.',
      ].join('\n')
    )
  }

  return fromRailway
}

function runSupabasePush({ dbUrl, includeAll, dryRun }) {
  const args = ['supabase', 'db', 'push', '--db-url', dbUrl, '--yes']
  if (includeAll) args.push('--include-all')
  if (dryRun) args.push('--dry-run')

  const result = spawnSync('npx', args, { stdio: 'inherit' })
  if (result.error) throw result.error
  if (typeof result.status === 'number' && result.status !== 0) {
    throw new Error(`supabase db push failed with exit code ${result.status}`)
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.help) {
    printHelp()
    return
  }

  const dbUrl = args.dbUrl || resolveRailwayDbUrl(args.service)
  console.log(`Target Railway DB: ${maskDbUrl(dbUrl)}`)
  console.log('Step 1/2: Dry-run migration push...\n')
  runSupabasePush({
    dbUrl,
    includeAll: args.includeAll,
    dryRun: true,
  })

  if (!args.apply) {
    console.log('\nDry-run completed. To apply for real, run again with --apply.')
    return
  }

  console.log('\nStep 2/2: Applying migrations...\n')
  runSupabasePush({
    dbUrl,
    includeAll: args.includeAll,
    dryRun: false,
  })

  console.log('\nMigration sync to Railway completed.')
}

try {
  main()
} catch (error) {
  console.error(String(error?.message || error))
  process.exit(1)
}

