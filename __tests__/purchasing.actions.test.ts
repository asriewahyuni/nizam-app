import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  prisma: {
    purchases: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    purchase_requests: { findMany: vi.fn(), createMany: vi.fn() },
    products: { create: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
    inventory_stocks: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    warehouses: { findFirst: vi.fn() },
    stock_movements: { createMany: vi.fn() },
    accounts: { findMany: vi.fn() },
    journal_entries: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
  getMembership: vi.fn(),
  revalidatePath: vi.fn(),
  createJournalEntry: vi.fn(),
  resolveAccessibleBranchSelection: vi.fn(),
  getBranchAccessScope: vi.fn(),
  withDbUserContext: vi.fn(),
}))

vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }))
vi.mock('@/lib/auth/permissions', () => ({ getMembership: mocks.getMembership }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/modules/accounting/actions/journal.actions', () => ({ createJournalEntry: mocks.createJournalEntry }))
vi.mock('@/modules/organization/lib/branch-access.server', () => ({ resolveAccessibleBranchSelection: mocks.resolveAccessibleBranchSelection, getBranchAccessScope: mocks.getBranchAccessScope }))
vi.mock('@/modules/sales/lib/sales-write.server', () => ({ withDbUserContext: mocks.withDbUserContext }))

import { createPurchaseRequests } from '@/modules/factory/actions/factory.actions'
import { createPurchaseEntry, getPurchaseRequests, receivePurchase } from '@/modules/purchasing/actions/purchasing.actions'

describe('Purchasing Branch Context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.getMembership.mockResolvedValue({ role: 'admin', permissions: ['purchasing'] })
  })

  it('rejects purchase creation when branch does not belong to active org', async () => {
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({ error: 'Anda tidak memiliki akses ke unit tersebut.' })

    const result = await createPurchaseEntry('org-1', {
      vendor_id: 'vendor-1',
      branch_id: 'branch-x',
      purchase_date: '2026-04-02',
      payment_term: 'TEMPO',
      lines: [{ product_id: 'prod-1', product_name: 'Baut', quantity: 2, unit_price: 1000 }],
    })

    expect(result).toEqual({ error: 'Pilih unit aktif terlebih dahulu untuk membuat pembelian.' })
  })

  it('passes branch_id into purchase transaction when branch is valid', async () => {
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({ scope: { accessibleBranchIds: ['branch-1'] }, branchId: 'branch-1' })
    mocks.withDbUserContext.mockResolvedValue({ success: true, purchase_id: 'po-1' })

    const result = await createPurchaseEntry('org-1', {
      vendor_id: 'vendor-1',
      branch_id: 'branch-1',
      purchase_date: '2026-04-02',
      payment_term: 'TEMPO',
      lines: [{ product_id: 'prod-1', product_name: 'Baut', quantity: 2, unit_price: 1000 }],
    })

    expect(result).toEqual({ success: true, purchase_id: 'po-1' })
    expect(mocks.withDbUserContext).toHaveBeenCalled()
  })

  it('filters purchase requests by branch when a unit is active', async () => {
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({ scope: { accessibleBranchIds: ['branch-1'] }, branchId: 'branch-1' })
    mocks.prisma.purchase_requests.findMany.mockResolvedValue([])

    await getPurchaseRequests('org-1', 'branch-1')

    expect(mocks.prisma.purchase_requests.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ org_id: 'org-1', branch_id: 'branch-1' }) }))
  })

  it('stamps active branch on manufacturing purchase requests', async () => {
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({ scope: { accessibleBranchIds: ['branch-1'] }, branchId: 'branch-1' })
    mocks.prisma.purchase_requests.createMany.mockResolvedValue({ count: 1 })

    const result = await createPurchaseRequests('org-1', [{ productId: 'prod-1', productName: 'Steel', quantity: 10, unit: 'Pcs', notes: '', sourceId: 'wo-1' }])

    expect(result).toEqual({ success: true, count: 1 })
    expect(mocks.prisma.purchase_requests.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.arrayContaining([expect.objectContaining({ org_id: 'org-1', branch_id: 'branch-1', requester_id: 'user-1' })]) }))
  })

  it('rejects receiving a branch PO when no active warehouse is available', async () => {
    mocks.prisma.purchases.findFirst.mockResolvedValue({ id: 'po-1', org_id: 'org-1', status: 'APPROVED', shariah_mode: 'CASH', payment_status: 'PAID', warehouse_id: null, branch_id: 'branch-1', purchase_items: [] })
    mocks.prisma.warehouses.findFirst.mockResolvedValue(null)

    const result = await receivePurchase('org-1', 'po-1')

    expect(result).toEqual({ error: 'Gudang operasional tidak ditemukan pada cabang terkait' })
  })

  it('falls back to direct stock sync when adjust_inventory_stock is missing from schema cache', async () => {
    const callback = vi.fn(async (tx: any) => {
      await tx.$executeRaw`SELECT 1`
    })
    mocks.prisma.$transaction.mockImplementation(async (fn: any) => fn({ $executeRaw: vi.fn().mockRejectedValue({ code: 'PGRST202', message: 'adjust_inventory_stock schema cache' }) }))
    mocks.prisma.products.findMany.mockResolvedValue([])
    mocks.prisma.inventory_stocks = { findMany: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({ id: 'stock-1' }), update: vi.fn() } as any

    expect(callback).not.toHaveBeenCalled()
  })
})
