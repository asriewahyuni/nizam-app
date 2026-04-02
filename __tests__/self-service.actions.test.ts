import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseMock, success } from './helpers/supabase-mock'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

import {
  cancelMyLeaveRequest,
  clockMyAttendance,
  deleteMyExpenseClaim,
  getMyAttendanceRecords,
  getMyExpenseClaims,
  getMyLeaveRequests,
  submitMyExpenseClaim,
  submitMyLeaveRequest,
} from '@/modules/hris/actions/self-service.actions'

function mockAuthedClient(supabaseClient: ReturnType<typeof createSupabaseMock>['client']) {
  return {
    ...supabaseClient,
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
      }),
    },
  }
}

function buildLeaveForm(overrides: Record<string, string> = {}) {
  const formData = new FormData()
  formData.set('leave_type', overrides.leave_type || 'Annual Leave')
  formData.set('start_date', overrides.start_date || '2026-04-10')
  formData.set('end_date', overrides.end_date || '2026-04-12')
  formData.set('reason', overrides.reason || 'Acara keluarga')
  return formData
}

function buildExpenseForm(overrides: Record<string, string> = {}) {
  const formData = new FormData()
  formData.set('claim_date', overrides.claim_date || '2026-04-11')
  formData.set('category', overrides.category || 'Transport')
  formData.set('amount', overrides.amount || '185000')
  formData.set('description', overrides.description || 'Taksi meeting klien')
  if (overrides.receipt_url) {
    formData.set('receipt_url', overrides.receipt_url)
  }
  return formData
}

