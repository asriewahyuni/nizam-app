import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock, success } from './helpers/supabase-mock'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  cookies: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
  seedDemoData: vi.fn(),
  applyVoucher: vi.fn(),
  getBranchAccessScope: vi.fn(),
  getCurrentAccessibleBranch: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
  createAdminClient: mocks.createAdminClient,
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
  getBranchAccessScope: mocks.getBranchAccessScope,
  getCurrentAccessibleBranch: mocks.getCurrentAccessibleBranch,
  canAccessAllBranchesForOrg: vi.fn(),
}))

import {
  createBranch,
  createOrganization,
  createOrganizationQuick,
  getActiveBranch,
  getActiveOrg,
  setActiveBranch,
  setActiveOrg,
} from '@/modules/organization/actions/org.actions'
import { getActiveBranchIdAction, getActiveOrgIdAction } from '@/modules/organization/actions/org-id.actions'

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

  it('falls back to role permissions by employee job title when membership role_id is empty', async () => {
    const cookieStore = createCookieStore({
      nizam_active_org_id: 'org-1',
    })
    mocks.cookies.mockResolvedValue(cookieStore)

    const supabase = createSupabaseMock({
      tables: {
        org_members: [
          {
            maybeSingleResult: success({
              org_id: 'org-1',
              role: 'staff',
              role_id: null,
              organizations: {
                id: 'org-1',
                settings: { plan: 'Demo' },
                active_addons: [],
              },
              roles: null,
            }),
          },
        ],
        saas_packages: [
          {
            maybeSingleResult: success({
              modules: ['Accounting', 'Finance', 'HRIS'],
            }),
          },
        ],
        employees: [
          {
            maybeSingleResult: success({
              job_title: 'Staff',
              role_id: null,
            }),
          },
        ],
        roles: [
          {
            result: success([
              {
                id: 'role-staff',
                name: 'Staff',
                permissions: ['coa:read', 'bank:read', 'journal:read'],
              },
            ]),
          },
        ],
      },
    })

    mocks.createClient.mockResolvedValue({
      ...supabase.client,
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'staff@example.com' } },
          error: null,
        }),
      },
    })

    const result = await getActiveOrg()

    expect(result).toEqual(
      expect.objectContaining({
        role: 'staff',
        roleId: 'role-staff',
        jobTitle: 'Staff',
        permissions: ['coa:read', 'bank:read', 'journal:read'],
      })
    )
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
    const memberUpdateBuilder = {
      update: vi.fn(() => memberUpdateBuilder),
      eq: vi.fn(() => memberUpdateBuilder),
    }

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
        if (table === 'organizations') return { insert: orgInsert }
        throw new Error(`Unexpected table ${table}`)
      }),
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
        if (table === 'branches') return { insert: branchInsert }
        if (table === 'organizations') return { delete: vi.fn(() => ({ eq: vi.fn() })) }
        throw new Error(`Unexpected admin table ${table}`)
      }),
    })

    const formData = new FormData()
    formData.set('name', 'PT Contoh Jaya')

    await createOrganization(formData)

    expect(orgInsert).toHaveBeenCalledWith(
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

    const orgInsert = vi.fn().mockResolvedValue({ error: null })
    const memberInsert = vi.fn().mockResolvedValue({ error: null })
    const branchInsert = vi.fn().mockResolvedValue({ error: null })
    const memberUpdateBuilder = {
      update: vi.fn(() => memberUpdateBuilder),
      eq: vi.fn(() => memberUpdateBuilder),
    }

    const randomUuidMock = vi.spyOn(globalThis.crypto, 'randomUUID')
    randomUuidMock
      .mockReturnValueOnce('org-2')
      .mockReturnValueOnce('branch-2')

    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'owner@example.com' } },
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'organizations') return { insert: orgInsert }
        throw new Error(`Unexpected table ${table}`)
      }),
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
        if (table === 'branches') return { insert: branchInsert }
        if (table === 'organizations') return { delete: vi.fn(() => ({ eq: vi.fn() })) }
        throw new Error(`Unexpected admin table ${table}`)
      }),
    })

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

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        branchId: 'branch-2',
      })
    )
    expect(branchInsertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-1',
        name: 'Cabang Bandung',
        code: 'BDG',
        address: 'Jl. Merdeka',
        is_active: true,
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
    expect(memberUpdateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        last_active_branch_id: 'branch-2',
      })
    )
  })

  it('persists the active org and resolved branch when switching organization', async () => {
    const cookieStore = createCookieStore()
    mocks.cookies.mockResolvedValue(cookieStore)
    mocks.getBranchAccessScope.mockResolvedValue({
      membershipId: 'member-2',
      role: 'owner',
      accessibleBranches: [
        { id: 'branch-2', org_id: 'org-2', name: 'Unit Bandung', code: 'BDG', address: null, is_active: true },
      ],
      accessibleBranchIds: ['branch-2'],
      canAccessAllBranches: true,
      hasPersistedSelection: false,
      storedBranchId: null,
    })

    const membershipQuery = {
      select: vi.fn(() => membershipQuery),
      eq: vi.fn(() => membershipQuery),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { org_id: 'org-2' },
        error: null,
      }),
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
        if (table === 'org_members') return membershipQuery
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
    expect(memberUpdateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        last_active_branch_id: 'branch-2',
      })
    )
  })

  it('persists the active branch when switching unit context', async () => {
    const cookieStore = createCookieStore()
    mocks.cookies.mockResolvedValue(cookieStore)
    mocks.getBranchAccessScope.mockResolvedValue({
      membershipId: 'member-1',
      role: 'owner',
      accessibleBranches: [
        { id: 'branch-1', org_id: 'org-1', name: 'Unit A', code: 'UA', address: null, is_active: true },
        { id: 'branch-2', org_id: 'org-1', name: 'Unit B', code: 'UB', address: null, is_active: true },
      ],
      accessibleBranchIds: ['branch-1', 'branch-2'],
      canAccessAllBranches: true,
      hasPersistedSelection: false,
      storedBranchId: null,
    })

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
    expect(memberUpdateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        last_active_branch_id: 'branch-2',
      })
    )
  })

  it('returns the persisted active org when login starts without an active-org cookie', async () => {
    const cookieStore = createCookieStore()
    mocks.cookies.mockResolvedValue(cookieStore)

    const supabase = createSupabaseMock({
      tables: {
        org_members: [
          {
            maybeSingleResult: success({
              org_id: 'org-2',
              last_active_at: '2026-04-04T10:00:00.000Z',
              joined_at: '2026-01-01T00:00:00.000Z',
            }),
          },
          {
            maybeSingleResult: success({
              org_id: 'org-2',
            }),
          },
        ],
      },
    })

    mocks.createClient.mockResolvedValue({
      ...supabase.client,
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'owner@example.com' } },
        }),
      },
    })

    const result = await getActiveOrgIdAction()

    expect(result).toBe('org-2')
    expect(supabase.calls[0]?.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: 'order',
          args: ['last_active_at', expect.objectContaining({ ascending: false })],
        }),
      ])
    )
  })

  it('rejects managers from creating a new branch from the app layer', async () => {
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'manager@example.com' } },
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'org_members') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { role: 'manager' },
              error: null,
            }),
          }
        }
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const formData = new FormData()
    formData.set('name', 'Cabang Surabaya')
    formData.set('code', 'SBY')

    const result = await createBranch('org-1', formData)

    expect(result).toEqual({
      error: 'Hanya owner atau admin yang dapat menambahkan unit.',
    })
  })
})
