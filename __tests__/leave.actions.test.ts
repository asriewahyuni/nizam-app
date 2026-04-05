import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    leave_requests: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    employees: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
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
    mocks.prisma.leave_requests.findMany.mockResolvedValue([])
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranchIds: ['branch-1'] },
      branchId: 'branch-1',
    })

    await getLeaveRequests('org-1')

    const findManyArgs = mocks.prisma.leave_requests.findMany.mock.calls[0]?.[0]
    expect(findManyArgs.where.branch_id).toBe('branch-1')
  })

  it('derives branch_id and computes days_taken when creating a leave request', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'requester-1' } })
    mocks.prisma.employees.findFirst.mockResolvedValue({
      id: 'emp-1',
      branch_id: 'branch-4',
    })
    const tx = {
      leave_requests: { create: vi.fn().mockResolvedValue({ id: 'leave-new' }) },
      approval_requests: { create: vi.fn().mockResolvedValue({ id: 'approval-1' }) },
    }
    mocks.prisma.$transaction.mockImplementation(async (fn: any) => fn(tx))
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranchIds: ['branch-4'] },
      branchId: 'branch-4',
    })

    const result = await createLeaveRequest('org-1', buildLeaveForm())
    const insertPayload = tx.leave_requests.create.mock.calls[0]?.[0]?.data as Record<string, any>
    const approvalPayload = tx.approval_requests.create.mock.calls[0]?.[0]?.data as Record<string, any>

    expect(result).toEqual({ success: true })
    expect(insertPayload.branch_id).toBe('branch-4')
    expect(insertPayload.days_taken).toBe(3)
    expect(approvalPayload.source_type).toBe('LEAVE_REQUEST')
    expect(approvalPayload.source_id).toBe('leave-new')
    expect(approvalPayload.requester_id).toBe('requester-1')
  })

  it('validates branch access before approving a leave request', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'approver-1' } })
    mocks.prisma.leave_requests.findFirst.mockResolvedValue({
      id: 'leave-1',
      org_id: 'org-1',
      branch_id: 'branch-2',
      status: 'PENDING',
    })
    const tx = {
      leave_requests: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      approval_requests: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    }
    mocks.prisma.$transaction.mockImplementation(async (fn: any) => fn(tx))
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranchIds: ['branch-2'] },
      branchId: 'branch-2',
    })

    const result = await approveLeaveRequest('leave-1')
    const leaveUpdateWhere = tx.leave_requests.updateMany.mock.calls[0]?.[0]?.where
    const approvalUpdateWhere = tx.approval_requests.updateMany.mock.calls[0]?.[0]?.where

    expect(result).toEqual({ success: true })
    expect(leaveUpdateWhere.branch_id).toBe('branch-2')
    expect(approvalUpdateWhere.branch_id).toBe('branch-2')
  })

  it('rejects leave requests only inside the accessible branch', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'approver-1' } })
    mocks.prisma.leave_requests.findFirst.mockResolvedValue({
      id: 'leave-2',
      org_id: 'org-1',
      branch_id: 'branch-5',
      status: 'PENDING',
    })
    const tx = {
      leave_requests: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      approval_requests: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    }
    mocks.prisma.$transaction.mockImplementation(async (fn: any) => fn(tx))
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranchIds: ['branch-5'] },
      branchId: 'branch-5',
    })

    const result = await rejectLeaveRequest('leave-2')
    const leaveUpdateWhere = tx.leave_requests.updateMany.mock.calls[0]?.[0]?.where
    const approvalUpdateWhere = tx.approval_requests.updateMany.mock.calls[0]?.[0]?.where

    expect(result).toEqual({ success: true })
    expect(leaveUpdateWhere.branch_id).toBe('branch-5')
    expect(approvalUpdateWhere.branch_id).toBe('branch-5')
  })
})
