import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    org_members: {
      findFirst: vi.fn(),
    },
    branches: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    org_member_units: {
      findMany: vi.fn(),
    },
  },
  auth: vi.fn(),
  cookies: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}))

vi.mock('@/auth', () => ({
  auth: mocks.auth,
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
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.prisma.org_members.findFirst.mockResolvedValue({
      id: 'member-1',
      role: 'staff',
      last_active_at: null,
      last_active_branch_id: null,
    })
    mocks.prisma.branches.findMany.mockResolvedValue([
      { id: 'branch-1', org_id: 'org-1', name: 'Unit A', code: 'UA', address: null, is_active: true },
      { id: 'branch-2', org_id: 'org-1', name: 'Unit B', code: 'UB', address: null, is_active: true },
    ])
    mocks.prisma.org_member_units.findMany.mockResolvedValue([{ branch_id: 'branch-2' }])

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
    mocks.auth.mockResolvedValue({ user: { id: 'owner-1' } })
    mocks.prisma.org_members.findFirst.mockResolvedValue({
      id: 'member-1',
      role: 'owner',
      last_active_at: null,
      last_active_branch_id: null,
    })
    mocks.prisma.branches.findMany.mockResolvedValue([
      { id: 'branch-1', org_id: 'org-1', name: 'Unit A', code: 'UA', address: null, is_active: true },
      { id: 'branch-2', org_id: 'org-1', name: 'Unit B', code: 'UB', address: null, is_active: true },
    ])

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

  it('reuses the persisted branch preference when the user last opened a specific unit', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'owner-1' } })
    mocks.prisma.org_members.findFirst.mockResolvedValue({
      id: 'member-1',
      role: 'owner',
      last_active_at: new Date('2026-04-04T10:00:00.000Z'),
      last_active_branch_id: 'branch-2',
    })
    mocks.prisma.branches.findMany.mockResolvedValue([
      { id: 'branch-1', org_id: 'org-1', name: 'Unit A', code: 'UA', address: null, is_active: true },
      { id: 'branch-2', org_id: 'org-1', name: 'Unit B', code: 'UB', address: null, is_active: true },
    ])

    const currentBranch = await getCurrentAccessibleBranch('org-1')
    const selection = await resolveAccessibleBranchSelection('org-1')

    expect(currentBranch?.id).toBe('branch-2')
    expect(selection).toEqual(
      expect.objectContaining({
        branchId: 'branch-2',
      })
    )
  })

  it('defaults owner/admin writes to the sole accessible branch when only one branch exists', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'owner-1' } })
    mocks.prisma.org_members.findFirst.mockResolvedValue({
      id: 'member-1',
      role: 'owner',
      last_active_at: null,
      last_active_branch_id: null,
    })
    mocks.prisma.branches.findMany.mockResolvedValue([
      { id: 'branch-1', org_id: 'org-1', name: 'Unit Utama', code: 'MAIN', address: null, is_active: true },
    ])

    const currentBranch = await getCurrentAccessibleBranch('org-1')
    const selection = await resolveAccessibleBranchSelection('org-1')

    expect(currentBranch?.id).toBe('branch-1')
    expect(selection).toEqual(
      expect.objectContaining({
        branchId: 'branch-1',
      })
    )
  })

  it('self-heals legacy owner orgs by creating the default branch when no active branch exists', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'owner-1' } })
    mocks.prisma.org_members.findFirst.mockResolvedValue({
      id: 'member-1',
      role: 'owner',
      last_active_at: null,
      last_active_branch_id: null,
    })
    mocks.prisma.branches.findMany.mockResolvedValue([])
    mocks.prisma.branches.findFirst.mockResolvedValue(null)
    mocks.prisma.branches.create.mockResolvedValue({
      id: 'branch-1',
      org_id: 'org-1',
      name: 'Unit Utama',
      code: 'MAIN',
      address: null,
      is_active: true,
    })

    const scope = await getBranchAccessScope('org-1')

    expect(scope.accessibleBranchIds).toEqual(['branch-1'])
    expect(scope.canAccessAllBranches).toBe(true)
    expect(mocks.prisma.branches.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          org_id: 'org-1',
          name: 'Unit Utama',
          code: 'MAIN',
          is_active: true,
        }),
      })
    )
  })
})
