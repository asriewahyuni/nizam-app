#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import readline from 'node:readline/promises'
import { spawn, spawnSync } from 'node:child_process'

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1'])
const DEFAULT_POSTGRES_IMAGE = 'postgres:16'
const CONNECT_TIMEOUT_SECONDS = '10'
const EXPECTED_TABLES = ['organizations', 'products', 'sales', 'ecommerce_orders']
const LOCAL_PLACEHOLDER_ROLES = ['anon', 'authenticated', 'service_role']

function printHelp() {
  console.log(
    [
      'Usage: node scripts/clone-railway-to-local.mjs [options]',
      '',
      'Command ini akan menghapus lalu membuat ulang database clone lokal,',
      'kemudian menyalin penuh database Railway/Postgres ke sana.',
      '',
      'Options:',
      '  --dry-run   Cek env, Docker, dan koneksi tanpa mengubah database lokal',
      '  --force     Lewati konfirmasi ketik nama database target',
      '  --verbose   Tampilkan log teknis tambahan',
      '  --help      Tampilkan bantuan ini',
      '',
      'Env yang dibutuhkan:',
      '  RAILWAY_DATABASE_URL / DATABASE_PUBLIC_URL / DATABASE_URL',
      '  LOCAL_POSTGRES_ADMIN_URL',
      '  LOCAL_CLONE_DATABASE_URL',
      '  LOCAL_CLONE_POSTGRES_IMAGE (opsional, default: postgres:16)',
    ].join('\n')
  )
}

function parseArgs(argv) {
  const args = {
    dryRun: false,
    force: false,
    verbose: false,
    help: false,
  }

  for (const token of argv) {
    if (token === '--dry-run') {
      args.dryRun = true
    } else if (token === '--force') {
      args.force = true
    } else if (token === '--verbose') {
      args.verbose = true
    } else if (token === '--help' || token === '-h') {
      args.help = true
    } else {
      throw new Error(`Argumen tidak dikenal: ${token}`)
    }
  }

  return args
}

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath)
  } catch {
    return false
  }
}

function stripInlineComment(raw) {
  let quoted = false
  let quoteChar = ''

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index]
    if (!quoted && (char === '"' || char === "'")) {
      quoted = true
      quoteChar = char
      continue
    }

    if (quoted && char === quoteChar) {
      quoted = false
      quoteChar = ''
      continue
    }

    if (!quoted && char === '#' && (index === 0 || /\s/.test(raw[index - 1] || ''))) {
      return raw.slice(0, index).trim()
    }
  }

  return raw.trim()
}

function decodeEnvValue(rawValue) {
  const trimmed = stripInlineComment(String(rawValue || '').trim())
  if (!trimmed) return ''

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    const quote = trimmed[0]
    const inner = trimmed.slice(1, -1)
    if (quote === "'") return inner
    return inner
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
  }

  return trimmed
}

function parseEnvFile(filePath) {
  const env = {}
  if (!fileExists(filePath)) return env

  const content = fs.readFileSync(filePath, 'utf8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const normalized = line.startsWith('export ') ? line.slice('export '.length).trim() : line
    const separatorIndex = normalized.indexOf('=')
    if (separatorIndex <= 0) continue

    const key = normalized.slice(0, separatorIndex).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue

    const value = normalized.slice(separatorIndex + 1)
    env[key] = decodeEnvValue(value)
  }

  return env
}

function loadEnvMap() {
  const rootDir = process.cwd()
  const baseEnv = parseEnvFile(path.join(rootDir, '.env'))
  const localEnv = parseEnvFile(path.join(rootDir, '.env.local'))
  return {
    ...baseEnv,
    ...localEnv,
    ...process.env,
  }
}

function readEnvValue(envMap, keys) {
  for (const key of keys) {
    const value = String(envMap[key] || '').trim()
    if (value) return value
  }
  return ''
}

function parsePostgresUrl(rawUrl, label) {
  const value = String(rawUrl || '').trim()
  if (!value) {
    throw new Error(`Variabel ${label} belum diisi.`)
  }

  let parsed
  try {
    parsed = new URL(value)
  } catch {
    throw new Error(`${label} bukan URL PostgreSQL yang valid.`)
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error(`${label} harus memakai skema postgres:// atau postgresql://.`)
  }

  return parsed
}

