import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    expense_claims: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
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
  approveExpenseClaim,
  createExpenseClaim,
  deleteExpenseClaim,
  getExpenseClaims,
} from '@/modules/hris/actions/expense.actions'

function buildExpenseForm(overrides: Record<string, string> = {}) {
  const formData = new FormData()
  formData.set('employee_id', overrides.employee_id || 'emp-1')
  formData.set('amount', overrides.amount || '125000')
  formData.set('category', overrides.category || 'Supplies')
  formData.set('description', overrides.description || 'Pembelian perlengkapan')
  formData.set('claim_date', overrides.claim_date || '2026-04-03')
  return formData
}

describe('Expense Claim Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filters expense claims by resolved branch selection', async () => {
    mocks.prisma.expense_claims.findMany.mockResolvedValue([])
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranchIds: ['branch-1'] },
      branchId: 'branch-1',
    })

    await getExpenseClaims('org-1')

    const findManyArgs = mocks.prisma.expense_claims.findMany.mock.calls[0]?.[0]
    expect(findManyArgs.where.branch_id).toBe('branch-1')
  })

  it('derives branch_id from employee when creating a claim', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.prisma.employees.findFirst.mockResolvedValue({
      id: 'emp-1',
      branch_id: 'branch-2',
    })
    mocks.prisma.expense_claims.create.mockResolvedValue({ id: 'claim-new' })
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranchIds: ['branch-2'] },
      branchId: 'branch-2',
    })

    const result = await createExpenseClaim('org-1', buildExpenseForm())
    const insertPayload = mocks.prisma.expense_claims.create.mock.calls[0]?.[0]?.data as Record<string, any>

    expect(result).toEqual({ success: true })
    expect(insertPayload.branch_id).toBe('branch-2')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/hris')
  })

  it('validates claim branch before approving', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'approver-1' } })
    mocks.prisma.expense_claims.findFirst.mockResolvedValue({
      id: 'claim-1',
      org_id: 'org-1',
      branch_id: 'branch-1',
      employee_id: 'emp-1',
      status: 'PENDING',
      amount: 125000,
      description: 'Pembelian perlengkapan',
      claim_date: new Date('2026-04-03T00:00:00.000Z'),
    })
    const tx = {
      journal_entries: { create: vi.fn().mockResolvedValue({ id: 'je-1' }) },
      journal_lines: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
      expense_claims: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    }
    mocks.prisma.$transaction.mockImplementation(async (fn: any) => fn(tx))
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranchIds: ['branch-1'] },
      branchId: 'branch-1',
    })

    const result = await approveExpenseClaim('claim-1', 'acc-exp', 'acc-payable')

    expect(result).toEqual({ success: true })
    expect(tx.journal_entries.create).toHaveBeenCalled()
    expect(tx.journal_lines.createMany).toHaveBeenCalled()
    expect(tx.expense_claims.updateMany).toHaveBeenCalled()
  })

  it('deletes claims only within the accessible branch', async () => {
    mocks.prisma.expense_claims.findFirst.mockResolvedValue({
      id: 'claim-1',
      org_id: 'org-1',
      branch_id: 'branch-1',
    })
    mocks.prisma.expense_claims.deleteMany.mockResolvedValue({ count: 1 })
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranchIds: ['branch-1'] },
      branchId: 'branch-1',
    })

    const result = await deleteExpenseClaim('claim-1')
    const deleteWhere = mocks.prisma.expense_claims.deleteMany.mock.calls[0]?.[0]?.where

    expect(result).toEqual({ success: true })
    expect(deleteWhere.branch_id).toBe('branch-1')
  })
})
