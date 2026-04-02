import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  revalidatePath: vi.fn(),
  getActiveBranch: vi.fn(),
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
    const branchQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    }
    const productsQuery = createNoopMutationBuilder()
    const rpcMock = vi.fn()

    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'branches') return branchQuery
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
    const branchQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'branch-1' },
        error: null,
      }),
    }
    const productsQuery = createNoopMutationBuilder()
    const rpcMock = vi.fn().mockResolvedValue({
      data: { success: true, purchase_id: 'po-1' },
      error: null,
    })

    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'branches') return branchQuery
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

    await getPurchaseRequests('org-1', 'branch-1')

    expect(purchaseRequestQuery.eq).toHaveBeenCalledWith('org_id', 'org-1')
    expect(purchaseRequestQuery.eq).toHaveBeenCalledWith('branch_id', 'branch-1')
  })

  it('stamps active branch on manufacturing purchase requests', async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null })

    mocks.getActiveBranch.mockResolvedValue({
      id: 'branch-1',
      org_id: 'org-1',
      name: 'Unit A',
      code: 'UA',
      address: null,
      is_active: true,
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

    const result = await receivePurchase('org-1', 'po-1')

    expect(result).toEqual({
      error: 'Tidak ada gudang aktif untuk unit PO ini. Buat atau pilih gudang unit terlebih dahulu.',
    })
    expect(warehouseFallbackQuery.eq).toHaveBeenCalledWith('branch_id', 'branch-1')
    expect(warehouseFallbackQuery.or).not.toHaveBeenCalled()
    expect(purchasesTable.update).not.toHaveBeenCalled()
    expect(purchaseUpdateEq).not.toHaveBeenCalled()
  })
})
