/**
 * Helper kecil untuk membaca target database runtime yang benar-benar dipakai app.
 *
 * Penting karena project masih punya env Supabase legacy, sementara runtime data
 * utama sudah memakai PostgreSQL native.
 */

export type RuntimeDatabaseMode =
  | 'local-postgres'
  | 'railway-postgres'
  | 'remote-postgres'
  | 'missing'

export type RuntimeDatabaseSourceKey =
  | 'DATABASE_URL'
  | 'RAILWAY_DATABASE_URL'
  | 'DATABASE_PUBLIC_URL'
  | 'missing'

export type RuntimeDatabaseTarget = {
  mode: RuntimeDatabaseMode
  sourceKey: RuntimeDatabaseSourceKey
  connectionString: string
  host: string
  port: string
  database: string
}

function getActiveConnectionString() {
  const candidates = [
    ['DATABASE_URL', String(process.env.DATABASE_URL || '').trim()],
    ['RAILWAY_DATABASE_URL', String(process.env.RAILWAY_DATABASE_URL || '').trim()],
    ['DATABASE_PUBLIC_URL', String(process.env.DATABASE_PUBLIC_URL || '').trim()],
  ] as const

  for (const [sourceKey, value] of candidates) {
    if (value) {
      return { sourceKey, value }
    }
  }

  return { sourceKey: 'missing' as const, value: '' }
}

function resolveModeFromHost(host: string): RuntimeDatabaseMode {
  const normalized = String(host || '').trim().toLowerCase()
  if (!normalized) return 'missing'
  if (normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1') {
    return 'local-postgres'
  }
  if (normalized.endsWith('.rlwy.net') || normalized.endsWith('.railway.internal')) {
    return 'railway-postgres'
  }
  return 'remote-postgres'
}

export function resolveRuntimeDatabaseTarget(): RuntimeDatabaseTarget {
  const active = getActiveConnectionString()
  if (!active.value) {
    return {
      mode: 'missing',
      sourceKey: 'missing',
      connectionString: '',
      host: '',
      port: '',
      database: '',
    }
  }

  try {
    const parsed = new URL(active.value)
    const database = String(parsed.pathname || '').replace(/^\/+/, '')

    return {
      mode: resolveModeFromHost(parsed.hostname),
      sourceKey: active.sourceKey,
      connectionString: active.value,
      host: parsed.hostname,
      port: parsed.port,
      database,
    }
  } catch {
    return {
      mode: 'remote-postgres',
      sourceKey: active.sourceKey,
      connectionString: active.value,
      host: '',
      port: '',
      database: '',
    }
  }
}
