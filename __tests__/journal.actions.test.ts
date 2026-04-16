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

function createFiscalPeriodsQuery() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: null,
      error: null,
    }),
  }
}

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
    const currentYear = String(new Date().getFullYear())
    const singleMock = vi.fn().mockResolvedValue({
      data: { id: 'je-1', entry_number: `JE-${currentYear}-000001` },
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
    const journalEntriesQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      like: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
      insert: insertEntryMock,
    }

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
        if (table === 'fiscal_periods') {
          return createFiscalPeriodsQuery()
        }
        if (table === 'journal_entries') {
          return journalEntriesQuery
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
        entry_number: `JE-${currentYear}-000001`,
      })
    )
    expect(result).toEqual({
      success: true,
      entryId: 'je-1',
      entryNumber: `JE-${currentYear}-000001`,
    })
  })

  it('retries when journal entry number collides and then succeeds', async () => {
    const currentYear = String(new Date().getFullYear())
    const insertEntryMock = vi
      .fn()
      .mockImplementationOnce(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: {
              code: '23505',
              message: 'duplicate key value violates unique constraint "journal_entries_org_id_entry_number_key"',
            },
          }),
        })),
      }))
      .mockImplementationOnce(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: 'je-2', entry_number: `JE-${currentYear}-000003` },
            error: null,
          }),
        })),
      }))
    const insertLinesMock = vi.fn().mockResolvedValue({
      error: null,
    })
    const maybeSingleMock = vi
      .fn()
      .mockResolvedValueOnce({
        data: { entry_number: `JE-${currentYear}-000001` },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { entry_number: `JE-${currentYear}-000002` },
        error: null,
      })
    const journalEntriesQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      like: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: maybeSingleMock,
      insert: insertEntryMock,
    }

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
        if (table === 'fiscal_periods') {
          return createFiscalPeriodsQuery()
        }
        if (table === 'journal_entries') {
          return journalEntriesQuery
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
      description: 'Jurnal retry',
      lines: [
        { account_id: 'acc-1', debit: 1000, credit: 0 },
        { account_id: 'acc-2', debit: 0, credit: 1000 },
      ],
    })

    expect(insertEntryMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        entry_number: `JE-${currentYear}-000002`,
      })
    )
    expect(insertEntryMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        entry_number: `JE-${currentYear}-000003`,
      })
    )
    expect(result).toEqual({
      success: true,
      entryId: 'je-2',
      entryNumber: `JE-${currentYear}-000003`,
    })
  })

  it('returns the real database error when header insert fails for another reason', async () => {
    const insertEntryMock = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: {
            code: '23503',
            message: 'insert or update on table "journal_entries" violates foreign key constraint',
          },
        }),
      })),
    }))
    const journalEntriesQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      like: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
      insert: insertEntryMock,
    }

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
        if (table === 'fiscal_periods') {
          return createFiscalPeriodsQuery()
        }
        if (table === 'journal_entries') {
          return journalEntriesQuery
        }
        if (table === 'journal_lines') {
          return { insert: vi.fn() }
        }
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const result = await createJournalEntry({
      org_id: 'org-1',
      entry_date: '2026-04-03',
      description: 'Jurnal gagal',
      lines: [
        { account_id: 'acc-1', debit: 1000, credit: 0 },
        { account_id: 'acc-2', debit: 0, credit: 1000 },
      ],
    })

    expect(result).toEqual({
      error: 'insert or update on table "journal_entries" violates foreign key constraint',
    })
  })
})
