import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    budgets: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    accounts: {
      findMany: vi.fn(),
    },
    journal_entries: {
      findMany: vi.fn(),
    },
    journal_lines: {
      findMany: vi.fn(),
    },
  },
  getAuthUser: vi.fn(),
  getMembership: vi.fn(),
  revalidatePath: vi.fn(),
  resolveAccessibleBranchSelection: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }))
vi.mock('@/lib/auth/permissions', () => ({ getAuthUser: mocks.getAuthUser, getMembership: mocks.getMembership }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/modules/organization/lib/branch-access.server', () => ({ resolveAccessibleBranchSelection: mocks.resolveAccessibleBranchSelection }))

import { getBudgets, getBudgetVsActual, saveBudget } from '@/modules/accounting/actions/budget.actions'

describe('Budget Branch Context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAuthUser.mockResolvedValue({ userId: 'user-1' })
    mocks.getMembership.mockResolvedValue({ memberId: 'member-1', orgId: 'org-1', userId: 'user-1', role: 'admin', roleId: null, permissions: [], isOwner: false, isAdmin: true, isOwnerOrAdmin: true })
  })

  it('filters budget rows by the active branch', async () => {
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({ scope: { accessibleBranchIds: ['branch-1'] }, branchId: 'branch-1' })
    mocks.prisma.budgets.findMany.mockResolvedValue([])

    await getBudgets('org-1', '2026-04-01', 'branch-1')

    expect(mocks.prisma.budgets.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ org_id: 'org-1', branch_id: 'branch-1' }) }))
  })

  it('stamps branch_id when saving a budget', async () => {
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({ scope: { accessibleBranchIds: ['branch-1'] }, branchId: 'branch-1' })
    mocks.prisma.budgets.findFirst.mockResolvedValue(null)
    mocks.prisma.budgets.create.mockResolvedValue({ id: 'budget-1' })

    const result = await saveBudget('org-1', 'acc-1', '2026-04-01', 1500000)

    expect(result).toEqual({ success: true, branchId: 'branch-1' })
    expect(mocks.prisma.budgets.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ org_id: 'org-1', branch_id: 'branch-1', account_id: 'acc-1', budget_amount: 1500000 }) }))
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/accounting/budgets')
  })

  it('filters budget vs actual calculation by the active branch', async () => {
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({ scope: { accessibleBranchIds: ['branch-1'] }, branchId: 'branch-1' })
    mocks.prisma.accounts.findMany.mockResolvedValue([
      { id: 'acc-revenue', code: '4001', name: 'Penjualan', type: 'REVENUE', normal_balance: 'CREDIT' },
    ])
    mocks.prisma.budgets.findMany.mockResolvedValue([{ account_id: 'acc-revenue', budget_amount: 2000000 }])
    mocks.prisma.journal_entries.findMany.mockResolvedValue([{ id: 'je-1' }])
    mocks.prisma.journal_lines.findMany.mockResolvedValue([{ account_id: 'acc-revenue', debit: 0, credit: 2500000 }])

    const result = await getBudgetVsActual('org-1', '2026-04-01', '2026-04-30', 'branch-1')

    expect(result).toEqual([
      expect.objectContaining({
        account_id: 'acc-revenue',
        budget_amount: 2000000,
        actual_amount: 2500000,
        variance: 500000,
      }),
    ])
    expect(mocks.prisma.budgets.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ branch_id: 'branch-1' }) }))
    expect(mocks.prisma.journal_entries.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ branch_id: 'branch-1' }) }))
  })
})
