export type AuthProvider = 'supabase' | 'internal'

const DEFAULT_AUTH_PROVIDER: AuthProvider = 'supabase'

function normalizeAuthProvider(value: unknown): AuthProvider {
  const normalized = String(value || '').trim().toLowerCase()
  return normalized === 'internal' ? 'internal' : DEFAULT_AUTH_PROVIDER
}

export function getAuthProvider(): AuthProvider {
  return normalizeAuthProvider(
    process.env.AUTH_PROVIDER || process.env.NEXT_PUBLIC_AUTH_PROVIDER
  )
}

export function isInternalAuthProvider() {
  return getAuthProvider() === 'internal'
}
