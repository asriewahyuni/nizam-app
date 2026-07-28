export const INTERNAL_AUTH_SESSION_COOKIE = 'nizam_internal_session'
export const INTERNAL_AUTH_SESSION_MAX_AGE = 60 * 60 * 24 * 30

/**
 * Domain eksplisit untuk cookie sesi/context, dipakai agar sesi tetap valid
 * lintas subdomain (mis. kliknizam.app <-> brain.kliknizam.app). Kosong/undefined
 * berarti cookie host-only seperti default Next.js (aman untuk dev/localhost).
 */
export function getSessionCookieDomain(): string | undefined {
  return process.env.SESSION_COOKIE_DOMAIN?.trim() || undefined
}