function normalizeDockerDbUrl(parsedUrl) {
  const normalized = new URL(parsedUrl.toString())
  if (LOCAL_HOSTNAMES.has(normalized.hostname)) {
    normalized.hostname = 'host.docker.internal'
  }

  if (!LOCAL_HOSTNAMES.has(parsedUrl.hostname) && !normalized.searchParams.has('sslmode')) {
    normalized.searchParams.set('sslmode', 'require')
  }

  return normalized.toString()
}

function maskDbUrl(dbUrl) {
  try {
    const parsed = new URL(dbUrl)
    if (parsed.password) parsed.password = '***'
    return parsed.toString()
  } catch {
    return dbUrl
  }
}

function getDatabaseName(parsedUrl, label) {
  const pathname = String(parsedUrl.pathname || '').replace(/^\/+/, '')
  if (!pathname) {
    throw new Error(`${label} harus menyertakan nama database di akhir URL.`)
  }
  return decodeURIComponent(pathname.split('/').filter(Boolean).at(-1) || '')
}

function sqlLiteral(value) {
  return `'${String(value || '').replace(/'/g, "''")}'`
}

function sqlIdent(value) {
  return `"${String(value || '').replace(/"/g, '""')}"`
}

function normalizeEndpointIdentity(parsedUrl) {
  const port = parsedUrl.port || ''
  const dbName = getDatabaseName(parsedUrl, 'URL')
  return `${parsedUrl.hostname.toLowerCase()}:${port}/${dbName}`
}

function ensureDistinctDatabases(sourceUrl, adminUrl, cloneUrl) {
  const sourceIdentity = normalizeEndpointIdentity(sourceUrl)
  const adminIdentity = normalizeEndpointIdentity(adminUrl)
  const cloneIdentity = normalizeEndpointIdentity(cloneUrl)

  if (sourceIdentity === cloneIdentity) {
    throw new Error('Source online dan target clone lokal mengarah ke database yang sama. Proses dibatalkan.')
  }

  if (adminIdentity === cloneIdentity) {
    throw new Error(
      'LOCAL_POSTGRES_ADMIN_URL tidak boleh menunjuk ke database clone. Arahkan ke database admin seperti `postgres`.'
    )
  }
}

function logStep(message) {
  console.log(`\n• ${message}`)
}

function logInfo(message) {
  console.log(`  ${message}`)
}

function logVerbose(enabled, message) {
  if (enabled) {
    console.log(`  [verbose] ${message}`)
  }
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    ...options,
  })

  if (result.error) throw result.error

  return {
    code: typeof result.status === 'number' ? result.status : 1,
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || ''),
  }
}

function assertDockerReady() {
  let versionResult
  try {
    versionResult = runCommand('docker', ['--version'])
  } catch {
    throw new Error('Docker tidak ditemukan. Pasang Docker Desktop lalu coba lagi.')
  }

  if (versionResult.code !== 0) {
    throw new Error('Docker tidak ditemukan. Pasang Docker Desktop lalu coba lagi.')
  }

  const infoResult = runCommand('docker', ['info'])
  if (infoResult.code !== 0) {
    throw new Error('Docker sudah terpasang, tetapi daemon belum aktif. Nyalakan Docker Desktop lalu coba lagi.')
  }
}

function dockerArgs(image, executable, dbUrl, extraArgs = []) {
  return [
    'run',
    '--rm',
    '-i',
    '-e',
    `PGCONNECT_TIMEOUT=${CONNECT_TIMEOUT_SECONDS}`,
    image,
    executable,
    dbUrl,
    ...extraArgs,
  ]
}

