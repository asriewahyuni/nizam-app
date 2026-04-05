import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getMembership: vi.fn(),
  revalidatePath: vi.fn(),
  resolveAccessibleBranchSelection: vi.fn(),
  prisma: {
    approval_requests: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    reimbursements: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    leave_requests: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    sales: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    purchases: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
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

vi.mock('@/modules/organization/lib/branch-access.server', () => ({
  resolveAccessibleBranchSelection: mocks.resolveAccessibleBranchSelection,
}))

import {
  decideApproval,
  getApprovalDetail,
  getPendingApprovals,
} from '@/modules/organization/actions/approval.actions'

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

function makeBranchSelection(branchId: string | null = 'branch-1') {
  return {
    scope: {
      accessibleBranches: [],
      accessibleBranchIds: branchId ? [branchId] : [],
      canAccessAllBranches: branchId === null,
      membershipId: 'member-1',
      role: 'owner',
    },
    branchId,
  }
}

describe('Approval Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.getMembership.mockResolvedValue(makeMembership())
    mocks.resolveAccessibleBranchSelection.mockResolvedValue(makeBranchSelection())
  })

  it('filters pending approvals by active branch and hydrates requester info', async () => {
    mocks.prisma.approval_requests.findMany.mockResolvedValue([
      {
        id: 'req-1',
        org_id: 'org-1',
        requester_id: 'requester-1',
        approver_id: null,
        source_type: 'SALES_ORDER',
        source_id: 'sale-1',
        status: 'PENDING',
        reason: 'Butuh approval limit kredit',
        notes: null,
        requested_at: new Date('2026-04-05T01:00:00.000Z'),
        decided_at: null,
        updated_at: new Date('2026-04-05T01:00:00.000Z'),
        branch_id: 'branch-1',
      },
    ])
    mocks.prisma.user.findMany.mockResolvedValue([
      {
        id: 'requester-1',
        email: 'staff@example.com',
        name: 'Staff Sales',
      },
    ])

    const result = await getPendingApprovals('org-1', 'branch-1')

    expect(mocks.prisma.approval_requests.findMany).toHaveBeenCalledWith({
      where: {
        org_id: 'org-1',
        status: 'PENDING',
        branch_id: 'branch-1',
      },
      orderBy: {
        requested_at: 'desc',
      },
      select: expect.any(Object),
    })
    expect(result).toEqual([
      expect.objectContaining({
        id: 'req-1',
        source_type: 'SALES_ORDER',
        requester: {
          id: 'requester-1',
          email: 'staff@example.com',
          name: 'Staff Sales',
        },
      }),
    ])
  })

  it('maps reimbursement detail into legacy UI aliases and keeps branch-scoped logs', async () => {
    mocks.prisma.reimbursements.findFirst.mockResolvedValue({
      id: 'reim-1',
      org_id: 'org-1',
      claim_number: 'CLM-001',
      user_id: 'user-2',
      description: 'Perjalanan dinas',
      total_amount: 150000,
      status: 'PENDING',
      notes: 'Harap diproses',
      journal_id: null,
      created_at: new Date('2026-04-05T01:00:00.000Z'),
      updated_at: new Date('2026-04-05T01:00:00.000Z'),
      branch_id: 'branch-1',
      reimbursement_items: [
        {
          id: 'item-1',
          reimbursement_id: 'reim-1',
          expense_date: new Date('2026-04-04T00:00:00.000Z'),
          category_account_id: 'acc-1',
          description: 'Taksi',
          amount: 150000,
          receipt_url: 'https://example.com/receipt.png',
          created_at: new Date('2026-04-05T01:00:00.000Z'),
          accounts: {
            code: '6101',
            name: 'Biaya Transportasi',
          },
        },
      ],
    })
    mocks.prisma.approval_requests.findMany.mockResolvedValue([
      {
        id: 'log-1',
        org_id: 'org-1',
        requester_id: 'requester-1',
        approver_id: null,
        source_type: 'REIMBURSEMENT',
        source_id: 'reim-1',
        status: 'PENDING',
        reason: 'Reimburse perjalanan',
        notes: null,
        requested_at: new Date('2026-04-05T01:00:00.000Z'),
        decided_at: null,
        updated_at: new Date('2026-04-05T01:00:00.000Z'),
        branch_id: 'branch-1',
      },
    ])
    mocks.prisma.user.findMany.mockResolvedValue([
      {
        id: 'requester-1',
        email: 'finance@example.com',
        name: 'Finance Staff',
      },
    ])

    const result = await getApprovalDetail('org-1', 'reim-1', 'REIMBURSEMENT', 'branch-1')

    expect(mocks.prisma.reimbursements.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'reim-1',
        org_id: 'org-1',
        branch_id: 'branch-1',
      },
      include: expect.any(Object),
    })
    expect(mocks.prisma.approval_requests.findMany).toHaveBeenCalledWith({
      where: {
        org_id: 'org-1',
        source_id: 'reim-1',
        source_type: 'REIMBURSEMENT',
        branch_id: 'branch-1',
      },
      orderBy: {
        requested_at: 'asc',
      },
      select: expect.any(Object),
    })
    expect(result).toEqual({
      data: expect.objectContaining({
        claim_number: 'CLM-001',
        items: [
          expect.objectContaining({
            description: 'Taksi',
            amount: 150000,
            account: {
              code: '6101',
              name: 'Biaya Transportasi',
            },
          }),
        ],
      }),
      logs: [
        expect.objectContaining({
          id: 'log-1',
          requester: {
            id: 'requester-1',
            email: 'finance@example.com',
            name: 'Finance Staff',
          },
        }),
      ],
      error: null,
    })
  })

  it('scopes approval decision side effects to the active sales branch', async () => {
    mocks.prisma.approval_requests.findFirst.mockResolvedValue({
      id: 'req-1',
      source_type: 'SALES_ORDER',
      source_id: 'sale-1',
      branch_id: 'branch-1',
    })
    mocks.prisma.approval_requests.update.mockResolvedValue({
      id: 'req-1',
    })
    mocks.prisma.sales.updateMany.mockResolvedValue({ count: 1 })

    const result = await decideApproval('req-1', 'org-1', 'APPROVED', 'OK', 'branch-1')

    expect(result).toEqual({ success: true })
    expect(mocks.prisma.approval_requests.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'req-1',
        org_id: 'org-1',
        branch_id: 'branch-1',
      },
      select: {
        id: true,
        source_type: true,
        source_id: true,
        branch_id: true,
      },
    })
    expect(mocks.prisma.approval_requests.update).toHaveBeenCalledWith({
      where: { id: 'req-1' },
      data: expect.objectContaining({
        status: 'APPROVED',
        notes: 'OK',
        approver_id: 'user-1',
        decided_at: expect.any(Date),
        updated_at: expect.any(Date),
      }),
    })
    expect(mocks.prisma.sales.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'sale-1',
        org_id: 'org-1',
        branch_id: 'branch-1',
      },
      data: {
        status: 'ORDERED',
        updated_at: expect.any(Date),
      },
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/', 'layout')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/accounting/approvals')
  })

  it('scopes reimbursement approval side effects to the active branch', async () => {
    mocks.prisma.approval_requests.findFirst.mockResolvedValue({
      id: 'req-2',
      source_type: 'REIMBURSEMENT',
      source_id: 'reim-1',
      branch_id: 'branch-1',
    })
    mocks.prisma.approval_requests.update.mockResolvedValue({
      id: 'req-2',
    })
    mocks.prisma.reimbursements.updateMany.mockResolvedValue({ count: 1 })

    const result = await decideApproval('req-2', 'org-1', 'REJECTED', 'No', 'branch-1')

    expect(result).toEqual({ success: true })
    expect(mocks.prisma.reimbursements.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'reim-1',
        org_id: 'org-1',
        branch_id: 'branch-1',
      },
      data: {
        status: 'REJECTED',
        updated_at: expect.any(Date),
      },
    })
  })

  it('scopes leave approval side effects to the active branch', async () => {
    mocks.getMembership.mockResolvedValue(
      makeMembership({
        role: 'manager',
        isOwner: false,
        isAdmin: false,
        isOwnerOrAdmin: false,
      })
    )
    mocks.prisma.approval_requests.findFirst.mockResolvedValue({
      id: 'req-3',
      source_type: 'LEAVE_REQUEST',
      source_id: 'leave-1',
      branch_id: 'branch-1',
    })
    mocks.prisma.approval_requests.update.mockResolvedValue({
      id: 'req-3',
    })
    mocks.prisma.leave_requests.updateMany.mockResolvedValue({ count: 1 })

    const result = await decideApproval('req-3', 'org-1', 'APPROVED', 'Approved', 'branch-1')

    expect(result).toEqual({ success: true })
    expect(mocks.prisma.leave_requests.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'leave-1',
        org_id: 'org-1',
        branch_id: 'branch-1',
      },
      data: {
        status: 'APPROVED',
        approved_by: 'user-1',
        approved_at: expect.any(Date),
        updated_at: expect.any(Date),
      },
    })
  })
})
