/**
 * lib/supabase/config.ts
 *
 * Config helper untuk Supabase SDK.
 *
 * ⚠ DEPRECATED: Semua query data sudah pindah ke Railway PostgreSQL native.
 * File ini hanya dipertahankan agar tidak ada runtime error dari modul yang
 * masih import getSupabasePublicConfig() / getSupabaseAdminConfig().
 * Fungsi-fungsi ini mengembalikan nilai dummy yang aman jika env tidak diset.
 */

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

/**
 * Kembalikan nilai string atau fallback kosong (tidak throw).
 * Dalam mode Railway-only, nilai ini tidak digunakan untuk query nyata.
 */
function getEnvOrEmpty(value: string | undefined): string {
  return value || ''
}

export function getSupabasePublicConfig(): SupabasePublicConfig {
  const target = getSupabaseTarget()

  if (target === 'local') {
    return {
      target,
      url: getEnvOrEmpty(process.env.NEXT_PUBLIC_SUPABASE_LOCAL_URL),
      anonKey: getEnvOrEmpty(process.env.NEXT_PUBLIC_SUPABASE_LOCAL_ANON_KEY),
    }
  }

  return {
    target,
    url: getEnvOrEmpty(process.env.NEXT_PUBLIC_SUPABASE_URL),
    anonKey: getEnvOrEmpty(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  }
}

export function getSupabaseAdminConfig(): SupabaseAdminConfig {
  const publicConfig = getSupabasePublicConfig()
  const serviceRoleKey =
    publicConfig.target === 'local'
      ? getEnvOrEmpty(process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY)
      : getEnvOrEmpty(process.env.SUPABASE_SERVICE_ROLE_KEY)
 
  if (publicConfig.target === 'local' && !serviceRoleKey) {
    throw new Error('Missing SUPABASE_LOCAL_SERVICE_ROLE_KEY')
  }
 
  return {
    ...publicConfig,
    serviceRoleKey,
  }
}
