import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  revalidatePath: vi.fn(),
  noStore: vi.fn(),
  getActiveBranch: vi.fn(),
  resolveAccessibleBranchSelection: vi.fn(),
  getBranchAccessScope: vi.fn(),
  queryPostgres: vi.fn(),
  createJournalEntry: vi.fn(),
  postJournalEntry: vi.fn(),
  nudgeEduModeValidation: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
  createAdminClient: mocks.createAdminClient,
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
  unstable_noStore: mocks.noStore,
}))

vi.mock('@/modules/organization/actions/org.actions', () => ({
  getActiveBranch: mocks.getActiveBranch,
}))

vi.mock('@/modules/organization/lib/branch-access.server', () => ({
  resolveAccessibleBranchSelection: mocks.resolveAccessibleBranchSelection,
  getBranchAccessScope: mocks.getBranchAccessScope,
}))

vi.mock('@/lib/db/postgres', () => ({
  queryPostgres: mocks.queryPostgres,
}))

vi.mock('@/modules/accounting/actions/journal.actions', () => ({
  createJournalEntry: mocks.createJournalEntry,
  postJournalEntry: mocks.postJournalEntry,
}))

vi.mock('@/modules/edu/lib/progress-hooks.server', () => ({
  nudgeEduModeValidation: mocks.nudgeEduModeValidation,
}))

import { createPurchaseRequests } from '@/modules/factory/actions/factory.actions'
import { createPurchaseEntry, getPurchaseRequests, receivePurchase } from '@/modules/purchasing/actions/purchasing.actions'

