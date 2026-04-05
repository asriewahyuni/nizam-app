import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getMembership: vi.fn(),
  revalidatePath: vi.fn(),
  prisma: {
    $transaction: vi.fn(),
    employees: {
      count: vi.fn(),
    },
    roles: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      aggregate: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    org_members: {
      count: vi.fn(),
    },
    org_invitations: {
      count: vi.fn(),
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

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

import {
  createOrgRole,
  deleteOrgRole,
  getOrgRoles,
  getResetRequestsCount,
  reorderOrgRoles,
  updateOrgRolePermissions,
} from '@/modules/organization/actions/hris.actions'

function makeMembership(overrides: Record<string, unknown> = {}) {
  return {
    memberId: 'member-1',
    userId: 'user-1',
    orgId: 'org-1',
    role: 'owner',
    roleId: null,
    permissions: ['business:write'],
    isOwner: true,
    isAdmin: false,
    isOwnerOrAdmin: true,
    ...overrides,
  }
}

describe('Organization HRIS Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.getMembership.mockResolvedValue(makeMembership())
  })

  it('returns sorted org roles for authenticated members', async () => {
    mocks.prisma.roles.findMany.mockResolvedValue([
      {
        id: 'role-2',
        org_id: 'org-1',
        name: 'Supervisor',
        permissions: ['employees:read'],
        is_system: false,
        priority: 2,
        parent_id: null,
        department_id: 'HRIS',
        department_ids: ['HRIS'],
      },
      {
        id: 'role-1',
        org_id: 'org-1',
        name: 'Admin',
        permissions: ['business:write'],
        is_system: true,
        priority: 0,
        parent_id: null,
        department_id: 'IT',
        department_ids: ['IT'],
      },
    ])

    const result = await getOrgRoles('org-1')

    expect(result).toEqual({
      roles: [
        expect.objectContaining({
          id: 'role-1',
          name: 'Admin',
          department_id: 'IT',
        }),
        expect.objectContaining({
          id: 'role-2',
          name: 'Supervisor',
          department_id: 'HRIS',
        }),
      ],
    })
  })

  it('counts reset requests via prisma once membership is validated', async () => {
    mocks.prisma.employees.count.mockResolvedValue(4)

    const result = await getResetRequestsCount('org-1')

    expect(result).toBe(4)
    expect(mocks.prisma.employees.count).toHaveBeenCalledWith({
      where: {
        org_id: 'org-1',
        reset_requested: true,
      },
    })
  })

  it('creates a role with the next priority slot', async () => {
    mocks.prisma.roles.aggregate.mockResolvedValue({
      _max: { priority: 3 },
    })
    mocks.prisma.roles.create.mockResolvedValue({
      id: 'role-4',
      org_id: 'org-1',
      name: 'Lead Warehouse',
      permissions: [],
      is_system: false,
      priority: 4,
      parent_id: null,
      department_id: 'OPERASIONAL',
      department_ids: ['OPERASIONAL'],
    })

    const result = await createOrgRole('org-1', {
      name: 'Lead Warehouse',
      departmentIds: ['OPERASIONAL'],
    })

    expect(result).toEqual({
      success: true,
      role: expect.objectContaining({
        id: 'role-4',
        name: 'Lead Warehouse',
        priority: 4,
        department_ids: ['OPERASIONAL'],
      }),
    })
    expect(mocks.prisma.roles.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          org_id: 'org-1',
          name: 'Lead Warehouse',
          priority: 4,
          department_id: 'OPERASIONAL',
        }),
      })
    )
  })

  it('rejects permission edits when the member lacks business access', async () => {
    mocks.getMembership.mockResolvedValue(
      makeMembership({
        role: 'hr',
        permissions: ['employees:write'],
        isOwner: false,
        isAdmin: false,
        isOwnerOrAdmin: false,
      })
    )

    const result = await updateOrgRolePermissions('org-1', 'role-1', ['employees:read'])

    expect(result).toEqual({
      error: 'Anda tidak memiliki izin untuk mengubah hak akses jabatan.',
    })
  })

  it('prevents deleting roles that are still assigned to members or invitations', async () => {
    mocks.prisma.roles.findFirst.mockResolvedValue({
      id: 'role-1',
      is_system: false,
    })
    mocks.prisma.org_members.count.mockResolvedValue(1)
    mocks.prisma.org_invitations.count.mockResolvedValue(0)

    const result = await deleteOrgRole('org-1', 'role-1')

    expect(result).toEqual({
      error: 'Jabatan ini masih dipakai oleh anggota atau undangan aktif.',
    })
    expect(mocks.prisma.roles.delete).not.toHaveBeenCalled()
  })

  it('reorders roles and returns the refreshed list', async () => {
    mocks.prisma.roles.findMany
      .mockResolvedValueOnce([
        { id: 'role-1' },
        { id: 'role-2' },
      ])
      .mockResolvedValueOnce([
        {
          id: 'role-2',
          org_id: 'org-1',
          name: 'Supervisor',
          permissions: [],
          is_system: false,
          priority: 0,
          parent_id: null,
          department_id: 'HRIS',
          department_ids: ['HRIS'],
        },
        {
          id: 'role-1',
          org_id: 'org-1',
          name: 'Admin',
          permissions: ['business:write'],
          is_system: true,
          priority: 1,
          parent_id: null,
          department_id: 'IT',
          department_ids: ['IT'],
        },
      ])
    mocks.prisma.roles.update.mockResolvedValue({})
    mocks.prisma.$transaction.mockResolvedValue([])

    const result = await reorderOrgRoles('org-1', ['role-2', 'role-1'])

    expect(result).toEqual({
      success: true,
      roles: [
        expect.objectContaining({ id: 'role-2', priority: 0 }),
        expect.objectContaining({ id: 'role-1', priority: 1 }),
      ],
    })
    expect(mocks.prisma.roles.update).toHaveBeenCalledTimes(2)
    expect(mocks.prisma.$transaction).toHaveBeenCalled()
  })
})
