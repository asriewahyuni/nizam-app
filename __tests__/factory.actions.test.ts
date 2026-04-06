import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  prisma: {
    production_boms: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
    production_bom_items: { createMany: vi.fn(), deleteMany: vi.fn() },
    production_work_orders: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    warehouses: { findFirst: vi.fn() },
    warehouse_bins: { findFirst: vi.fn(), findMany: vi.fn() },
    inventory_stocks: { upsert: vi.fn() },
    products: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
  revalidatePath: vi.fn(),
  resolveAccessibleBranchSelection: vi.fn(),
  withDbUserContext: vi.fn(),
}))

vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/modules/organization/lib/branch-access.server', () => ({ resolveAccessibleBranchSelection: mocks.resolveAccessibleBranchSelection }))
vi.mock('@/modules/sales/lib/sales-write.server', () => ({ withDbUserContext: mocks.withDbUserContext }))

import { createBom, createWorkOrder, getBoms, getWorkOrders, updateWorkOrderStatus } from '@/modules/factory/actions/factory.actions'

describe('Factory Branch Context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
  })

  it('filters BoM list to shared rows and the active branch', async () => {
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({ scope: { accessibleBranchIds: ['branch-1'] }, branchId: 'branch-1' })
    mocks.prisma.production_boms.findMany.mockResolvedValue([])

    await getBoms('org-1', 'branch-1')

    expect(mocks.prisma.production_boms.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ org_id: 'org-1', OR: [{ branch_id: null }, { branch_id: 'branch-1' }] }) }))
  })

  it('filters work order list to the active branch', async () => {
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({ scope: { accessibleBranchIds: ['branch-1'] }, branchId: 'branch-1' })
    mocks.prisma.production_work_orders.findMany.mockResolvedValue([])

    await getWorkOrders('org-1', 'branch-1')

    expect(mocks.prisma.production_work_orders.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ org_id: 'org-1', branch_id: 'branch-1' }) }))
  })

  it('stamps active branch on new BoM records', async () => {
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({ scope: { accessibleBranchIds: ['branch-1'] }, branchId: 'branch-1' })
    mocks.prisma.production_boms.create.mockResolvedValue({ id: 'bom-1' })
    mocks.prisma.products.findMany.mockResolvedValue([{ id: 'prod-rm', name: 'Bahan A', unit: 'Pcs' }])
    mocks.prisma.production_bom_items.createMany.mockResolvedValue({ count: 1 })

    const result = await createBom('org-1', {
      productId: 'prod-fg',
      code: 'BOM-001',
      description: 'BoM Branch A',
      items: [{ productId: 'prod-rm', quantity: 2, unit: 'Pcs' }],
    })

    expect(result).toEqual({ success: true })
    expect(mocks.prisma.production_boms.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          org_id: 'org-1',
          branch_id: 'branch-1',
          product_id: 'prod-fg',
        }),
      })
    )
    expect(mocks.prisma.production_bom_items.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            product_id: 'prod-rm',
            quantity: 2,
            unit: 'Pcs',
          }),
        ],
      })
    )
  })

  it('normalizes BoM quantity into product base unit before saving', async () => {
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
    mocks.prisma.production_boms.create.mockResolvedValue({ id: 'bom-2' })
    mocks.prisma.products.findMany.mockResolvedValue([{ id: 'prod-rm', name: 'Daging Sapi', unit: 'Kg' }])
    mocks.prisma.production_bom_items.createMany.mockResolvedValue({ count: 1 })

    const result = await createBom('org-1', {
      productId: 'prod-fg',
      code: 'BOM-002',
      description: 'Konversi satuan bahan',
      items: [{ productId: 'prod-rm', quantity: 100, unit: 'Gram' }],
    })

    expect(result).toEqual({ success: true })
    expect(mocks.prisma.production_bom_items.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            product_id: 'prod-rm',
            quantity: 0.1,
            unit: 'Kg',
          }),
        ],
      })
    )
  })

  it('rejects work order creation when the selected BoM belongs to another branch', async () => {
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({ scope: { accessibleBranchIds: ['branch-1'] }, branchId: 'branch-1' })
    mocks.prisma.production_boms.findFirst.mockResolvedValue({ id: 'bom-1', org_id: 'org-1', branch_id: 'branch-2' })

    const formData = new FormData()
    formData.set('bom_id', 'bom-1')
    formData.set('wo_number', 'WO-1')
    formData.set('quantity_planned', '10')

    const result = await createWorkOrder('org-1', formData)

    expect(result).toEqual({ error: 'Resep produksi tidak tersedia untuk unit aktif.' })
  })

  it('rejects production completion when the finished-goods warehouse is outside the active branch', async () => {
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({ scope: { accessibleBranchIds: ['branch-1'] }, branchId: 'branch-1' })
    mocks.prisma.production_work_orders.findFirst.mockResolvedValue({ id: 'wo-1', org_id: 'org-1', branch_id: 'branch-1', bom_id: 'bom-1', status: 'DRAFT' })
    mocks.prisma.warehouses.findFirst.mockResolvedValue(null)

    const result = await updateWorkOrderStatus('org-1', 'wo-1', 'COMPLETED', { warehouseId: 'wh-2' })

    expect(result).toEqual({ error: 'Gudang hasil produksi tidak berada pada unit aktif.' })
  })
})
