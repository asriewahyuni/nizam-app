import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseMock, success } from './helpers/supabase-mock'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  cookies: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
  createAdminClient: mocks.createAdminClient,
}))

vi.mock('next/headers', () => ({
  cookies: mocks.cookies,
}))

import {
  canAccessAllBranchesForOrg,
  getBranchAccessScope,
  getCurrentAccessibleBranch,
  resolveAccessibleBranchSelection,
} from '@/modules/organization/lib/branch-access.server'

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
  }
}

describe('Branch Access Server Helper', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.cookies.mockResolvedValue(createCookieStore())
  })

  it('limits non-owner members to explicitly assigned branches', async () => {
    const createScopedClient = () => {
      const supabase = createSupabaseMock({
        tables: {
          org_members: [
            {
              maybeSingleResult: success({
                id: 'member-1',
                role: 'staff',
              }),
            },
          ],
          branches: [
            {
              result: success([
                { id: 'branch-1', org_id: 'org-1', name: 'Unit A', code: 'UA', address: null, is_active: true },
                { id: 'branch-2', org_id: 'org-1', name: 'Unit B', code: 'UB', address: null, is_active: true },
              ]),
            },
          ],
          org_member_units: [
            {
              result: success([{ branch_id: 'branch-2' }]),
            },
          ],
        },
      })

      return {
        authed: {
          ...supabase.client,
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: 'user-1' } },
            }),
          },
        },
        admin: supabase.client,
      }
    }

    mocks.createClient.mockImplementation(async () => createScopedClient().authed)
    mocks.createAdminClient.mockImplementation(async () => createScopedClient().admin)

    const scope = await getBranchAccessScope('org-1')
    const currentBranch = await getCurrentAccessibleBranch('org-1')
    const nullSelection = await resolveAccessibleBranchSelection('org-1', null)

    expect(scope.accessibleBranchIds).toEqual(['branch-2'])
    expect(scope.canAccessAllBranches).toBe(false)
    expect(currentBranch?.id).toBe('branch-2')
    expect(nullSelection).toEqual(
      expect.objectContaining({
        error: 'Anda tidak memiliki akses ke semua unit pada organisasi ini.',
      })
    )
  })

  it('keeps owner/admin on all-branch scope when multiple branches exist', async () => {
    const createScopedClient = () => {
      const supabase = createSupabaseMock({
        tables: {
          org_members: [
            {
              maybeSingleResult: success({
                id: 'member-1',
                role: 'owner',
              }),
            },
          ],
          branches: [
            {
              result: success([
                { id: 'branch-1', org_id: 'org-1', name: 'Unit A', code: 'UA', address: null, is_active: true },
                { id: 'branch-2', org_id: 'org-1', name: 'Unit B', code: 'UB', address: null, is_active: true },
              ]),
            },
          ],
        },
      })

      return {
        authed: {
          ...supabase.client,
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: 'owner-1' } },
            }),
          },
        },
        admin: supabase.client,
      }
    }

    mocks.createClient.mockImplementation(async () => createScopedClient().authed)
    mocks.createAdminClient.mockImplementation(async () => createScopedClient().admin)

    const currentBranch = await getCurrentAccessibleBranch('org-1')
    const canAccessAll = await canAccessAllBranchesForOrg('org-1')
    const selection = await resolveAccessibleBranchSelection('org-1')

    expect(currentBranch).toBeNull()
    expect(canAccessAll).toBe(true)
    expect(selection).toEqual(
      expect.objectContaining({
        branchId: null,
      })
    )
  })
})
