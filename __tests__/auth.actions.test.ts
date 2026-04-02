import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  cookies: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
  createAdminClient: mocks.createAdminClient,
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

vi.mock('next/headers', () => ({
  cookies: mocks.cookies,
}))

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}))

import {
  getSession,
  restorePlatformAdminSession,
  signInAsTenantOwner,
  signOut,
  signUp,
} from '@/modules/auth/actions/auth.actions'

function createCookieStore(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))

  return {
    get: vi.fn((name: string) => {
      const value = values.get(name)
      return value ? { name, value } : undefined
    }),
    set: vi.fn((name: string, value: string) => {
      values.set(name, value)
    }),
    delete: vi.fn((name: string) => {
      values.delete(name)
    }),
    getAll: vi.fn(() => Array.from(values.entries()).map(([name, value]) => ({ name, value }))),
    values,
  }
}

describe('Auth Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.cookies.mockResolvedValue(createCookieStore())
  })

  it('maps duplicate sign-up errors to a user-friendly message', async () => {
    mocks.createClient.mockResolvedValue({
      auth: {
        signUp: vi.fn().mockResolvedValue({
          data: null,
          error: {
            message: 'User already registered',
          },
        }),
      },
    })

    const formData = new FormData()
    formData.set('email', 'owner@example.com')
    formData.set('password', 'secret123')
    formData.set('fullName', 'Owner Example')

    const result = await signUp(formData)

    expect(result).toEqual({
      error: 'Gagal: Email ini sudah pernah didaftarkan. Silakan Login atau gunakan email lain.'
    })
  })

  it('returns the active user session when available', async () => {
    const user = { id: 'user-1', email: 'owner@example.com' }
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user },
          error: null,
        }),
      },
    })

    const result = await getSession()

    expect(result).toEqual(user)
  })

  it('returns null when no authenticated user exists', async () => {
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    })

    const result = await getSession()

    expect(result).toBeNull()
  })

  it('signs out, revalidates layout, and redirects to login', async () => {
    const signOutMock = vi.fn().mockResolvedValue({})
    const cookieStore = createCookieStore({
      nizam_active_org_id: 'org-1',
      nizam_admin_impersonation: 'backup-token',
    })
    mocks.cookies.mockResolvedValue(cookieStore)
    mocks.createClient.mockResolvedValue({
      auth: {
        signOut: signOutMock,
      },
    })

    await signOut()

    expect(cookieStore.delete).toHaveBeenCalledWith('nizam_active_org_id')
    expect(cookieStore.delete).toHaveBeenCalledWith('nizam_admin_impersonation')
    expect(signOutMock).toHaveBeenCalledOnce()
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/', 'layout')
    expect(mocks.redirect).toHaveBeenCalledWith('/login')
  })

  it('rejects sign in as tenant when current user is not a platform admin', async () => {
    mocks.createClient.mockResolvedValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: {
              access_token: 'access-token',
              refresh_token: 'refresh-token',
              user: {
                id: 'user-1',
                email: 'owner@example.com',
              },
            },
          },
          error: null,
        }),
      },
    })
    mocks.createAdminClient.mockResolvedValue({})

    const result = await signInAsTenantOwner('org-1')

    expect(result).toEqual({
      error: 'Akses ditolak. Hanya platform admin yang bisa login sebagai tenant.'
    })
  })

  it('backs up admin session, switches to tenant session, and redirects to dashboard', async () => {
    const cookieStore = createCookieStore({
      nizam_active_org_id: 'admin-org-1',
    })
    mocks.cookies.mockResolvedValue(cookieStore)

    mocks.createClient.mockResolvedValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: {
              access_token: 'admin-access',
              refresh_token: 'admin-refresh',
              user: {
                id: 'admin-user',
                email: 'bob@executive.id',
              },
            },
          },
          error: null,
        }),
        verifyOtp: vi.fn().mockResolvedValue({
          data: { session: { access_token: 'tenant-access' } },
          error: null,
        }),
      },
    })

    const orgQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 'org-tenant-1',
          name: 'Tenant One',
          owner_email: 'tenant-owner@example.com',
        },
        error: null,
      }),
    }

    const ownerMemberQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          user_id: 'tenant-owner-user-id',
        },
        error: null,
      }),
    }

    mocks.createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'organizations') return orgQuery
        if (table === 'org_members') return ownerMemberQuery
        throw new Error(`Unexpected table ${table}`)
      }),
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: {
              user: {
                id: 'tenant-owner-user-id',
                email: 'tenant-owner@example.com',
              },
            },
            error: null,
          }),
          generateLink: vi.fn().mockResolvedValue({
            data: {
              properties: {
                hashed_token: 'tenant-token-hash',
              },
            },
            error: null,
          }),
        },
      },
    })

    await signInAsTenantOwner('org-tenant-1')

    expect(cookieStore.set).toHaveBeenCalledWith(
      'nizam_admin_impersonation',
      expect.any(String),
      expect.objectContaining({ path: '/', httpOnly: true, sameSite: 'lax' })
    )
    const backupCookie = cookieStore.set.mock.calls.find(([name]) => name === 'nizam_admin_impersonation')?.[1]
    const decodedBackup = JSON.parse(Buffer.from(String(backupCookie), 'base64url').toString('utf8'))
    expect(decodedBackup).toEqual({
      accessToken: 'admin-access',
      refreshToken: 'admin-refresh',
      email: 'bob@executive.id',
      activeOrgId: 'admin-org-1',
    })

    expect(cookieStore.set).toHaveBeenCalledWith(
      'nizam_active_org_id',
      'org-tenant-1',
      expect.objectContaining({ path: '/', httpOnly: true, sameSite: 'lax' })
    )
    expect(cookieStore.delete).toHaveBeenCalledWith('nizam_demo_org_id')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/', 'layout')
    expect(mocks.redirect).toHaveBeenCalledWith('/dashboard')
  })

  it('restores backed up admin session and redirects back to admin', async () => {
    const payload = Buffer.from(JSON.stringify({
      accessToken: 'admin-access',
      refreshToken: 'admin-refresh',
      email: 'bob@executive.id',
      activeOrgId: 'admin-org-1',
    }), 'utf8').toString('base64url')
    const cookieStore = createCookieStore({
      nizam_admin_impersonation: payload,
      nizam_active_org_id: 'tenant-org-1',
    })
    mocks.cookies.mockResolvedValue(cookieStore)

    const setSessionMock = vi.fn().mockResolvedValue({ data: {}, error: null })
    mocks.createClient.mockResolvedValue({
      auth: {
        setSession: setSessionMock,
      },
    })

    await restorePlatformAdminSession()

    expect(setSessionMock).toHaveBeenCalledWith({
      access_token: 'admin-access',
      refresh_token: 'admin-refresh',
    })
    expect(cookieStore.delete).toHaveBeenCalledWith('nizam_demo_org_id')
    expect(cookieStore.set).toHaveBeenCalledWith(
      'nizam_active_org_id',
      'admin-org-1',
      expect.objectContaining({ path: '/', httpOnly: true, sameSite: 'lax' })
    )
    expect(cookieStore.delete).toHaveBeenCalledWith('nizam_admin_impersonation')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/', 'layout')
    expect(mocks.redirect).toHaveBeenCalledWith('/admin')
  })
})
