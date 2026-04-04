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
  requestPasswordReset,
  restorePlatformAdminSession,
  signInWithNik,
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
      nizam_active_branch_id: 'branch-1',
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
    expect(cookieStore.delete).toHaveBeenCalledWith('nizam_active_branch_id')
    expect(cookieStore.delete).toHaveBeenCalledWith('nizam_admin_impersonation')
    expect(signOutMock).toHaveBeenCalledOnce()
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/', 'layout')
    expect(mocks.redirect).toHaveBeenCalledWith('/login')
  })

  it('signs in employee by NIK using a shared auth user and keeps active org preference', async () => {
    const cookieStore = createCookieStore({
      nizam_active_org_id: 'org-b',
      nizam_active_branch_id: 'branch-old',
    })
    const signInWithPasswordMock = vi.fn().mockResolvedValue({ error: null })

    mocks.cookies.mockResolvedValue(cookieStore)
    mocks.createClient.mockResolvedValue({
      auth: {
        signInWithPassword: signInWithPasswordMock,
      },
    })

    const employeesQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          { id: 'emp-a', org_id: 'org-a', user_id: 'user-shared', created_at: '2025-01-01T00:00:00Z' },
          { id: 'emp-b', org_id: 'org-b', user_id: 'user-shared', created_at: '2025-02-01T00:00:00Z' },
        ],
        error: null,
      }),
    }

    const getUserByIdMock = vi.fn().mockResolvedValue({
      data: {
        user: {
          id: 'user-shared',
          email: 'shared.staff@example.com',
        },
      },
      error: null,
    })

    mocks.createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'employees') return employeesQuery
        throw new Error(`Unexpected table ${table}`)
      }),
      auth: {
        admin: {
          getUserById: getUserByIdMock,
        },
      },
    })

    const formData = new FormData()
    formData.set('nik', 'K-0001')
    formData.set('password', 'secret123')
    formData.set('redirectTo', '/purchasing')

    await signInWithNik(formData)

    expect(getUserByIdMock).toHaveBeenCalledWith('user-shared')
    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: 'shared.staff@example.com',
      password: 'secret123',
    })
    expect(cookieStore.set).toHaveBeenCalledWith(
      'nizam_active_org_id',
      'org-b',
      expect.objectContaining({
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
      })
    )
    expect(cookieStore.delete).toHaveBeenCalledWith('nizam_demo_org_id')
    expect(cookieStore.delete).toHaveBeenCalledWith('nizam_active_branch_id')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/', 'layout')
    expect(mocks.redirect).toHaveBeenCalledWith('/purchasing')
  })

  it('restores the persisted active org for NIK login when browser cookies are empty', async () => {
    const cookieStore = createCookieStore()
    const signInWithPasswordMock = vi.fn().mockResolvedValue({ error: null })

    mocks.cookies.mockResolvedValue(cookieStore)
    mocks.createClient.mockResolvedValue({
      auth: {
        signInWithPassword: signInWithPasswordMock,
      },
    })

    const employeesQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          { id: 'emp-a', org_id: 'org-a', user_id: 'user-shared', created_at: '2025-01-01T00:00:00Z' },
          { id: 'emp-b', org_id: 'org-b', user_id: 'user-shared', created_at: '2025-02-01T00:00:00Z' },
        ],
        error: null,
      }),
    }

    const preferredOrgQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          org_id: 'org-b',
          last_active_at: '2026-04-04T10:00:00.000Z',
          joined_at: '2025-02-01T00:00:00Z',
        },
        error: null,
      }),
    }

    const getUserByIdMock = vi.fn().mockResolvedValue({
      data: {
        user: {
          id: 'user-shared',
          email: 'shared.staff@example.com',
        },
      },
      error: null,
    })

    mocks.createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'employees') return employeesQuery
        if (table === 'org_members') return preferredOrgQuery
        throw new Error(`Unexpected table ${table}`)
      }),
      auth: {
        admin: {
          getUserById: getUserByIdMock,
        },
      },
    })

    const formData = new FormData()
    formData.set('nik', 'K-0001')
    formData.set('password', 'secret123')

    await signInWithNik(formData)

    expect(preferredOrgQuery.in).toHaveBeenCalledWith('org_id', ['org-a', 'org-b'])
    expect(cookieStore.set).toHaveBeenCalledWith(
      'nizam_active_org_id',
      'org-b',
      expect.objectContaining({
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
      })
    )
    expect(mocks.redirect).toHaveBeenCalledWith('/dashboard')
  })

  it('marks every employee row tied to the same auth user when requesting password reset', async () => {
    const listQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          { id: 'emp-a', first_name: 'Rina', user_id: 'user-shared' },
          { id: 'emp-b', first_name: 'Rina', user_id: 'user-shared' },
        ],
        error: null,
      }),
    }

    const updateQuery = {
      update: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    }

    mocks.createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table !== 'employees') throw new Error(`Unexpected table ${table}`)
        return {
          ...listQuery,
          update: updateQuery.update,
          in: updateQuery.in,
        }
      }),
    })

    const result = await requestPasswordReset('K-0001')

    expect(updateQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        reset_requested: true,
      })
    )
    expect(updateQuery.in).toHaveBeenCalledWith('id', ['emp-a', 'emp-b'])
    expect(result).toEqual({ success: true, name: 'Rina' })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/hris')
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
      nizam_active_branch_id: 'admin-branch-1',
    })
    const verifyOtpMock = vi.fn().mockResolvedValue({ error: null })

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
        verifyOtp: verifyOtpMock,
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

    expect(verifyOtpMock).toHaveBeenCalledWith({
      type: 'magiclink',
      token_hash: 'tenant-token-hash',
    })

    expect(cookieStore.set).toHaveBeenCalledWith(
      'nizam_admin_impersonation',
      expect.any(String),
      expect.objectContaining({
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
      })
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
      expect.objectContaining({
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
      })
    )
    expect(cookieStore.delete).toHaveBeenCalledWith('nizam_demo_org_id')
    expect(cookieStore.delete).toHaveBeenCalledWith('nizam_active_branch_id')
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
      nizam_active_branch_id: 'tenant-branch-1',
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
    expect(cookieStore.delete).toHaveBeenCalledWith('nizam_active_branch_id')
    expect(cookieStore.set).toHaveBeenCalledWith(
      'nizam_active_org_id',
      'admin-org-1',
      expect.objectContaining({
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
      })
    )
    expect(cookieStore.delete).toHaveBeenCalledWith('nizam_admin_impersonation')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/', 'layout')
    expect(mocks.redirect).toHaveBeenCalledWith('/admin')
  })
})
