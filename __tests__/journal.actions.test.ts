import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseMock, failure, success } from './helpers/supabase-mock'

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

import { createJournalEntry, voidJournalEntry } from '@/modules/accounting/actions/journal.actions'

function mockAuthedClient(supabaseClient: ReturnType<typeof createSupabaseMock>['client']) {
  return {
    ...supabaseClient,
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
      }),
    },
  }
}

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

describe('Journal Void Synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('delegates sale journal voids to the atomic sale RPC', async () => {
    const supabase = createSupabaseMock({
      tables: {
        journal_entries: [
          {
            maybeSingleResult: success({
              entry_date: '2026-04-17',
              status: 'POSTED',
              reference_type: 'SALE',
              reference_id: 'sale-1',
            }),
          },
        ],
        fiscal_periods: [
          {
            maybeSingleResult: success(null),
          },
        ],
      },
      rpc: {
        void_sale_atomic: [
          success({ success: true }),
        ],
      },
    })

    mocks.createClient.mockResolvedValue(mockAuthedClient(supabase.client))

    const result = await voidJournalEntry('je-sale-1', 'org-1', 'Void dari jurnal')

    expect(result).toEqual({ success: true })
    expect(supabase.rpcCalls).toEqual([
      {
        fn: 'void_sale_atomic',
        args: {
          p_org_id: 'org-1',
          p_sale_id: 'sale-1',
          p_user_id: 'user-1',
          p_reason: 'Void dari jurnal',
        },
      },
    ])
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/sales')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/accounting/journal')
  })

  it('removes sales payment rows and recalculates payment status when PAYMENT_IN is voided', async () => {
    const supabase = createSupabaseMock({
      tables: {
        journal_entries: [
          {
            maybeSingleResult: success({
              entry_date: '2026-04-17',
              status: 'POSTED',
              reference_type: 'PAYMENT_IN',
              reference_id: 'pay-1',
            }),
          },
          {
            result: success([]),
          },
        ],
        fiscal_periods: [
          {
            maybeSingleResult: success(null),
          },
        ],
        sales_payments: [
          {
            maybeSingleResult: success({
              id: 'pay-1',
              sale_id: 'sale-1',
            }),
          },
          {
            result: success([]),
          },
          {
            result: success([
              { amount: 200, discount_amount: 0 },
            ]),
          },
        ],
        sales: [
          {
            maybeSingleResult: success({
              grand_total: 1000,
            }),
          },
          {
            result: success([]),
          },
        ],
        sales_returns: [
          {
            result: success([]),
          },
        ],
      },
    })

    mocks.createClient.mockResolvedValue(mockAuthedClient(supabase.client))

    const result = await voidJournalEntry('je-pay-1', 'org-1', 'Void pembayaran masuk')

    expect(result).toEqual({ success: true })

    const paymentDeleteCall = supabase.calls.find(
      (call) => call.table === 'sales_payments' && call.operations.some((operation) => operation.method === 'delete')
    )
    expect(paymentDeleteCall).toBeTruthy()

    const salesUpdateCall = supabase.calls.find(
      (call) => call.table === 'sales' && call.operations.some((operation) => operation.method === 'update')
    )
    expect(salesUpdateCall?.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: 'update',
          args: [{ payment_status: 'PARTIAL' }],
        }),
      ])
    )
  })

  it('falls back to zeroing purchase returns when legacy schema lacks purchase_returns.status', async () => {
    const supabase = createSupabaseMock({
      tables: {
        journal_entries: [
          {
            maybeSingleResult: success({
              entry_date: '2026-04-17',
              status: 'POSTED',
              reference_type: 'PURCHASE_RETURN',
              reference_id: 'pret-1',
            }),
          },
          {
            result: success([]),
          },
        ],
        fiscal_periods: [
          {
            maybeSingleResult: success(null),
          },
        ],
        purchase_returns: [
          {
            maybeSingleResult: success({
              id: 'pret-1',
              purchase_id: 'po-1',
              notes: 'Retur vendor',
            }),
          },
          {
            result: failure("Could not find the 'status' column of 'purchase_returns' in the schema cache", 'PGRST204'),
          },
          {
            result: success([]),
          },
          {
            result: success([]),
          },
        ],
        purchases: [
          {
            maybeSingleResult: success({
              warehouse_id: 'wh-1',
            }),
          },
          {
            maybeSingleResult: success({
              grand_total: 500000,
            }),
          },
          {
            result: success([]),
          },
        ],
        stock_movements: [
          {
            result: success([
              { product_id: 'prod-1', quantity: -2 },
            ]),
          },
          {
            result: success([]),
          },
        ],
        purchase_return_items: [
          {
            result: success([]),
          },
        ],
        purchase_payments: [
          {
            result: success([]),
          },
        ],
      },
      rpc: {
        adjust_inventory_stock: [
          success(null),
        ],
      },
    })

    mocks.createClient.mockResolvedValue(mockAuthedClient(supabase.client))

    const result = await voidJournalEntry('je-pret-1', 'org-1', 'Void retur pembelian')

    expect(result).toEqual({ success: true })

    const purchaseReturnUpdateCalls = supabase.calls.filter(
      (call) => call.table === 'purchase_returns' && call.operations.some((operation) => operation.method === 'update')
    )

    expect(purchaseReturnUpdateCalls).toHaveLength(2)
    expect(purchaseReturnUpdateCalls[0]?.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: 'update',
          args: [
            expect.objectContaining({
              status: 'VOIDED',
              total_amount: 0,
              tax_amount: 0,
            }),
          ],
        }),
      ])
    )
    expect(purchaseReturnUpdateCalls[1]?.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: 'update',
          args: [
            expect.not.objectContaining({
              status: expect.anything(),
            }),
          ],
        }),
      ])
    )
  })
})
