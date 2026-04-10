import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabaseAdminConfig, getSupabasePublicConfig } from '@/lib/supabase/config'
import { isInternalAuthProvider } from '@/lib/auth/provider'
import { getInternalAuthSession, signOutInternalAuth } from '@/lib/auth/internal-auth.server'
import { INTERNAL_AUTH_SESSION_MAX_AGE } from '@/lib/auth/internal-auth.shared'
import type { Database } from '@/types/database.types'

type MutableServerClient = {
  auth?: Record<string, unknown>
}

/**
 * Supabase client for use in:
 * - Server Components
 * - Server Actions
 * - Route Handlers
 */
export async function createClient() {
  const cookieStore = await cookies()
  const { url, anonKey } = getSupabasePublicConfig()

  const client = createServerClient<Database>(
    url,
    anonKey,
    {
      db: { schema: 'public' },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component — cookie setting ignored
          }
        },
      },
    }
  )

  if (isInternalAuthProvider()) {
    const mutableClient = client as unknown as MutableServerClient
    const auth = mutableClient.auth || {}

    mutableClient.auth = {
      ...auth,
      async getUser() {
        const internalSession = await getInternalAuthSession()
        return {
          data: {
            user: (internalSession?.user || null) as unknown,
          },
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
    }
  }

  return client
}

export async function createAdminClient() {
  const { url, serviceRoleKey } = getSupabaseAdminConfig()

  return createServerClient<Database>(
    url,
    serviceRoleKey,
    {
      db: { schema: 'public' },
      cookies: {
        getAll() { return [] },
        setAll() {}
      },
    }
  )
}
