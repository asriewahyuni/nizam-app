export const INTERNAL_AUTH_SESSION_COOKIE = 'nizam_internal_session'
export const INTERNAL_AUTH_SESSION_MAX_AGE = 60 * 60 * 24 * 30

/**
 * session.user.id berisi legacy_user_id (Supabase auth.users UUID) kalau ada,
 * BUKAN internal_auth_users.id — lihat toInternalSessionUser() di internal-auth.server.ts.
 * Pakai fungsi ini untuk FK yang merujuk ke internal_auth_users(id), mis. kojasmat_anggota.user_id.
 */
export function resolveInternalUserId(session: {
  user: { id: string; user_metadata: Record<string, unknown> }
}): string {
  return (session.user.user_metadata['internal_user_id'] as string | null) ?? session.user.id
}

/**
 * Domain eksplisit untuk cookie sesi/context, dipakai agar sesi tetap valid
 * lintas subdomain (mis. kliknizam.app <-> brain.kliknizam.app). Kosong/undefined
 * berarti cookie host-only seperti default Next.js (aman untuk dev/localhost).
 */
export function getSessionCookieDomain(): string | undefined {
  return process.env.SESSION_COOKIE_DOMAIN?.trim() || undefined
}
