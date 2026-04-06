import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    employees: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
  auth: vi.fn(),
  nextAuthSignIn: vi.fn(),
  nextAuthSignOut: vi.fn(),
  cookies: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
  getStoredActiveOrgIdForUser: vi.fn(),
  isPlatformAdminEmail: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}))

vi.mock('@/auth', () => ({
  auth: mocks.auth,
  signIn: mocks.nextAuthSignIn,
  signOut: mocks.nextAuthSignOut,
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

vi.mock('@/modules/organization/lib/active-context.server', () => ({
  getStoredActiveOrgIdForUser: mocks.getStoredActiveOrgIdForUser,
  persistMembershipActiveContext: vi.fn(),
}))

vi.mock('@/lib/saas/platform-admin', () => ({
  isPlatformAdminEmail: mocks.isPlatformAdminEmail,
}))

import {
  getSession,
  requestPasswordReset,
  restorePlatformAdminSession,
  signInAsTenantOwner,
  signInWithNik,
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
    values,
  }
}

describe('Auth Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.cookies.mockResolvedValue(createCookieStore())
  })

  it('maps duplicate sign-up errors to a user-friendly message', async () => {
    mocks.prisma.user.create.mockRejectedValue({ code: 'P2002' })

    const formData = new FormData()
    formData.set('email', 'owner@example.com')
    formData.set('password', 'secret123')
    formData.set('fullName', 'Owner Example')

    const result = await signUp(formData)
    expect(result).toEqual({
      error: 'Gagal: Email ini sudah pernah didaftarkan. Silakan Login atau gunakan email lain.',
    })
  })

  it('marks owner metadata as demo when sign-up plan is demo', async () => {
    const signUpMock = vi.fn().mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })

    mocks.createClient.mockResolvedValue({
      auth: {
        signUp: signUpMock,
      },
    })

    const formData = new FormData()
    formData.set('email', 'demo.owner@example.com')
    formData.set('password', 'secret123')
    formData.set('fullName', 'Demo Owner')
    formData.set('plan', 'demo')

    const result = await signUp(formData)

    expect(signUpMock).toHaveBeenCalledWith({
      email: 'demo.owner@example.com',
      password: 'secret123',
      options: {
        data: {
          full_name: 'Demo Owner',
          login_type: 'owner',
          is_demo: true,
        },
      },
    })
    expect(result).toEqual({
      success: true,
      email: 'demo.owner@example.com',
    })
  })

  it('returns the active user session when available', async () => {
    mocks.auth.mockResolvedValue({
      user: { id: 'user-1', email: 'owner@example.com', name: 'Owner Example' },
    })

    const result = await getSession()
    expect(result).toEqual({
      id: 'user-1',
      email: 'owner@example.com',
      user_metadata: {
        full_name: 'Owner Example',
        login_type: 'owner',
      },
    })
  })

  it('returns null when no authenticated user exists', async () => {
    mocks.auth.mockResolvedValue(null)
    const result = await getSession()
    expect(result).toBeNull()
  })

  it('signs out and clears active context cookies', async () => {
    const cookieStore = createCookieStore({
      nizam_active_org_id: 'org-1',
      nizam_active_branch_id: 'branch-1',
      nizam_admin_impersonation: 'backup-token',
    })
    mocks.cookies.mockResolvedValue(cookieStore)
    mocks.nextAuthSignOut.mockResolvedValue(undefined)

    await signOut()

    expect(cookieStore.delete).toHaveBeenCalledWith('nizam_active_org_id')
    expect(cookieStore.delete).toHaveBeenCalledWith('nizam_active_branch_id')
    expect(cookieStore.delete).toHaveBeenCalledWith('nizam_admin_impersonation')
    expect(mocks.nextAuthSignOut).toHaveBeenCalledWith({ redirectTo: '/login' })
  })

  it('signs in employee by NIK and keeps active org preference', async () => {
    const cookieStore = createCookieStore({
      nizam_active_org_id: 'org-b',
      nizam_active_branch_id: 'branch-old',
    })
    mocks.cookies.mockResolvedValue(cookieStore)
    mocks.prisma.employees.findMany.mockResolvedValue([
      { id: 'emp-a', org_id: 'org-a', user_id: 'user-shared', created_at: new Date('2025-01-01T00:00:00Z') },
      { id: 'emp-b', org_id: 'org-b', user_id: 'user-shared', created_at: new Date('2025-02-01T00:00:00Z') },
    ])
    mocks.prisma.user.findUnique.mockResolvedValue({ email: 'shared.staff@example.com' })
    mocks.nextAuthSignIn.mockResolvedValue(undefined)

    const formData = new FormData()
    formData.set('nik', 'K-0001')
    formData.set('password', 'secret123')
    formData.set('redirectTo', '/purchasing')

    await signInWithNik(formData)

    expect(mocks.nextAuthSignIn).toHaveBeenCalledWith('credentials', {
      email: 'shared.staff@example.com',
      password: 'secret123',
      redirect: false,
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
    expect(cookieStore.delete).toHaveBeenCalledWith('nizam_active_branch_id')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/', 'layout')
    expect(mocks.redirect).toHaveBeenCalledWith('/purchasing')
  })

  it('restores preferred org for NIK login when browser cookies are empty', async () => {
    const cookieStore = createCookieStore()
    mocks.cookies.mockResolvedValue(cookieStore)
    mocks.prisma.employees.findMany.mockResolvedValue([
      { id: 'emp-a', org_id: 'org-a', user_id: 'user-shared', created_at: new Date('2025-01-01T00:00:00Z') },
      { id: 'emp-b', org_id: 'org-b', user_id: 'user-shared', created_at: new Date('2025-02-01T00:00:00Z') },
    ])
    mocks.prisma.user.findUnique.mockResolvedValue({ email: 'shared.staff@example.com' })
    mocks.getStoredActiveOrgIdForUser.mockResolvedValue('org-b')
    mocks.nextAuthSignIn.mockResolvedValue(undefined)

    const formData = new FormData()
    formData.set('nik', 'K-0001')
    formData.set('password', 'secret123')

    await signInWithNik(formData)

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

  it('rejects sign in as tenant when current user is not a platform admin', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'admin-1', email: 'notadmin@example.com' } })
    mocks.isPlatformAdminEmail.mockReturnValue(false)

    const result = await signInAsTenantOwner('org-1')
    expect(result).toEqual({
      error: 'Akses ditolak. Hanya platform admin yang bisa login sebagai tenant.',
    })
  })

  it('marks reset requested for matching NIK', async () => {
    mocks.prisma.employees.findMany.mockResolvedValue([
      { id: 'emp-a', first_name: 'Rina', user_id: 'user-shared' },
      { id: 'emp-b', first_name: 'Rina', user_id: 'user-shared' },
    ])
    mocks.prisma.employees.updateMany.mockResolvedValue({ count: 2 })

    const result = await requestPasswordReset('K-0001')

    expect(mocks.prisma.employees.updateMany).toHaveBeenCalled()
    expect(result).toEqual({ success: true, name: 'Rina' })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/hris')
  })

  it('restores backed up admin session and redirects back to admin', async () => {
    const payload = Buffer.from(
      JSON.stringify({
        accessToken: 'admin-1',
        refreshToken: '',
        email: 'admin@example.com',
        activeOrgId: 'org-1',
      }),
      'utf8'
    ).toString('base64url')

    const cookieStore = createCookieStore({
      nizam_admin_impersonation: payload,
      nizam_active_org_id: 'tenant-org-1',
      nizam_active_branch_id: 'tenant-branch-1',
    })

    mocks.cookies.mockResolvedValue(cookieStore)
    mocks.nextAuthSignIn.mockResolvedValue(undefined)

    await restorePlatformAdminSession()

    expect(cookieStore.delete).toHaveBeenCalledWith('nizam_active_branch_id')
    expect(cookieStore.delete).toHaveBeenCalledWith('nizam_admin_impersonation')
    expect(mocks.redirect).toHaveBeenCalledWith('/admin')
  })
})
