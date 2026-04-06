import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseMock, failure, success } from './helpers/supabase-mock'

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

  it('retries create without department_id when legacy schema does not have the column', async () => {
    const supabase = createSupabaseMock({
      tables: {
        employees: [
          {
            singleResult: failure("Could not find the 'department_id' column of 'employees' in the schema cache"),
          },
          {
            singleResult: success({ id: 'emp-1' }),
          },
        ],
      },
    })

    mocks.createClient.mockResolvedValue(supabase.client)
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranchIds: ['branch-1'] },
      branchId: 'branch-1',
    })

    const result = await createEmployee('org-1', buildEmployeeForm({ department_id: 'HRIS' }))
    const firstInsert = supabase.calls[0]?.operations.find((operation) => operation.method === 'insert')?.args[0] as Record<string, unknown>
    const secondInsert = supabase.calls[1]?.operations.find((operation) => operation.method === 'insert')?.args[0] as Record<string, unknown>

    expect(result).toEqual({ success: true })
    expect(firstInsert).toHaveProperty('department_id')
    expect(secondInsert).not.toHaveProperty('department_id')
  })

  it('retries update without department_id when legacy schema does not have the column', async () => {
    const supabase = createSupabaseMock({
      tables: {
        employees: [
          {
            maybeSingleResult: success({
              id: 'emp-1',
              branch_id: 'branch-1',
            }),
          },
          {
            result: failure("Could not find the 'department_id' column of 'employees' in the schema cache"),
          },
          {
            result: success([]),
          },
        ],
      },
    })

    mocks.createClient.mockResolvedValue(supabase.client)
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranchIds: ['branch-1'] },
      branchId: 'branch-1',
    })

    const result = await updateEmployee('emp-1', 'org-1', buildEmployeeForm({ department_id: 'HRIS' }))
    const firstUpdate = supabase.calls[1]?.operations.find((operation) => operation.method === 'update')?.args[0] as Record<string, unknown>
    const secondUpdate = supabase.calls[2]?.operations.find((operation) => operation.method === 'update')?.args[0] as Record<string, unknown>

    expect(result).toEqual({ success: true })
    expect(firstUpdate).toHaveProperty('department_id')
    expect(secondUpdate).not.toHaveProperty('department_id')
  })

  it('deletes employee only inside accessible branch', async () => {
    const supabase = createSupabaseMock({
      tables: {
        employees: [
          {
            maybeSingleResult: success({
              id: 'emp-1',
              branch_id: 'branch-1',
            }),
          },
          {
            result: success([]),
          },
        ],
      },
    })

    mocks.createClient.mockResolvedValue(supabase.client)
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranchIds: ['branch-1'] },
      branchId: 'branch-1',
    })

    const result = await deleteEmployee('emp-1', 'org-1')
    const deleteCall = supabase.calls[1]
    const branchFilter = deleteCall?.operations.find(
      (operation) => operation.method === 'eq' && operation.args[0] === 'branch_id'
    )
    const deleteOperation = deleteCall?.operations.find((operation) => operation.method === 'delete')

    expect(result).toEqual({ success: true })
    expect(deleteOperation).toBeTruthy()
    expect(branchFilter?.args[1]).toBe('branch-1')
  })

  it('syncs managed child organizations assignment from employee form', async () => {
    const formData = buildEmployeeForm()
    formData.set('managed_child_orgs', JSON.stringify(['child-1', 'child-2']))

    const supabase = createSupabaseMock({
      tables: {
        employees: [
          {
            maybeSingleResult: success({
              id: 'emp-1',
              branch_id: 'branch-1',
            }),
          },
          {
            result: success([]),
          },
        ],
        organizations: [
          {
            maybeSingleResult: success({
              id: 'org-1',
              parent_org_id: null,
            }),
          },
          {
            result: success([
              { id: 'child-1' },
              { id: 'child-2' },
              { id: 'child-3' },
            ]),
          },
          {
            result: success([]),
          },
          {
            result: success([]),
          },
        ],
      },
    })

    mocks.createClient.mockResolvedValue(supabase.client)
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranchIds: ['branch-1'] },
      branchId: 'branch-1',
    })

    const result = await updateEmployee('emp-1', 'org-1', formData)
    const organizationCalls = supabase.calls.filter((call) => call.table === 'organizations')
    const clearAssignmentCall = organizationCalls[2]
    const setAssignmentCall = organizationCalls[3]

    expect(result).toEqual({ success: true })
    expect(clearAssignmentCall?.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'update', args: [expect.objectContaining({ manager_employee_id: null })] }),
        expect.objectContaining({ method: 'eq', args: ['parent_org_id', 'org-1'] }),
        expect.objectContaining({ method: 'eq', args: ['manager_employee_id', 'emp-1'] }),
        expect.objectContaining({ method: 'not', args: ['id', 'in', '(child-1,child-2)'] }),
      ])
    )
    expect(setAssignmentCall?.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'update', args: [expect.objectContaining({ manager_employee_id: 'emp-1' })] }),
        expect.objectContaining({ method: 'eq', args: ['parent_org_id', 'org-1'] }),
        expect.objectContaining({ method: 'in', args: ['id', ['child-1', 'child-2']] }),
      ])
    )
  })
})
