import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
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
    $transaction: vi.fn(),
    organizations: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    org_members: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    branches: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    saas_packages: {
      findFirst: vi.fn(),
    },
    employees: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
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

vi.mock('@/auth', () => ({
  auth: mocks.auth,
}))

vi.mock('@/lib/auth/permissions', () => ({
  getMembership: mocks.getMembership,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
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
  seedDemoOrganization: mocks.seedDemoOrganization,
}))

vi.mock('@/modules/organization/actions/billing.actions', () => ({
  applyVoucher: mocks.applyVoucher,
}))

vi.mock('@/modules/organization/lib/branch-access.server', () => ({
  getBranchAccessScope: mocks.getBranchAccessScope,
  getCurrentAccessibleBranch: mocks.getCurrentAccessibleBranch,
  canAccessAllBranchesForOrg: mocks.canAccessAllBranchesForOrg,
}))

vi.mock('@/modules/organization/lib/active-context.server', () => ({
  persistMembershipActiveContext: mocks.persistMembershipActiveContext,
  resolveActiveMembership: mocks.resolveActiveMembership,
}))

vi.mock('@/modules/organization/lib/logo-storage.server', () => ({
  uploadOrganizationLogoAsset: mocks.uploadOrganizationLogoAsset,
}))

import {
  createBranch,
  createOrganization,
  createOrganizationQuick,
  getActiveBranch,
  removeOrgMember,
  setActiveBranch,
  setActiveOrg,
  updateOrgMemberRole,
} from '@/modules/organization/actions/org.actions'
import {
  getActiveBranchIdAction,
  getActiveOrgIdAction,
} from '@/modules/organization/actions/org-id.actions'

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

function makeMembership(overrides: Record<string, unknown> = {}) {
  return {
    memberId: 'member-1',
    userId: 'user-1',
    orgId: 'org-1',
    role: 'owner',
    roleId: null,
    permissions: [],
    isOwner: true,
    isAdmin: false,
    isOwnerOrAdmin: true,
    ...overrides,
  }
}

