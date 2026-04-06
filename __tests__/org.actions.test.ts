import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getAuthUser: vi.fn(),
  getMembership: vi.fn(),
  cookies: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((path: string) => path),
  seedDemoOrganization: vi.fn(),
  applyVoucher: vi.fn(),
  getBranchAccessScope: vi.fn(),
  getCurrentAccessibleBranch: vi.fn(),
  canAccessAllBranchesForOrg: vi.fn(),
  persistMembershipActiveContext: vi.fn(),
  resolveActiveMembership: vi.fn(),
  uploadOrganizationLogoAsset: vi.fn(),
  prisma: {
    $queryRaw: vi.fn(),
    organizations: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    org_members: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    branches: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    saas_packages: {
      findFirst: vi.fn(),
    },
    employees: {
      findFirst: vi.fn(),
    },
    org_invitations: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn(),
    },
    roles: {
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/auth/permissions', () => ({ getAuthUser: mocks.getAuthUser, getMembership: mocks.getMembership }))
vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }))
vi.mock('next/headers', () => ({ cookies: mocks.cookies }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('@/modules/demo/actions/demo.actions', () => ({ seedDemoOrganization: mocks.seedDemoOrganization }))
vi.mock('@/modules/organization/actions/billing.actions', () => ({ applyVoucher: mocks.applyVoucher }))
vi.mock('@/modules/organization/lib/branch-access.server', () => ({
  getBranchAccessScope: mocks.getBranchAccessScope,
  getCurrentAccessibleBranch: mocks.getCurrentAccessibleBranch,
  canAccessAllBranchesForOrg: mocks.canAccessAllBranchesForOrg,
}))
vi.mock('@/modules/organization/lib/active-context.server', () => ({
  persistMembershipActiveContext: mocks.persistMembershipActiveContext,
  resolveActiveMembership: mocks.resolveActiveMembership,
}))
vi.mock('@/modules/organization/lib/logo-storage.server', () => ({ uploadOrganizationLogoAsset: mocks.uploadOrganizationLogoAsset }))

import {
  createBranch,
  createOrganizationQuick,
  removeOrgMember,
  setActiveOrg,
  updateOrgMemberRole,
} from '@/modules/organization/actions/org.actions'
import { getActiveOrgIdAction } from '@/modules/organization/actions/org-id.actions'

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

describe('Organization Actions (Prisma)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: 'user-1', email: 'owner@example.com', name: 'Owner' } })
    mocks.getAuthUser.mockResolvedValue({ userId: 'user-1', email: 'owner@example.com', name: 'Owner' })
    mocks.getMembership.mockResolvedValue({
      memberId: 'member-1',
      userId: 'user-1',
      orgId: 'org-1',
      role: 'owner',
      roleId: null,
      permissions: [],
      isOwner: true,
      isAdmin: false,
      isOwnerOrAdmin: true,
    })
    mocks.cookies.mockResolvedValue(createCookieStore())
    mocks.persistMembershipActiveContext.mockResolvedValue({ success: true })
    mocks.resolveActiveMembership.mockResolvedValue(null)
    mocks.getBranchAccessScope.mockResolvedValue({
      membershipId: 'member-1',
      role: 'owner',
      accessibleBranches: [],
      accessibleBranchIds: [],
      canAccessAllBranches: true,
      hasPersistedSelection: false,
      storedBranchId: null,
    })
    mocks.prisma.organizations.findMany.mockResolvedValue([])
    mocks.prisma.organizations.count.mockResolvedValue(0)
    mocks.prisma.branches.count.mockResolvedValue(0)
    mocks.prisma.org_members.count.mockResolvedValue(0)
    mocks.prisma.saas_packages.findFirst.mockResolvedValue(null)
    mocks.prisma.$queryRaw.mockResolvedValue([])
  })

  it('creates organization quickly with default branch and active context', async () => {
    mocks.prisma.organizations.create.mockResolvedValue({ id: 'org-2' })
    mocks.prisma.org_members.create.mockResolvedValue({ id: 'member-2' })
    mocks.prisma.branches.create.mockResolvedValue({ id: 'branch-2' })

    const randomUuidMock = vi.spyOn(globalThis.crypto, 'randomUUID')
    randomUuidMock.mockReturnValueOnce('org-2').mockReturnValueOnce('branch-2')

    const formData = new FormData()
    formData.set('name', 'PT Header Baru')

    const result = await createOrganizationQuick(formData)

    expect(result).toEqual({ success: true, orgId: 'org-2', branchId: 'branch-2' })
    expect(mocks.prisma.organizations.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ id: 'org-2', name: 'PT Header Baru' }) }))
    expect(mocks.prisma.org_members.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ org_id: 'org-2', user_id: 'user-1', role: 'owner' }) }))
    expect(mocks.prisma.branches.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ id: 'branch-2', org_id: 'org-2', code: 'MAIN' }) }))
    expect(mocks.persistMembershipActiveContext).toHaveBeenCalledWith({ userId: 'user-1', orgId: 'org-2', branchId: 'branch-2' })

    randomUuidMock.mockRestore()
  })

  it('persists active org with resolved branch when switching org', async () => {
    const cookieStore = createCookieStore()
    mocks.cookies.mockResolvedValue(cookieStore)
    mocks.prisma.org_members.findFirst.mockResolvedValue({ org_id: 'org-2' })
    mocks.getBranchAccessScope.mockResolvedValue({
      membershipId: 'member-2',
      role: 'owner',
      accessibleBranches: [{ id: 'branch-2', org_id: 'org-2', name: 'Unit Bandung', code: 'BDG', address: null, is_active: true }],
      accessibleBranchIds: ['branch-2'],
      canAccessAllBranches: true,
      hasPersistedSelection: false,
      storedBranchId: null,
    })

    const result = await setActiveOrg('org-2')

    expect(result).toEqual({ success: true, orgId: 'org-2', branchId: 'branch-2' })
    expect(cookieStore.set).toHaveBeenCalledWith('nizam_active_org_id', 'org-2', expect.any(Object))
    expect(cookieStore.set).toHaveBeenCalledWith('nizam_active_branch_id', 'branch-2', expect.any(Object))
    expect(mocks.persistMembershipActiveContext).toHaveBeenCalledWith({ userId: 'user-1', orgId: 'org-2', branchId: 'branch-2' })
  })

  it('returns persisted active org from org-id action', async () => {
    const cookieStore = createCookieStore()
    mocks.cookies.mockResolvedValue(cookieStore)
    mocks.resolveActiveMembership.mockResolvedValue({ org_id: 'org-2' })

    const result = await getActiveOrgIdAction()

    expect(result).toBe('org-2')
    expect(mocks.resolveActiveMembership).toHaveBeenCalled()
  })

  it('rejects managers from creating branch', async () => {
    mocks.getMembership.mockResolvedValue({
      memberId: 'member-1',
      userId: 'user-1',
      orgId: 'org-1',
      role: 'manager',
      roleId: null,
      permissions: [],
      isOwner: false,
      isAdmin: false,
      isOwnerOrAdmin: false,
    })

    const formData = new FormData()
    formData.set('name', 'Cabang Surabaya')
    formData.set('code', 'SBY')

    const result = await createBranch('org-1', formData)
    expect(result).toEqual({ error: 'Hanya owner atau admin yang dapat menambahkan unit.' })
  })

  it('prevents demoting the last owner', async () => {
    mocks.prisma.org_members.findFirst.mockResolvedValue({ id: 'member-owner', user_id: 'owner-1', role: 'owner', role_id: null })
    mocks.prisma.org_members.count.mockResolvedValue(1)

    const result = await updateOrgMemberRole('org-1', 'member-owner', 'admin')

    expect(result).toEqual({ error: 'Organisasi harus memiliki minimal satu owner aktif.' })
    expect(mocks.prisma.org_members.update).not.toHaveBeenCalled()
  })

  it('prevents deleting own membership', async () => {
    mocks.prisma.org_members.findFirst.mockResolvedValue({ id: 'member-1', user_id: 'user-1', role: 'admin' })

    const result = await removeOrgMember('org-1', 'member-1')

    expect(result).toEqual({ error: 'Anda tidak dapat menghapus keanggotaan Anda sendiri.' })
    expect(mocks.prisma.org_members.delete).not.toHaveBeenCalled()
  })
})
