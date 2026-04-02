import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabaseAdminConfig, getSupabasePublicConfig } from '@/lib/supabase/config'
import type { Database } from '@/types/database.types'

/**
 * Supabase client for use in:
 * - Server Components
 * - Server Actions
 * - Route Handlers
 */
export async function createClient() {
  const cookieStore = await cookies()
  const { url, anonKey } = getSupabasePublicConfig()

  return createServerClient<Database>(
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
