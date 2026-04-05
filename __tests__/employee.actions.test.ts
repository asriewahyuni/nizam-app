import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    employees: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
  },
  auth: vi.fn(),
  revalidatePath: vi.fn(),
  resolveAccessibleBranchSelection: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}))

vi.mock('@/auth', () => ({
  auth: mocks.auth,
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

vi.mock('@/modules/organization/lib/branch-access.server', () => ({
  resolveAccessibleBranchSelection: mocks.resolveAccessibleBranchSelection,
}))

import { createEmployee, getEmployees, updateEmployee } from '@/modules/hris/actions/employee.actions'

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
  })

  it('filters employees by resolved branch selection', async () => {
    mocks.prisma.employees.findMany.mockResolvedValue([])
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranchIds: ['branch-1'] },
      branchId: 'branch-1',
    })

    await getEmployees('org-1')

    const findManyArgs = mocks.prisma.employees.findMany.mock.calls[0]?.[0]
    expect(findManyArgs.where.branch_id).toBe('branch-1')
  })

  it('stamps branch_id when creating an employee', async () => {
    mocks.prisma.employees.create.mockResolvedValue({ id: 'emp-new' })
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranchIds: ['branch-1'] },
      branchId: 'branch-1',
    })

    const result = await createEmployee('org-1', buildEmployeeForm())
    const insertPayload = mocks.prisma.employees.create.mock.calls[0]?.[0]?.data as Record<string, any>

    expect(result).toEqual({ success: true })
    expect(insertPayload.branch_id).toBe('branch-1')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/hris')
  })

  it('updates employees only inside their own branch', async () => {
    mocks.prisma.employees.findFirst.mockResolvedValue({
      id: 'emp-1',
      branch_id: 'branch-1',
    })
    mocks.prisma.employees.updateMany.mockResolvedValue({ count: 1 })
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranchIds: ['branch-1'] },
      branchId: 'branch-1',
    })

    const result = await updateEmployee('emp-1', 'org-1', buildEmployeeForm({ first_name: 'Raka' }))
    const updateWhere = mocks.prisma.employees.updateMany.mock.calls[0]?.[0]?.where

    expect(result).toEqual({ success: true })
    expect(updateWhere.branch_id).toBe('branch-1')
  })
})
