import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    sales: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    sales_items: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    approval_requests: {
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    contacts: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    journal_entries: {
      update: vi.fn(),
      findFirst: vi.fn(),
    },
    stock_movements: {
      deleteMany: vi.fn(),
    },
  }

  return {
    getActiveBranch: vi.fn(),
    resolveAccessibleBranchSelection: vi.fn(),
    getAuthUser: vi.fn(),
    revalidatePath: vi.fn(),
    withDbUserContext: vi.fn(),
    insertSaleHeader: vi.fn(),
    extractDatabaseError: vi.fn(),
    toNumber: vi.fn((v: unknown) => Number(v || 0)),
    prisma: {
      products: {
        findMany: vi.fn(),
      },
      inventory_stocks: {
        findMany: vi.fn(),
      },
      sales: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      sales_items: {
        findMany: vi.fn(),
      },
      approval_requests: {
        updateMany: vi.fn(),
      },
      warehouses: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    },
    tx,
  }
})

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }))
vi.mock('@/lib/auth/permissions', () => ({ getAuthUser: mocks.getAuthUser }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/modules/organization/actions/org.actions', () => ({ getActiveBranch: mocks.getActiveBranch }))
vi.mock('@/modules/organization/lib/branch-access.server', () => ({ resolveAccessibleBranchSelection: mocks.resolveAccessibleBranchSelection }))
vi.mock('@/modules/sales/lib/sales-write.server', () => ({
  withDbUserContext: mocks.withDbUserContext,
  insertSaleHeader: mocks.insertSaleHeader,
  extractDatabaseError: mocks.extractDatabaseError,
  toNumber: mocks.toNumber,
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

describe('Sales Actions (Prisma)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAuthUser.mockResolvedValue({ userId: 'user-1', email: 'sales@example.com', name: 'Sales User' })
    mocks.resolveAccessibleBranchSelection.mockResolvedValue(makeBranchSelection('branch-1'))
    mocks.withDbUserContext.mockImplementation(async (_userId: string, callback: any) => callback(mocks.tx))
    mocks.insertSaleHeader.mockResolvedValue('sale-1')
    mocks.extractDatabaseError.mockImplementation((error: any) => ({ message: error?.message || 'Unknown error', code: error?.code || null }))
    mocks.prisma.warehouses.findMany.mockResolvedValue([{ id: 'wh-1' }])
  })

  it('rejects creating sales order when no active branch is selected', async () => {
    mocks.resolveAccessibleBranchSelection.mockResolvedValue(makeBranchSelection(null))

    const result = await createSaleEntry('org-1', {
      customer_id: 'cust-1',
      sale_date: '2026-04-03',
      lines: [{ product_name: 'Produk A', quantity: 1, unit_price: 1000 }],
    })

    expect(result).toEqual({ error: 'Pilih unit aktif terlebih dahulu untuk membuat sales order.' })
    expect(mocks.withDbUserContext).not.toHaveBeenCalled()
  })

  it('stamps active branch on sales order lines and approval request', async () => {
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
    expect(mocks.insertSaleHeader).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      orgId: 'org-1',
      branchId: 'branch-1',
      customerId: 'cust-1',
    }))
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
      data: expect.objectContaining({ org_id: 'org-1', branch_id: 'branch-1', source_id: 'sale-1' }),
    })
  })

  it('forces SALAM sales to use LUNAS and keep due date', async () => {
    const result = await createSaleEntry('org-1', {
      customer_id: 'cust-1',
      customer_name: 'PT Salam Jaya',
      sale_date: '2026-04-05',
      due_date: '2026-04-20',
      payment_term: 'TEMPO',
      shariah_mode: 'SALAM',
      lines: [{ product_name: 'Produk SALAM', quantity: 1, unit_price: 5000 }],
    })

    expect(result).toEqual({ success: true, saleId: 'sale-1' })
    expect(mocks.insertSaleHeader).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ paymentTerm: 'LUNAS', dueDate: '2026-04-20', shariahMode: 'SALAM' }))
  })

  it('requires due date when creating SALAM order', async () => {
    const result = await createSaleEntry('org-1', {
      customer_id: 'cust-1',
      sale_date: '2026-04-05',
      payment_term: 'LUNAS',
      shariah_mode: 'SALAM',
      lines: [{ product_name: 'Produk SALAM', quantity: 1, unit_price: 5000 }],
    })

    expect(result).toEqual({ error: 'Tanggal jatuh tempo pengiriman wajib diisi.' })
    expect(mocks.withDbUserContext).not.toHaveBeenCalled()
  })

  it('filters sales list by active branch', async () => {
    mocks.prisma.sales.findMany.mockResolvedValue([])

    await getSales('org-1', 'branch-1')

    expect(mocks.prisma.sales.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ org_id: 'org-1', branch_id: 'branch-1' }) }))
  })

  it('delivers order via delivery RPC after branch-scoped validation', async () => {
    mocks.prisma.sales.findFirst.mockResolvedValue({ status: 'ORDERED', warehouse_id: null, shariah_mode: 'CASH', payment_status: 'UNPAID' })
    mocks.prisma.sales_items.findMany.mockResolvedValue([{ product_id: 'prod-1', quantity: 1, products: { name: 'Produk A', type: 'INVENTORY' } }])
    mocks.prisma.warehouses.findFirst.mockResolvedValue({ id: 'wh-1' })
    mocks.prisma.inventory_stocks.findMany.mockResolvedValue([{ product_id: 'prod-1', quantity: 10 }])

    const result = await deliverSale('org-1', 'sale-1', 'wh-1')

    expect(result).toEqual({ success: true, error: undefined })
    expect(mocks.tx.$executeRaw).toHaveBeenCalled()
  })

  it('voids sales order through atomic RPC and cancels pending approvals', async () => {
    mocks.prisma.sales.findFirst.mockResolvedValue({ status: 'FINISHED', warehouse_id: 'wh-1' })
    mocks.tx.$queryRaw.mockResolvedValue([{ result: { success: true } }])
    mocks.prisma.approval_requests.updateMany.mockResolvedValue({ count: 1 })

    const result = await voidSale('org-1', 'sale-1')

    expect(result).toEqual({ success: true, error: undefined })
    expect(mocks.tx.$queryRaw).toHaveBeenCalled()
    expect(mocks.prisma.approval_requests.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ source_id: 'sale-1', branch_id: 'branch-1' }) }))
  })

  it('rejects POS when active branch is missing', async () => {
    mocks.getActiveBranch.mockResolvedValue(null)

    const result = await processPosTransaction('org-1', {
      lines: [{ product_id: 'prod-1', product_name: 'Produk A', quantity: 1, unit_price: 1000 }],
      account_id: 'cash-1',
    })

    expect(result).toEqual({ error: 'Pilih unit aktif terlebih dahulu untuk memproses transaksi POS.' })
  })

  it('stamps active branch for POS and runs payment RPC query', async () => {
    mocks.getActiveBranch.mockResolvedValue({ id: 'branch-1', org_id: 'org-1' })
    mocks.prisma.products.findMany.mockResolvedValue([{ id: 'prod-1', type: 'INVENTORY', name: 'Produk A' }])
    mocks.prisma.warehouses.findFirst.mockResolvedValue({ id: 'wh-1' })
    mocks.prisma.inventory_stocks.findMany.mockResolvedValue([{ product_id: 'prod-1', quantity: 5 }])
    mocks.tx.contacts.findFirst.mockResolvedValue({ id: 'cust-walkin' })
    mocks.tx.$queryRaw.mockResolvedValue([{ result: { success: true } }])

    const result = await processPosTransaction('org-1', {
      warehouse_id: 'wh-1',
      lines: [{ product_id: 'prod-1', product_name: 'Produk A', quantity: 1, unit_price: 1000 }],
      account_id: 'cash-1',
      notes: 'POS',
    })

    expect(result).toEqual({ success: true, saleId: 'sale-1', error: undefined })
    expect(mocks.insertSaleHeader).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ branchId: 'branch-1', warehouseId: 'wh-1', paymentTerm: 'CASH' }))
    expect(mocks.tx.$queryRaw).toHaveBeenCalled()
  })
})
