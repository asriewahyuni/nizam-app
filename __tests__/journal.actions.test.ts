import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
  resolveAccessibleBranchSelection: vi.fn(),
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

import { createJournalEntry } from '@/modules/accounting/actions/journal.actions'

describe('Journal Branch Guardrails', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects manual journal creation when no active branch is selected', async () => {
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: {
        accessibleBranches: [],
        accessibleBranchIds: [],
        canAccessAllBranches: true,
        membershipId: 'member-1',
        role: 'owner',
      },
      branchId: null,
    })

    const fromMock = vi.fn()
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
        }),
      },
      from: fromMock,
    })

    const result = await createJournalEntry({
      org_id: 'org-1',
      entry_date: '2026-04-03',
      description: 'Jurnal test',
      lines: [
        { account_id: 'acc-1', debit: 1000, credit: 0 },
        { account_id: 'acc-2', debit: 0, credit: 1000 },
      ],
    })

    expect(result).toEqual({
      error: 'Pilih unit aktif terlebih dahulu untuk membuat jurnal manual.',
    })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('stamps the resolved active branch onto manual journals', async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: { id: 'je-1', entry_number: 'JR-001' },
      error: null,
    })
    const insertEntryMock = vi.fn(() => ({
      select: vi.fn(() => ({
        single: singleMock,
      })),
    }))
    const insertLinesMock = vi.fn().mockResolvedValue({
      error: null,
    })

    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: {
        accessibleBranches: [],
        accessibleBranchIds: ['branch-1'],
        canAccessAllBranches: false,
        membershipId: 'member-1',
        role: 'staff',
      },
      branchId: 'branch-1',
    })

    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'journal_entries') {
          return { insert: insertEntryMock }
        }
        if (table === 'journal_lines') {
          return { insert: insertLinesMock }
        }
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const result = await createJournalEntry({
      org_id: 'org-1',
      entry_date: '2026-04-03',
      description: 'Jurnal test',
      lines: [
        { account_id: 'acc-1', debit: 1000, credit: 0 },
        { account_id: 'acc-2', debit: 0, credit: 1000 },
      ],
    })

    expect(insertEntryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-1',
        branch_id: 'branch-1',
      })
    )
    expect(result).toEqual({
      success: true,
      entryId: 'je-1',
      entryNumber: 'JR-001',
    })
  })
})
