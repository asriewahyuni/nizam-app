import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
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

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}))

import { getSession, signOut, signUp } from '@/modules/auth/actions/auth.actions'

describe('Auth Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    mocks.createClient.mockResolvedValue({
      auth: {
        signOut: signOutMock,
      },
    })

    await signOut()

    expect(signOutMock).toHaveBeenCalledOnce()
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/', 'layout')
    expect(mocks.redirect).toHaveBeenCalledWith('/login')
  })
})
