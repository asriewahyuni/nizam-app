import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  cookies: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
  seedDemoData: vi.fn(),
  applyVoucher: vi.fn(),
  getCurrentAccessibleBranch: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}))

vi.mock('next/headers', () => ({
  cookies: mocks.cookies,
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}))

vi.mock('@/modules/demo/actions/demo.actions', () => ({
  seedDemoData: mocks.seedDemoData,
}))

vi.mock('@/modules/organization/actions/billing.actions', () => ({
  applyVoucher: mocks.applyVoucher,
}))

vi.mock('@/modules/organization/lib/branch-access.server', () => ({
  getBranchAccessScope: vi.fn(),
  getCurrentAccessibleBranch: mocks.getCurrentAccessibleBranch,
  canAccessAllBranchesForOrg: vi.fn(),
}))

import { createOrganization, getActiveBranch } from '@/modules/organization/actions/org.actions'
import { getActiveBranchIdAction } from '@/modules/organization/actions/org-id.actions'

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

describe('Organization Branch Bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.cookies.mockResolvedValue(createCookieStore())
  })

  it('falls back to the sole active branch when no branch cookie is set', async () => {
    mocks.getCurrentAccessibleBranch.mockResolvedValue({
      id: 'branch-1',
      org_id: 'org-1',
      name: 'Unit Utama',
      code: 'MAIN',
      address: null,
      is_active: true,
    })

    const result = await getActiveBranch('org-1')

    expect(result).toEqual({
      id: 'branch-1',
      org_id: 'org-1',
      name: 'Unit Utama',
      code: 'MAIN',
      address: null,
      is_active: true,
    })
  })

  it('returns the sole active branch id when no branch cookie is set', async () => {
    mocks.getCurrentAccessibleBranch.mockResolvedValue({
      id: 'branch-1',
      org_id: 'org-1',
      name: 'Unit Utama',
      code: 'MAIN',
      address: null,
      is_active: true,
    })

    const result = await getActiveBranchIdAction('org-1')

    expect(result).toBe('branch-1')
  })

  it('creates a default branch when creating a new organization', async () => {
    const cookieStore = createCookieStore()
    mocks.cookies.mockResolvedValue(cookieStore)

    const orgInsert = vi.fn().mockResolvedValue({ error: null })
    const memberInsert = vi.fn().mockResolvedValue({ error: null })
    const branchInsert = vi.fn().mockResolvedValue({ error: null })

    const randomUuidMock = vi.spyOn(globalThis.crypto, 'randomUUID')
    randomUuidMock
      .mockReturnValueOnce('org-1')
      .mockReturnValueOnce('branch-1')

    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'owner@example.com' } },
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'organizations') return { insert: orgInsert, delete: vi.fn(() => ({ eq: vi.fn() })) }
        if (table === 'org_members') return { insert: memberInsert }
        if (table === 'branches') return { insert: branchInsert }
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const formData = new FormData()
    formData.set('name', 'PT Contoh Jaya')

    await createOrganization(formData)

    expect(orgInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'org-1',
        name: 'PT Contoh Jaya',
      })
    )
    expect(branchInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'branch-1',
        org_id: 'org-1',
        name: 'Unit Utama',
        code: 'MAIN',
        is_active: true,
      })
    )
    expect(cookieStore.set).toHaveBeenCalledWith(
      'nizam_active_org_id',
      'org-1',
      expect.objectContaining({
        path: '/',
        httpOnly: true,
      })
    )
    expect(cookieStore.set).toHaveBeenCalledWith(
      'nizam_active_branch_id',
      'branch-1',
      expect.objectContaining({
        path: '/',
        httpOnly: true,
      })
    )
    expect(mocks.redirect).toHaveBeenCalledWith('/dashboard')

    randomUuidMock.mockRestore()
  })
})
