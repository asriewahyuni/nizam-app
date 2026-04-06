import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    accounts: { findMany: vi.fn() },
    journal_entries: { findMany: vi.fn() },
    journal_lines: { findMany: vi.fn() },
  },
  resolveAccessibleBranchSelection: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }))
vi.mock('@/modules/organization/lib/branch-access.server', () => ({ resolveAccessibleBranchSelection: mocks.resolveAccessibleBranchSelection }))

import { getTaxSummary } from '@/modules/accounting/actions/tax.actions'

describe('Tax Branch Context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filters tax journal entries by the active branch', async () => {
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({ scope: { accessibleBranchIds: ['branch-1'] }, branchId: 'branch-1' })
    mocks.prisma.accounts.findMany.mockResolvedValue([{ id: 'acc-vat-in', code: '1401' }])
    mocks.prisma.journal_entries.findMany.mockResolvedValue([{ id: 'je-1' }])
    mocks.prisma.journal_lines.findMany.mockResolvedValue([
      {
        debit: 11000,
        credit: 0,
        memo: 'PPN Masukan',
        accounts: { id: 'acc-vat-in', code: '1401', name: 'PPN Masukan', type: 'ASSET', normal_balance: 'DEBIT' },
        journal_entries: { entry_number: 'JE-1', entry_date: new Date('2026-04-03T00:00:00.000Z'), description: 'Pembelian' },
      },
    ])

    const result = await getTaxSummary('org-1', '2026-04-01', '2026-04-30', 'branch-1')

    expect(result.vatIn.total).toBe(11000)
    expect(mocks.prisma.journal_entries.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ org_id: 'org-1', branch_id: 'branch-1' }) }))
  })
})
