import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    journal_entries: { findMany: vi.fn() },
    journal_lines: { findMany: vi.fn() },
    sales: { findMany: vi.fn(), count: vi.fn() },
    purchases: { count: vi.fn() },
    fixed_assets: { count: vi.fn() },
    employees: { count: vi.fn() },
    payroll_runs: { count: vi.fn() },
  },
  getAuthUser: vi.fn(),
  getMembership: vi.fn(),
  resolveAccessibleBranchSelection: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }))
vi.mock('@/lib/auth/permissions', () => ({ getAuthUser: mocks.getAuthUser, getMembership: mocks.getMembership }))
vi.mock('@/modules/organization/lib/branch-access.server', () => ({ resolveAccessibleBranchSelection: mocks.resolveAccessibleBranchSelection }))

import { getBSCMetrics } from '@/modules/accounting/actions/bsc.actions'

describe('BSC Branch Context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAuthUser.mockResolvedValue({ userId: 'user-1' })
    mocks.getMembership.mockResolvedValue({ memberId: 'member-1', orgId: 'org-1', userId: 'user-1', role: 'admin', roleId: null, permissions: [], isOwner: false, isAdmin: true, isOwnerOrAdmin: true })
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({ scope: { accessibleBranchIds: ['branch-1'] }, branchId: 'branch-1' })
  })

  it('scopes BSC metrics to the active branch across all underlying modules', async () => {
    mocks.prisma.journal_entries.findMany
      .mockResolvedValueOnce([{ id: 'je-current' }])
      .mockResolvedValueOnce([{ id: 'je-last' }])
    mocks.prisma.journal_lines.findMany
      .mockResolvedValueOnce([
        { debit: 0, credit: 250000, accounts: { type: 'REVENUE', code: '4001' } },
        { debit: 50000, credit: 0, accounts: { type: 'EXPENSE', code: '5001' } },
      ])
      .mockResolvedValueOnce([
        { debit: 0, credit: 100000, accounts: { type: 'REVENUE', code: '4001' } },
      ])
    mocks.prisma.sales.findMany.mockResolvedValue([{ id: 'sale-1', grand_total: 250000, customer_id: 'cust-1' }])
    mocks.prisma.purchases.count.mockResolvedValue(1)
    mocks.prisma.sales.count.mockResolvedValue(2)
    mocks.prisma.fixed_assets.count.mockResolvedValueOnce(3).mockResolvedValueOnce(1)
    mocks.prisma.employees.count.mockResolvedValue(5)
    mocks.prisma.payroll_runs.count.mockResolvedValue(1)

    const result = await getBSCMetrics('org-1', 'branch-1')

    expect(result.financial.currentRevenue).toBe(250000)
    expect(result.financial.currentExpenses).toBe(50000)
    expect(result.customer.totalOrders).toBe(1)
    expect(result.internal.pendingPurchases).toBe(1)
    expect(result.internal.pendingSales).toBe(2)
    expect(result.internal.totalAssets).toBe(3)
    expect(result.learning.activeEmployees).toBe(5)
    expect(result.learning.payrollRunsCompleted).toBe(1)

    expect(mocks.prisma.sales.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ branch_id: 'branch-1' }) }))
    expect(mocks.prisma.purchases.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ branch_id: 'branch-1' }) }))
    expect(mocks.prisma.fixed_assets.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ branch_id: 'branch-1' }) }))
    expect(mocks.prisma.employees.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ branch_id: 'branch-1' }) }))
  })
})
