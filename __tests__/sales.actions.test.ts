import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
  getActiveBranch: vi.fn(),
  resolveAccessibleBranchSelection: vi.fn(),
  queryPostgres: vi.fn(),
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

vi.mock('@/lib/db/postgres', () => ({
  queryPostgres: mocks.queryPostgres,
}))

import { processPosTransaction } from '@/modules/sales/actions/pos.actions'
import { createSaleEntry, deliverSale, getSales, voidSale } from '@/modules/sales/actions/sales.actions'

function createOrderedSalesLookup(rows: any[] = []) {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    then: (resolve: (value: { data: any[]; error: null }) => unknown) => resolve({ data: rows, error: null }),
  }

  return builder
}

describe('Sales Branch Context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createClient.mockReset()
    mocks.queryPostgres.mockReset()
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

  it('keeps ISTISHNA sales on TEMPO so down payment can be recorded bertahap', async () => {
    const saleSingle = vi.fn().mockResolvedValue({
      data: { id: 'sale-istishna-1' },
      error: null,
    })
    const saleInsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: saleSingle,
      })),
    }))
    const lineInsert = vi.fn().mockResolvedValue({ error: null })
    const approvalInsert = vi.fn().mockResolvedValue({ error: null })
    const orderedSalesLookup = createOrderedSalesLookup([])
    const productsQuery = {
      select: vi.fn(() => productsQuery),
      eq: vi.fn(() => productsQuery),
      in: vi.fn().mockResolvedValue({
        data: [{ id: 'prod-1', name: 'Produk ISTISHNA', type: 'INVENTORY' }],
        error: null,
      }),
    }
    const inventoryStocksQuery = {
      select: vi.fn(() => inventoryStocksQuery),
      eq: vi.fn(() => inventoryStocksQuery),
      in: vi.fn().mockResolvedValue({
        data: [{ product_id: 'prod-1', quantity: 10, warehouses: { branch_id: 'branch-1' } }],
        error: null,
      }),
    }
    const productionBomsQuery = {
      select: vi.fn(() => productionBomsQuery),
      eq: vi.fn(() => productionBomsQuery),
      in: vi.fn(() => productionBomsQuery),
      or: vi.fn().mockResolvedValue({
        data: [{ id: 'bom-1', product_id: 'prod-1', branch_id: 'branch-1' }],
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
        if (table === 'production_boms') return productionBomsQuery
        if (table === 'sales') return { ...orderedSalesLookup, insert: saleInsert }
        if (table === 'sales_items') return { insert: lineInsert }
        if (table === 'approval_requests') return { insert: approvalInsert }
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const result = await createSaleEntry('org-1', {
      customer_id: 'cust-1',
      customer_name: 'PT Istishna Maju',
      sale_date: '2026-04-05',
      due_date: '2026-04-20',
      payment_term: 'TEMPO',
      shariah_mode: 'ISTISHNA',
      lines: [{ product_id: 'prod-1', product_name: 'Produk ISTISHNA', quantity: 1, unit_price: 5000 }],
    })

    expect(result).toEqual({ success: true, saleId: 'sale-istishna-1' })
    expect(saleInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_term: 'TEMPO',
        due_date: '2026-04-20',
        shariah_mode: 'ISTISHNA',
      })
    )
  })

  it('auto-converts shortage without BoM into SALAM sales order', async () => {
    const saleSingle = vi.fn().mockResolvedValue({
      data: { id: 'sale-auto-salam-1' },
      error: null,
    })
    const saleInsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: saleSingle,
      })),
    }))
    const lineInsert = vi.fn().mockResolvedValue({ error: null })
    const approvalInsert = vi.fn().mockResolvedValue({ error: null })
    const orderedSalesLookup = createOrderedSalesLookup([])
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
    const productionBomsQuery = {
      select: vi.fn(() => productionBomsQuery),
      eq: vi.fn(() => productionBomsQuery),
      in: vi.fn(() => productionBomsQuery),
      or: vi.fn().mockResolvedValue({
        data: [],
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
        if (table === 'production_boms') return productionBomsQuery
        if (table === 'sales') return { ...orderedSalesLookup, insert: saleInsert }
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

    expect(result).toEqual({ success: true, saleId: 'sale-auto-salam-1' })
    expect(saleInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        shariah_mode: 'SALAM',
        payment_term: 'LUNAS',
        due_date: '2026-04-16',
      })
    )
    expect(lineInsert).toHaveBeenCalled()
    expect(approvalInsert).toHaveBeenCalled()
  })

  it('auto-converts shortage with active BoM into ISTISHNA sales order', async () => {
    const saleSingle = vi.fn().mockResolvedValue({
      data: { id: 'sale-auto-istishna-1' },
      error: null,
    })
    const saleInsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: saleSingle,
      })),
    }))
    const lineInsert = vi.fn().mockResolvedValue({ error: null })
    const approvalInsert = vi.fn().mockResolvedValue({ error: null })
    const orderedSalesLookup = createOrderedSalesLookup([])
    const productsQuery = {
      select: vi.fn(() => productsQuery),
      eq: vi.fn(() => productsQuery),
      in: vi.fn().mockResolvedValue({
        data: [{ id: 'prod-1', name: 'Produk BoM', type: 'INVENTORY' }],
        error: null,
      }),
    }
    const inventoryStocksQuery = {
      select: vi.fn(() => inventoryStocksQuery),
      eq: vi.fn(() => inventoryStocksQuery),
      in: vi.fn().mockResolvedValue({
        data: [{ product_id: 'prod-1', quantity: 1, warehouses: { branch_id: 'branch-1' } }],
        error: null,
      }),
    }
    const productionBomsQuery = {
      select: vi.fn(() => productionBomsQuery),
      eq: vi.fn(() => productionBomsQuery),
      in: vi.fn(() => productionBomsQuery),
      or: vi.fn().mockResolvedValue({
        data: [{ id: 'bom-1', product_id: 'prod-1', branch_id: 'branch-1' }],
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
        if (table === 'production_boms') return productionBomsQuery
        if (table === 'sales') return { ...orderedSalesLookup, insert: saleInsert }
        if (table === 'sales_items') return { insert: lineInsert }
        if (table === 'approval_requests') return { insert: approvalInsert }
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const result = await createSaleEntry('org-1', {
      customer_id: 'cust-1',
      sale_date: '2026-04-06',
      due_date: '2026-04-18',
      payment_term: 'TEMPO',
      shariah_mode: 'CASH',
      lines: [{ product_id: 'prod-1', product_name: 'Produk BoM', quantity: 5, unit_price: 1000 }],
    })

    expect(result).toEqual({ success: true, saleId: 'sale-auto-istishna-1' })
    expect(saleInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        shariah_mode: 'ISTISHNA',
        payment_term: 'TEMPO',
        due_date: '2026-04-18',
      })
    )
  })

  it('rejects mixed shortage that would require both ISTISHNA and SALAM in one SO', async () => {
    const saleInsert = vi.fn()
    const lineInsert = vi.fn()
    const approvalInsert = vi.fn()
    const orderedSalesLookup = createOrderedSalesLookup([])
    const productsQuery = {
      select: vi.fn(() => productsQuery),
      eq: vi.fn(() => productsQuery),
      in: vi.fn().mockResolvedValue({
        data: [
          { id: 'prod-bom', name: 'Produk Produksi', type: 'INVENTORY' },
          { id: 'prod-salam', name: 'Produk Salam', type: 'INVENTORY' },
        ],
        error: null,
      }),
    }
    const inventoryStocksQuery = {
      select: vi.fn(() => inventoryStocksQuery),
      eq: vi.fn(() => inventoryStocksQuery),
      in: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    }
    const productionBomsQuery = {
      select: vi.fn(() => productionBomsQuery),
      eq: vi.fn(() => productionBomsQuery),
      in: vi.fn(() => productionBomsQuery),
      or: vi.fn().mockResolvedValue({
        data: [{ id: 'bom-1', product_id: 'prod-bom', branch_id: 'branch-1' }],
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
        if (table === 'production_boms') return productionBomsQuery
        if (table === 'sales') return { ...orderedSalesLookup, insert: saleInsert }
        if (table === 'sales_items') return { insert: lineInsert }
        if (table === 'approval_requests') return { insert: approvalInsert }
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const result = await createSaleEntry('org-1', {
      customer_id: 'cust-1',
      sale_date: '2026-04-06',
      due_date: '2026-04-20',
      payment_term: 'TEMPO',
      shariah_mode: 'CASH',
      lines: [
        { product_id: 'prod-bom', product_name: 'Produk Produksi', quantity: 5, unit_price: 1000 },
        { product_id: 'prod-salam', product_name: 'Produk Salam', quantity: 2, unit_price: 2000 },
      ],
    })

    expect(result).toEqual({
      error: 'SO ini mencampur produk yang harus diproduksi dan yang harus dipesan tanpa produksi. Produk "Produk Produksi" harus memakai akad ISTISHNA karena punya BoM aktif, sedangkan "Produk Salam" harus memakai akad SALAM karena tidak punya BoM. Pisahkan ke SO terpisah.',
    })
    expect(saleInsert).not.toHaveBeenCalled()
    expect(lineInsert).not.toHaveBeenCalled()
    expect(approvalInsert).not.toHaveBeenCalled()
  })

  it('blocks non-SALAM invoice creation when stock is still physically available but already allocated to ordered SO lain', async () => {
    const saleInsert = vi.fn()
    const lineInsert = vi.fn()
    const approvalInsert = vi.fn()
    const orderedSalesLookup = createOrderedSalesLookup([
      {
        id: 'sale-ordered-1',
        sales_items: [{ product_id: 'prod-1', quantity: 8 }],
      },
    ])
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
        data: [{ product_id: 'prod-1', quantity: 10, warehouses: { branch_id: 'branch-1' } }],
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
        if (table === 'sales') return { ...orderedSalesLookup, insert: saleInsert }
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
      error: 'Stok produk "Produk A" tidak cukup. Stok fisik 10, sudah dialokasikan ke SO lain 8, tersedia dijual 2, permintaan 5.',
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

  it('retries creating sales order without commission snapshot columns when schema cache is still old', async () => {
    const saleSingle = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: 'PGRST204',
          message: "Could not find the 'commission_type' column of 'sales' in the schema cache",
        },
      })
      .mockResolvedValueOnce({
        data: { id: 'sale-legacy-1' },
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
      customer_name: 'PT Legacy Cache',
      sale_date: '2026-04-08',
      due_date: '2026-04-15',
      payment_term: 'TEMPO',
      lines: [{ product_name: 'Produk A', quantity: 1, unit_price: 1000 }],
    })

    expect(result).toEqual({ success: true, saleId: 'sale-legacy-1' })
    expect(saleInsert).toHaveBeenCalledTimes(2)
    const saleInsertCalls = saleInsert.mock.calls as unknown as Array<[Record<string, unknown>]>
    const firstInsertPayload = saleInsertCalls[0]?.[0]
    const secondInsertPayload = saleInsertCalls[1]?.[0]

    expect(firstInsertPayload).toEqual(
      expect.objectContaining({
        commission_type: null,
        commission_value: null,
        reseller_id: null,
      })
    )
    expect(secondInsertPayload).not.toHaveProperty('commission_type')
    expect(secondInsertPayload).not.toHaveProperty('commission_value')
    expect(secondInsertPayload).not.toHaveProperty('reseller_id')
  })

  it('filters sales list by branch when a unit is active', async () => {
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranches: [], accessibleBranchIds: ['branch-1'], canAccessAllBranches: false, membershipId: 'member-1', role: 'staff' },
      branchId: 'branch-1',
    })
    mocks.queryPostgres.mockResolvedValueOnce({ rows: [] })

    await getSales('org-1', 'branch-1')

    expect(mocks.queryPostgres).toHaveBeenCalledWith(
      expect.stringContaining('WHERE  s.org_id = $1 AND s.branch_id = $2'),
      ['org-1', 'branch-1']
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
    const organizationsQuery = {
      select: vi.fn(() => organizationsQuery),
      eq: vi.fn(() => organizationsQuery),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { settings: {} },
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
        if (table === 'organizations') return organizationsQuery
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
      payment_method: 'CASH',
      amount_tendered: 1000,
      change_amount: 0,
      notes: 'POS',
    })

    expect(result).toEqual({ success: true, saleId: 'sale-1' })
    expect(salesInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-1',
        branch_id: 'branch-1',
        warehouse_id: 'wh-1',
        pos_payment_method: 'CASH',
        pos_amount_tendered: 1000,
        pos_change_amount: 0,
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
        data: { status: 'ORDERED', warehouse_id: null, shariah_mode: 'CASH' },
      }),
    }
    const saleItemsQuery: any = {
      select: vi.fn(() => saleItemsQuery),
      eq: vi.fn((..._args: any[]) => saleItemsQuery),
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

    const result = await deliverSale('org-1', 'sale-1', 'wh-1')

    expect(result).toEqual({ success: true })
    expect(rpcMock).toHaveBeenCalledWith('process_sales_delivery_atomic', {
      p_org_id: 'org-1',
      p_sale_id: 'sale-1',
      p_warehouse_id: 'wh-1',
    })
  })

  it('maps duplicate sales delivery journal collisions into a friendly message', async () => {
    const saleQuery = {
      select: vi.fn(() => saleQuery),
      eq: vi.fn(() => saleQuery),
      single: vi.fn().mockResolvedValue({
        data: { status: 'ORDERED', warehouse_id: null, shariah_mode: 'CASH' },
      }),
    }
    const saleItemsQuery: any = {
      select: vi.fn(() => saleItemsQuery),
      eq: vi.fn((..._args: any[]) => saleItemsQuery),
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
    const rpcMock = vi.fn().mockResolvedValue({
      error: {
        code: '23505',
        message: 'duplicate key value violates unique constraint "uq_journal_ref_per_org"',
      },
    })

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
      error: 'Sales ini sudah memiliki jurnal delivery. Sistem menolak membuat jurnal SALE ganda. Muat ulang data; jika status sales masih belum selesai, rekonsiliasi jurnal delivery lama terlebih dahulu.',
    })
  })

  it('blocks delivery when stock is insufficient for non-SALAM sales', async () => {
    const saleQuery = {
      select: vi.fn(() => saleQuery),
      eq: vi.fn(() => saleQuery),
      single: vi.fn().mockResolvedValue({
        data: { status: 'ORDERED', warehouse_id: null, shariah_mode: 'CASH' },
      }),
    }
    const saleItemsQuery: any = {
      select: vi.fn(() => saleItemsQuery),
      eq: vi.fn((..._args: any[]) => saleItemsQuery),
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
    const productionBomsQuery = {
      select: vi.fn(() => productionBomsQuery),
      eq: vi.fn(() => productionBomsQuery),
      in: vi.fn(() => productionBomsQuery),
      or: vi.fn().mockResolvedValue({
        data: [],
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
        if (table === 'production_boms') return productionBomsQuery
        if (table === 'warehouses') return warehouseQuery
        throw new Error(`Unexpected table ${table}`)
      }),
      rpc: rpcMock,
    })

    const result = await deliverSale('org-1', 'sale-1', 'wh-1')

    expect(result).toMatchObject({
      error: expect.stringContaining('Stok tidak cukup untuk produk "Produk A"'),
      code: 'DELIVERY_STOCK_SHORTAGE',
    })
    expect((result as any).shortages).toEqual([
      expect.objectContaining({
        productId: 'prod-1',
        resolution: 'PURCHASING',
        requiredQty: 5,
        availableQty: 2,
        shortageQty: 3,
      }),
    ])
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('blocks paid SALAM delivery when stock is insufficient and suggests production from BoM', async () => {
    const saleQuery = {
      select: vi.fn(() => saleQuery),
      eq: vi.fn(() => saleQuery),
      single: vi.fn().mockResolvedValue({
        data: { status: 'ORDERED', warehouse_id: 'wh-1', shariah_mode: 'SALAM', payment_status: 'PAID' },
      }),
    }
    const saleItemsQuery: any = {
      select: vi.fn(() => saleItemsQuery),
      eq: vi.fn((..._args: any[]) => saleItemsQuery),
    }
    saleItemsQuery.eq = vi.fn((column: string, value: string) => {
      if (column === 'sale_id' && value === 'sale-1') {
        return Promise.resolve({
          data: [{ product_id: 'prod-1', quantity: 4, products: { name: 'Produk A', type: 'INVENTORY', unit: 'Pcs' } }],
          error: null,
        })
      }
      return saleItemsQuery
    })
    const inventoryStocksQuery = {
      select: vi.fn(() => inventoryStocksQuery),
      eq: vi.fn(() => inventoryStocksQuery),
      in: vi.fn().mockResolvedValue({
        data: [{ product_id: 'prod-1', quantity: 0 }],
        error: null,
      }),
    }
    const productionBomsQuery = {
      select: vi.fn(() => productionBomsQuery),
      eq: vi.fn(() => productionBomsQuery),
      in: vi.fn(() => productionBomsQuery),
      or: vi.fn().mockResolvedValue({
        data: [{ id: 'bom-1', product_id: 'prod-1', branch_id: 'branch-1' }],
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
        if (table === 'production_boms') return productionBomsQuery
        if (table === 'warehouses') return warehouseQuery
        throw new Error(`Unexpected table ${table}`)
      }),
      rpc: rpcMock,
    })

    const result = await deliverSale('org-1', 'sale-1', 'wh-1')

    expect(result).toMatchObject({
      error: expect.stringContaining('Stok tidak cukup untuk produk "Produk A"'),
      code: 'DELIVERY_STOCK_SHORTAGE',
    })
    expect((result as any).shortages).toEqual([
      expect.objectContaining({
        productId: 'prod-1',
        resolution: 'PRODUCTION',
        bomId: 'bom-1',
        requiredQty: 4,
        availableQty: 0,
        shortageQty: 4,
      }),
    ])
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
    const stockMovementQuery: any = {
      select: vi.fn(() => stockMovementQuery),
      eq: vi.fn((..._args: any[]) => stockMovementQuery),
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
    const journalEntryQuery: any = {
      update: vi.fn(() => journalEntryQuery),
      eq: vi.fn((..._args: any[]) => journalEntryQuery),
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
