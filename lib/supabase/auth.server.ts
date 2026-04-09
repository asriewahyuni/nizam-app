import type { AuthError, User } from '@supabase/supabase-js'
import { cache } from 'react'
import { createClient } from './server'

export type ServerAuthContext = {
  supabase: Awaited<ReturnType<typeof createClient>>
  user: User | null
  error: AuthError | null
}

const getServerAuthContextCached = cache(async (): Promise<ServerAuthContext> => {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  return {
    supabase,
    user,
    error,
  }
})

export async function getServerAuthContext() {
  // Reuse the same server auth lookup within a request so page/layout loaders
  // do not keep repeating the same Supabase auth round-trip.
  return getServerAuthContextCached()
}
