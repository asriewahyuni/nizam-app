import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
  resolveAccessibleBranchSelection: vi.fn(),
  createJournalEntry: vi.fn(),
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

vi.mock('@/modules/accounting/actions/journal.actions', () => ({
  createJournalEntry: mocks.createJournalEntry,
}))

import { approveReimbursement, getReimbursements, payReimbursement, rejectReimbursement, submitReimbursement } from '@/modules/accounting/actions/reimburse.actions'

describe('Reimbursement Branch Context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filters reimbursements by active branch', async () => {
    const orderMock = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    })
    const reimburseQuery = {
      select: vi.fn(() => reimburseQuery),
      eq: vi.fn(() => reimburseQuery),
      order: orderMock,
    }

    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table !== 'reimbursements') throw new Error(`Unexpected table ${table}`)
        return reimburseQuery
      }),
    })
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranches: [], accessibleBranchIds: ['branch-1'], canAccessAllBranches: false, membershipId: 'member-1', role: 'staff' },
      branchId: 'branch-1',
    })

    await getReimbursements('org-1', 'branch-1')

    expect(reimburseQuery.eq).toHaveBeenCalledWith('org_id', 'org-1')
    expect(reimburseQuery.eq).toHaveBeenCalledWith('branch_id', 'branch-1')
  })

  it('rejects reimbursement submission when no active branch is selected', async () => {
    const fromMock = vi.fn()

    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranches: [], accessibleBranchIds: [], canAccessAllBranches: false, membershipId: 'member-1', role: 'staff' },
      branchId: null,
    })
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
        }),
      },
      from: fromMock,
    })

    const result = await submitReimbursement('org-1', {
      description: 'Perjalanan Dinas',
      items: [
        {
          expense_date: '2026-04-03',
          category_account_id: 'acc-1',
          description: 'Taksi',
          amount: 100000,
          receipt_url: 'https://example.com/nota.jpg',
        },
      ],
    })

    expect(result).toEqual({
      error: 'Pilih unit aktif terlebih dahulu untuk mengajukan reimbursement.',
    })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('stamps active branch on reimbursement and approval request', async () => {
    const reimbursementSingle = vi.fn().mockResolvedValue({
      data: { id: 'reim-1' },
      error: null,
    })
    const reimbursementInsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: reimbursementSingle,
      })),
    }))
    const reimbursementDelete = vi.fn(() => ({
      eq: vi.fn(),
    }))
    const itemsInsert = vi.fn().mockResolvedValue({ error: null })
    const approvalInsert = vi.fn().mockResolvedValue({ error: null })

    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranches: [], accessibleBranchIds: ['branch-1'], canAccessAllBranches: false, membershipId: 'member-1', role: 'staff' },
      branchId: 'branch-1',
    })
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'reimbursements') {
          return {
            insert: reimbursementInsert,
            delete: reimbursementDelete,
          }
        }
        if (table === 'reimbursement_items') {
          return { insert: itemsInsert }
        }
        if (table === 'approval_requests') {
          return { insert: approvalInsert }
        }
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const result = await submitReimbursement('org-1', {
      description: 'Perjalanan Dinas',
      items: [
        {
          expense_date: '2026-04-03',
          category_account_id: 'acc-1',
          description: 'Taksi',
          amount: 100000,
          receipt_url: 'https://example.com/nota.jpg',
        },
      ],
    })

    expect(result).toEqual({ success: true, id: 'reim-1' })
    expect(reimbursementInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-1',
        branch_id: 'branch-1',
        user_id: 'user-1',
      })
    )
    expect(approvalInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-1',
        branch_id: 'branch-1',
        source_id: 'reim-1',
      })
    )
  })

  it('passes reimbursement branch into payment journal entry', async () => {
    const reimbursementQuery = {
      select: vi.fn(() => reimbursementQuery),
      eq: vi.fn(() => reimbursementQuery),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'reim-1',
          org_id: 'org-1',
          branch_id: 'branch-1',
          claim_number: 'REIMB-2026-0001',
          description: 'Perjalanan',
          total_amount: 150000,
          status: 'APPROVED',
          items: [
            { category_account_id: 'acc-exp', amount: 150000 },
          ],
        },
        error: null,
      }),
    }
    const bankQuery = {
      select: vi.fn(() => bankQuery),
      eq: vi.fn(() => bankQuery),
      single: vi.fn().mockResolvedValue({
        data: { account_id: 'acc-bank' },
        error: null,
      }),
    }
    const reimbursementUpdateEq = vi.fn(() => reimbursementUpdate)
    const reimbursementUpdate = {
      eq: reimbursementUpdateEq,
    }
    const reimbursementsTable = {
      select: vi.fn(() => reimbursementQuery),
      update: vi.fn(() => reimbursementUpdate),
    }

    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranches: [], accessibleBranchIds: ['branch-1'], canAccessAllBranches: false, membershipId: 'member-1', role: 'staff' },
      branchId: 'branch-1',
    })
    mocks.createJournalEntry.mockResolvedValue({
      success: true,
      entryId: 'je-1',
    })
    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'reimbursements') return reimbursementsTable
        if (table === 'bank_accounts') return bankQuery
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const result = await payReimbursement('reim-1', 'org-1', 'bank-1')

    expect(result).toEqual({ success: true })
    expect(mocks.createJournalEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-1',
        branch_id: 'branch-1',
        reference_id: 'reim-1',
      })
    )
    expect(reimbursementQuery.eq).toHaveBeenCalledWith('branch_id', 'branch-1')
    expect(reimbursementUpdateEq).toHaveBeenCalledWith('branch_id', 'branch-1')
  })

  it('syncs approval request when approving reimbursement from the reimbursement page', async () => {
    const reimbursementUpdateEq = vi.fn(() => reimbursementUpdate)
    const reimbursementUpdate = {
      eq: reimbursementUpdateEq,
    }
    const approvalUpdateEq = vi.fn(() => approvalUpdate)
    const approvalUpdate = {
      eq: approvalUpdateEq,
    }

    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranches: [], accessibleBranchIds: ['branch-1'], canAccessAllBranches: false, membershipId: 'member-1', role: 'manager' },
      branchId: 'branch-1',
    })
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'approver-1' } },
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'reimbursements') {
          return { update: vi.fn(() => reimbursementUpdate) }
        }
        if (table === 'approval_requests') {
          return { update: vi.fn(() => approvalUpdate) }
        }
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const result = await approveReimbursement('reim-1', 'org-1')

    expect(result).toEqual({ success: true })
    expect(reimbursementUpdateEq).toHaveBeenCalledWith('branch_id', 'branch-1')
    expect(approvalUpdateEq).toHaveBeenCalledWith('branch_id', 'branch-1')
    expect(approvalUpdateEq).toHaveBeenCalledWith('source_id', 'reim-1')
    expect(approvalUpdateEq).toHaveBeenCalledWith('status', 'PENDING')
  })

  it('syncs rejection notes back to approval request when rejecting reimbursement directly', async () => {
    const reimbursementUpdateEq = vi.fn(() => reimbursementUpdate)
    const reimbursementUpdate = {
      eq: reimbursementUpdateEq,
    }
    const approvalUpdateEq = vi.fn(() => approvalUpdate)
    const approvalUpdate = {
      eq: approvalUpdateEq,
    }
    const approvalUpdateSpy = vi.fn(() => approvalUpdate)

    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranches: [], accessibleBranchIds: ['branch-1'], canAccessAllBranches: false, membershipId: 'member-1', role: 'manager' },
      branchId: 'branch-1',
    })
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'approver-1' } },
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'reimbursements') {
          return { update: vi.fn(() => reimbursementUpdate) }
        }
        if (table === 'approval_requests') {
          return { update: approvalUpdateSpy }
        }
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const result = await rejectReimbursement('reim-1', 'org-1', 'Budget tidak valid')

    expect(result).toEqual({ success: true })
    expect(reimbursementUpdateEq).toHaveBeenCalledWith('branch_id', 'branch-1')
    expect(approvalUpdateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'REJECTED',
        notes: 'Budget tidak valid',
        approver_id: 'approver-1',
      })
    )
    expect(approvalUpdateEq).toHaveBeenCalledWith('branch_id', 'branch-1')
    expect(approvalUpdateEq).toHaveBeenCalledWith('source_id', 'reim-1')
  })
})
