import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  prisma: {
    warehouses: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    warehouse_bins: { findFirst: vi.fn(), delete: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    inventory_adjustments: { create: vi.fn() },
    inventory_adjustment_items: { createMany: vi.fn() },
    products: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
  revalidatePath: vi.fn(),
  resolveAccessibleBranchSelection: vi.fn(),
}))

vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/modules/organization/lib/branch-access.server', () => ({ resolveAccessibleBranchSelection: mocks.resolveAccessibleBranchSelection }))

import { createInventoryAdjustment, createInventoryTransfer } from '@/modules/inventory/actions/inventory.actions'
import { createWarehouse, deleteWarehouseBin, getWarehouses } from '@/modules/inventory/actions/warehouse.actions'

describe('Inventory Branch Context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
  })

  it('filters warehouses strictly by active branch', async () => {
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({ scope: { accessibleBranchIds: ['branch-1'] }, branchId: 'branch-1' })
    mocks.prisma.warehouses.findMany.mockResolvedValue([])

    await getWarehouses('org-1')

    expect(mocks.prisma.warehouses.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ org_id: 'org-1', branch_id: 'branch-1' }) }))
  })

  it('stamps active branch when creating a warehouse', async () => {
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({ scope: { accessibleBranchIds: ['branch-1'] }, branchId: 'branch-1' })
    mocks.prisma.warehouses.create.mockResolvedValue({ id: 'wh-1', org_id: 'org-1', branch_id: 'branch-1', code: 'GD-1', name: 'Gudang Unit A' })

    const result = await createWarehouse('org-1', { code: 'gd-1', name: 'Gudang Unit A' })

    expect(mocks.prisma.warehouses.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ org_id: 'org-1', branch_id: 'branch-1', code: 'GD-1' }) }))
    expect(result).toEqual({ success: true, data: expect.objectContaining({ id: 'wh-1' }) })
  })

  it('rejects creating a warehouse when no active branch is selected', async () => {
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({ scope: { accessibleBranchIds: [] }, branchId: null })

    const result = await createWarehouse('org-1', { code: 'gd-1', name: 'Gudang Unit A' })

    expect(result).toEqual({ error: 'Pilih unit aktif terlebih dahulu untuk mengelola gudang.' })
  })

  it('rejects stock adjustment when no active branch is selected', async () => {
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({ scope: { accessibleBranchIds: [] }, branchId: null })

    const result = await createInventoryAdjustment('org-1', { adj_date: '2026-04-03', type: 'STOCK_COUNT', notes: 'Test', items: [] })

    expect(result).toEqual({ error: 'Pilih unit aktif terlebih dahulu untuk melakukan stok opname atau write-off.' })
  })

  it('rejects stock transfer when one warehouse is outside the active branch', async () => {
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({ scope: { accessibleBranchIds: ['branch-1'] }, branchId: 'branch-1' })
    mocks.prisma.warehouses.findMany?.mockResolvedValue?.([])

    const result = await createInventoryTransfer('org-1', { transfer_date: '2026-04-03', source_wh_id: 'wh-1', target_wh_id: 'wh-2', notes: 'Transfer', items: [] })

    expect(result).toEqual({ error: 'Gudang transfer tidak tersedia pada unit aktif.' })
  })

  it('rejects deleting warehouse bin outside the active branch', async () => {
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({ scope: { accessibleBranchIds: ['branch-1'] }, branchId: 'branch-1' })
    mocks.prisma.warehouse_bins.findFirst.mockResolvedValue(null)

    const result = await deleteWarehouseBin('org-1', 'bin-1')

    expect(result).toEqual({ error: 'Bin tidak tersedia pada unit aktif.' })
  })
})
