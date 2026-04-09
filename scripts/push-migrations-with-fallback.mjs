#!/usr/bin/env node
/**
 * Push migrations to a remote database with automatic fallback for
 * "cannot insert multiple commands into a prepared statement" failures.
 *
 * Workflow:
 * 1) Run `supabase db push`
 * 2) If parser/prepared-statement failure occurs on migration X at statement N:
 *    - Split migration file into SQL statements
 *    - Apply from statement N onward using `supabase db query --file ...`
 *    - Mark migration X as applied via `supabase migration repair`
 * 3) Repeat until `db push` succeeds
 *
 * Usage:
 *   node scripts/push-migrations-with-fallback.mjs \
 *     --workdir /tmp/supa_source_sync \
 *     --db-url-file /tmp/railway_db_url.txt \
 *     --supabase-bin /path/to/supabase
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

function parseArgs(argv) {
  const args = {
    workdir: process.cwd(),
    dbUrl: '',
    dbUrlFile: '',
    supabaseBin: process.env.SUPABASE_BIN || 'supabase',
    maxRetries: 50,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--workdir') {
      args.workdir = String(argv[i + 1] || '').trim()
      i += 1
    } else if (token.startsWith('--workdir=')) {
      args.workdir = token.slice('--workdir='.length).trim()
    } else if (token === '--db-url') {
      args.dbUrl = String(argv[i + 1] || '').trim()
      i += 1
    } else if (token.startsWith('--db-url=')) {
      args.dbUrl = token.slice('--db-url='.length).trim()
    } else if (token === '--db-url-file') {
      args.dbUrlFile = String(argv[i + 1] || '').trim()
      i += 1
    } else if (token.startsWith('--db-url-file=')) {
      args.dbUrlFile = token.slice('--db-url-file='.length).trim()
    } else if (token === '--supabase-bin') {
      args.supabaseBin = String(argv[i + 1] || '').trim()
      i += 1
    } else if (token.startsWith('--supabase-bin=')) {
      args.supabaseBin = token.slice('--supabase-bin='.length).trim()
    } else if (token === '--max-retries') {
      args.maxRetries = Number(argv[i + 1] || 50)
      i += 1
    } else if (token.startsWith('--max-retries=')) {
      args.maxRetries = Number(token.slice('--max-retries='.length))
    } else if (token === '--help' || token === '-h') {
      printHelp()
      process.exit(0)
    } else {
      throw new Error(`Unknown argument: ${token}`)
    }
  }

  if (!args.dbUrl && args.dbUrlFile) {
    args.dbUrl = String(fs.readFileSync(args.dbUrlFile, 'utf8')).trim()
  }
  if (!args.dbUrl) {
    throw new Error('Missing DB URL. Provide --db-url or --db-url-file.')
  }
  if (!Number.isFinite(args.maxRetries) || args.maxRetries < 1) {
    throw new Error('--max-retries must be a positive number.')
  }

  return args
}

function printHelp() {
  console.log(
    [
      'Usage: node scripts/push-migrations-with-fallback.mjs [options]',
      '',
      'Options:',
      '  --workdir <path>         Supabase project dir containing `supabase/migrations`',
      '  --db-url <url>           Target Postgres URL',
      '  --db-url-file <path>     Read target Postgres URL from file',
      '  --supabase-bin <path>    Supabase CLI binary path (default: $SUPABASE_BIN or supabase)',
      '  --max-retries <n>        Max fallback loops (default: 50)',
      '  --help                   Show help',
    ].join('\n')
  )
}

function run(cmd, argv, { cwd } = {}) {
  const result = spawnSync(cmd, argv, {
    cwd,
    encoding: 'utf8',
  })
  if (result.error) throw result.error
  return {
    code: typeof result.status === 'number' ? result.status : 1,
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || ''),
  }
}

function runStrict(cmd, argv, options = {}) {
  const result = run(cmd, argv, options)
  if (result.code !== 0) {
    throw new Error(
      [
        `Command failed: ${cmd} ${argv.join(' ')}`,
        result.stdout ? `stdout:\n${result.stdout}` : '',
        result.stderr ? `stderr:\n${result.stderr}` : '',
      ]
        .filter(Boolean)
        .join('\n\n')
    )
  }
  return result
}

function parseFailingMigration(output) {
  const applyingMatches = [...output.matchAll(/Applying migration ([0-9]+_[^\s.]+\.sql)\.\.\./g)]
  const lastApplying = applyingMatches.at(-1)
  if (!lastApplying) return null

  const statementMatch = output.match(/At statement:\s*([0-9]+)/i)
  const statementNumber = statementMatch ? Number(statementMatch[1]) : 1
  if (!Number.isFinite(statementNumber) || statementNumber < 1) {
    return { filename: lastApplying[1], statementNumber: 1 }
  }
  return { filename: lastApplying[1], statementNumber }
}

function readDollarTag(sql, i) {
  if (sql[i] !== '$') return null
  let j = i + 1
  while (j < sql.length && /[A-Za-z0-9_]/.test(sql[j])) j += 1
  if (j < sql.length && sql[j] === '$') return sql.slice(i, j + 1)
  return null
}

function splitSqlStatements(sql) {
  const out = []
  let buffer = ''

  let inSingle = false
  let inDouble = false
  let inLineComment = false
  let inBlockComment = false
  let dollarTag = null

  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i]
    const next = i + 1 < sql.length ? sql[i + 1] : ''

    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) {
        buffer += dollarTag
        i += dollarTag.length - 1
        dollarTag = null
      } else {
        buffer += ch
      }
      continue
    }

    if (inSingle) {
      buffer += ch
      if (ch === "'" && next === "'") {
        buffer += next
        i += 1
      } else if (ch === "'") {
        inSingle = false
      }
      continue
    }

    if (inDouble) {
      buffer += ch
      if (ch === '"' && next === '"') {
        buffer += next
        i += 1
      } else if (ch === '"') {
        inDouble = false
      }
      continue
    }

    if (inLineComment) {
      buffer += ch
      if (ch === '\n') inLineComment = false
      continue
    }

    if (inBlockComment) {
      buffer += ch
      if (ch === '*' && next === '/') {
        buffer += next
        i += 1
        inBlockComment = false
      }
      continue
    }

    if (ch === '-' && next === '-') {
      buffer += '--'
      i += 1
      inLineComment = true
      continue
    }

    if (ch === '/' && next === '*') {
      buffer += '/*'
      i += 1
      inBlockComment = true
      continue
    }

    if (ch === "'") {
      buffer += ch
      inSingle = true
      continue
    }

    if (ch === '"') {
      buffer += ch
      inDouble = true
      continue
    }

    if (ch === '$') {
      const tag = readDollarTag(sql, i)
      if (tag) {
        buffer += tag
        i += tag.length - 1
        dollarTag = tag
        continue
      }
    }

    if (ch === ';') {
      const statement = buffer.trim()
      if (statement) out.push(statement)
      buffer = ''
      continue
    }

    buffer += ch
  }

  const last = buffer.trim()
  if (last) out.push(last)
  return out
}

function isSkippableError(message) {
  const text = String(message || '')
  return [
    /already exists/i,
    /duplicate key value violates unique constraint/i,
    /is already a member of role/i,
  ].some((rx) => rx.test(text))
}

function applyStatements({ statements, startIndex, workdir, dbUrl, supabaseBin, label }) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fallback-sql-'))
  try {
    for (let i = startIndex; i < statements.length; i += 1) {
      const statement = statements[i].trim()
      if (!statement) continue

      const filePath = path.join(tmpDir, `${label}.${String(i + 1).padStart(4, '0')}.sql`)
      fs.writeFileSync(filePath, `${statement};\n`)

      const result = run(
        supabaseBin,
        ['db', 'query', '--db-url', dbUrl, '--file', filePath],
        { cwd: workdir }
      )
      if (result.code !== 0) {
        const combined = `${result.stdout}\n${result.stderr}`.trim()
        if (!isSkippableError(combined)) {
          throw new Error(
            [
              `Failed fallback statement ${i + 1}/${statements.length} for ${label}`,
              result.stdout ? `stdout:\n${result.stdout}` : '',
              result.stderr ? `stderr:\n${result.stderr}` : '',
            ]
              .filter(Boolean)
              .join('\n\n')
          )
        }
        console.log(`  skip benign error at statement ${i + 1}`)
      }

      if ((i + 1 - startIndex + 1) % 10 === 0) {
        console.log(`  applied ${i + 1 - startIndex + 1} statements from fallback...`)
      }
    }
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    } catch {
      // ignore cleanup errors
    }
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2))

  console.log(`Workdir     : ${args.workdir}`)
  console.log(`Supabase bin: ${args.supabaseBin}`)
  console.log(`Max retries : ${args.maxRetries}`)
  console.log('Starting migration push with fallback...')

  for (let attempt = 1; attempt <= args.maxRetries; attempt += 1) {
    console.log(`\nPush attempt ${attempt}/${args.maxRetries}`)
    const pushResult = run(
      args.supabaseBin,
      ['db', 'push', '--db-url', args.dbUrl, '--yes'],
      { cwd: args.workdir }
    )
    const combinedOutput = `${pushResult.stdout}\n${pushResult.stderr}`.trim()
    if (combinedOutput) console.log(combinedOutput)

    if (pushResult.code === 0) {
      console.log('\nPush completed successfully.')
      return
    }

    const failInfo = parseFailingMigration(combinedOutput)
    if (!failInfo) {
      throw new Error('db push failed and failing migration could not be parsed.\n' + combinedOutput)
    }

    const migrationPath = path.join(
      args.workdir,
      'supabase',
      'migrations',
      failInfo.filename
    )
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Failing migration file not found: ${migrationPath}`)
    }

    console.log(`Fallback apply: ${failInfo.filename} from statement ${failInfo.statementNumber}`)
    const sql = fs.readFileSync(migrationPath, 'utf8')
    const statements = splitSqlStatements(sql)
    // Supabase parser statement index can differ from our splitter
    // (especially around function bodies). Re-apply from start with
    // idempotent skipping for "already exists" type errors.
    const startIndex = 0

    applyStatements({
      statements,
      startIndex,
      workdir: args.workdir,
      dbUrl: args.dbUrl,
      supabaseBin: args.supabaseBin,
      label: failInfo.filename.replace(/\.sql$/i, ''),
    })

    const version = failInfo.filename.split('_')[0]
    console.log(`Marking migration ${version} as applied...`)
    runStrict(
      args.supabaseBin,
      ['migration', 'repair', '--db-url', args.dbUrl, '--status', 'applied', version, '--yes'],
      { cwd: args.workdir }
    )
  }

  throw new Error(`Reached max retries (${args.maxRetries}) before completion.`)
}

try {
  main()
} catch (error) {
  console.error(String(error?.message || error))
  process.exit(1)
}
