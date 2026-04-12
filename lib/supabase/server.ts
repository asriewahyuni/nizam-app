/**
 * lib/supabase/server.ts
 *
 * Drop-in replacement untuk Supabase client — semua query sekarang ke Railway PostgreSQL.
 * Interface dijaga sama agar semua action files tidak perlu diubah.
 *
 * ⚠ Supabase Cloud tidak lagi digunakan. AUTH_PROVIDER=internal adalah satu-satunya mode.
 */

import { createPostgresNativeClient } from '@/lib/db/postgres-client'
import { getInternalAuthSession, signOutInternalAuth } from '@/lib/auth/internal-auth.server'
import { INTERNAL_AUTH_SESSION_MAX_AGE } from '@/lib/auth/internal-auth.shared'

/**
 * createClient() — kompatibel dengan Supabase JS SDK interface.
 * Digunakan di Server Components, Server Actions, dan Route Handlers.
 *
 * - .from(table).*  → PostgreSQL native query ke Railway
 * - .auth.*         → Internal auth session (cookie-based)
 * - .rpc()          → PostgreSQL function call ke Railway
 */
export async function createClient() {
  const pgClient = createPostgresNativeClient()
  const mutableClient = pgClient as any

  // Override auth methods dengan internal auth berbasis session cookie
  mutableClient.auth = {
    async getUser() {
      const internalSession = await getInternalAuthSession()
      return {
        data: { user: (internalSession?.user || null) as unknown },
        error: null,
      }
    },

    async getSession() {
      const internalSession = await getInternalAuthSession()
      if (!internalSession?.user) {
        return { data: { session: null }, error: null }
      }
      const nowEpoch = Math.floor(Date.now() / 1000)
      return {
        data: {
          session: {
            access_token: `internal:${internalSession.sessionId}`,
            refresh_token: `internal:${internalSession.sessionId}`,
            token_type: 'bearer',
            expires_in: INTERNAL_AUTH_SESSION_MAX_AGE,
            expires_at: nowEpoch + INTERNAL_AUTH_SESSION_MAX_AGE,
            user: internalSession.user as unknown,
          },
        },
        error: null,
      }
    },

    async signOut() {
      await signOutInternalAuth()
      return { error: null }
    },

    // Admin API stub — digunakan oleh beberapa actions untuk user lookup
    admin: {
      async listUsers() {
        // Tidak diimplementasikan dalam mode Railway-only
        return { data: { users: [] }, error: null }
      },
      async getUserById(id: string) {
        return { data: { user: null }, error: null }
      },
      async updateUserById(id: string, _attrs: Record<string, unknown>) {
        return { data: { user: null }, error: null }
      },
    },
  }

  return mutableClient
}

/**
 * createAdminClient() — alias createClient() karena PostgreSQL superuser
 * sudah bypass semua RLS secara native.
 */
export async function createAdminClient() {
  return createClient()
}
