'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { NizamDatabase } from '@/types/database.types'

/**
 * Supabase client for use in Client Components.
 * Singleton pattern — avoids creating multiple GoTrue instances.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  return createBrowserClient<NizamDatabase>(url, key)
}
