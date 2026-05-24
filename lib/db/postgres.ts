import { Pool, types, type PoolClient, type QueryResultRow } from 'pg'

// Kembalikan DATE (OID 1082) sebagai string plain "YYYY-MM-DD",
// bukan JavaScript Date object. Hal ini menghindari konversi timezone
// yang tidak konsisten antar server (UTC vs UTC+7) dan mempermudah
// perbandingan tanggal di seluruh aplikasi.
types.setTypeParser(1082, (val: string) => val)

type GlobalWithPostgresPool = typeof globalThis & {
  __nizamPostgresPool?: Pool
}

const globalWithPostgresPool = globalThis as GlobalWithPostgresPool
const RETRYABLE_POSTGRES_ERROR_CODES = new Set([
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
])

function requireDatabaseUrl() {
  const value =
    String(process.env.DATABASE_URL || '').trim() ||
    String(process.env.RAILWAY_DATABASE_URL || '').trim() ||
    String(process.env.DATABASE_PUBLIC_URL || '').trim()

  if (!value) {
    throw new Error('Missing DATABASE_URL/RAILWAY_DATABASE_URL/DATABASE_PUBLIC_URL')
  }

  return value
}

function resolveSslConfig(connectionString: string) {
  try {
    const host = new URL(connectionString).hostname.toLowerCase()
    const isPrivateRailway = host.endsWith('.railway.internal')
    const isLocalhost = host === 'localhost' || host === '127.0.0.1'

    if (isPrivateRailway || isLocalhost) {
      return false
    }

    return { rejectUnauthorized: false }
  } catch {
    return undefined
  }
}

function createPool() {
  const connectionString = requireDatabaseUrl()
  const max = Number(process.env.PG_POOL_MAX || 10)
  const idleTimeoutMillis = Number(process.env.PG_IDLE_TIMEOUT_MS || 30_000)
  const connectionTimeoutMillis = Number(process.env.PG_CONNECT_TIMEOUT_MS || 10_000)

  return new Pool({
    connectionString,
    max,
    idleTimeoutMillis,
    connectionTimeoutMillis,
    ssl: resolveSslConfig(connectionString),
  })
}

export function getPostgresPool() {
  if (!globalWithPostgresPool.__nizamPostgresPool) {
    globalWithPostgresPool.__nizamPostgresPool = createPool()
  }

  return globalWithPostgresPool.__nizamPostgresPool
}

function shouldRetryPostgresError(error: unknown) {
  const code = String((error as { code?: unknown })?.code || '').trim().toUpperCase()
  if (RETRYABLE_POSTGRES_ERROR_CODES.has(code)) return true

  const message = error instanceof Error ? error.message.toLowerCase() : String(error || '').toLowerCase()
  return (
    message.includes('getaddrinfo enotfound')
    || message.includes('eai_again')
    || message.includes('connection terminated unexpectedly')
    || message.includes('socket hang up')
  )
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function resetPostgresPool() {
  const pool = globalWithPostgresPool.__nizamPostgresPool
  if (!pool) return

  globalWithPostgresPool.__nizamPostgresPool = undefined
  try {
    await pool.end()
  } catch {
    // Abaikan error cleanup agar retry tetap lanjut.
  }
}

async function runPostgresWithRetry<T>(
  operationName: 'query' | 'connect',
  runner: (pool: Pool) => Promise<T>
): Promise<T> {
  const maxAttempts = Math.max(1, Number(process.env.PG_RETRY_ATTEMPTS || 2))
  const retryDelayMs = Math.max(50, Number(process.env.PG_RETRY_DELAY_MS || 250))

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await runner(getPostgresPool())
    } catch (error) {
      if (attempt >= maxAttempts || !shouldRetryPostgresError(error)) {
        throw error
      }

      console.warn(
        `[Postgres] ${operationName} gagal karena koneksi sementara. Reset pool dan coba lagi (${attempt}/${maxAttempts}).`
      )
      await resetPostgresPool()
      await sleep(retryDelayMs)
    }
  }

  throw new Error(`[Postgres] Retry ${operationName} gagal tanpa error yang jelas.`)
}

export async function queryPostgres<T extends QueryResultRow>(
  text: string,
  values?: unknown[]
) {
  return runPostgresWithRetry('query', (pool) => pool.query<T>(text, values))
}

export async function connectPostgresClient(): Promise<PoolClient> {
  return runPostgresWithRetry('connect', (pool) => pool.connect())
}

export async function closePostgresPool() {
  await resetPostgresPool()
}