function createNoopMutationBuilder() {
  const builder = {
    update: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    eq: vi.fn(() => builder),
  }

  return builder
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

function mockPurchaseRead(purchaseRow: Record<string, unknown>, itemRows: Array<Record<string, unknown>> = []) {
  mocks.queryPostgres
    .mockResolvedValueOnce({ rows: [purchaseRow] })
    .mockResolvedValueOnce({ rows: itemRows })
}

describe('Purchasing Branch Context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.noStore.mockImplementation(() => undefined)
    mocks.createJournalEntry.mockResolvedValue({ success: true })
    mocks.postJournalEntry.mockResolvedValue({ success: true })
    mocks.nudgeEduModeValidation.mockResolvedValue(undefined)
  })

  it('rejects purchase creation when branch does not belong to active org', async () => {
    const productsQuery = createNoopMutationBuilder()
    const rpcMock = vi.fn()

    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranches: [], accessibleBranchIds: [], canAccessAllBranches: false, membershipId: 'member-1', role: 'staff' },
      error: 'Anda tidak memiliki akses ke unit tersebut.',
    })
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'products') return productsQuery
        throw new Error(`Unexpected table ${table}`)
      }),
      rpc: rpcMock,
    })

    const result = await createPurchaseEntry('org-1', {
      vendor_id: 'vendor-1',
      branch_id: 'branch-x',
      purchase_date: '2026-04-02',
      payment_term: 'TEMPO',
      lines: [
        {
          product_id: 'prod-1',
          product_name: 'Baut',
          quantity: 2,
          unit_price: 1000,
        },
      ],
    })

    expect(result).toEqual({ error: 'Unit aktif tidak valid untuk organisasi ini.' })
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('passes branch_id into purchase RPC when branch is valid', async () => {
    const productsQuery = createNoopMutationBuilder()
    const rpcMock = vi.fn().mockResolvedValue({
      data: { success: true, purchase_id: 'po-1' },
      error: null,
    })

    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranches: [], accessibleBranchIds: ['branch-1'], canAccessAllBranches: false, membershipId: 'member-1', role: 'staff' },
      branchId: 'branch-1',
    })
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'products') return productsQuery
        throw new Error(`Unexpected table ${table}`)
      }),
      rpc: rpcMock,
    })

    const result = await createPurchaseEntry('org-1', {
      vendor_id: 'vendor-1',
      branch_id: 'branch-1',
      purchase_date: '2026-04-02',
      payment_term: 'TEMPO',
      lines: [
        {
          product_id: 'prod-1',
          product_name: 'Baut',
          quantity: 2,
          unit_price: 1000,
        },
      ],
    })

    expect(result).toEqual({ success: true, purchaseId: 'po-1' })
    expect(rpcMock).toHaveBeenCalledWith(
      'process_purchase_atomic',
      expect.objectContaining({
        p_org_id: 'org-1',
        p_branch_id: 'branch-1',
      })
    )
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/purchasing')
  })

  it('forces SALAM purchase creation to use LUNAS term metadata', async () => {
    const productsQuery = createNoopMutationBuilder()
    const rpcMock = vi.fn().mockResolvedValue({
      data: { success: true, purchase_id: 'po-salam-1' },
      error: null,
    })

    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranches: [], accessibleBranchIds: ['branch-1'], canAccessAllBranches: false, membershipId: 'member-1', role: 'staff' },
      branchId: 'branch-1',
    })
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'products') return productsQuery
        throw new Error(`Unexpected table ${table}`)
      }),
      rpc: rpcMock,
    })

    const result = await createPurchaseEntry('org-1', {
      vendor_id: 'vendor-1',
      branch_id: 'branch-1',
      purchase_date: '2026-04-06',
      due_date: '2026-04-20',
      payment_term: 'TEMPO',
      shariah_mode: 'SALAM',
      payment_account_id: 'cash-1',
      lines: [
        {
          product_id: 'prod-1',
          product_name: 'Baut',
          quantity: 2,
          unit_price: 1000,
        },
      ],
    })

    expect(result).toEqual({ success: true, purchaseId: 'po-salam-1' })
    expect(rpcMock).toHaveBeenCalledWith(
      'process_purchase_atomic',
      expect.objectContaining({
        p_shariah_mode: 'SALAM',
        p_notes: expect.stringContaining('[TERMIN: LUNAS]'),
      })
    )
  })

  it('requires planned goods-availability date for SALAM purchase', async () => {
    const productsQuery = createNoopMutationBuilder()
    const rpcMock = vi.fn()

    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranches: [], accessibleBranchIds: ['branch-1'], canAccessAllBranches: false, membershipId: 'member-1', role: 'staff' },
      branchId: 'branch-1',
    })
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'products') return productsQuery
        throw new Error(`Unexpected table ${table}`)
      }),
      rpc: rpcMock,
    })

    const result = await createPurchaseEntry('org-1', {
      vendor_id: 'vendor-1',
      branch_id: 'branch-1',
      purchase_date: '2026-04-06',
      payment_term: 'LUNAS',
      shariah_mode: 'SALAM',
      payment_account_id: 'cash-1',
      lines: [
        {
          product_id: 'prod-1',
          product_name: 'Baut',
          quantity: 1,
          unit_price: 1000,
        },
      ],
    })

    expect(result).toEqual({
      error: 'Akad SALAM pembelian wajib menetapkan tanggal barang disediakan.',
    })
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('keeps ISTISHNA purchase on chosen payment term so DP can be recorded bertahap', async () => {
    const productsQuery = createNoopMutationBuilder()
    const rpcMock = vi.fn().mockResolvedValue({
      data: { success: true, purchase_id: 'po-istishna-1' },
      error: null,
    })

    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranches: [], accessibleBranchIds: ['branch-1'], canAccessAllBranches: false, membershipId: 'member-1', role: 'staff' },
      branchId: 'branch-1',
    })
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'products') return productsQuery
        throw new Error(`Unexpected table ${table}`)
      }),
      rpc: rpcMock,
    })

    const result = await createPurchaseEntry('org-1', {
      vendor_id: 'vendor-1',
      branch_id: 'branch-1',
      purchase_date: '2026-04-06',
      due_date: '2026-04-20',
      payment_term: 'TEMPO',
      shariah_mode: 'ISTISHNA',
      lines: [
        {
          product_id: 'prod-1',
          product_name: 'Barang ISTISHNA',
          quantity: 2,
          unit_price: 1000,
        },
      ],
    })

    expect(result).toEqual({ success: true, purchaseId: 'po-istishna-1' })
    expect(rpcMock).toHaveBeenCalledWith(
      'process_purchase_atomic',
      expect.objectContaining({
        p_shariah_mode: 'ISTISHNA',
        p_due_date: '2026-04-20',
        p_notes: expect.stringContaining('[TERMIN: TEMPO]'),
      })
    )
  })

  it('syncs published PO header discount and insurance after RPC success', async () => {
    const productsQuery = createNoopMutationBuilder()
    const purchasesTable = createNoopMutationBuilder()
    const rpcMock = vi.fn().mockResolvedValue({
      data: { success: true, purchase_id: 'po-headers-1' },
      error: null,
    })

    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranches: [], accessibleBranchIds: ['branch-1'], canAccessAllBranches: false, membershipId: 'member-1', role: 'staff' },
      branchId: 'branch-1',
    })
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'products') return productsQuery
        if (table === 'purchases') return purchasesTable
        throw new Error(`Unexpected table ${table}`)
      }),
      rpc: rpcMock,
    })

    const result = await createPurchaseEntry('org-1', {
      vendor_id: 'vendor-1',
      branch_id: 'branch-1',
      purchase_date: '2026-04-02',
      payment_term: 'TEMPO',
      discount_amount: 150,
      insurance_amount: 50,
      shipping_amount: 25,
      lines: [
        {
          product_id: 'prod-1',
          product_name: 'Baut',
          quantity: 2,
          unit_price: 1000,
        },
      ],
    })

    expect(result).toEqual({ success: true, purchaseId: 'po-headers-1' })
    expect(purchasesTable.update).toHaveBeenCalledWith(
      expect.objectContaining({
        vendor_id: 'vendor-1',
        branch_id: 'branch-1',
        purchase_date: '2026-04-02',
        total_amount: 2000,
        discount_amount: 150,
        shipping_amount: 25,
        insurance_amount: 50,
        grand_total: 1925,
      })
    )
  })

  it('filters purchase requests by branch when a unit is active', async () => {
    const orderMock = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    })
    const purchaseRequestQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: orderMock,
    }

    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'purchase_requests') return purchaseRequestQuery
        throw new Error(`Unexpected table ${table}`)
      }),
    })
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranches: [], accessibleBranchIds: ['branch-1'], canAccessAllBranches: false, membershipId: 'member-1', role: 'staff' },
      branchId: 'branch-1',
    })

    await getPurchaseRequests('org-1', 'branch-1')

    expect(purchaseRequestQuery.eq).toHaveBeenCalledWith('org_id', 'org-1')
    expect(purchaseRequestQuery.eq).toHaveBeenCalledWith('branch_id', 'branch-1')
  })

  it('stamps active branch on manufacturing purchase requests', async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null })

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
        if (table !== 'purchase_requests') throw new Error(`Unexpected table ${table}`)
        return {
          insert: insertMock,
        }
      }),
    })

    const result = await createPurchaseRequests('org-1', [
      {
        productId: 'prod-1',
        productName: 'Baut',
        quantity: 5,
        unit: 'Pcs',
        notes: 'Auto',
        sourceId: 'wo-1',
      },
    ])

    expect(insertMock).toHaveBeenCalledWith([
      expect.objectContaining({
        org_id: 'org-1',
        branch_id: 'branch-1',
        requester_id: 'user-1',
      }),
    ])
    expect(result).toEqual({ success: true, count: 1 })
  })

  it('rejects receiving a branch PO when no active warehouse is available', async () => {
    const purchaseSelectBuilder = {
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'po-1',
          org_id: 'org-1',
          status: 'DRAFT',
          branch_id: 'branch-1',
          warehouse_id: null,
          purchase_items: [],
          total_amount: 1000,
          shipping_amount: 0,
          insurance_amount: 0,
        },
        error: null,
      }),
    }
    const purchaseUpdateEq = vi.fn()
    const purchasesTable = {
      select: vi.fn(() => purchaseSelectBuilder),
      update: vi.fn(() => ({
        eq: purchaseUpdateEq,
      })),
    }
    const warehouseFallbackQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    }

    mockPurchaseRead({
      id: 'po-1',
      org_id: 'org-1',
      status: 'DRAFT',
      branch_id: 'branch-1',
      warehouse_id: null,
      total_amount: 1000,
      shipping_amount: 0,
      insurance_amount: 0,
      tax_amount: 0,
      discount_amount: 0,
      grand_total: 1000,
      notes: '',
      shariah_mode: 'CASH',
      payment_status: 'UNPAID',
    })

    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'purchases') return purchasesTable
        if (table === 'warehouses') return warehouseFallbackQuery
        throw new Error(`Unexpected table ${table}`)
      }),
    })
    mocks.getBranchAccessScope.mockResolvedValue({
      accessibleBranches: [{ id: 'branch-1' }],
      accessibleBranchIds: ['branch-1'],
      canAccessAllBranches: false,
      membershipId: 'member-1',
      role: 'staff',
    })

    const result = await receivePurchase('org-1', 'po-1')

    expect(result).toEqual({
      error: 'Tidak ada gudang aktif untuk unit PO ini. Buat atau pilih gudang unit terlebih dahulu.',
    })
    expect(warehouseFallbackQuery.eq).toHaveBeenCalledWith('branch_id', 'branch-1')
    expect(warehouseFallbackQuery.or).not.toHaveBeenCalled()
    expect(purchasesTable.update).not.toHaveBeenCalled()
    expect(purchaseUpdateEq).not.toHaveBeenCalled()
  })

  it('blocks SALAM purchase receiving when payment is not fully paid yet', async () => {
    const purchaseSelectBuilder = {
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'po-salam-1',
          org_id: 'org-1',
          status: 'ORDERED',
          branch_id: 'branch-1',
          shariah_mode: 'SALAM',
          payment_status: 'UNPAID',
          warehouse_id: null,
          purchase_items: [],
          total_amount: 1000,
          shipping_amount: 0,
          insurance_amount: 0,
        },
        error: null,
      }),
    }
    const purchasesTable = {
      select: vi.fn(() => purchaseSelectBuilder),
      update: vi.fn(() => ({
        eq: vi.fn().mockReturnThis(),
      })),
    }

    mockPurchaseRead({
      id: 'po-salam-1',
      org_id: 'org-1',
      status: 'ORDERED',
      branch_id: 'branch-1',
      warehouse_id: null,
      total_amount: 1000,
      shipping_amount: 0,
      insurance_amount: 0,
      tax_amount: 0,
      discount_amount: 0,
      grand_total: 1000,
      notes: '',
      shariah_mode: 'SALAM',
      payment_status: 'UNPAID',
    })

    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'purchases') return purchasesTable
        throw new Error(`Unexpected table ${table}`)
      }),
    })
    mocks.getBranchAccessScope.mockResolvedValue({
      accessibleBranches: [{ id: 'branch-1' }],
      accessibleBranchIds: ['branch-1'],
      canAccessAllBranches: false,
      membershipId: 'member-1',
      role: 'staff',
    })

    const result = await receivePurchase('org-1', 'po-salam-1')

    expect(result).toEqual({
      error: 'Akad SALAM pembelian wajib lunas terlebih dahulu sebelum penerimaan barang.',
    })
    expect(purchasesTable.update).not.toHaveBeenCalled()
  })

  it('falls back to direct stock sync when adjust_inventory_stock is missing from schema cache', async () => {
    const purchaseSelectBuilder = {
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'po-1',
          org_id: 'org-1',
          status: 'APPROVED',
          branch_id: 'branch-1',
          warehouse_id: 'wh-1',
          purchase_number: 'PO-001',
          purchase_items: [
            {
              product_id: 'prod-1',
              quantity: 2,
              unit_price: 1000,
              discount_amount: 0,
            },
          ],
          total_amount: 2000,
          shipping_amount: 0,
          insurance_amount: 0,
          tax_amount: 0,
          discount_amount: 0,
          grand_total: 2000,
          notes: '',
          shariah_mode: 'CASH',
        },
        error: null,
      }),
    }
    const purchaseUpdateEq = vi.fn().mockReturnThis()
    const purchaseUpdateOrgEq = vi.fn().mockResolvedValue({ error: null })
    const purchasesTable = {
      select: vi.fn(() => purchaseSelectBuilder),
      update: vi.fn(() => ({
        eq: vi.fn((column: string, value: unknown) => {
          purchaseUpdateEq(column, value)
          return {
            eq: purchaseUpdateOrgEq,
          }
        }),
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
    const stockMovementsTable = {
      insert: vi.fn().mockResolvedValue({ error: null }),
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
    const rpcMock = vi.fn(async (fn: string) => {
      if (fn === 'adjust_inventory_stock') {
        return {
          data: null,
          error: {
            code: 'PGRST202',
            message: 'Could not find the function public.adjust_inventory_stock(p_diff, p_org_id, p_product_id, p_warehouse_id) in the schema cache',
          },
        }
      }

      throw new Error(`Unexpected rpc ${fn}`)
    })
    const inventoryStocksQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    }
    const inventoryStocksInsert = vi.fn().mockResolvedValue({ error: null })
    const inventoryStocksTable = {
      select: vi.fn(() => inventoryStocksQuery),
      insert: inventoryStocksInsert,
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    }

    mockPurchaseRead(
      {
        id: 'po-1',
        org_id: 'org-1',
        status: 'APPROVED',
        branch_id: 'branch-1',
        warehouse_id: 'wh-1',
        purchase_number: 'PO-001',
        total_amount: 2000,
        shipping_amount: 0,
        insurance_amount: 0,
        tax_amount: 0,
        discount_amount: 0,
        grand_total: 2000,
        notes: '',
        shariah_mode: 'CASH',
        payment_status: 'UNPAID',
      },
      [
        {
          product_id: 'prod-1',
          quantity: 2,
          unit_price: 1000,
          discount_amount: 0,
          product_asset_account_id: null,
          product_category: 'Bahan',
        },
      ]
    )

    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'purchases') return purchasesTable
        if (table === 'warehouses') return explicitWarehouseQuery
        if (table === 'stock_movements') return stockMovementsTable
        if (table === 'accounts') return accountsQuery
        if (table === 'journal_entries') return journalEntriesQuery
        throw new Error(`Unexpected table ${table}`)
      }),
      rpc: rpcMock,
    })
    mocks.createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table !== 'inventory_stocks') throw new Error(`Unexpected admin table ${table}`)
        return inventoryStocksTable
      }),
    })
    mocks.getBranchAccessScope.mockResolvedValue({
      accessibleBranches: [{ id: 'branch-1' }],
      accessibleBranchIds: ['branch-1'],
      canAccessAllBranches: false,
      membershipId: 'member-1',
      role: 'staff',
    })

    const result = await receivePurchase('org-1', 'po-1')

    expect(result).toEqual({ success: true })
    expect(rpcMock).toHaveBeenCalledWith(
      'adjust_inventory_stock',
      expect.objectContaining({
        p_org_id: 'org-1',
        p_product_id: 'prod-1',
        p_warehouse_id: 'wh-1',
        p_diff: 2,
        p_batch_number: null,
        p_bin_id: null,
      })
    )
    expect(inventoryStocksInsert).toHaveBeenCalledWith({
      org_id: 'org-1',
      product_id: 'prod-1',
      warehouse_id: 'wh-1',
      quantity: 2,
      batch_number: null,
    })
    expect(purchaseUpdateEq).toHaveBeenCalledWith('id', 'po-1')
  })

  it('falls back to direct stock sync when adjust_inventory_stock signature is incompatible', async () => {
    const purchaseSelectBuilder = {
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'po-1',
          org_id: 'org-1',
          status: 'APPROVED',
          branch_id: 'branch-1',
          warehouse_id: 'wh-1',
          purchase_number: 'PO-001',
          purchase_items: [
            {
              product_id: 'prod-1',
              quantity: 2,
              unit_price: 1000,
              discount_amount: 0,
            },
          ],
          total_amount: 2000,
          shipping_amount: 0,
          insurance_amount: 0,
          tax_amount: 0,
          discount_amount: 0,
          grand_total: 2000,
          notes: '',
          shariah_mode: 'CASH',
        },
        error: null,
      }),
    }
    const purchaseUpdateEq = vi.fn().mockReturnThis()
    const purchaseUpdateOrgEq = vi.fn().mockResolvedValue({ error: null })
    const purchasesTable = {
      select: vi.fn(() => purchaseSelectBuilder),
      update: vi.fn(() => ({
        eq: vi.fn((column: string, value: unknown) => {
          purchaseUpdateEq(column, value)
          return {
            eq: purchaseUpdateOrgEq,
          }
        }),
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
    const stockMovementsTable = {
      insert: vi.fn().mockResolvedValue({ error: null }),
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
    const rpcMock = vi.fn(async (fn: string) => {
      if (fn === 'adjust_inventory_stock') {
        return {
          data: null,
          error: {
            code: '42883',
            message: 'function public.adjust_inventory_stock(uuid, uuid, uuid, numeric, unknown, unknown) does not exist',
          },
        }
      }

      throw new Error(`Unexpected rpc ${fn}`)
    })
    const inventoryStocksQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    }
    const inventoryStocksInsert = vi.fn().mockResolvedValue({ error: null })
    const inventoryStocksTable = {
      select: vi.fn(() => inventoryStocksQuery),
      insert: inventoryStocksInsert,
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    }

    mockPurchaseRead(
      {
        id: 'po-1',
        org_id: 'org-1',
        status: 'APPROVED',
        branch_id: 'branch-1',
        warehouse_id: 'wh-1',
        purchase_number: 'PO-001',
        total_amount: 2000,
        shipping_amount: 0,
        insurance_amount: 0,
        tax_amount: 0,
        discount_amount: 0,
        grand_total: 2000,
        notes: '',
        shariah_mode: 'CASH',
        payment_status: 'UNPAID',
      },
      [
        {
          product_id: 'prod-1',
          quantity: 2,
          unit_price: 1000,
          discount_amount: 0,
          product_asset_account_id: null,
          product_category: 'Bahan',
        },
      ]
    )

    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'purchases') return purchasesTable
        if (table === 'warehouses') return explicitWarehouseQuery
        if (table === 'stock_movements') return stockMovementsTable
        if (table === 'accounts') return accountsQuery
        if (table === 'journal_entries') return journalEntriesQuery
        throw new Error(`Unexpected table ${table}`)
      }),
      rpc: rpcMock,
    })
    mocks.createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table !== 'inventory_stocks') throw new Error(`Unexpected admin table ${table}`)
        return inventoryStocksTable
      }),
    })
    mocks.getBranchAccessScope.mockResolvedValue({
      accessibleBranches: [{ id: 'branch-1' }],
      accessibleBranchIds: ['branch-1'],
      canAccessAllBranches: false,
      membershipId: 'member-1',
      role: 'staff',
    })

    const result = await receivePurchase('org-1', 'po-1')

    expect(result).toEqual({ success: true })
    expect(rpcMock).toHaveBeenCalledWith(
      'adjust_inventory_stock',
      expect.objectContaining({
        p_org_id: 'org-1',
        p_product_id: 'prod-1',
        p_warehouse_id: 'wh-1',
        p_diff: 2,
        p_batch_number: null,
        p_bin_id: null,
      })
    )
    expect(inventoryStocksInsert).toHaveBeenCalledWith({
      org_id: 'org-1',
      product_id: 'prod-1',
      warehouse_id: 'wh-1',
      quantity: 2,
      batch_number: null,
    })
    expect(purchaseUpdateEq).toHaveBeenCalledWith('id', 'po-1')
  })

  it('falls back to direct stock sync when adjust_inventory_stock ON CONFLICT index is missing', async () => {
    const purchaseSelectBuilder = {
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'po-1',
          org_id: 'org-1',
          status: 'APPROVED',
          branch_id: 'branch-1',
          warehouse_id: 'wh-1',
          purchase_number: 'PO-001',
          purchase_items: [
            {
              product_id: 'prod-1',
              quantity: 2,
              unit_price: 1000,
              discount_amount: 0,
            },
          ],
          total_amount: 2000,
          shipping_amount: 0,
          insurance_amount: 0,
          tax_amount: 0,
          discount_amount: 0,
          grand_total: 2000,
          notes: '',
          shariah_mode: 'CASH',
        },
        error: null,
      }),
    }
    const purchaseUpdateEq = vi.fn().mockReturnThis()
    const purchaseUpdateOrgEq = vi.fn().mockResolvedValue({ error: null })
    const purchasesTable = {
      select: vi.fn(() => purchaseSelectBuilder),
      update: vi.fn(() => ({
        eq: vi.fn((column: string, value: unknown) => {
          purchaseUpdateEq(column, value)
          return {
            eq: purchaseUpdateOrgEq,
          }
        }),
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
    const stockMovementsTable = {
      insert: vi.fn().mockResolvedValue({ error: null }),
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
    const rpcMock = vi.fn(async (fn: string) => {
      if (fn === 'adjust_inventory_stock') {
        return {
          data: null,
          error: {
            code: '42P10',
            message: 'there is no unique or exclusion constraint matching the ON CONFLICT specification',
          },
        }
      }

      throw new Error(`Unexpected rpc ${fn}`)
    })
    const inventoryStocksQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    }
    const inventoryStocksInsert = vi.fn().mockResolvedValue({ error: null })
    const inventoryStocksTable = {
      select: vi.fn(() => inventoryStocksQuery),
      insert: inventoryStocksInsert,
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    }

    mockPurchaseRead(
      {
        id: 'po-1',
        org_id: 'org-1',
        status: 'APPROVED',
        branch_id: 'branch-1',
        warehouse_id: 'wh-1',
        purchase_number: 'PO-001',
        total_amount: 2000,
        shipping_amount: 0,
        insurance_amount: 0,
        tax_amount: 0,
        discount_amount: 0,
        grand_total: 2000,
        notes: '',
        shariah_mode: 'CASH',
        payment_status: 'UNPAID',
      },
      [
        {
          product_id: 'prod-1',
          quantity: 2,
          unit_price: 1000,
          discount_amount: 0,
          product_asset_account_id: null,
          product_category: 'Bahan',
        },
      ]
    )

    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'purchases') return purchasesTable
        if (table === 'warehouses') return explicitWarehouseQuery
        if (table === 'stock_movements') return stockMovementsTable
        if (table === 'accounts') return accountsQuery
        if (table === 'journal_entries') return journalEntriesQuery
        throw new Error(`Unexpected table ${table}`)
      }),
      rpc: rpcMock,
    })
    mocks.createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table !== 'inventory_stocks') throw new Error(`Unexpected admin table ${table}`)
        return inventoryStocksTable
      }),
    })
    mocks.getBranchAccessScope.mockResolvedValue({
      accessibleBranches: [{ id: 'branch-1' }],
      accessibleBranchIds: ['branch-1'],
      canAccessAllBranches: false,
      membershipId: 'member-1',
      role: 'staff',
    })

    const result = await receivePurchase('org-1', 'po-1')

    expect(result).toEqual({ success: true })
    expect(inventoryStocksInsert).toHaveBeenCalledWith({
      org_id: 'org-1',
      product_id: 'prod-1',
      warehouse_id: 'wh-1',
      quantity: 2,
      batch_number: null,
    })
    expect(purchaseUpdateEq).toHaveBeenCalledWith('id', 'po-1')
  })

  it('avoids duplicate stock posting when movement already exists for the same PO', async () => {
    const purchaseSelectBuilder = {
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'po-2',
          org_id: 'org-1',
          status: 'APPROVED',
          branch_id: 'branch-1',
          warehouse_id: 'wh-1',
          purchase_items: [],
          total_amount: 1000,
          shipping_amount: 0,
          insurance_amount: 0,
        },
        error: null,
      }),
    }
    const purchaseUpdateEq = vi.fn().mockReturnThis()
    const purchaseUpdateOrgEq = vi.fn().mockResolvedValue({ error: null })
    const purchasesTable = {
      select: vi.fn(() => purchaseSelectBuilder),
      update: vi.fn(() => ({
        eq: vi.fn((column: string, value: unknown) => {
          purchaseUpdateEq(column, value)
          return {
            eq: purchaseUpdateOrgEq,
          }
        }),
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
    const stockMovementsSelect = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    }
    const stockMovementsHead = vi.fn().mockResolvedValue({
      count: 2,
      error: null,
    })
    stockMovementsSelect.eq = vi.fn(() => stockMovementsSelect)
    const stockMovementsTable = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: stockMovementsHead,
          })),
        })),
      })),
      insert: vi.fn().mockResolvedValue({ error: null }),
    }
    const accountsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    }
    const journalEntriesQuery = createJournalEntriesQuery({
      data: { id: 'je-po-2', status: 'POSTED' },
      error: null,
    })

    mockPurchaseRead({
      id: 'po-2',
      org_id: 'org-1',
      status: 'APPROVED',
      branch_id: 'branch-1',
      warehouse_id: 'wh-1',
      total_amount: 1000,
      shipping_amount: 0,
      insurance_amount: 0,
      tax_amount: 0,
      discount_amount: 0,
      grand_total: 1000,
      notes: '',
      shariah_mode: 'CASH',
      payment_status: 'UNPAID',
    })

    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'purchases') return purchasesTable
        if (table === 'warehouses') return explicitWarehouseQuery
        if (table === 'stock_movements') return stockMovementsTable
        if (table === 'accounts') return accountsQuery
        if (table === 'journal_entries') return journalEntriesQuery
        throw new Error(`Unexpected table ${table}`)
      }),
      rpc: vi.fn(),
    })
    mocks.getBranchAccessScope.mockResolvedValue({
      accessibleBranches: [{ id: 'branch-1' }],
      accessibleBranchIds: ['branch-1'],
      canAccessAllBranches: false,
      membershipId: 'member-1',
      role: 'staff',
    })

    const result = await receivePurchase('org-1', 'po-2')

    expect(result).toEqual({ success: true })
    expect(stockMovementsHead).toHaveBeenCalledWith('reference_id', 'po-2')
    expect(purchaseUpdateEq).toHaveBeenCalledWith('id', 'po-2')
    expect(purchaseUpdateOrgEq).toHaveBeenCalledWith('org_id', 'org-1')
    expect(stockMovementsTable.insert).not.toHaveBeenCalled()
  })

  it('falls back to status-only update when purchases.warehouse_id is missing in schema cache', async () => {
    const purchaseSelectBuilder = {
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'po-3',
          org_id: 'org-1',
          status: 'APPROVED',
          branch_id: 'branch-1',
          warehouse_id: 'wh-1',
          purchase_items: [],
          total_amount: 1000,
          shipping_amount: 0,
          insurance_amount: 0,
        },
        error: null,
      }),
    }

    const updatePayloads: Array<Record<string, unknown>> = []
    const purchasesTable = {
      select: vi.fn(() => purchaseSelectBuilder),
      update: vi.fn((payload: Record<string, unknown>) => {
        updatePayloads.push(payload)
        return {
          eq: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue(
              Object.prototype.hasOwnProperty.call(payload, 'warehouse_id')
                ? {
                    error: {
                      code: 'PGRST204',
                      message: "Could not find the 'warehouse_id' column of 'purchases' in the schema cache",
                    },
                  }
                : { error: null }
            ),
          })),
        }
      }),
    }
    const explicitWarehouseQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'wh-1', branch_id: 'branch-1' },
        error: null,
      }),
    }
    const stockMovementsHead = vi.fn().mockResolvedValue({
      count: 1,
      error: null,
    })
    const stockMovementsTable = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: stockMovementsHead,
          })),
        })),
      })),
      insert: vi.fn().mockResolvedValue({ error: null }),
    }
    const journalEntriesQuery = createJournalEntriesQuery({
      data: { id: 'je-po-3', status: 'POSTED' },
      error: null,
    })

    mockPurchaseRead({
      id: 'po-3',
      org_id: 'org-1',
      status: 'APPROVED',
      branch_id: 'branch-1',
      warehouse_id: 'wh-1',
      total_amount: 1000,
      shipping_amount: 0,
      insurance_amount: 0,
      tax_amount: 0,
      discount_amount: 0,
      grand_total: 1000,
      notes: '',
      shariah_mode: 'CASH',
      payment_status: 'UNPAID',
    })

    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'purchases') return purchasesTable
        if (table === 'warehouses') return explicitWarehouseQuery
        if (table === 'stock_movements') return stockMovementsTable
        if (table === 'journal_entries') return journalEntriesQuery
        throw new Error(`Unexpected table ${table}`)
      }),
      rpc: vi.fn(),
    })
    mocks.getBranchAccessScope.mockResolvedValue({
      accessibleBranches: [{ id: 'branch-1' }],
      accessibleBranchIds: ['branch-1'],
      canAccessAllBranches: false,
      membershipId: 'member-1',
      role: 'staff',
    })

    const result = await receivePurchase('org-1', 'po-3')

    expect(result).toEqual({ success: true })
    expect(purchasesTable.update).toHaveBeenCalledTimes(2)
    expect(updatePayloads[0]).toEqual(
      expect.objectContaining({
        status: 'RECEIVED',
        warehouse_id: 'wh-1',
      })
    )
    expect(updatePayloads[1]).toEqual(
      expect.objectContaining({
        status: 'RECEIVED',
      })
    )
    expect(updatePayloads[1]).not.toHaveProperty('warehouse_id')
  })
})
