import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    accounts: { findMany: vi.fn() },
    sales: { findMany: vi.fn() },
    sales_payments: { findMany: vi.fn() },
    sales_returns: { findMany: vi.fn() },
    purchases: { findMany: vi.fn() },
    purchase_payments: { findMany: vi.fn() },
    purchase_returns: { findMany: vi.fn() },
    journal_entries: { findMany: vi.fn() },
    journal_lines: { findMany: vi.fn() },
  },
  getAuthUser: vi.fn(),
  getMembership: vi.fn(),
  resolveAccessibleBranchSelection: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }))
vi.mock('@/lib/auth/permissions', () => ({ getAuthUser: mocks.getAuthUser, getMembership: mocks.getMembership }))
vi.mock('@/modules/organization/lib/branch-access.server', () => ({ resolveAccessibleBranchSelection: mocks.resolveAccessibleBranchSelection }))

import { getAgingReport } from '@/modules/accounting/actions/aging.actions'

describe('Aging Branch Context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    mocks.getAuthUser.mockResolvedValue({ userId: 'user-1' })
    mocks.getMembership.mockResolvedValue({ memberId: 'member-1', orgId: 'org-1', userId: 'user-1', role: 'admin', roleId: null, permissions: [], isOwner: false, isAdmin: true, isOwnerOrAdmin: true })
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({ scope: { accessibleBranchIds: ['branch-1'] }, branchId: 'branch-1' })
  })

  it('filters AR aging data and GL reconciliation by active branch', async () => {
    mocks.prisma.accounts.findMany.mockResolvedValue([{ id: 'acc-ar', code: '1201' }])
    mocks.prisma.sales.findMany.mockResolvedValue([])
    mocks.prisma.journal_entries.findMany.mockResolvedValue([{ id: 'je-1' }])
    mocks.prisma.journal_lines.findMany.mockResolvedValue([
      { debit: 100000, credit: 0, accounts: { code: '1201', type: 'ASSET' } },
    ])

    const result = await getAgingReport('org-1', 'AR', 'branch-1')

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          doc_number: 'GL-1201-ADJ',
          outstanding: 100000,
          source_type: 'JOURNAL',
        }),
      ])
    )

    expect(mocks.prisma.sales.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          org_id: 'org-1',
          OR: [{ branch_id: 'branch-1' }, { branch_id: null }],
        }),
      })
    )
    expect(mocks.prisma.journal_entries.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          org_id: 'org-1',
          status: 'POSTED',
          branch_id: 'branch-1',
        }),
      })
    )
  })

  it('uses Asia/Jakarta business date when bucketing due dates around midnight UTC', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-03T18:30:00.000Z'))

    mocks.prisma.accounts.findMany.mockResolvedValue([{ id: 'acc-ar', code: '1201' }])
    mocks.prisma.sales.findMany.mockResolvedValue([
      {
        id: 'sale-1',
        sale_number: 'SO-001',
        sale_date: new Date('2026-04-04T00:00:00.000Z'),
        due_date: new Date('2026-04-04T00:00:00.000Z'),
        grand_total: 100000,
        contacts: { name: 'PT Test' },
      },
    ])
    mocks.prisma.sales_payments.findMany.mockResolvedValue([])
    mocks.prisma.sales_returns.findMany.mockResolvedValue([])
    mocks.prisma.journal_entries.findMany.mockResolvedValue([])

    const result = await getAgingReport('org-1', 'AR', 'branch-1')
    const row = result.find((item) => item.doc_number === 'SO-001')

    expect(row).toEqual(expect.objectContaining({ aging_bucket: 'Current', days_overdue: 0 }))
  })

})
