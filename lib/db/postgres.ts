import { Pool, type QueryResultRow } from 'pg'

type GlobalWithPostgresPool = typeof globalThis & {
  __nizamPostgresPool?: Pool
}

const globalWithPostgresPool = globalThis as GlobalWithPostgresPool

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

  return new Pool({
    connectionString,
    max,
    idleTimeoutMillis,
    ssl: resolveSslConfig(connectionString),
  })
}

export function getPostgresPool() {
  if (!globalWithPostgresPool.__nizamPostgresPool) {
    globalWithPostgresPool.__nizamPostgresPool = createPool()
  }

  return globalWithPostgresPool.__nizamPostgresPool
}

export async function queryPostgres<T extends QueryResultRow>(
  text: string,
  values?: unknown[]
) {
  return getPostgresPool().query<T>(text, values)
}

export async function closePostgresPool() {
  const pool = globalWithPostgresPool.__nizamPostgresPool
  if (!pool) return

  globalWithPostgresPool.__nizamPostgresPool = undefined
  await pool.end()
}