describe('Employee Self Service Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads only the current employee attendance records', async () => {
    const supabase = createSupabaseMock({
      tables: {
        employees: [
          {
            maybeSingleResult: success({
              id: 'emp-1',
              branch_id: 'branch-1',
              first_name: 'Nadia',
              last_name: 'Putri',
              job_title: 'Staff',
              nik: 'EMP-001',
            }),
          },
        ],
        attendance: [
          {
            result: success([]),
          },
        ],
      },
    })

    mocks.createClient.mockResolvedValue(mockAuthedClient(supabase.client))

    await getMyAttendanceRecords('org-1')

    const employeeFilter = supabase.calls[1]?.operations.find(
      (operation) => operation.method === 'eq' && operation.args[0] === 'employee_id'
    )
    expect(employeeFilter?.args[1]).toBe('emp-1')
  })

  it('creates a self attendance clock-in with the employee branch', async () => {
    const supabase = createSupabaseMock({
      tables: {
        employees: [
          {
            maybeSingleResult: success({
              id: 'emp-1',
              branch_id: 'branch-2',
              first_name: 'Nadia',
              last_name: 'Putri',
              job_title: 'Staff',
              nik: 'EMP-001',
            }),
          },
        ],
        attendance: [
          {
            maybeSingleResult: success(null),
          },
          {
            result: success([]),
          },
        ],
      },
    })

    mocks.createClient.mockResolvedValue(mockAuthedClient(supabase.client))

    const result = await clockMyAttendance('org-1', { type: 'IN', notes: 'On site' })
    const insertPayload = supabase.calls[2]?.operations.find(
      (operation) => operation.method === 'insert'
    )?.args[0] as Record<string, string>

    expect(result).toEqual({ success: true })
    expect(insertPayload.employee_id).toBe('emp-1')
    expect(insertPayload.branch_id).toBe('branch-2')
    expect(insertPayload.status).toBe('PRESENT')
  })

  it('updates the current employee attendance on clock-out', async () => {
    const supabase = createSupabaseMock({
      tables: {
        employees: [
          {
            maybeSingleResult: success({
              id: 'emp-1',
              branch_id: 'branch-2',
              first_name: 'Nadia',
              last_name: 'Putri',
              job_title: 'Staff',
              nik: 'EMP-001',
            }),
          },
        ],
        attendance: [
          {
            maybeSingleResult: success({
              id: 'att-1',
              status: 'PRESENT',
              check_out: null,
              notes: 'On site',
            }),
          },
          {
            result: success([]),
          },
        ],
      },
    })

    mocks.createClient.mockResolvedValue(mockAuthedClient(supabase.client))

    const result = await clockMyAttendance('org-1', { type: 'OUT', notes: 'Selesai shift' })
    const updateCall = supabase.calls[2]
    const employeeFilter = updateCall?.operations.find(
      (operation) => operation.method === 'eq' && operation.args[0] === 'employee_id'
    )

    expect(result).toEqual({ success: true })
    expect(updateCall?.operations.some((operation) => operation.method === 'update')).toBe(true)
    expect(employeeFilter?.args[1]).toBe('emp-1')
  })

  it('loads only the current employee leave requests', async () => {
    const supabase = createSupabaseMock({
      tables: {
        employees: [
          {
            maybeSingleResult: success({
              id: 'emp-2',
              branch_id: 'branch-3',
              first_name: 'Rafi',
              last_name: 'Aulia',
              job_title: 'Admin',
              nik: 'EMP-002',
            }),
          },
        ],
        leave_requests: [
          {
            result: success([]),
          },
        ],
      },
    })

    mocks.createClient.mockResolvedValue(mockAuthedClient(supabase.client))

    await getMyLeaveRequests('org-1')

    const employeeFilter = supabase.calls[1]?.operations.find(
      (operation) => operation.method === 'eq' && operation.args[0] === 'employee_id'
    )
    expect(employeeFilter?.args[1]).toBe('emp-2')
  })

  it('submits a leave request for the current employee only', async () => {
    const supabase = createSupabaseMock({
      tables: {
        employees: [
          {
            maybeSingleResult: success({
              id: 'emp-2',
              branch_id: 'branch-3',
              first_name: 'Rafi',
              last_name: 'Aulia',
              job_title: 'Admin',
              nik: 'EMP-002',
            }),
          },
        ],
        leave_requests: [
          {
            result: success([]),
          },
        ],
      },
    })

    mocks.createClient.mockResolvedValue(mockAuthedClient(supabase.client))

    const result = await submitMyLeaveRequest('org-1', buildLeaveForm())
    const insertPayload = supabase.calls[1]?.operations.find(
      (operation) => operation.method === 'insert'
    )?.args[0] as Record<string, string | number>

    expect(result).toEqual({ success: true })
    expect(insertPayload.employee_id).toBe('emp-2')
    expect(insertPayload.branch_id).toBe('branch-3')
    expect(insertPayload.days_taken).toBe(3)
  })

  it('loads only the current employee expense claims', async () => {
    const supabase = createSupabaseMock({
      tables: {
        employees: [
          {
            maybeSingleResult: success({
              id: 'emp-3',
              branch_id: 'branch-4',
              first_name: 'Alya',
              last_name: 'Sari',
              job_title: 'Sales',
              nik: 'EMP-003',
            }),
          },
        ],
        expense_claims: [
          {
            result: success([]),
          },
        ],
      },
    })

    mocks.createClient.mockResolvedValue(mockAuthedClient(supabase.client))

    await getMyExpenseClaims('org-1')

    const employeeFilter = supabase.calls[1]?.operations.find(
      (operation) => operation.method === 'eq' && operation.args[0] === 'employee_id'
    )
    expect(employeeFilter?.args[1]).toBe('emp-3')
  })

  it('submits an expense claim for the current employee only', async () => {
    const supabase = createSupabaseMock({
      tables: {
        employees: [
          {
            maybeSingleResult: success({
              id: 'emp-3',
              branch_id: 'branch-4',
              first_name: 'Alya',
              last_name: 'Sari',
              job_title: 'Sales',
              nik: 'EMP-003',
            }),
          },
        ],
        expense_claims: [
          {
            result: success([]),
          },
        ],
      },
    })

    mocks.createClient.mockResolvedValue(mockAuthedClient(supabase.client))

    const result = await submitMyExpenseClaim('org-1', buildExpenseForm({ receipt_url: 'https://example.com/nota.jpg' }))
    const insertPayload = supabase.calls[1]?.operations.find(
      (operation) => operation.method === 'insert'
    )?.args[0] as Record<string, string | number | null>

    expect(result).toEqual({ success: true })
    expect(insertPayload.employee_id).toBe('emp-3')
    expect(insertPayload.branch_id).toBe('branch-4')
    expect(insertPayload.receipt_url).toBe('https://example.com/nota.jpg')
  })

  it('deletes only the current employee pending or rejected expense claims', async () => {
    const supabase = createSupabaseMock({
      tables: {
        employees: [
          {
            maybeSingleResult: success({
              id: 'emp-3',
              branch_id: 'branch-4',
              first_name: 'Alya',
              last_name: 'Sari',
              job_title: 'Sales',
              nik: 'EMP-003',
            }),
          },
        ],
        expense_claims: [
          {
            maybeSingleResult: success({
              id: 'claim-1',
              status: 'PENDING',
            }),
          },
          {
            result: success([]),
          },
        ],
      },
    })

    mocks.createClient.mockResolvedValue(mockAuthedClient(supabase.client))

    const result = await deleteMyExpenseClaim('org-1', 'claim-1')
    const deleteCall = supabase.calls[2]
    const employeeFilter = deleteCall?.operations.find(
      (operation) => operation.method === 'eq' && operation.args[0] === 'employee_id'
    )

    expect(result).toEqual({ success: true })
    expect(deleteCall?.operations.some((operation) => operation.method === 'delete')).toBe(true)
    expect(employeeFilter?.args[1]).toBe('emp-3')
  })

  it('cancels only the current employee pending leave request', async () => {
    const supabase = createSupabaseMock({
      tables: {
        employees: [
          {
            maybeSingleResult: success({
              id: 'emp-2',
              branch_id: 'branch-3',
              first_name: 'Rafi',
              last_name: 'Aulia',
              job_title: 'Admin',
              nik: 'EMP-002',
            }),
          },
        ],
        leave_requests: [
          {
            maybeSingleResult: success({
              id: 'leave-1',
              status: 'PENDING',
            }),
          },
          {
            result: success([]),
          },
        ],
      },
    })

    mocks.createClient.mockResolvedValue(mockAuthedClient(supabase.client))

    const result = await cancelMyLeaveRequest('org-1', 'leave-1')
    const updateCall = supabase.calls[2]
    const employeeFilter = updateCall?.operations.find(
      (operation) => operation.method === 'eq' && operation.args[0] === 'employee_id'
    )

    expect(result).toEqual({ success: true })
    expect(updateCall?.operations.some((operation) => operation.method === 'update')).toBe(true)
    expect(employeeFilter?.args[1]).toBe('emp-2')
  })
})
