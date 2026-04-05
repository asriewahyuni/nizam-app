import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    sales_items: {
      createMany: vi.fn(),
    },
    approval_requests: {
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    journal_entries: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    stock_movements: {
      deleteMany: vi.fn(),
    },
    contacts: {
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    sales: {
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  }

  return {
    createClient: vi.fn(),
    revalidatePath: vi.fn(),
    getActiveBranch: vi.fn(),
    resolveAccessibleBranchSelection: vi.fn(),
    getAuthUser: vi.fn(),
    prisma: {
      sales: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      warehouses: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      $transaction: vi.fn(),
    },
    tx,
  }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}))

vi.mock('@/lib/auth/permissions', () => ({
  getAuthUser: mocks.getAuthUser,
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

function makeBranchSelection(branchId: string | null = 'branch-1') {
  return {
    scope: {
      accessibleBranches: [],
      accessibleBranchIds: branchId ? [branchId] : [],
      canAccessAllBranches: branchId === null,
      membershipId: 'member-1',
      role: 'staff',
    },
    branchId,
  }
}

describe('Sales Branch Context', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.getAuthUser.mockResolvedValue({
      userId: 'user-1',
      email: 'sales@example.com',
      name: 'Sales User',
    })
    mocks.prisma.$transaction.mockImplementation(async (callback: any) => callback(mocks.tx))
  })

  it('rejects creating sales order when no active branch is selected', async () => {
    mocks.resolveAccessibleBranchSelection.mockResolvedValue(makeBranchSelection(null))

    const result = await createSaleEntry('org-1', {
      customer_id: 'cust-1',
      sale_date: '2026-04-03',
      lines: [{ product_name: 'Produk A', quantity: 1, unit_price: 1000 }],
    })

    expect(result).toEqual({
      error: 'Pilih unit aktif terlebih dahulu untuk membuat sales order.',
    })
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled()
  })

  it('stamps active branch on sales order, line items, and approval request', async () => {
    mocks.resolveAccessibleBranchSelection.mockResolvedValue(makeBranchSelection('branch-1'))
    mocks.tx.$queryRaw.mockResolvedValue([{ id: 'sale-1' }])
    mocks.tx.sales_items.createMany.mockResolvedValue({ count: 1 })
    mocks.tx.approval_requests.create.mockResolvedValue({ id: 'approval-1' })

    const result = await createSaleEntry('org-1', {
      customer_id: 'cust-1',
      customer_name: 'PT Unit A',
      sale_date: '2026-04-03',
      due_date: '2026-04-10',
      payment_term: 'TEMPO',
      lines: [{ product_name: 'Produk A', quantity: 2, unit_price: 1000 }],
    })

    expect(result).toEqual({ success: true, saleId: 'sale-1' })
    expect(mocks.tx.$queryRaw.mock.calls[0]).toEqual(
      expect.arrayContaining(['org-1', 'branch-1', 'cust-1'])
    )
    expect(mocks.tx.sales_items.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          org_id: 'org-1',
          branch_id: 'branch-1',
          sale_id: 'sale-1',
        }),
      ],
    })
    expect(mocks.tx.approval_requests.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        org_id: 'org-1',
        branch_id: 'branch-1',
        source_id: 'sale-1',
      }),
    })
  })

  it('filters sales list by branch when a unit is active', async () => {
    mocks.resolveAccessibleBranchSelection.mockResolvedValue(makeBranchSelection('branch-1'))
    mocks.prisma.sales.findMany.mockResolvedValue([])

    await getSales('org-1', 'branch-1')

    expect(mocks.prisma.sales.findMany).toHaveBeenCalledWith({
      where: {
        org_id: 'org-1',
        branch_id: 'branch-1',
      },
      select: expect.any(Object),
      orderBy: {
        created_at: 'desc',
      },
    })
  })

  it('delivers sales order using selected warehouse for physical stock sync', async () => {
    mocks.resolveAccessibleBranchSelection.mockResolvedValue(makeBranchSelection('branch-1'))
    mocks.prisma.sales.findFirst.mockResolvedValue({
      status: 'ORDERED',
      warehouse_id: null,
    })
    mocks.prisma.warehouses.findFirst.mockResolvedValue({ id: 'wh-1' })
    mocks.tx.$executeRaw.mockResolvedValue(1)

    const result = await deliverSale('org-1', 'sale-1', 'wh-1')

    expect(result).toEqual({ success: true })
    expect(mocks.prisma.warehouses.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'wh-1',
        org_id: 'org-1',
        is_active: true,
        branch_id: 'branch-1',
      },
      select: {
        id: true,
      },
    })
    expect(mocks.tx.$executeRaw).toHaveBeenCalledTimes(3)
    expect(mocks.tx.$executeRaw.mock.calls[2]).toEqual(
      expect.arrayContaining(['org-1', 'sale-1', 'wh-1'])
    )
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
})
