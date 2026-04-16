import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  revalidatePath: vi.fn(),
  getBranchAccessScope: vi.fn(),
  resolveAccessibleBranchSelection: vi.fn(),
  queryPostgres: vi.fn(),
  createJournalEntry: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
  createAdminClient: mocks.createAdminClient,
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

vi.mock('@/modules/organization/lib/branch-access.server', () => ({
  getBranchAccessScope: mocks.getBranchAccessScope,
  resolveAccessibleBranchSelection: mocks.resolveAccessibleBranchSelection,
}))

vi.mock('@/lib/db/postgres', () => ({
  queryPostgres: mocks.queryPostgres,
}))

vi.mock('@/modules/accounting/actions/journal.actions', () => ({
  createJournalEntry: mocks.createJournalEntry,
}))

import { receivePurchase } from '@/modules/purchasing/actions/purchasing.actions'

function createStockMovementsTable() {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({
            count: 0,
            error: null,
          }),
        })),
      })),
    })),
    insert: vi.fn().mockResolvedValue({ error: null }),
  }
}

function createJournalEntriesQuery(result: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  }

  return query
}

describe('Purchasing Receipt Journal Balancing', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.createAdminClient.mockResolvedValue({
      from: vi.fn(),
    })
    mocks.getBranchAccessScope.mockResolvedValue({
      accessibleBranches: [{ id: 'branch-1' }],
      accessibleBranchIds: ['branch-1'],
      canAccessAllBranches: false,
      membershipId: 'member-1',
      role: 'staff',
    })
    mocks.createJournalEntry.mockResolvedValue({ success: true })
  })

  it('keeps purchase journal balanced when landed cost allocation must offset line discounts', async () => {
    const purchasesTable = {
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        })),
      })),
    }
    const explicitWarehouseQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'wh-1', branch_id: 'branch-1' },
        error: null,
      }),
    }
    const accountsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [
          { id: 'acc-inventory', code: '1301', type: 'ASSET' },
          { id: 'acc-payable', code: '2101', type: 'LIABILITY' },
        ],
        error: null,
      }),
    }
    const journalEntriesQuery = createJournalEntriesQuery({
      data: null,
      error: null,
    })
    const stockMovementsTable = createStockMovementsTable()
    const rpcMock = vi.fn(async (fn: string) => {
      if (fn === 'update_product_average_cost') return { data: null, error: null }
      if (fn === 'adjust_inventory_stock') return { data: null, error: null }
      throw new Error(`Unexpected rpc ${fn}`)
    })

    mocks.queryPostgres
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'po-1',
            org_id: 'org-1',
            status: 'ORDERED',
            branch_id: 'branch-1',
            warehouse_id: 'wh-1',
            purchase_number: 'PO-001',
            total_amount: 300,
            discount_amount: 0,
            shipping_amount: 30,
            insurance_amount: 0,
            tax_amount: 0,
            grand_total: 330,
            notes: '',
            shariah_mode: 'CASH',
            payment_status: 'UNPAID',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'line-1',
            purchase_id: 'po-1',
            product_id: 'prod-1',
            quantity: 1,
            unit_price: 100,
            discount_amount: 10,
            product_asset_account_id: null,
            product_category: 'Bahan',
          },
          {
            id: 'line-2',
            purchase_id: 'po-1',
            product_id: 'prod-2',
            quantity: 1,
            unit_price: 100,
            discount_amount: 10,
            product_asset_account_id: null,
            product_category: 'Bahan',
          },
          {
            id: 'line-3',
            purchase_id: 'po-1',
            product_id: 'prod-3',
            quantity: 1,
            unit_price: 100,
            discount_amount: 10,
            product_asset_account_id: null,
            product_category: 'Bahan',
          },
        ],
      })

    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'purchases') return purchasesTable
        if (table === 'warehouses') return explicitWarehouseQuery
        if (table === 'accounts') return accountsQuery
        if (table === 'journal_entries') return journalEntriesQuery
        if (table === 'stock_movements') return stockMovementsTable
        throw new Error(`Unexpected table ${table}`)
      }),
      rpc: rpcMock,
    })

    const result = await receivePurchase('org-1', 'po-1')

    expect(result).toEqual({ success: true })
    expect(mocks.createJournalEntry).toHaveBeenCalledTimes(1)

    const journalLines = mocks.createJournalEntry.mock.calls[0][0].lines
    const totalDebit = journalLines.reduce((sum: number, line: { debit?: number }) => sum + Number(line.debit || 0), 0)
    const totalCredit = journalLines.reduce((sum: number, line: { credit?: number }) => sum + Number(line.credit || 0), 0)

    expect(totalDebit).toBe(330)
    expect(totalCredit).toBe(330)
    expect(journalLines).toEqual(expect.arrayContaining([
      expect.objectContaining({
        account_id: 'acc-inventory',
        debit: 330,
        credit: 0,
      }),
      expect.objectContaining({
        account_id: 'acc-payable',
        debit: 0,
        credit: 330,
      }),
    ]))
  })

  it('creates missing receipt journal even when stock movements already exist', async () => {
    const purchasesTable = {
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        })),
      })),
    }
    const explicitWarehouseQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'wh-1', branch_id: 'branch-1' },
        error: null,
      }),
    }
    const accountsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [
          { id: 'acc-inventory', code: '1301', type: 'ASSET' },
          { id: 'acc-payable', code: '2101', type: 'LIABILITY' },
        ],
        error: null,
      }),
    }
    const journalEntriesQuery = createJournalEntriesQuery({
      data: null,
      error: null,
    })
    const stockMovementsTable = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({
              count: 2,
              error: null,
            }),
          })),
        })),
      })),
      insert: vi.fn().mockResolvedValue({ error: null }),
    }

    mocks.queryPostgres
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'po-2',
            org_id: 'org-1',
            status: 'RECEIVED',
            branch_id: 'branch-1',
            warehouse_id: 'wh-1',
            purchase_number: 'PO-002',
            total_amount: 2000,
            discount_amount: 0,
            shipping_amount: 0,
            insurance_amount: 0,
            tax_amount: 0,
            grand_total: 2000,
            notes: '',
            shariah_mode: 'CASH',
            payment_status: 'UNPAID',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'line-1',
            purchase_id: 'po-2',
            product_id: 'prod-1',
            quantity: 2,
            unit_price: 1000,
            discount_amount: 0,
            product_asset_account_id: null,
            product_category: 'Bahan',
          },
        ],
      })

    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'purchases') return purchasesTable
        if (table === 'warehouses') return explicitWarehouseQuery
        if (table === 'accounts') return accountsQuery
        if (table === 'journal_entries') return journalEntriesQuery
        if (table === 'stock_movements') return stockMovementsTable
        throw new Error(`Unexpected table ${table}`)
      }),
      rpc: vi.fn(),
    })

    const result = await receivePurchase('org-1', 'po-2')

    expect(result).toEqual({ success: true })
    expect(stockMovementsTable.insert).not.toHaveBeenCalled()
    expect(purchasesTable.update).not.toHaveBeenCalled()
    expect(mocks.createJournalEntry).toHaveBeenCalledTimes(1)
    expect(mocks.createJournalEntry).toHaveBeenCalledWith(expect.objectContaining({
      reference_type: 'PURCHASE',
      reference_id: 'po-2',
      description: 'Penerimaan Pembelian & Stok PO-002',
    }))
  })

  it('normalizes legacy purchase_date strings before creating receipt journal', async () => {
    const purchasesTable = {
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        })),
      })),
    }
    const explicitWarehouseQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'wh-1', branch_id: 'branch-1' },
        error: null,
      }),
    }
    const accountsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [
          { id: 'acc-inventory', code: '1301', type: 'ASSET' },
          { id: 'acc-payable', code: '2101', type: 'LIABILITY' },
        ],
        error: null,
      }),
    }
    const journalEntriesQuery = createJournalEntriesQuery({
      data: null,
      error: null,
    })
    const stockMovementsTable = createStockMovementsTable()
    const rpcMock = vi.fn(async (fn: string) => {
      if (fn === 'update_product_average_cost') return { data: null, error: null }
      if (fn === 'adjust_inventory_stock') return { data: null, error: null }
      throw new Error(`Unexpected rpc ${fn}`)
    })

    mocks.queryPostgres
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'po-legacy-date-1',
            org_id: 'org-1',
            status: 'ORDERED',
            branch_id: 'branch-1',
            warehouse_id: 'wh-1',
            purchase_number: 'PO-LEGACY',
            purchase_date: 'Thu Apr 16 2026 00:00:00 GMT+0700 (Western Indonesia Time)',
            total_amount: 1000,
            discount_amount: 0,
            shipping_amount: 0,
            insurance_amount: 0,
            tax_amount: 0,
            grand_total: 1000,
            notes: '',
            shariah_mode: 'CASH',
            payment_status: 'UNPAID',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'line-1',
            purchase_id: 'po-legacy-date-1',
            product_id: 'prod-1',
            quantity: 1,
            unit_price: 1000,
            discount_amount: 0,
            product_asset_account_id: null,
            product_category: 'Bahan',
          },
        ],
      })

    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'purchases') return purchasesTable
        if (table === 'warehouses') return explicitWarehouseQuery
        if (table === 'accounts') return accountsQuery
        if (table === 'journal_entries') return journalEntriesQuery
        if (table === 'stock_movements') return stockMovementsTable
        throw new Error(`Unexpected table ${table}`)
      }),
      rpc: rpcMock,
    })

    const result = await receivePurchase('org-1', 'po-legacy-date-1')

    expect(result).toEqual({ success: true })
    expect(mocks.createJournalEntry).toHaveBeenCalledWith(expect.objectContaining({
      entry_date: '2026-04-16',
      reference_id: 'po-legacy-date-1',
    }))
  })
})
