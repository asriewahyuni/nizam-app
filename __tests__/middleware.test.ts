import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: mocks.createServerClient,
}))

import { updateSession } from '@/lib/supabase/middleware'

const ORIGINAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ORIGINAL_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const ORIGINAL_TARGET = process.env.NEXT_PUBLIC_SUPABASE_TARGET
const ORIGINAL_LOCAL_URL = process.env.NEXT_PUBLIC_SUPABASE_LOCAL_URL
const ORIGINAL_LOCAL_KEY = process.env.NEXT_PUBLIC_SUPABASE_LOCAL_ANON_KEY
const ORIGINAL_AUTH_PROVIDER = process.env.AUTH_PROVIDER

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name]
    return
  }

  process.env[name] = value
}

describe('Supabase Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.AUTH_PROVIDER
    delete process.env.NEXT_PUBLIC_SUPABASE_TARGET
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
    delete process.env.NEXT_PUBLIC_SUPABASE_LOCAL_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_LOCAL_ANON_KEY
  })

  afterEach(() => {
    restoreEnv('AUTH_PROVIDER', ORIGINAL_AUTH_PROVIDER)
    restoreEnv('NEXT_PUBLIC_SUPABASE_TARGET', ORIGINAL_TARGET)
    restoreEnv('NEXT_PUBLIC_SUPABASE_URL', ORIGINAL_URL)
    restoreEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', ORIGINAL_KEY)
    restoreEnv('NEXT_PUBLIC_SUPABASE_LOCAL_URL', ORIGINAL_LOCAL_URL)
    restoreEnv('NEXT_PUBLIC_SUPABASE_LOCAL_ANON_KEY', ORIGINAL_LOCAL_KEY)
  })

  it('redirects unauthenticated users away from protected routes', async () => {
    mocks.createServerClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
        }),
      },
    })

    const response = await updateSession(new NextRequest('http://localhost:3000/fleet'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/login?redirectTo=%2Ffleet')
  })

  it('keeps query params in redirectTo for protected routes', async () => {
    mocks.createServerClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
        }),
      },
    })

    const response = await updateSession(
      new NextRequest('http://localhost:3000/hris?tab=attendance&branchId=abc')
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/login?redirectTo=%2Fhris%3Ftab%3Dattendance%26branchId%3Dabc'
    )
  })

  it('redirects authenticated users away from auth pages', async () => {
    mocks.createServerClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
        }),
      },
    })

    const response = await updateSession(new NextRequest('http://localhost:3000/login'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard')
  })

  it('redirects authenticated users to redirectTo when provided', async () => {
    mocks.createServerClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
        }),
      },
    })

    const response = await updateSession(
      new NextRequest('http://localhost:3000/login?redirectTo=%2Freports%3FstartDate%3D2026-03-01')
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/reports?startDate=2026-03-01')
  })

  it('passes through public routes while still building a response', async () => {
    mocks.createServerClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
        }),
      },
    })

    const response = await updateSession(new NextRequest('http://localhost:3000/demo'))

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })

  it('bypasses internal next requests without auth lookup', async () => {
    const response = await updateSession(new NextRequest('http://localhost:3000/_next/webpack-hmr'))

    expect(mocks.createServerClient).not.toHaveBeenCalled()
    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })

  it('uses local supabase credentials when target is local', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_TARGET = 'local'
    process.env.NEXT_PUBLIC_SUPABASE_LOCAL_URL = 'http://127.0.0.1:54321'
    process.env.NEXT_PUBLIC_SUPABASE_LOCAL_ANON_KEY = 'local-anon-key'

    mocks.createServerClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
        }),
      },
    })

    await updateSession(new NextRequest('http://localhost:3000/fleet'))

    expect(mocks.createServerClient).toHaveBeenCalledWith(
      'http://127.0.0.1:54321',
      'local-anon-key',
      expect.any(Object)
    )
  })

  it('uses internal session cookie when AUTH_PROVIDER=internal', async () => {
    process.env.AUTH_PROVIDER = 'internal'

    const request = new NextRequest('http://localhost:3000/fleet', {
      headers: {
        cookie: 'nizam_internal_session=internal-token',
      },
    })

    const response = await updateSession(request)

    expect(mocks.createServerClient).not.toHaveBeenCalled()
    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })
})