function runDockerPsql({ image, dbUrl, sql, label, verbose }) {
  const args = dockerArgs(image, 'psql', dbUrl, ['-v', 'ON_ERROR_STOP=1', '-At', '-c', sql])
  logVerbose(verbose, `psql ${label}: ${maskDbUrl(dbUrl)}`)
  const result = runCommand('docker', args)

  if (result.code !== 0) {
    const details = [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join('\n')
    throw new Error(`${label} gagal.\n${details || 'Tidak ada detail error dari psql.'}`)
  }

  return result.stdout.trim()
}

function resolveServerMajorVersion({ image, dbUrl, label, verbose }) {
  const raw = runDockerPsql({
    image,
    dbUrl,
    sql: "SELECT current_setting('server_version_num');",
    label,
    verbose,
  })

  const numericVersion = Number.parseInt(String(raw || '').trim(), 10)
  const major = Math.trunc(numericVersion / 10000)

  if (!Number.isFinite(numericVersion) || !Number.isFinite(major) || major < 1) {
    throw new Error(`${label} gagal membaca versi PostgreSQL server.`)
  }

  return major
}

function resolveCompatibleDumpImage(baseImage, sourceMajorVersion) {
  const normalized = String(baseImage || '').trim()
  if (!normalized) return `postgres:${sourceMajorVersion}`

  const match = normalized.match(/^postgres(?::(.+))?$/i)
  if (!match) {
    return normalized
  }

  return `postgres:${sourceMajorVersion}`
}

function ensureConnection({ image, dbUrl, label, verbose }) {
  runDockerPsql({
    image,
    dbUrl,
    sql: 'select current_database();',
    label,
    verbose,
  })
}

function summarizeContext({ sourceUrl, adminUrl, cloneUrl, image }) {
  console.log('Ringkasan target clone:')
  logInfo(`Source online : ${maskDbUrl(sourceUrl.toString())}`)
  logInfo(`Admin lokal   : ${maskDbUrl(adminUrl.toString())}`)
  logInfo(`DB clone lokal: ${maskDbUrl(cloneUrl.toString())}`)
  logInfo(`Docker client : ${image}`)
}

async function confirmDestructiveAction(databaseName) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      'Terminal ini tidak interaktif. Jalankan ulang dengan terminal biasa, atau pakai flag --force jika Anda yakin.'
    )
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  try {
    const answer = (await rl.question(`Ketik nama database target (${databaseName}) untuk lanjut: `)).trim()
    if (answer !== databaseName) {
      throw new Error('Konfirmasi tidak cocok. Proses dibatalkan dan database lokal tidak diubah.')
    }
  } finally {
    rl.close()
  }
}

function rebuildCloneDatabase({ image, adminDbUrl, cloneDatabaseName, verbose }) {
  const terminateSql = `
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = ${sqlLiteral(cloneDatabaseName)}
      AND pid <> pg_backend_pid();
  `

  logStep('Menutup koneksi lama ke database clone lokal')
  runDockerPsql({
    image,
    dbUrl: adminDbUrl,
    sql: terminateSql,
    label: 'Memutus koneksi database clone',
    verbose,
  })

  logStep('Menghapus database clone lokal lama jika ada')
  runDockerPsql({
    image,
    dbUrl: adminDbUrl,
    sql: `DROP DATABASE IF EXISTS ${sqlIdent(cloneDatabaseName)};`,
    label: 'DROP DATABASE',
    verbose,
  })

  logStep('Membuat ulang database clone lokal')
  runDockerPsql({
    image,
    dbUrl: adminDbUrl,
    sql: `CREATE DATABASE ${sqlIdent(cloneDatabaseName)};`,
    label: 'CREATE DATABASE',
    verbose,
  })
}

function ensureLocalPlaceholderRoles({ image, adminDbUrl, verbose }) {
  const statements = LOCAL_PLACEHOLDER_ROLES.map(
    (roleName) => `
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${sqlLiteral(roleName)}) THEN
        CREATE ROLE ${sqlIdent(roleName)} NOLOGIN;
      END IF;
    `
  ).join('\n')

  logStep('Menyiapkan role placeholder Supabase di PostgreSQL lokal')
  runDockerPsql({
    image,
    dbUrl: adminDbUrl,
    sql: `
      DO $$
      BEGIN
        ${statements}
      END
      $$;
    `,
    label: 'Membuat role placeholder lokal',
    verbose,
  })
}

function pipeOutput(stream, target, buffer) {
  if (!stream) return
  stream.setEncoding('utf8')
  stream.on('data', (chunk) => {
    buffer.push(chunk)
    target.write(chunk)
  })
}

