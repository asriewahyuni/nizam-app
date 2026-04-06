import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    journal_entries: {
      findMany: vi.fn(),
    },
    journal_lines: {
      findMany: vi.fn(),
    },
    bank_accounts: {
      findMany: vi.fn(),
    },
  },
  getAuthUser: vi.fn(),
  getMembership: vi.fn(),
  resolveAccessibleBranchSelection: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}))

vi.mock('@/lib/auth/permissions', () => ({
  getAuthUser: mocks.getAuthUser,
  getMembership: mocks.getMembership,
}))

vi.mock('@/modules/organization/lib/branch-access.server', () => ({
  resolveAccessibleBranchSelection: mocks.resolveAccessibleBranchSelection,
}))

import { getCashFlow, getGeneralLedger, getProfitLoss } from '@/modules/accounting/actions/reports.actions'

describe('Reports Branch Context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAuthUser.mockResolvedValue({ userId: 'user-1' })
    mocks.getMembership.mockResolvedValue({ memberId: 'member-1', orgId: 'org-1', userId: 'user-1', role: 'admin', roleId: null, permissions: [], isOwner: false, isAdmin: true, isOwnerOrAdmin: true })
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({ scope: { accessibleBranchIds: ['branch-1'] }, branchId: 'branch-1' })
  })

  it('filters general ledger by active branch', async () => {
    mocks.prisma.journal_entries.findMany.mockResolvedValue([
      {
        id: 'je-1',
        org_id: 'org-1',
        entry_number: 'JE-1',
        entry_date: new Date('2026-04-01T00:00:00.000Z'),
        description: 'Entry',
        reference_type: 'MANUAL',
        reference_id: null,
        status: 'POSTED',
        is_auto: false,
        notes: null,
        created_by: null,
        posted_at: null,
        voided_at: null,
        voided_by: null,
        void_reason: null,
        created_at: new Date('2026-04-01T00:00:00.000Z'),
        updated_at: new Date('2026-04-01T00:00:00.000Z'),
        branch_id: 'branch-1',
        journal_lines: [],
      },
    ])

    const result = await getGeneralLedger('org-1', 'branch-1')

    expect(result).toEqual([expect.objectContaining({ id: 'je-1', branch_id: 'branch-1', journal_lines: [] })])
    expect(mocks.prisma.journal_entries.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ org_id: 'org-1', status: 'POSTED', branch_id: 'branch-1' }) }))
  })

  it('scopes profit and loss calculations to the active branch', async () => {
    mocks.prisma.journal_entries.findMany.mockResolvedValue([{ id: 'je-1' }])
    mocks.prisma.journal_lines.findMany.mockResolvedValue([
      {
        debit: 0,
        credit: 125000,
        accounts: {
          id: 'acc-rev',
          code: '4001',
          name: 'Penjualan',
          type: 'REVENUE',
          normal_balance: 'CREDIT',
          cash_flow_category: 'OPERATING',
        },
      },
      {
        debit: 25000,
        credit: 0,
        accounts: {
          id: 'acc-exp',
          code: '5001',
          name: 'Beban Operasional',
          type: 'EXPENSE',
          normal_balance: 'DEBIT',
          cash_flow_category: 'OPERATING',
        },
      },
    ])

    const result = await getProfitLoss('org-1', '2026-04-01', '2026-04-30', 'branch-1')

    expect(result.totalRevenue).toBe(125000)
    expect(result.totalExpenses).toBe(25000)
    expect(result.netProfit).toBe(100000)
    expect(mocks.prisma.journal_entries.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ branch_id: 'branch-1' }) }))
    expect(mocks.prisma.journal_lines.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ entry_id: { in: ['je-1'] } }) }))
  })

  it('uses branch-scoped journal entries when calculating cash flow trends', async () => {
    mocks.prisma.bank_accounts.findMany.mockResolvedValue([{ accounts: { code: '1101' } }])
    mocks.prisma.journal_entries.findMany
      .mockResolvedValueOnce([{ id: 'je-all' }])
      .mockResolvedValueOnce([{ id: 'je-current' }])
      .mockResolvedValueOnce([{ id: 'je-last' }])
    mocks.prisma.journal_lines.findMany
      .mockResolvedValueOnce([
        {
          debit: 0,
          credit: 200000,
          accounts: {
            id: 'acc-rev',
            code: '4001',
            name: 'Penjualan',
            type: 'REVENUE',
            normal_balance: 'CREDIT',
            cash_flow_category: 'OPERATING',
          },
        },
      ])
      .mockResolvedValueOnce([{ debit: 75000, credit: 0, accounts: { code: '1101' } }])
      .mockResolvedValueOnce([{ debit: 50000, credit: 0, accounts: { code: '1101' } }])

    const result = await getCashFlow('org-1', 'branch-1')

    expect(result.ocf).toBe(200000)
    expect(mocks.prisma.journal_entries.findMany).toHaveBeenCalledTimes(3)
    mocks.prisma.journal_entries.findMany.mock.calls.forEach(([args]: any[]) => {
      expect(args.where.branch_id).toBe('branch-1')
    })
  })
})
