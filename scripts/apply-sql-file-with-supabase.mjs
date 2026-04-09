#!/usr/bin/env node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

function parseArgs(argv) {
  const args = {
    sqlFile: '',
    dbUrl: '',
    dbUrlFile: '',
    supabaseBin: process.env.SUPABASE_BIN || 'supabase',
    skipBenign: true,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--sql-file') {
      args.sqlFile = String(argv[i + 1] || '').trim()
      i += 1
    } else if (token.startsWith('--sql-file=')) {
      args.sqlFile = token.slice('--sql-file='.length).trim()
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
    } else if (token === '--strict') {
      args.skipBenign = false
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
  if (!args.sqlFile) throw new Error('Missing --sql-file')
  if (!args.dbUrl) throw new Error('Missing --db-url or --db-url-file')
  if (!fs.existsSync(args.sqlFile)) throw new Error(`SQL file not found: ${args.sqlFile}`)

  return args
}

function printHelp() {
  console.log(
    [
      'Usage: node scripts/apply-sql-file-with-supabase.mjs [options]',
      '',
      'Options:',
      '  --sql-file <path>       SQL file to apply',
      '  --db-url <url>          Target DB URL',
      '  --db-url-file <path>    Read target DB URL from file',
      '  --supabase-bin <path>   Supabase CLI binary path',
      '  --strict                Do not skip benign duplicate errors',
    ].join('\n')
  )
}

function run(cmd, argv) {
  const result = spawnSync(cmd, argv, { encoding: 'utf8' })
  if (result.error) throw result.error
  return {
    code: typeof result.status === 'number' ? result.status : 1,
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || ''),
  }
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

function isBenign(message) {
  const text = String(message || '')
  return [
    /already exists/i,
    /duplicate key value violates unique constraint/i,
    /does not exist, skipping/i,
  ].some((rx) => rx.test(text))
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const sql = fs.readFileSync(args.sqlFile, 'utf8')
  const statements = splitSqlStatements(sql)

  console.log(`Applying ${args.sqlFile}`)
  console.log(`Statements: ${statements.length}`)

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apply-sql-'))
  try {
    for (let i = 0; i < statements.length; i += 1) {
      const filePath = path.join(tmpDir, `${String(i + 1).padStart(4, '0')}.sql`)
      fs.writeFileSync(filePath, `${statements[i]};\n`)

      const result = run(args.supabaseBin, ['db', 'query', '--db-url', args.dbUrl, '--file', filePath])
      if (result.code !== 0) {
        const combined = `${result.stdout}\n${result.stderr}`.trim()
        if (args.skipBenign && isBenign(combined)) {
          console.log(`  skip benign error at statement ${i + 1}`)
          continue
        }
        throw new Error(
          [
            `Failed at statement ${i + 1}/${statements.length}`,
            result.stdout ? `stdout:\n${result.stdout}` : '',
            result.stderr ? `stderr:\n${result.stderr}` : '',
          ]
            .filter(Boolean)
            .join('\n\n')
        )
      }
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }

  console.log('Apply complete.')
}

try {
  main()
} catch (error) {
  console.error(String(error?.message || error))
  process.exit(1)
}
