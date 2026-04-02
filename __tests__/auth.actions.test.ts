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

import { getSession, signInAsTenantOwner, signOut, signUp } from '@/modules/auth/actions/auth.actions'

describe('Auth Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.cookies.mockResolvedValue({
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    })
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
    const cookieStore = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    }

    mocks.cookies.mockResolvedValue(cookieStore)
    mocks.createClient.mockResolvedValue({
      auth: {
        signOut: signOutMock,
      },
    })

    await signOut()

    expect(signOutMock).toHaveBeenCalledOnce()
    expect(cookieStore.delete).toHaveBeenCalledWith('nizam_active_org_id')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/', 'layout')
    expect(mocks.redirect).toHaveBeenCalledWith('/login')
  })

  it('rejects login-as requests from non-platform admins', async () => {
    const getUserMock = vi.fn().mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'owner@example.com',
        },
      },
      error: null,
    })

    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: getUserMock,
      },
    })
    mocks.createAdminClient.mockResolvedValue({})

    const result = await signInAsTenantOwner('org-1')

    expect(result).toEqual({
      error: 'Akses ditolak. Fitur ini hanya untuk platform admin.'
    })
  })

  it('generates a tenant owner session and redirects to dashboard', async () => {
    const verifyOtpMock = vi.fn().mockResolvedValue({ error: null })
    const cookieStore = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    }

    mocks.cookies.mockResolvedValue(cookieStore)
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: 'admin-1',
              email: 'bob@executive.id',
            },
          },
          error: null,
        }),
        verifyOtp: verifyOtpMock,
      },
    })

    mocks.createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'organizations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: 'org-1',
                    name: 'Tenant Demo',
                    owner_email: 'tenant@example.com',
                  },
                  error: null,
                }),
              }),
            }),
          }
        }

        if (table === 'org_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      limit: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({
                          data: {
                            user_id: 'owner-user-1',
                          },
                          error: null,
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }
        }

        throw new Error(`Unexpected table: ${table}`)
      }),
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: {
              user: {
                id: 'owner-user-1',
                email: 'tenant@example.com',
              },
            },
            error: null,
          }),
          generateLink: vi.fn().mockResolvedValue({
            data: {
              properties: {
                hashed_token: 'hashed-token-1',
              },
            },
            error: null,
          }),
        },
      },
    })

    await signInAsTenantOwner('org-1')

    expect(verifyOtpMock).toHaveBeenCalledWith({
      type: 'magiclink',
      token_hash: 'hashed-token-1',
    })
    expect(cookieStore.set).toHaveBeenCalledWith('nizam_active_org_id', 'org-1', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/', 'layout')
    expect(mocks.redirect).toHaveBeenCalledWith('/dashboard')
  })
})
