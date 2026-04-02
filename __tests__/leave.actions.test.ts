import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseMock, success } from './helpers/supabase-mock'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
  resolveAccessibleBranchSelection: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

vi.mock('@/modules/organization/lib/branch-access.server', () => ({
  resolveAccessibleBranchSelection: mocks.resolveAccessibleBranchSelection,
}))

import {
  approveLeaveRequest,
  createLeaveRequest,
  getLeaveRequests,
  rejectLeaveRequest,
} from '@/modules/hris/actions/leave.actions'

function buildLeaveForm(overrides: Record<string, string> = {}) {
  const formData = new FormData()
  formData.set('employee_id', overrides.employee_id || 'emp-1')
  formData.set('leave_type', overrides.leave_type || 'Annual Leave')
  formData.set('start_date', overrides.start_date || '2026-04-10')
  formData.set('end_date', overrides.end_date || '2026-04-12')
  formData.set('reason', overrides.reason || 'Liburan keluarga')
  return formData
}

describe('Leave Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filters leave requests by resolved branch selection', async () => {
    const supabase = createSupabaseMock({
      tables: {
        leave_requests: [
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

    await getLeaveRequests('org-1')

    const branchFilter = supabase.calls[0]?.operations.find(
      (operation) => operation.method === 'eq' && operation.args[0] === 'branch_id'
    )
    expect(branchFilter?.args[1]).toBe('branch-1')
  })

  it('derives branch_id and computes days_taken when creating a leave request', async () => {
    const supabase = createSupabaseMock({
      tables: {
        employees: [
          {
            maybeSingleResult: success({
              id: 'emp-1',
              branch_id: 'branch-4',
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

    mocks.createClient.mockResolvedValue(supabase.client)
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranchIds: ['branch-4'] },
      branchId: 'branch-4',
    })

    const result = await createLeaveRequest('org-1', buildLeaveForm())
    const insertPayload = supabase.calls[1]?.operations.find((operation) => operation.method === 'insert')?.args[0] as Record<string, string | number>

    expect(result).toEqual({ success: true })
    expect(insertPayload.branch_id).toBe('branch-4')
    expect(insertPayload.days_taken).toBe(3)
  })

  it('validates branch access before approving a leave request', async () => {
    const supabase = createSupabaseMock({
      tables: {
        leave_requests: [
          {
            maybeSingleResult: success({
              id: 'leave-1',
              org_id: 'org-1',
              branch_id: 'branch-2',
              status: 'PENDING',
            }),
          },
          {
            result: success([]),
          },
        ],
      },
    })

    mocks.createClient.mockResolvedValue({
      ...supabase.client,
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'approver-1' } },
        }),
      },
    })
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranchIds: ['branch-2'] },
      branchId: 'branch-2',
    })

    const result = await approveLeaveRequest('leave-1')
    const updateCall = supabase.calls[1]
    const branchFilter = updateCall?.operations.find(
      (operation) => operation.method === 'eq' && operation.args[0] === 'branch_id'
    )

    expect(result).toEqual({ success: true })
    expect(updateCall?.operations.some((operation) => operation.method === 'update')).toBe(true)
    expect(branchFilter?.args[1]).toBe('branch-2')
  })

  it('rejects leave requests only inside the accessible branch', async () => {
    const supabase = createSupabaseMock({
      tables: {
        leave_requests: [
          {
            maybeSingleResult: success({
              id: 'leave-2',
              org_id: 'org-1',
              branch_id: 'branch-5',
              status: 'PENDING',
            }),
          },
          {
            result: success([]),
          },
        ],
      },
    })

    mocks.createClient.mockResolvedValue({
      ...supabase.client,
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'approver-1' } },
        }),
      },
    })
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranchIds: ['branch-5'] },
      branchId: 'branch-5',
    })

    const result = await rejectLeaveRequest('leave-2')
    const updateCall = supabase.calls[1]
    const branchFilter = updateCall?.operations.find(
      (operation) => operation.method === 'eq' && operation.args[0] === 'branch_id'
    )

    expect(result).toEqual({ success: true })
    expect(branchFilter?.args[1]).toBe('branch-5')
  })
})