describe('Organization Branch Bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.cookies.mockResolvedValue(createCookieStore())
    mocks.auth.mockResolvedValue({
      user: { id: 'user-1', email: 'owner@example.com', name: 'Owner' },
    })
    mocks.getMembership.mockResolvedValue(makeMembership())
    mocks.persistMembershipActiveContext.mockResolvedValue({ success: true })
    mocks.resolveActiveMembership.mockResolvedValue(null)
    mocks.getCurrentAccessibleBranch.mockResolvedValue(null)
    mocks.getBranchAccessScope.mockResolvedValue({
      membershipId: 'member-1',
      role: 'owner',
      accessibleBranches: [],
      accessibleBranchIds: [],
      canAccessAllBranches: true,
      hasPersistedSelection: false,
      storedBranchId: null,
    })
    mocks.prisma.$transaction.mockReset()
    mocks.prisma.org_members.findFirst.mockReset()
    mocks.prisma.org_members.update.mockReset()
    mocks.prisma.org_members.delete.mockReset()
    mocks.prisma.org_members.count.mockReset()
    mocks.prisma.branches.findFirst.mockReset()
    mocks.prisma.branches.create.mockReset()
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

    const orgCreate = vi.fn().mockResolvedValue({})
    const memberCreate = vi.fn().mockResolvedValue({})
    const branchCreate = vi.fn().mockResolvedValue({})

    mocks.prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        organizations: { create: orgCreate },
        org_members: { create: memberCreate },
        branches: { create: branchCreate },
      })
    )

    const randomUuidMock = vi.spyOn(globalThis.crypto, 'randomUUID')
    randomUuidMock
      .mockReturnValueOnce('org-1')
      .mockReturnValueOnce('branch-1')

    const formData = new FormData()
    formData.set('name', 'PT Contoh Jaya')

    await createOrganization(formData)

    expect(orgCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: 'org-1',
          name: 'PT Contoh Jaya',
        }),
      })
    )
    expect(memberCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'org-1',
        name: 'PT Contoh Jaya',
        is_demo: false,
        settings: expect.objectContaining({
          plan: 'Trial',
          is_demo: false,
        }),
      })
    )
    expect(branchCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: 'branch-1',
          org_id: 'org-1',
          name: 'Unit Utama',
          code: 'MAIN',
          is_active: true,
        }),
      })
    )
    expect(mocks.persistMembershipActiveContext).toHaveBeenCalledWith({
      userId: 'user-1',
      orgId: 'org-1',
      branchId: 'branch-1',
    })
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

  it('marks organization as demo when onboarding comes from demo flow', async () => {
    const cookieStore = createCookieStore()
    mocks.cookies.mockResolvedValue(cookieStore)

    const orgInsert = vi.fn().mockResolvedValue({ error: null })
    const memberInsert = vi.fn().mockResolvedValue({ error: null })
    const branchInsert = vi.fn().mockResolvedValue({ error: null })
    const memberUpdateBuilder = {
      update: vi.fn(() => memberUpdateBuilder),
      eq: vi.fn(() => memberUpdateBuilder),
    }

    const randomUuidMock = vi.spyOn(globalThis.crypto, 'randomUUID')
    randomUuidMock
      .mockReturnValueOnce('org-demo-1')
      .mockReturnValueOnce('branch-demo-1')

    const sessionClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'owner@example.com' } },
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'organizations') return { insert: orgInsert }
        throw new Error(`Unexpected table ${table}`)
      }),
    }

    mocks.createClient.mockResolvedValue(sessionClient)
    mocks.createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'org_members') {
          return {
            insert: memberInsert,
            update: memberUpdateBuilder.update,
            eq: memberUpdateBuilder.eq,
          }
        }
        if (table === 'branches') return { insert: branchInsert }
        if (table === 'organizations') return { delete: vi.fn(() => ({ eq: vi.fn() })) }
        throw new Error(`Unexpected admin table ${table}`)
      }),
    })

    const formData = new FormData()
    formData.set('name', 'PT Demo Flow')
    formData.set('plan', 'demo')
    formData.set('type', 'CATERING')

    await createOrganization(formData)

    expect(orgInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'org-demo-1',
        name: 'PT Demo Flow',
        is_demo: true,
        settings: expect.objectContaining({
          plan: 'Demo',
          is_demo: true,
          business_type: 'CATERING',
        }),
      })
    )
    expect(mocks.seedDemoData).toHaveBeenCalledWith(sessionClient, 'org-demo-1', 'CATERING')
    expect(mocks.redirect).toHaveBeenCalledWith('/dashboard')
    randomUuidMock.mockRestore()
  })

  it('creates a new organization without redirect for quick switching from header', async () => {
    const cookieStore = createCookieStore()
    mocks.cookies.mockResolvedValue(cookieStore)

    mocks.prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        organizations: { create: vi.fn().mockResolvedValue({}) },
        org_members: { create: vi.fn().mockResolvedValue({}) },
        branches: { create: vi.fn().mockResolvedValue({}) },
      })
    )

    const randomUuidMock = vi.spyOn(globalThis.crypto, 'randomUUID')
    randomUuidMock
      .mockReturnValueOnce('org-2')
      .mockReturnValueOnce('branch-2')

    const formData = new FormData()
    formData.set('name', 'PT Header Baru')

    const result = await createOrganizationQuick(formData)

    expect(result).toEqual({
      success: true,
      orgId: 'org-2',
      branchId: 'branch-2',
    })
    expect(cookieStore.set).toHaveBeenCalledWith(
      'nizam_active_org_id',
      'org-2',
      expect.objectContaining({
        path: '/',
        httpOnly: true,
      })
    )
    expect(cookieStore.set).toHaveBeenCalledWith(
      'nizam_active_branch_id',
      'branch-2',
      expect.objectContaining({
        path: '/',
        httpOnly: true,
      })
    )
    expect(mocks.redirect).not.toHaveBeenCalled()

    randomUuidMock.mockRestore()
  })

  it('reuses existing MAIN branch when branch bootstrap already created it', async () => {
    const cookieStore = createCookieStore()
    mocks.cookies.mockResolvedValue(cookieStore)

    const orgInsert = vi.fn().mockResolvedValue({ error: null })
    const memberInsert = vi.fn().mockResolvedValue({ error: null })
    const branchInsert = vi.fn().mockResolvedValue({
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    })
    const branchReadBuilder = {
      select: vi.fn(() => branchReadBuilder),
      eq: vi.fn(() => branchReadBuilder),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'existing-main-branch' },
        error: null,
      }),
    }
    const memberUpdateBuilder = {
      update: vi.fn(() => memberUpdateBuilder),
      eq: vi.fn(() => memberUpdateBuilder),
    }

    const randomUuidMock = vi.spyOn(globalThis.crypto, 'randomUUID')
    randomUuidMock
      .mockReturnValueOnce('org-4')
      .mockReturnValueOnce('branch-4')

    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'owner@example.com' } },
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'organizations') return { insert: orgInsert }
        if (table === 'branches') return branchReadBuilder
        throw new Error(`Unexpected table ${table}`)
      }),
      rpc: vi.fn().mockResolvedValue({ error: null }),
    })
    mocks.createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'org_members') {
          return {
            insert: memberInsert,
            update: memberUpdateBuilder.update,
            eq: memberUpdateBuilder.eq,
          }
        }
        if (table === 'branches') {
          return {
            insert: branchInsert,
            select: branchReadBuilder.select,
            eq: branchReadBuilder.eq,
            maybeSingle: branchReadBuilder.maybeSingle,
          }
        }
        if (table === 'organizations') return { delete: vi.fn(() => ({ eq: vi.fn() })) }
        if (table === 'accounts') return { select: vi.fn(() => ({ eq: vi.fn(() => ({ limit: vi.fn().mockResolvedValue({ data: [] }) })) })) }
        throw new Error(`Unexpected admin table ${table}`)
      }),
      rpc: vi.fn().mockResolvedValue({ error: null }),
    })

    const formData = new FormData()
    formData.set('name', 'PT Branch Sudah Ada')

    await createOrganization(formData)

    expect(branchInsert).toHaveBeenCalled()
    expect(cookieStore.set).toHaveBeenCalledWith(
      'nizam_active_branch_id',
      'existing-main-branch',
      expect.objectContaining({
        path: '/',
        httpOnly: true,
      })
    )
    expect(memberUpdateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        last_active_branch_id: 'existing-main-branch',
      })
    )
    expect(mocks.redirect).toHaveBeenCalledWith('/dashboard')
    randomUuidMock.mockRestore()
  })

  it('falls back to session client when admin client is unavailable', async () => {
    const cookieStore = createCookieStore()
    mocks.cookies.mockResolvedValue(cookieStore)

    const orgInsert = vi.fn().mockResolvedValue({ error: null })
    const memberInsert = vi.fn().mockResolvedValue({ error: null })
    const branchInsert = vi.fn().mockResolvedValue({ error: null })
    const orgMemberUpdateBuilder = {
      update: vi.fn(() => orgMemberUpdateBuilder),
      eq: vi.fn(() => orgMemberUpdateBuilder),
    }

    const randomUuidMock = vi.spyOn(globalThis.crypto, 'randomUUID')
    randomUuidMock
      .mockReturnValueOnce('org-3')
      .mockReturnValueOnce('branch-3')

    mocks.createAdminClient.mockRejectedValue(new Error('Missing SUPABASE_SERVICE_ROLE_KEY'))
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'owner@example.com' } },
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'organizations') return { insert: orgInsert }
        if (table === 'org_members') {
          return {
            insert: memberInsert,
            update: orgMemberUpdateBuilder.update,
            eq: orgMemberUpdateBuilder.eq,
          }
        }
        if (table === 'branches') return { insert: branchInsert }
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const formData = new FormData()
    formData.set('name', 'PT Fallback Session')

    await createOrganization(formData)

    expect(orgInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'org-3',
        name: 'PT Fallback Session',
      })
    )
    expect(memberInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-3',
        user_id: 'user-1',
        role: 'owner',
      })
    )
    expect(branchInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'branch-3',
        org_id: 'org-3',
        name: 'Unit Utama',
        code: 'MAIN',
      })
    )
    expect(mocks.redirect).toHaveBeenCalledWith('/dashboard')
    randomUuidMock.mockRestore()
  })

  it('returns migration hint when organization trigger references a missing table', async () => {
    const cookieStore = createCookieStore()
    mocks.cookies.mockResolvedValue(cookieStore)

    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'owner@example.com' } },
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'organizations') {
          return {
            insert: vi.fn().mockResolvedValue({
              error: {
                code: '42P01',
                message: 'relation "accounts" does not exist',
              },
            }),
          }
        }
        throw new Error(`Unexpected table ${table}`)
      }),
    })
    mocks.createAdminClient.mockResolvedValue({
      from: vi.fn(),
    })

    const formData = new FormData()
    formData.set('name', 'PT Migrasi Belum Lengkap')

    const result = await createOrganization(formData)

    expect(result).toEqual({
      error: 'Database belum lengkap. Tabel "accounts" belum tersedia. Jalankan migrasi Supabase terbaru lalu coba lagi.',
    })
    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it('creates a new branch and makes it the active unit immediately', async () => {
    const cookieStore = createCookieStore()
    mocks.cookies.mockResolvedValue(cookieStore)

    const insertedBranch = {
      id: 'branch-2',
      org_id: 'org-1',
      name: 'Cabang Bandung',
      code: 'BDG',
      address: 'Jl. Merdeka',
      is_active: true,
    }

    const orgMembersBuilder = {
      select: vi.fn(() => orgMembersBuilder),
      eq: vi.fn(() => orgMembersBuilder),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { role: 'owner' },
        error: null,
      }),
    }

    const duplicateNameBuilder = {
      eq: vi.fn(() => duplicateNameBuilder),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    }

    const duplicateCodeBuilder = {
      eq: vi.fn(() => duplicateCodeBuilder),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    }

    const branchInsertBuilder = {
      insert: vi.fn(() => branchInsertBuilder),
      select: vi.fn(() => branchInsertBuilder),
      single: vi.fn().mockResolvedValue({
        data: insertedBranch,
        error: null,
      }),
    }

    let branchReadCount = 0
    const branchCountBuilder = {
      count: 1,
      eq: vi.fn(() => branchCountBuilder),
    }
    const childOrgCountBuilder = {
      count: 0,
      eq: vi.fn(() => childOrgCountBuilder),
    }
    const memberCountBuilder = {
      count: 1,
      eq: vi.fn(() => memberCountBuilder),
    }
    const orgSettingsBuilder = {
      eq: vi.fn(() => orgSettingsBuilder),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { settings: {} },
        error: null,
      }),
    }

    const organizationsTableBuilder = {
      select: vi.fn((_: string, options?: { count?: string; head?: boolean }) => {
        if (options?.count === 'exact' && options?.head) return childOrgCountBuilder
        return orgSettingsBuilder
      }),
    }
    const orgMembersTableBuilder = {
      select: vi.fn((_: string, options?: { count?: string; head?: boolean }) => {
        if (options?.count === 'exact' && options?.head) return memberCountBuilder
        return orgMembersBuilder
      }),
    }
    const branchesTableBuilder = {
      select: vi.fn((_: string, options?: { count?: string; head?: boolean }) => {
        if (options?.count === 'exact' && options?.head) return branchCountBuilder
        branchReadCount += 1
        if (branchReadCount === 1) return duplicateNameBuilder
        return duplicateCodeBuilder
      }),
      insert: branchInsertBuilder.insert,
    }

    const memberUpdateBuilder = {
      update: vi.fn(() => memberUpdateBuilder),
      eq: vi.fn(() => memberUpdateBuilder),
    }

    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'owner@example.com' } },
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'organizations') return organizationsTableBuilder
        if (table === 'org_members') return orgMembersTableBuilder
        if (table === 'branches') return branchesTableBuilder
        throw new Error(`Unexpected table ${table}`)
      }),
    })
    mocks.createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'org_members') {
          return {
            update: memberUpdateBuilder.update,
            eq: memberUpdateBuilder.eq,
          }
        }
        throw new Error(`Unexpected admin table ${table}`)
      }),
    })

    const formData = new FormData()
    formData.set('name', 'Cabang Bandung')
    formData.set('code', 'bdg')
    formData.set('address', 'Jl. Merdeka')

    const result = await createBranch('org-1', formData)

    expect(result).toEqual({
      success: true,
      branch: insertedBranch,
      branchId: 'branch-2',
    })
    expect(mocks.prisma.branches.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          org_id: 'org-1',
          name: 'Cabang Bandung',
          code: 'BDG',
          address: 'Jl. Merdeka',
          is_active: true,
        }),
      })
    )
    expect(cookieStore.set).toHaveBeenCalledWith(
      'nizam_active_branch_id',
      'branch-2',
      expect.objectContaining({
        path: '/',
        httpOnly: true,
      })
    )
    expect(mocks.persistMembershipActiveContext).toHaveBeenCalledWith({
      userId: 'user-1',
      orgId: 'org-1',
      branchId: 'branch-2',
    })
  })

  it('persists the active org and resolved branch when switching organization', async () => {
    const cookieStore = createCookieStore()
    mocks.cookies.mockResolvedValue(cookieStore)
    mocks.getBranchAccessScope.mockResolvedValue({
      membershipId: 'member-2',
      role: 'owner',
      accessibleBranches: [
        {
          id: 'branch-2',
          org_id: 'org-2',
          name: 'Unit Bandung',
          code: 'BDG',
          address: null,
          is_active: true,
        },
      ],
      accessibleBranchIds: ['branch-2'],
      canAccessAllBranches: true,
      hasPersistedSelection: false,
      storedBranchId: null,
    })
    mocks.prisma.org_members.findFirst.mockResolvedValue({ org_id: 'org-2' })

    const result = await setActiveOrg('org-2')

    expect(result).toEqual({
      success: true,
      orgId: 'org-2',
      branchId: 'branch-2',
    })
    expect(cookieStore.set).toHaveBeenCalledWith(
      'nizam_active_org_id',
      'org-2',
      expect.objectContaining({
        path: '/',
        httpOnly: true,
      })
    )
    expect(cookieStore.set).toHaveBeenCalledWith(
      'nizam_active_branch_id',
      'branch-2',
      expect.objectContaining({
        path: '/',
        httpOnly: true,
      })
    )
    expect(mocks.persistMembershipActiveContext).toHaveBeenCalledWith({
      userId: 'user-1',
      orgId: 'org-2',
      branchId: 'branch-2',
    })
  })

  it('persists the active branch when switching unit context', async () => {
    const cookieStore = createCookieStore()
    mocks.cookies.mockResolvedValue(cookieStore)
    mocks.getBranchAccessScope.mockResolvedValue({
      membershipId: 'member-1',
      role: 'owner',
      accessibleBranches: [
        {
          id: 'branch-1',
          org_id: 'org-1',
          name: 'Unit A',
          code: 'UA',
          address: null,
          is_active: true,
        },
        {
          id: 'branch-2',
          org_id: 'org-1',
          name: 'Unit B',
          code: 'UB',
          address: null,
          is_active: true,
        },
      ],
      accessibleBranchIds: ['branch-1', 'branch-2'],
      canAccessAllBranches: true,
      hasPersistedSelection: false,
      storedBranchId: null,
    })

    const result = await setActiveBranch('org-1', 'branch-2')

    expect(result).toEqual({
      success: true,
      branchId: 'branch-2',
    })
    expect(cookieStore.set).toHaveBeenCalledWith(
      'nizam_active_branch_id',
      'branch-2',
      expect.objectContaining({
        path: '/',
        httpOnly: true,
      })
    )
    expect(mocks.persistMembershipActiveContext).toHaveBeenCalledWith({
      userId: 'user-1',
      orgId: 'org-1',
      branchId: 'branch-2',
    })
  })

  it('returns the persisted active org when login starts without an active-org cookie', async () => {
    const cookieStore = createCookieStore()
    mocks.cookies.mockResolvedValue(cookieStore)
    mocks.resolveActiveMembership.mockResolvedValue({
      org_id: 'org-2',
    })

    const result = await getActiveOrgIdAction()

    expect(result).toBe('org-2')
    expect(mocks.resolveActiveMembership).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user-1',
        email: 'owner@example.com',
      }),
      cookieStore,
      'org_id'
    )
  })

  it('rejects managers from creating a new branch from the app layer', async () => {
    mocks.getMembership.mockResolvedValue(
      makeMembership({
        role: 'manager',
        isOwner: false,
        isAdmin: false,
        isOwnerOrAdmin: false,
      })
    )

    const formData = new FormData()
    formData.set('name', 'Cabang Surabaya')
    formData.set('code', 'SBY')

    const result = await createBranch('org-1', formData)

    expect(result).toEqual({
      error: 'Hanya owner atau admin yang dapat menambahkan unit.',
    })
  })

  it('prevents demoting the last remaining owner', async () => {
    mocks.prisma.org_members.findFirst.mockResolvedValue({
      id: 'member-owner',
      user_id: 'owner-1',
      role: 'owner',
      role_id: null,
    })
    mocks.prisma.org_members.count.mockResolvedValue(1)

    const result = await updateOrgMemberRole('org-1', 'member-owner', 'admin')

    expect(result).toEqual({
      error: 'Organisasi harus memiliki minimal satu owner aktif.',
    })
    expect(mocks.prisma.org_members.update).not.toHaveBeenCalled()
  })

  it('updates org member role for owner/admin actors', async () => {
    mocks.prisma.org_members.findFirst.mockResolvedValue({
      id: 'member-2',
      user_id: 'user-2',
      role: 'staff',
      role_id: 'role-staff',
    })
    mocks.prisma.org_members.update.mockResolvedValue({
      id: 'member-2',
      role: 'manager',
      role_id: 'role-staff',
    })

    const result = await updateOrgMemberRole('org-1', 'member-2', 'manager')

    expect(result).toEqual({
      success: true,
      memberId: 'member-2',
      role: 'manager',
      roleId: 'role-staff',
    })
    expect(mocks.prisma.org_members.update).toHaveBeenCalledWith({
      where: { id: 'member-2' },
      data: { role: 'manager' },
      select: {
        id: true,
        role: true,
        role_id: true,
      },
    })
  })

  it('prevents deleting the actor membership itself', async () => {
    mocks.prisma.org_members.findFirst.mockResolvedValue({
      id: 'member-1',
      user_id: 'user-1',
      role: 'admin',
    })

    const result = await removeOrgMember('org-1', 'member-1')

    expect(result).toEqual({
      error: 'Anda tidak dapat menghapus keanggotaan Anda sendiri.',
    })
    expect(mocks.prisma.org_members.delete).not.toHaveBeenCalled()
  })
})
