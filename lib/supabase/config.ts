type SupabaseTarget = 'remote' | 'local'

type SupabasePublicConfig = {
  target: SupabaseTarget
  url: string
  anonKey: string
}

type SupabaseAdminConfig = SupabasePublicConfig & {
  serviceRoleKey: string
}

const LOCAL_TARGET = 'local'

function getSupabaseTarget(): SupabaseTarget {
  return process.env.NEXT_PUBLIC_SUPABASE_TARGET === LOCAL_TARGET ? LOCAL_TARGET : 'remote'
}

function requireEnv(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing ${name}`)
  }

  return value
}

export function getSupabasePublicConfig(): SupabasePublicConfig {
  const target = getSupabaseTarget()

  if (target === 'local') {
    return {
      target,
      url: requireEnv('NEXT_PUBLIC_SUPABASE_LOCAL_URL', process.env.NEXT_PUBLIC_SUPABASE_LOCAL_URL),
      anonKey: requireEnv('NEXT_PUBLIC_SUPABASE_LOCAL_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_LOCAL_ANON_KEY),
    }
  }

  return {
    target,
    url: requireEnv('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
    anonKey: requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  }
}

export function getSupabaseAdminConfig(): SupabaseAdminConfig {
  const publicConfig = getSupabasePublicConfig()
  const serviceRoleKey =
    publicConfig.target === 'local'
      ? requireEnv('SUPABASE_LOCAL_SERVICE_ROLE_KEY', process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY)
      : requireEnv('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY)

  return {
    ...publicConfig,
    serviceRoleKey,
  }
}
