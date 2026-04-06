import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    bank_accounts: { findFirst: vi.fn() },
    bank_mutations: { createMany: vi.fn() },
  },
  revalidatePath: vi.fn(),
  resolveAccessibleBranchSelection: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/modules/organization/lib/branch-access.server', () => ({ resolveAccessibleBranchSelection: mocks.resolveAccessibleBranchSelection }))

import { processBankCSV } from '@/modules/cash/actions/reconcile.actions'

describe('Bank Reconciliation CSV Parsing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.prisma.bank_accounts.findFirst.mockResolvedValue({ id: 'bank-1', branch_id: 'branch-1' })
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({ scope: { accessibleBranchIds: ['branch-1'] }, branchId: 'branch-1' })
  })

  it('rejects empty CSV files with a clear validation error', async () => {
    const result = await processBankCSV('org-1', 'bank-1', '\n')
    expect(result).toEqual({ error: 'File CSV kosong.' })
  })

  it('parses quoted descriptions containing commas correctly', async () => {
    mocks.prisma.bank_mutations.createMany.mockResolvedValue({ count: 1 })
    const csv = `date,description,amount,type,balance
2026-04-04,"TRANSFER, BIAYA ADMIN",-2500,OUT,997500`

    const result = await processBankCSV('org-1', 'bank-1', csv)

    expect(result).toEqual({ success: true, count: 1 })
    expect(mocks.prisma.bank_mutations.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.arrayContaining([expect.objectContaining({ description: 'TRANSFER, BIAYA ADMIN', amount: 2500, type: 'OUT', balance: 997500, branch_id: 'branch-1' })]) }))
  })

  it('supports DD/MM/YYYY dates from bank exports', async () => {
    mocks.prisma.bank_mutations.createMany.mockResolvedValue({ count: 1 })
    const csv = `date,description,amount,type,balance
04/04/2026,Setoran Tunai,50000,IN,1047500`

    const result = await processBankCSV('org-1', 'bank-1', csv)

    expect(result).toEqual({ success: true, count: 1 })
    expect(mocks.prisma.bank_mutations.createMany).toHaveBeenCalled()
  })
})