function streamDumpToRestore({
  stepLabel,
  dumpImage,
  restoreImage,
  sourceDbUrl,
  targetDbUrl,
  dumpArgs,
  restoreArgs,
  verbose,
}) {
  return new Promise((resolve, reject) => {
    logStep(stepLabel)
    logInfo('Proses ini bisa butuh beberapa menit tergantung ukuran database.')

    logVerbose(verbose, `pg_dump source: ${maskDbUrl(sourceDbUrl)} via ${dumpImage}`)
    logVerbose(verbose, `psql target: ${maskDbUrl(targetDbUrl)} via ${restoreImage}`)

    const dump = spawn('docker', dumpArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const restore = spawn('docker', restoreArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const dumpStdErr = []
    const restoreStdOut = []
    const restoreStdErr = []

    dump.on('error', (error) => reject(error))
    restore.on('error', (error) => reject(error))

    if (!dump.stdout || !restore.stdin) {
      reject(new Error('Gagal menyiapkan stream clone database.'))
      return
    }

    dump.stdout.on('error', () => undefined)
    restore.stdin.on('error', () => undefined)
    dump.stdout.pipe(restore.stdin)

    pipeOutput(dump.stderr, process.stderr, dumpStdErr)
    pipeOutput(restore.stdout, process.stdout, restoreStdOut)
    pipeOutput(restore.stderr, process.stderr, restoreStdErr)

    let dumpClosed = false
    let restoreClosed = false
    let dumpCode = 1
    let restoreCode = 1
    let finished = false

    const maybeFinish = () => {
      if (finished || !dumpClosed || !restoreClosed) return
      finished = true

      if (dumpCode !== 0 || restoreCode !== 0) {
        const errorParts = [
          dumpStdErr.join('').trim(),
          restoreStdOut.join('').trim(),
          restoreStdErr.join('').trim(),
        ].filter(Boolean)
        reject(
          new Error(
            [
              'Restore database gagal.',
              dumpCode !== 0 ? `pg_dump keluar dengan kode ${dumpCode}.` : '',
              restoreCode !== 0 ? `psql keluar dengan kode ${restoreCode}.` : '',
              errorParts.join('\n'),
            ]
              .filter(Boolean)
              .join('\n')
          )
        )
        return
      }

      resolve()
    }

    dump.on('close', (code) => {
      dumpClosed = true
      dumpCode = typeof code === 'number' ? code : 1
      maybeFinish()
    })

    restore.on('close', (code) => {
      restoreClosed = true
      restoreCode = typeof code === 'number' ? code : 1
      maybeFinish()
    })
  })
}

async function restoreDatabase({ dumpImage, restoreImage, sourceDbUrl, targetDbUrl, verbose }) {
  await streamDumpToRestore({
    stepLabel: 'Memulihkan schema dari online ke lokal',
    dumpImage,
    restoreImage,
    sourceDbUrl,
    targetDbUrl,
    dumpArgs: dockerArgs(dumpImage, 'pg_dump', sourceDbUrl, [
      '--schema-only',
      '--no-owner',
      '--no-privileges',
      '--quote-all-identifiers',
      '--verbose',
    ]),
    restoreArgs: dockerArgs(restoreImage, 'psql', targetDbUrl, ['-v', 'ON_ERROR_STOP=1']),
    verbose,
  })

  await streamDumpToRestore({
    stepLabel: 'Memulihkan data dari online ke lokal',
    dumpImage,
    restoreImage,
    sourceDbUrl,
    targetDbUrl,
    dumpArgs: dockerArgs(dumpImage, 'pg_dump', sourceDbUrl, [
      '--data-only',
      '--disable-triggers',
      '--no-owner',
      '--no-privileges',
      '--quote-all-identifiers',
      '--verbose',
    ]),
    restoreArgs: dockerArgs(restoreImage, 'psql', targetDbUrl, ['-v', 'ON_ERROR_STOP=1']),
    verbose,
  })
}

function verifyRestore({ image, cloneDbUrl, verbose }) {
  logStep('Memeriksa hasil clone lokal')
  const tableCount = runDockerPsql({
    image,
    dbUrl: cloneDbUrl,
    sql: `
      SELECT COUNT(*)::text
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema');
    `,
    label: 'Verifikasi jumlah tabel',
    verbose,
  })

  const expectedTableSql = `
    SELECT COALESCE(string_agg(name, ', ' ORDER BY name), '')
    FROM (
      SELECT unnest(ARRAY[${EXPECTED_TABLES.map(sqlLiteral).join(', ')}]) AS name
    ) AS expected
    WHERE to_regclass('public.' || name) IS NOT NULL;
  `

  const existingTables = runDockerPsql({
    image,
    dbUrl: cloneDbUrl,
    sql: expectedTableSql,
    label: 'Verifikasi tabel utama',
    verbose,
  })

  logInfo(`Jumlah tabel non-sistem: ${tableCount || '0'}`)
  if (existingTables) {
    logInfo(`Tabel utama yang terdeteksi: ${existingTables}`)
  } else {
    logInfo('Tabel utama belum terdeteksi. Cek ulang hasil clone jika ini tidak sesuai harapan.')
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    return
  }

  const envMap = loadEnvMap()
  const image = String(envMap.LOCAL_CLONE_POSTGRES_IMAGE || DEFAULT_POSTGRES_IMAGE).trim() || DEFAULT_POSTGRES_IMAGE
  const sourceRawUrl = readEnvValue(envMap, ['RAILWAY_DATABASE_URL', 'DATABASE_PUBLIC_URL', 'DATABASE_URL'])
  const adminRawUrl = readEnvValue(envMap, ['LOCAL_POSTGRES_ADMIN_URL'])
  const cloneRawUrl = readEnvValue(envMap, ['LOCAL_CLONE_DATABASE_URL'])

  const sourceUrl = parsePostgresUrl(sourceRawUrl, 'RAILWAY_DATABASE_URL / DATABASE_PUBLIC_URL / DATABASE_URL')
  const adminUrl = parsePostgresUrl(adminRawUrl, 'LOCAL_POSTGRES_ADMIN_URL')
  const cloneUrl = parsePostgresUrl(cloneRawUrl, 'LOCAL_CLONE_DATABASE_URL')

  ensureDistinctDatabases(sourceUrl, adminUrl, cloneUrl)

  const cloneDatabaseName = getDatabaseName(cloneUrl, 'LOCAL_CLONE_DATABASE_URL')
  const adminDatabaseName = getDatabaseName(adminUrl, 'LOCAL_POSTGRES_ADMIN_URL')

  if (adminDatabaseName === cloneDatabaseName) {
    throw new Error(
      'LOCAL_POSTGRES_ADMIN_URL tidak boleh memakai database clone yang sama. Gunakan database admin seperti `postgres`.'
    )
  }

  const sourceDockerUrl = normalizeDockerDbUrl(sourceUrl)
  const adminDockerUrl = normalizeDockerDbUrl(adminUrl)
  const cloneDockerUrl = normalizeDockerDbUrl(cloneUrl)

  logStep('Menjalankan preflight')
  assertDockerReady()
  summarizeContext({ sourceUrl, adminUrl, cloneUrl, image })

  logInfo('Menguji koneksi source online...')
  ensureConnection({
    image,
    dbUrl: sourceDockerUrl,
    label: 'Koneksi source online',
    verbose: args.verbose,
  })

  logInfo('Menguji koneksi admin PostgreSQL lokal...')
  ensureConnection({
    image,
    dbUrl: adminDockerUrl,
    label: 'Koneksi admin PostgreSQL lokal',
    verbose: args.verbose,
  })

  const sourceMajorVersion = resolveServerMajorVersion({
    image,
    dbUrl: sourceDockerUrl,
    label: 'Membaca versi PostgreSQL source online',
    verbose: args.verbose,
  })
  const localMajorVersion = resolveServerMajorVersion({
    image,
    dbUrl: adminDockerUrl,
    label: 'Membaca versi PostgreSQL lokal',
    verbose: args.verbose,
  })
  const dumpImage = resolveCompatibleDumpImage(image, sourceMajorVersion)

  logInfo(`Versi source online : PostgreSQL ${sourceMajorVersion}`)
  logInfo(`Versi lokal         : PostgreSQL ${localMajorVersion}`)
  if (dumpImage !== image) {
    logInfo(`Image pg_dump otomatis disesuaikan ke ${dumpImage} agar cocok dengan source online.`)
  }

  if (args.dryRun) {
    logStep('Dry-run selesai')
    logInfo('Env, Docker, dan koneksi dasar sudah lolos. Tidak ada perubahan database yang dijalankan.')
    return
  }

  if (!args.force) {
    logStep('Konfirmasi penghapusan database clone lokal')
    await confirmDestructiveAction(cloneDatabaseName)
  } else {
    logInfo('Flag --force aktif, konfirmasi manual dilewati.')
  }

  rebuildCloneDatabase({
    image,
    adminDbUrl: adminDockerUrl,
    cloneDatabaseName,
    verbose: args.verbose,
  })

  ensureLocalPlaceholderRoles({
    image,
    adminDbUrl: adminDockerUrl,
    verbose: args.verbose,
  })

  await restoreDatabase({
    dumpImage,
    restoreImage: image,
    sourceDbUrl: sourceDockerUrl,
    targetDbUrl: cloneDockerUrl,
    verbose: args.verbose,
  })

  verifyRestore({
    image,
    cloneDbUrl: cloneDockerUrl,
    verbose: args.verbose,
  })

  logStep('Selesai')
  logInfo(`Database clone lokal ${cloneDatabaseName} sudah diganti dengan data terbaru dari online.`)
}

main().catch((error) => {
  const message = String(error?.message || error || 'Unknown error')
  console.error(`\n❌ ${message}`)
  process.exit(1)
})
