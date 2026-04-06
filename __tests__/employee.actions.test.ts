import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    employees: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    organizations: {
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
  },
  getAuthUser: vi.fn(),
  revalidatePath: vi.fn(),
  resolveAccessibleBranchSelection: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }))
vi.mock('@/lib/auth/permissions', () => ({ getAuthUser: mocks.getAuthUser, getMembership: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/modules/organization/lib/branch-access.server', () => ({ resolveAccessibleBranchSelection: mocks.resolveAccessibleBranchSelection }))

import { createEmployee, deleteEmployee, getEmployees, updateEmployee } from '@/modules/hris/actions/employee.actions'

function buildEmployeeForm(overrides: Record<string, string> = {}) {
  const formData = new FormData()
  formData.set('nik', overrides.nik || 'EMP-0001')
  formData.set('first_name', overrides.first_name || 'Salsa')
  formData.set('last_name', overrides.last_name || 'Pratama')
  formData.set('job_title', overrides.job_title || 'Staff Gudang')
  formData.set('employment_status', overrides.employment_status || 'FULL_TIME')
  formData.set('basic_salary', overrides.basic_salary || '4500000')
  formData.set('join_date', overrides.join_date || '2026-04-03')
  formData.set('email', overrides.email || 'salsa@example.com')
  formData.set('gender', overrides.gender || 'F')
  formData.set('tax_status', overrides.tax_status || 'TK/0')
  return formData
}

describe('Employee Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAuthUser.mockResolvedValue({ userId: 'user-1', email: 'hr@example.com', name: 'HR User' })
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranchIds: ['branch-1'] },
      branchId: 'branch-1',
    })
    mocks.prisma.$executeRaw.mockResolvedValue(undefined)
    mocks.prisma.organizations.findMany.mockResolvedValue([])
    mocks.prisma.$queryRaw.mockResolvedValue([])
  })

  it('filters employees by resolved branch and returns managed enrichments', async () => {
    mocks.prisma.employees.findMany.mockResolvedValue([{ id: 'emp-1', branch_id: 'branch-1', first_name: 'Salsa', branches: { id: 'branch-1', name: 'Unit A', code: 'UA' } }])
    mocks.prisma.$queryRaw
      .mockResolvedValueOnce([{ id: 'branch-1', pic_employee_id: 'emp-1' }])
      .mockResolvedValueOnce([{ id: 'org-child-1', name: 'PT Child', manager_employee_id: 'emp-1' }])

    const result = await getEmployees('org-1')

    expect(mocks.prisma.employees.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ org_id: 'org-1', branch_id: 'branch-1' }) }))
    expect(result[0]).toEqual(expect.objectContaining({
      id: 'emp-1',
      managed_branches: [{ id: 'branch-1' }],
      managed_child_orgs: [{ id: 'org-child-1', name: 'PT Child' }],
    }))
  })

  it('stamps branch_id when creating employee', async () => {
    mocks.prisma.employees.create.mockResolvedValue({ id: 'emp-new' })

    const result = await createEmployee('org-1', buildEmployeeForm())

    expect(result).toEqual({ success: true })
    expect(mocks.prisma.employees.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ org_id: 'org-1', branch_id: 'branch-1' }) }))
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/hris')
  })

  it('updates employee record only after branch accessibility check', async () => {
    mocks.prisma.employees.findFirst.mockResolvedValue({ branch_id: 'branch-1' })

    const result = await updateEmployee('emp-1', 'org-1', buildEmployeeForm({ first_name: 'Raka' }))

    expect(result).toEqual({ success: true })
    expect(mocks.prisma.employees.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'emp-1' }, data: expect.objectContaining({ first_name: 'Raka' }) }))
  })

  it('deletes employee only inside accessible branch', async () => {
    mocks.prisma.employees.findFirst.mockResolvedValue({ branch_id: 'branch-1' })
    mocks.prisma.employees.delete.mockResolvedValue({ id: 'emp-1' })

    const result = await deleteEmployee('emp-1', 'org-1')

    expect(result).toEqual({ success: true })
    expect(mocks.prisma.employees.delete).toHaveBeenCalledWith({ where: { id: 'emp-1' } })
  })
})
