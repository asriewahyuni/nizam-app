import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getSupabaseAdminConfig, getSupabasePublicConfig } from '@/lib/supabase/config'

const ORIGINAL_ENV = {
  NEXT_PUBLIC_SUPABASE_TARGET: process.env.NEXT_PUBLIC_SUPABASE_TARGET,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SUPABASE_LOCAL_URL: process.env.NEXT_PUBLIC_SUPABASE_LOCAL_URL,
  NEXT_PUBLIC_SUPABASE_LOCAL_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_LOCAL_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_LOCAL_SERVICE_ROLE_KEY: process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY,
}

function restoreEnv() {
  Object.entries(ORIGINAL_ENV).forEach(([key, value]) => {
    if (value === undefined) {
      delete process.env[key]
      return
    }

    process.env[key] = value
  })
}

describe('Supabase Config', () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_TARGET
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    delete process.env.NEXT_PUBLIC_SUPABASE_LOCAL_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_LOCAL_ANON_KEY
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY
  })

  afterEach(() => {
    restoreEnv()
  })

  it('uses remote credentials by default', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'remote-anon'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'remote-service-role'

    expect(getSupabasePublicConfig()).toEqual({
      target: 'remote',
      url: 'https://example.supabase.co',
      anonKey: 'remote-anon',
    })

    expect(getSupabaseAdminConfig()).toEqual({
      target: 'remote',
      url: 'https://example.supabase.co',
      anonKey: 'remote-anon',
      serviceRoleKey: 'remote-service-role',
    })
  })

  it('uses local credentials when target is local', () => {
    process.env.NEXT_PUBLIC_SUPABASE_TARGET = 'local'
    process.env.NEXT_PUBLIC_SUPABASE_LOCAL_URL = 'http://127.0.0.1:54321'
    process.env.NEXT_PUBLIC_SUPABASE_LOCAL_ANON_KEY = 'local-anon'
    process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY = 'local-service-role'

    expect(getSupabasePublicConfig()).toEqual({
      target: 'local',
      url: 'http://127.0.0.1:54321',
      anonKey: 'local-anon',
    })

    expect(getSupabaseAdminConfig()).toEqual({
      target: 'local',
      url: 'http://127.0.0.1:54321',
      anonKey: 'local-anon',
      serviceRoleKey: 'local-service-role',
    })
  })

  it('requires a dedicated local service role key in local mode', () => {
    process.env.NEXT_PUBLIC_SUPABASE_TARGET = 'local'
    process.env.NEXT_PUBLIC_SUPABASE_LOCAL_URL = 'http://127.0.0.1:54321'
    process.env.NEXT_PUBLIC_SUPABASE_LOCAL_ANON_KEY = 'local-anon'

    expect(() => getSupabaseAdminConfig()).toThrow('Missing SUPABASE_LOCAL_SERVICE_ROLE_KEY')
  })
})
