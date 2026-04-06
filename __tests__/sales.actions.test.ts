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
      findFirst: vi.fn(),
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
      products: {
        findMany: vi.fn(),
      },
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
import { createSaleEntry, deliverSale, getSales, voidSale } from '@/modules/sales/actions/sales.actions'

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

  it('forces SALAM sales to use LUNAS payment term while keeping due date', async () => {
    const saleSingle = vi.fn().mockResolvedValue({
      data: { id: 'sale-salam-1' },
      error: null,
    })
    const saleInsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: saleSingle,
      })),
    }))
    const lineInsert = vi.fn().mockResolvedValue({ error: null })
    const approvalInsert = vi.fn().mockResolvedValue({ error: null })

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
        if (table === 'sales') return { insert: saleInsert }
        if (table === 'sales_items') return { insert: lineInsert }
        if (table === 'approval_requests') return { insert: approvalInsert }
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const result = await createSaleEntry('org-1', {
      customer_id: 'cust-1',
      customer_name: 'PT Salam Jaya',
      sale_date: '2026-04-05',
      due_date: '2026-04-20',
      payment_term: 'TEMPO',
      shariah_mode: 'SALAM',
      lines: [{ product_name: 'Produk SALAM', quantity: 1, unit_price: 5000 }],
    })

    expect(result).toEqual({ success: true, saleId: 'sale-salam-1' })
    expect(saleInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_term: 'LUNAS',
        due_date: '2026-04-20',
        shariah_mode: 'SALAM',
      })
    )
  })

  it('requires due date for SALAM sales order creation', async () => {
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranches: [], accessibleBranchIds: ['branch-1'], canAccessAllBranches: false, membershipId: 'member-1', role: 'staff' },
      branchId: 'branch-1',
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

    const result = await createSaleEntry('org-1', {
      customer_id: 'cust-1',
      sale_date: '2026-04-05',
      payment_term: 'LUNAS',
      shariah_mode: 'SALAM',
      lines: [{ product_name: 'Produk SALAM', quantity: 1, unit_price: 5000 }],
    })

    expect(result).toEqual({ error: 'Tanggal jatuh tempo pengiriman wajib diisi.' })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('blocks non-SALAM invoice creation when stock is insufficient and suggests SALAM', async () => {
    const saleInsert = vi.fn()
    const lineInsert = vi.fn()
    const approvalInsert = vi.fn()
    const productsQuery = {
      select: vi.fn(() => productsQuery),
      eq: vi.fn(() => productsQuery),
      in: vi.fn().mockResolvedValue({
        data: [{ id: 'prod-1', name: 'Produk A', type: 'INVENTORY' }],
        error: null,
      }),
    }
    const inventoryStocksQuery = {
      select: vi.fn(() => inventoryStocksQuery),
      eq: vi.fn(() => inventoryStocksQuery),
      in: vi.fn().mockResolvedValue({
        data: [{ product_id: 'prod-1', quantity: 2, warehouses: { branch_id: 'branch-1' } }],
        error: null,
      }),
    }

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
        if (table === 'inventory_stocks') return inventoryStocksQuery
        if (table === 'sales') return { insert: saleInsert }
        if (table === 'sales_items') return { insert: lineInsert }
        if (table === 'approval_requests') return { insert: approvalInsert }
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const result = await createSaleEntry('org-1', {
      customer_id: 'cust-1',
      sale_date: '2026-04-06',
      due_date: '2026-04-16',
      payment_term: 'TEMPO',
      shariah_mode: 'CASH',
      lines: [{ product_id: 'prod-1', product_name: 'Produk A', quantity: 5, unit_price: 1000 }],
    })

    expect(result).toEqual({
      error:
        'Stok produk "Produk A" tidak mencukupi untuk invoice biasa. Dibutuhkan 5, tersedia 2. Ubah transaksi ke akad SALAM agar pesanan tetap bisa dicatat tanpa mengurangi stok saat ini.',
    })
    expect(saleInsert).not.toHaveBeenCalled()
    expect(lineInsert).not.toHaveBeenCalled()
    expect(approvalInsert).not.toHaveBeenCalled()
  })

  it('allows SALAM invoice creation even when inventory stock is currently insufficient', async () => {
    const saleSingle = vi.fn().mockResolvedValue({
      data: { id: 'sale-salam-stock-1' },
      error: null,
    })
    const saleInsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: saleSingle,
      })),
    }))
    const lineInsert = vi.fn().mockResolvedValue({ error: null })
    const approvalInsert = vi.fn().mockResolvedValue({ error: null })

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
        if (table === 'sales') return { insert: saleInsert }
        if (table === 'sales_items') return { insert: lineInsert }
        if (table === 'approval_requests') return { insert: approvalInsert }
        if (table === 'products' || table === 'inventory_stocks') {
          throw new Error('Stock check should not run for SALAM mode')
        }
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const result = await createSaleEntry('org-1', {
      customer_id: 'cust-1',
      customer_name: 'PT Salam Stock',
      sale_date: '2026-04-06',
      due_date: '2026-04-22',
      payment_term: 'TEMPO',
      shariah_mode: 'SALAM',
      lines: [{ product_id: 'prod-1', product_name: 'Produk A', quantity: 50, unit_price: 1000 }],
    })

    expect(result).toEqual({ success: true, saleId: 'sale-salam-stock-1' })
    expect(saleInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_term: 'LUNAS',
        shariah_mode: 'SALAM',
      })
    )
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
    mocks.getActiveBranch.mockResolvedValue(null)

    const result = await processPosTransaction('org-1', {
      lines: [{ product_id: 'prod-1', product_name: 'Produk A', quantity: 1, unit_price: 1000 }],
      account_id: 'cash-1',
      notes: 'POS',
    })

    expect(result).toEqual({
      error: 'Pilih unit aktif terlebih dahulu untuk memproses transaksi POS.',
    })
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled()
  })

  it('stamps active branch on POS sales transaction', async () => {
    const productsQuery = {
      select: vi.fn(() => productsQuery),
      eq: vi.fn(() => productsQuery),
      in: vi.fn(() => Promise.resolve({
        data: [{ id: 'prod-1', type: 'INVENTORY', name: 'Produk A' }],
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
    const inventoryStocksQuery = {
      select: vi.fn(() => inventoryStocksQuery),
      eq: vi.fn(() => inventoryStocksQuery),
      in: vi.fn().mockResolvedValue({
        data: [{ product_id: 'prod-1', quantity: 10 }],
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
        if (table === 'inventory_stocks') return inventoryStocksQuery
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
    expect(mocks.prisma.products.findMany).toHaveBeenCalledWith({
      where: {
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
        data: { status: 'ORDERED', warehouse_id: null, shariah_mode: 'CASH' },
      }),
    }
    const saleItemsQuery = {
      select: vi.fn(() => saleItemsQuery),
      eq: vi.fn(() => saleItemsQuery),
    }
    saleItemsQuery.eq = vi.fn((column: string, value: string) => {
      if (column === 'sale_id' && value === 'sale-1') {
        return Promise.resolve({
          data: [{ product_id: 'prod-1', quantity: 1, products: { name: 'Produk A', type: 'INVENTORY' } }],
          error: null,
        })
      }
      return saleItemsQuery
    })
    const inventoryStocksQuery = {
      select: vi.fn(() => inventoryStocksQuery),
      eq: vi.fn(() => inventoryStocksQuery),
      in: vi.fn().mockResolvedValue({
        data: [{ product_id: 'prod-1', quantity: 5 }],
        error: null,
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
        if (table === 'sales_items') return saleItemsQuery
        if (table === 'inventory_stocks') return inventoryStocksQuery
        if (table === 'warehouses') return warehouseQuery
        throw new Error(`Unexpected table ${table}`)
      }),
      rpc: rpcMock,
    })
    expect(mocks.tx.$queryRaw.mock.calls[0]).toEqual(
      expect.arrayContaining(['org-1', 'branch-1', 'wh-1', 'cust-walkin'])
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
    expect(
      mocks.tx.$executeRaw.mock.calls.some((call) =>
        JSON.stringify(call).includes('process_sales_delivery_atomic') &&
        JSON.stringify(call).includes('sale-1') &&
        JSON.stringify(call).includes('wh-1')
      )
    ).toBe(true)
    expect(
      mocks.tx.$queryRaw.mock.calls.some((call) =>
        JSON.stringify(call).includes('process_sales_payment_atomic') &&
        JSON.stringify(call).includes('sale-1') &&
        JSON.stringify(call).includes('cash-1')
      )
    ).toBe(true)
  })

  it('blocks delivery when stock is insufficient for non-SALAM sales', async () => {
    const saleQuery = {
      select: vi.fn(() => saleQuery),
      eq: vi.fn(() => saleQuery),
      single: vi.fn().mockResolvedValue({
        data: { status: 'ORDERED', warehouse_id: null, shariah_mode: 'CASH' },
      }),
    }
    const saleItemsQuery = {
      select: vi.fn(() => saleItemsQuery),
      eq: vi.fn(() => saleItemsQuery),
    }
    saleItemsQuery.eq = vi.fn((column: string, value: string) => {
      if (column === 'sale_id' && value === 'sale-1') {
        return Promise.resolve({
          data: [{ product_id: 'prod-1', quantity: 5, products: { name: 'Produk A', type: 'INVENTORY' } }],
          error: null,
        })
      }
      return saleItemsQuery
    })
    const inventoryStocksQuery = {
      select: vi.fn(() => inventoryStocksQuery),
      eq: vi.fn(() => inventoryStocksQuery),
      in: vi.fn().mockResolvedValue({
        data: [{ product_id: 'prod-1', quantity: 2 }],
        error: null,
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
    const rpcMock = vi.fn()

    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranches: [], accessibleBranchIds: ['branch-1'], canAccessAllBranches: false, membershipId: 'member-1', role: 'staff' },
      branchId: 'branch-1',
    })
    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'sales') return saleQuery
        if (table === 'sales_items') return saleItemsQuery
        if (table === 'inventory_stocks') return inventoryStocksQuery
        if (table === 'warehouses') return warehouseQuery
        throw new Error(`Unexpected table ${table}`)
      }),
      rpc: rpcMock,
    })

    const result = await deliverSale('org-1', 'sale-1', 'wh-1')

    expect(result).toEqual({
      error: 'Stok tidak cukup untuk produk "Produk A". Dibutuhkan 5, tersedia 2. Penjualan tidak boleh melebihi stok (kecuali akad SALAM).',
    })
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('blocks SALAM delivery when invoice is not fully paid yet', async () => {
    const saleQuery = {
      select: vi.fn(() => saleQuery),
      eq: vi.fn(() => saleQuery),
      single: vi.fn().mockResolvedValue({
        data: { status: 'ORDERED', warehouse_id: 'wh-1', shariah_mode: 'SALAM', payment_status: 'UNPAID' },
      }),
    }
    const rpcMock = vi.fn()

    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranches: [], accessibleBranchIds: ['branch-1'], canAccessAllBranches: false, membershipId: 'member-1', role: 'staff' },
      branchId: 'branch-1',
    })
    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'sales') return saleQuery
        throw new Error(`Unexpected table ${table}`)
      }),
      rpc: rpcMock,
    })

    const result = await deliverSale('org-1', 'sale-1', 'wh-1')

    expect(result).toEqual({
      error: 'Akad SALAM wajib lunas terlebih dahulu sebelum pengiriman barang.',
    })
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('voids sales order via atomic RPC to keep inventory and ledger synchronized', async () => {
    const saleQuery = {
      select: vi.fn(() => saleQuery),
      eq: vi.fn(() => saleQuery),
      single: vi.fn().mockResolvedValue({
        data: { status: 'FINISHED' },
      }),
    }
    const approvalUpdate = {
      update: vi.fn(() => approvalUpdate),
      eq: vi.fn(() => approvalUpdate),
    }
    const rpcMock = vi.fn().mockResolvedValue({
      data: { success: true },
      error: null,
    })

    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranches: [], accessibleBranchIds: ['branch-1'], canAccessAllBranches: false, membershipId: 'member-1', role: 'admin' },
      branchId: 'branch-1',
    })
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'sales') return saleQuery
        if (table === 'approval_requests') return approvalUpdate
        throw new Error(`Unexpected table ${table}`)
      }),
      rpc: rpcMock,
    })

    const result = await voidSale('org-1', 'sale-1')

    expect(result).toEqual({ success: true })
    expect(rpcMock).toHaveBeenCalledWith('void_sale_atomic', {
      p_org_id: 'org-1',
      p_sale_id: 'sale-1',
      p_user_id: 'user-1',
      p_reason: 'Pembatalan Sales Order',
    })
  })

  it('falls back to non-RPC void flow when void_sale_atomic is unavailable in schema cache', async () => {
    const saleQuery = {
      select: vi.fn(() => saleQuery),
      eq: vi.fn(() => saleQuery),
      single: vi.fn().mockResolvedValue({
        data: { status: 'FINISHED', warehouse_id: 'wh-1' },
      }),
      update: vi.fn(() => saleQuery),
    }
    const stockMovementQuery = {
      select: vi.fn(() => stockMovementQuery),
      eq: vi.fn(() => stockMovementQuery),
      delete: vi.fn(() => stockMovementQuery),
    }
    let stockMovementEqCount = 0
    stockMovementQuery.eq = vi.fn(() => {
      stockMovementEqCount += 1
      if (stockMovementEqCount === 3) {
        return Promise.resolve({
          data: [{ product_id: 'prod-1', quantity: -2 }],
          error: null,
        })
      }
      if (stockMovementEqCount === 6) {
        return Promise.resolve({ error: null })
      }
      return stockMovementQuery
    })
    const journalEntryQuery = {
      update: vi.fn(() => journalEntryQuery),
      eq: vi.fn(() => journalEntryQuery),
    }
    journalEntryQuery.eq = vi.fn((column: string) => {
      if (column === 'status') {
        return Promise.resolve({ error: null })
      }
      return journalEntryQuery
    })
    const approvalUpdate = {
      update: vi.fn(() => approvalUpdate),
      eq: vi.fn(() => approvalUpdate),
    }

    const rpcMock = vi.fn(async (fn: string) => {
      if (fn === 'void_sale_atomic') {
        return {
          data: null,
          error: {
            code: 'PGRST202',
            message: 'Could not find the function public.void_sale_atomic(p_org_id, p_reason, p_sale_id, p_user_id) in the schema cache',
          },
        }
      }
      if (fn === 'adjust_inventory_stock') {
        return { data: null, error: null }
      }
      throw new Error(`Unexpected rpc ${fn}`)
    })

    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranches: [], accessibleBranchIds: ['branch-1'], canAccessAllBranches: false, membershipId: 'member-1', role: 'admin' },
      branchId: 'branch-1',
    })
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'sales') return saleQuery
        if (table === 'stock_movements') return stockMovementQuery
        if (table === 'journal_entries') return journalEntryQuery
        if (table === 'approval_requests') return approvalUpdate
        throw new Error(`Unexpected table ${table}`)
      }),
      rpc: rpcMock,
    })

    const result = await voidSale('org-1', 'sale-1')

    expect(result).toEqual({ success: true })
    expect(rpcMock).toHaveBeenCalledWith('void_sale_atomic', {
      p_org_id: 'org-1',
      p_sale_id: 'sale-1',
      p_user_id: 'user-1',
      p_reason: 'Pembatalan Sales Order',
    })
    expect(rpcMock).toHaveBeenCalledWith(
      'adjust_inventory_stock',
      expect.objectContaining({
        p_org_id: 'org-1',
        p_product_id: 'prod-1',
        p_warehouse_id: 'wh-1',
        p_diff: 2,
      })
    )
  })
})
