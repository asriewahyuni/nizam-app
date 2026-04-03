import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  revalidatePath: vi.fn(),
  getActiveBranch: vi.fn(),
  resolveAccessibleBranchSelection: vi.fn(),
  getBranchAccessScope: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
  createAdminClient: mocks.createAdminClient,
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

vi.mock('@/modules/organization/actions/org.actions', () => ({
  getActiveBranch: mocks.getActiveBranch,
}))

vi.mock('@/modules/organization/lib/branch-access.server', () => ({
  resolveAccessibleBranchSelection: mocks.resolveAccessibleBranchSelection,
  getBranchAccessScope: mocks.getBranchAccessScope,
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

describe('Purchasing Branch Context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    const purchaseUpdateEq = vi.fn().mockResolvedValue({ error: null })
    const purchasesTable = {
      select: vi.fn(() => purchaseSelectBuilder),
      update: vi.fn(() => ({
        eq: purchaseUpdateEq,
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
        data: [],
        error: null,
      }),
    }
    const rpcMock = vi.fn(async (fn: string) => {
      if (fn === 'update_product_average_cost') {
        return { data: null, error: null }
      }

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

    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'purchases') return purchasesTable
        if (table === 'warehouses') return explicitWarehouseQuery
        if (table === 'stock_movements') return stockMovementsTable
        if (table === 'accounts') return accountsQuery
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
})
