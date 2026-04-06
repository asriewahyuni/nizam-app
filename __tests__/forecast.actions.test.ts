import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    bank_accounts: { findMany: vi.fn() },
    journal_entries: { findMany: vi.fn() },
    journal_lines: { findMany: vi.fn() },
    sales: { findMany: vi.fn() },
    sales_payments: { findMany: vi.fn() },
    sales_returns: { findMany: vi.fn() },
    purchases: { findMany: vi.fn() },
    purchase_payments: { findMany: vi.fn() },
    purchase_returns: { findMany: vi.fn() },
  },
  getAuthUser: vi.fn(),
  getMembership: vi.fn(),
  resolveAccessibleBranchSelection: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }))
vi.mock('@/lib/auth/permissions', () => ({ getAuthUser: mocks.getAuthUser, getMembership: mocks.getMembership }))
vi.mock('@/modules/organization/lib/branch-access.server', () => ({ resolveAccessibleBranchSelection: mocks.resolveAccessibleBranchSelection }))

import { getCashFlowForecast } from '@/modules/accounting/actions/forecast.actions'

describe('Forecast Branch Context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAuthUser.mockResolvedValue({ userId: 'user-1' })
    mocks.getMembership.mockResolvedValue({ memberId: 'member-1', orgId: 'org-1', userId: 'user-1', role: 'admin', roleId: null, permissions: [], isOwner: false, isAdmin: true, isOwnerOrAdmin: true })
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({ scope: { accessibleBranchIds: ['branch-1'] }, branchId: 'branch-1' })
  })

  it('scopes current cash, inflow, and outflow to the active branch', async () => {
    mocks.prisma.bank_accounts.findMany.mockResolvedValue([{ accounts: { code: '1101' } }])
    mocks.prisma.journal_entries.findMany.mockResolvedValue([{ id: 'je-1' }])
    mocks.prisma.journal_lines.findMany.mockResolvedValue([{ debit: 500000, credit: 0 }])
    mocks.prisma.sales.findMany.mockResolvedValue([{ id: 'sale-1', grand_total: 150000, due_date: null, sale_number: 'SO-001' }])
    mocks.prisma.sales_payments.findMany.mockResolvedValue([])
    mocks.prisma.sales_returns.findMany.mockResolvedValue([])
    mocks.prisma.purchases.findMany.mockResolvedValue([{ id: 'purchase-1', grand_total: 40000, due_date: null, purchase_number: 'PO-001' }])
    mocks.prisma.purchase_payments.findMany.mockResolvedValue([])
    mocks.prisma.purchase_returns.findMany.mockResolvedValue([])

    const result = await getCashFlowForecast('org-1', 1, 'branch-1')

    expect(result.currentCash).toBe(500000)
    expect(result.totalProjectedInflow).toBe(150000)
    expect(result.totalProjectedOutflow).toBe(40000)
    expect(result.forecast[0]?.balance).toBe(610000)
    expect(mocks.prisma.journal_entries.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ branch_id: 'branch-1' }) }))
    expect(mocks.prisma.sales.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ branch_id: 'branch-1' }) }))
    expect(mocks.prisma.purchases.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ branch_id: 'branch-1' }) }))
  })

  it('uses outstanding balances for PARTIAL documents instead of full totals', async () => {
    mocks.prisma.bank_accounts.findMany.mockResolvedValue([{ accounts: { code: '1101' } }])
    mocks.prisma.journal_entries.findMany.mockResolvedValue([{ id: 'je-1' }])
    mocks.prisma.journal_lines.findMany.mockResolvedValue([{ debit: 500000, credit: 0 }])
    mocks.prisma.sales.findMany.mockResolvedValue([{ id: 'sale-1', grand_total: 1000000, due_date: null, sale_number: 'SO-TEST-01' }])
    mocks.prisma.sales_payments.findMany.mockResolvedValue([{ sale_id: 'sale-1', amount: 400000, discount_amount: 0 }])
    mocks.prisma.sales_returns.findMany.mockResolvedValue([])
    mocks.prisma.purchases.findMany.mockResolvedValue([{ id: 'purchase-1', grand_total: 800000, due_date: null, purchase_number: 'PO-TEST-01' }])
    mocks.prisma.purchase_payments.findMany.mockResolvedValue([{ purchase_id: 'purchase-1', amount: 300000, discount_amount: 0 }])
    mocks.prisma.purchase_returns.findMany.mockResolvedValue([])

    const result = await getCashFlowForecast('org-1', 1, 'branch-1')

    expect(result.totalProjectedInflow).toBe(600000)
    expect(result.totalProjectedOutflow).toBe(500000)
    expect(result.forecast[0]?.inflow).toBe(600000)
    expect(result.forecast[0]?.outflow).toBe(500000)
    expect(result.forecast[0]?.balance).toBe(600000)
  })
})
