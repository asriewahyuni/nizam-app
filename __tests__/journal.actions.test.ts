import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  prisma: {
    $transaction: vi.fn(),
    journal_entries: {
      updateMany: vi.fn(),
    },
  },
  revalidatePath: vi.fn(),
  resolveAccessibleBranchSelection: vi.fn(),
}))

vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/modules/organization/lib/branch-access.server', () => ({ resolveAccessibleBranchSelection: mocks.resolveAccessibleBranchSelection }))

import { createJournalEntry } from '@/modules/accounting/actions/journal.actions'

describe('Journal Branch Guardrails', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
  })

  it('rejects manual journal creation when no active branch is selected', async () => {
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({ scope: { accessibleBranchIds: [] }, branchId: null })

    const result = await createJournalEntry({
      org_id: 'org-1',
      entry_date: '2026-04-03',
      description: 'Jurnal test',
      lines: [
        { account_id: 'acc-1', debit: 1000, credit: 0 },
        { account_id: 'acc-2', debit: 0, credit: 1000 },
      ],
    })

    expect(result).toEqual({ error: 'Pilih unit aktif terlebih dahulu untuk membuat jurnal manual.' })
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled()
  })

  it('stamps the resolved active branch onto manual journals', async () => {
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({ scope: { accessibleBranchIds: ['branch-1'] }, branchId: 'branch-1' })
    mocks.prisma.$transaction.mockImplementation(async (callback: any) => callback({
      journal_entries: { create: vi.fn().mockResolvedValue({ id: 'je-1', entry_number: 'JR-001' }) },
      journal_lines: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
    }))

    const result = await createJournalEntry({
      org_id: 'org-1',
      entry_date: '2026-04-03',
      description: 'Jurnal test',
      lines: [
        { account_id: 'acc-1', debit: 1000, credit: 0 },
        { account_id: 'acc-2', debit: 0, credit: 1000 },
      ],
    })

    expect(mocks.prisma.$transaction).toHaveBeenCalled()
    const transactionCallback = mocks.prisma.$transaction.mock.calls[0]?.[0]
    const db = {
      journal_entries: { create: vi.fn().mockResolvedValue({ id: 'je-1', entry_number: 'JR-001' }) },
      journal_lines: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
    }
    await transactionCallback(db)
    expect(db.journal_entries.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ org_id: 'org-1', branch_id: 'branch-1' }) }))
    expect(result).toEqual({ success: true, entryId: 'je-1', entryNumber: 'JR-001' })
  })
})
