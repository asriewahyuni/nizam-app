import { beforeEach, describe, expect, it, vi } from 'vitest'

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

import { decideApproval, getPendingApprovals } from '@/modules/organization/actions/approval.actions'

describe('Approval Branch Context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filters pending approvals by active branch', async () => {
    const orderMock = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    })
    const approvalQuery = {
      select: vi.fn(() => approvalQuery),
      eq: vi.fn(() => approvalQuery),
      order: orderMock,
    }

    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table !== 'approval_requests') throw new Error(`Unexpected table ${table}`)
        return approvalQuery
      }),
    })
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranches: [], accessibleBranchIds: ['branch-1'], canAccessAllBranches: false, membershipId: 'member-1', role: 'staff' },
      branchId: 'branch-1',
    })

    await getPendingApprovals('org-1', 'branch-1')

    expect(approvalQuery.eq).toHaveBeenCalledWith('org_id', 'org-1')
    expect(approvalQuery.eq).toHaveBeenCalledWith('status', 'PENDING')
    expect(approvalQuery.eq).toHaveBeenCalledWith('branch_id', 'branch-1')
  })

  it('scopes approval decision to the active branch', async () => {
    const requestLookup = {
      select: vi.fn(() => requestLookup),
      eq: vi.fn(() => requestLookup),
      single: vi.fn().mockResolvedValue({
        data: {
          source_type: 'SALES_ORDER',
          source_id: 'sale-1',
          branch_id: 'branch-1',
        },
        error: null,
      }),
    }
    const approvalUpdateEq = vi.fn(() => approvalUpdate)
    const approvalUpdate = {
      eq: approvalUpdateEq,
    }
    const approvalTable = {
      select: vi.fn(() => requestLookup),
      update: vi.fn(() => approvalUpdate),
    }
    const salesUpdateEq = vi.fn(() => salesUpdate)
    const salesUpdate = {
      eq: salesUpdateEq,
    }
    const salesTable = {
      update: vi.fn(() => salesUpdate),
    }

    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'approver-1' } },
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'approval_requests') return approvalTable
        if (table === 'sales') return salesTable
        throw new Error(`Unexpected table ${table}`)
      }),
    })
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranches: [], accessibleBranchIds: ['branch-1'], canAccessAllBranches: false, membershipId: 'member-1', role: 'staff' },
      branchId: 'branch-1',
    })

    const result = await decideApproval('req-1', 'org-1', 'APPROVED', 'OK', 'branch-1')

    expect(result).toEqual({ success: true })
    expect(requestLookup.eq).toHaveBeenCalledWith('branch_id', 'branch-1')
    expect(approvalUpdateEq).toHaveBeenCalledWith('branch_id', 'branch-1')
    expect(salesUpdateEq).toHaveBeenCalledWith('branch_id', 'branch-1')
  })

  it('scopes reimbursement approval side effects to the active branch', async () => {
    const requestLookup = {
      select: vi.fn(() => requestLookup),
      eq: vi.fn(() => requestLookup),
      single: vi.fn().mockResolvedValue({
        data: {
          source_type: 'REIMBURSEMENT',
          source_id: 'reim-1',
          branch_id: 'branch-1',
        },
        error: null,
      }),
    }
    const approvalUpdateEq = vi.fn(() => approvalUpdate)
    const approvalUpdate = {
      eq: approvalUpdateEq,
    }
    const approvalTable = {
      select: vi.fn(() => requestLookup),
      update: vi.fn(() => approvalUpdate),
    }
    const reimburseUpdateEq = vi.fn(() => reimburseUpdate)
    const reimburseUpdate = {
      eq: reimburseUpdateEq,
    }
    const reimbursementsTable = {
      update: vi.fn(() => reimburseUpdate),
    }

    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'approver-1' } },
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'approval_requests') return approvalTable
        if (table === 'reimbursements') return reimbursementsTable
        throw new Error(`Unexpected table ${table}`)
      }),
    })
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranches: [], accessibleBranchIds: ['branch-1'], canAccessAllBranches: false, membershipId: 'member-1', role: 'staff' },
      branchId: 'branch-1',
    })

    const result = await decideApproval('req-2', 'org-1', 'REJECTED', 'No', 'branch-1')

    expect(result).toEqual({ success: true })
    expect(requestLookup.eq).toHaveBeenCalledWith('branch_id', 'branch-1')
    expect(approvalUpdateEq).toHaveBeenCalledWith('branch_id', 'branch-1')
    expect(reimburseUpdateEq).toHaveBeenCalledWith('branch_id', 'branch-1')
  })
})
