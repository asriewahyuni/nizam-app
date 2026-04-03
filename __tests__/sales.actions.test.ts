import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
  getActiveBranch: vi.fn(),
  resolveAccessibleBranchSelection: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

vi.mock('@/modules/organization/actions/org.actions', () => ({
  getActiveBranch: mocks.getActiveBranch,
}))

vi.mock('@/modules/organization/lib/branch-access.server', () => ({
  resolveAccessibleBranchSelection: mocks.resolveAccessibleBranchSelection,
}))

import { processPosTransaction } from '@/modules/sales/actions/pos.actions'
import { createSaleEntry, deliverSale, getSales } from '@/modules/sales/actions/sales.actions'

describe('Sales Branch Context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects creating sales order when no active branch is selected', async () => {
    const fromMock = vi.fn()

    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranches: [], accessibleBranchIds: [], canAccessAllBranches: false, membershipId: 'member-1', role: 'staff' },
      branchId: null,
    })
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
        }),
      },
      from: fromMock,
    })

    const result = await createSaleEntry('org-1', {
      customer_id: 'cust-1',
      sale_date: '2026-04-03',
      lines: [{ product_name: 'Produk A', quantity: 1, unit_price: 1000 }],
    })

    expect(result).toEqual({
      error: 'Pilih unit aktif terlebih dahulu untuk membuat sales order.',
    })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('stamps active branch on sales order, line items, and approval request', async () => {
    const saleSingle = vi.fn().mockResolvedValue({
      data: { id: 'sale-1' },
      error: null,
    })
    const saleInsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: saleSingle,
      })),
    }))
    const lineInsert = vi.fn().mockResolvedValue({ error: null })
    const approvalInsert = vi.fn().mockResolvedValue({ error: null })

    mocks.getActiveBranch.mockResolvedValue({
      id: 'branch-1',
      org_id: 'org-1',
      name: 'Unit A',
      code: 'UA',
      address: null,
      is_active: true,
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
        if (table === 'sales') {
          return { insert: saleInsert }
        }
        if (table === 'sales_items') {
          return { insert: lineInsert }
        }
        if (table === 'approval_requests') {
          return { insert: approvalInsert }
        }
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const result = await createSaleEntry('org-1', {
      customer_id: 'cust-1',
      customer_name: 'PT Unit A',
      sale_date: '2026-04-03',
      due_date: '2026-04-10',
      payment_term: 'TEMPO',
      lines: [{ product_name: 'Produk A', quantity: 2, unit_price: 1000 }],
    })

    expect(result).toEqual({ success: true, saleId: 'sale-1' })
    expect(saleInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-1',
        branch_id: 'branch-1',
        customer_id: 'cust-1',
      })
    )
    expect(lineInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        org_id: 'org-1',
        branch_id: 'branch-1',
        sale_id: 'sale-1',
      }),
    ])
    expect(approvalInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-1',
        branch_id: 'branch-1',
        source_id: 'sale-1',
      })
    )
  })

  it('filters sales list by branch when a unit is active', async () => {
    const orderMock = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    })
    const salesQuery = {
      select: vi.fn(() => salesQuery),
      eq: vi.fn(() => salesQuery),
      order: orderMock,
    }

    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table !== 'sales') throw new Error(`Unexpected table ${table}`)
        return salesQuery
      }),
    })
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranches: [], accessibleBranchIds: ['branch-1'], canAccessAllBranches: false, membershipId: 'member-1', role: 'staff' },
      branchId: 'branch-1',
    })

    await getSales('org-1', 'branch-1')

    expect(salesQuery.eq).toHaveBeenCalledWith('org_id', 'org-1')
    expect(salesQuery.eq).toHaveBeenCalledWith('branch_id', 'branch-1')
  })

  it('rejects POS transaction when no active branch is selected', async () => {
    const fromMock = vi.fn()
    const rpcMock = vi.fn()

    mocks.getActiveBranch.mockResolvedValue(null)
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
        }),
      },
      from: fromMock,
      rpc: rpcMock,
    })

    const result = await processPosTransaction('org-1', {
      lines: [{ product_id: 'prod-1', product_name: 'Produk A', quantity: 1, unit_price: 1000 }],
      account_id: 'cash-1',
      notes: 'POS',
    })

    expect(result).toEqual({
      error: 'Pilih unit aktif terlebih dahulu untuk memproses transaksi POS.',
    })
    expect(fromMock).not.toHaveBeenCalled()
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('stamps active branch on POS sales transaction', async () => {
    const productsQuery = {
      select: vi.fn(() => productsQuery),
      eq: vi.fn(() => productsQuery),
      in: vi.fn(() => Promise.resolve({
        data: [{ id: 'prod-1', type: 'INVENTORY' }],
        error: null,
      })),
    }
    const warehouseQuery = {
      select: vi.fn(() => warehouseQuery),
      eq: vi.fn(() => warehouseQuery),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'wh-1', name: 'Gudang Utama' },
        error: null,
      }),
    }
    const walkInQuery = {
      select: vi.fn(() => walkInQuery),
      eq: vi.fn(() => walkInQuery),
      single: vi.fn().mockResolvedValue({
        data: { id: 'cust-walkin' },
        error: null,
      }),
    }
    const saleSingle = vi.fn().mockResolvedValue({
      data: { id: 'sale-1' },
      error: null,
    })
    const salesInsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: saleSingle,
      })),
    }))
    const salesItemsInsert = vi.fn().mockResolvedValue({ error: null })
    const rpcMock = vi.fn().mockResolvedValue({ error: null })

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
        if (table === 'contacts') return walkInQuery
        if (table === 'products') return productsQuery
        if (table === 'warehouses') return warehouseQuery
        if (table === 'sales') return { insert: salesInsert }
        if (table === 'sales_items') return { insert: salesItemsInsert }
        throw new Error(`Unexpected table ${table}`)
      }),
      rpc: rpcMock,
    })

    const result = await processPosTransaction('org-1', {
      warehouse_id: 'wh-1',
      lines: [{ product_id: 'prod-1', product_name: 'Produk A', quantity: 1, unit_price: 1000 }],
      account_id: 'cash-1',
      notes: 'POS',
    })

    expect(result).toEqual({ success: true, saleId: 'sale-1' })
    expect(salesInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-1',
        branch_id: 'branch-1',
        warehouse_id: 'wh-1',
      })
    )
    expect(salesItemsInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        org_id: 'org-1',
        branch_id: 'branch-1',
      }),
    ])
    expect(rpcMock).toHaveBeenCalledWith('process_sales_delivery_atomic', {
      p_org_id: 'org-1',
      p_sale_id: 'sale-1',
      p_warehouse_id: 'wh-1',
    })
  })

  it('delivers sales order using selected warehouse for physical stock sync', async () => {
    const saleQuery = {
      select: vi.fn(() => saleQuery),
      eq: vi.fn(() => saleQuery),
      single: vi.fn().mockResolvedValue({
        data: { status: 'ORDERED', warehouse_id: null },
      }),
    }
    const warehouseQuery = {
      select: vi.fn(() => warehouseQuery),
      eq: vi.fn(() => warehouseQuery),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'wh-1', name: 'Gudang Utama', branch_id: 'branch-1' },
        error: null,
      }),
    }
    const rpcMock = vi.fn().mockResolvedValue({ error: null })

    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranches: [], accessibleBranchIds: ['branch-1'], canAccessAllBranches: false, membershipId: 'member-1', role: 'staff' },
      branchId: 'branch-1',
    })
    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'sales') return saleQuery
        if (table === 'warehouses') return warehouseQuery
        throw new Error(`Unexpected table ${table}`)
      }),
      rpc: rpcMock,
    })

    const result = await deliverSale('org-1', 'sale-1', 'wh-1')

    expect(result).toEqual({ success: true })
    expect(rpcMock).toHaveBeenCalledWith('process_sales_delivery_atomic', {
      p_org_id: 'org-1',
      p_sale_id: 'sale-1',
      p_warehouse_id: 'wh-1',
    })
  })
})
