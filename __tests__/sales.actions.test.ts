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
    mocks.getActiveBranch.mockResolvedValue({
      id: 'branch-1',
      org_id: 'org-1',
      name: 'Unit A',
      code: 'UA',
      address: null,
      is_active: true,
    })
    mocks.prisma.products.findMany.mockResolvedValue([{ id: 'prod-1', type: 'INVENTORY' }])
    mocks.prisma.warehouses.findFirst.mockResolvedValue({ id: 'wh-1' })
    mocks.tx.contacts.findFirst.mockResolvedValue({ id: 'cust-walkin' })
    mocks.tx.$queryRaw
      .mockResolvedValueOnce([{ id: 'sale-1' }])
      .mockResolvedValueOnce([{ result: { success: true, payment_id: 'pay-1' } }])
    mocks.tx.sales_items.createMany.mockResolvedValue({ count: 1 })
    mocks.tx.$executeRaw.mockResolvedValue(1)

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
        id: {
          in: ['prod-1'],
        },
      },
      select: {
        id: true,
        type: true,
      },
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
})
