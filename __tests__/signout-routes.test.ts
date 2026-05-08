import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: mocks.cookies,
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}))

import { GET } from '@/app/auth/signout/route'
import { POST } from '@/app/api/auth/signout/route'

describe('signout routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('clears the internal session and redirects from GET /auth/signout', async () => {
    const deleteCookie = vi.fn()
    const signOut = vi.fn().mockResolvedValue({ error: null })

    mocks.cookies.mockResolvedValue({ delete: deleteCookie })
    mocks.createClient.mockResolvedValue({
      auth: { signOut },
    })

    const response = await GET()

    expect(signOut).toHaveBeenCalledTimes(1)
    expect(deleteCookie).toHaveBeenCalledWith('nizam_internal_session')
    expect(deleteCookie).toHaveBeenCalledWith('nizam_demo_org_id')
    expect(deleteCookie).toHaveBeenCalledWith('nizam_active_org_id')
    expect(deleteCookie).toHaveBeenCalledWith('nizam_active_branch_id')
    expect(deleteCookie).toHaveBeenCalledWith('nizam_admin_impersonation')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/', 'layout')
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toMatch(/^https:\/\/kliknizam\.app\/?$/)
  })

  it('clears the internal session and returns JSON from POST /api/auth/signout', async () => {
    const deleteCookie = vi.fn()
    const signOut = vi.fn().mockResolvedValue({ error: null })

    mocks.cookies.mockResolvedValue({ delete: deleteCookie })
    mocks.createClient.mockResolvedValue({
      auth: { signOut },
    })

    const response = await POST()

    expect(signOut).toHaveBeenCalledTimes(1)
    expect(deleteCookie).toHaveBeenCalledWith('nizam_internal_session')
    expect(deleteCookie).toHaveBeenCalledWith('nizam_demo_org_id')
    expect(deleteCookie).toHaveBeenCalledWith('nizam_active_org_id')
    expect(deleteCookie).toHaveBeenCalledWith('nizam_active_branch_id')
    expect(deleteCookie).toHaveBeenCalledWith('nizam_admin_impersonation')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/', 'layout')
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
  })
})
