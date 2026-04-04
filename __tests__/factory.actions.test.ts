import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
  resolveAccessibleBranchSelection: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

vi.mock('@/modules/organization/lib/branch-access.server', () => ({
  resolveAccessibleBranchSelection: mocks.resolveAccessibleBranchSelection,
}))

import {
  createBom,
  createWorkOrder,
  getBoms,
  getWorkOrders,
  updateWorkOrderStatus,
} from '@/modules/factory/actions/factory.actions'

function createQueryBuilder(result: any) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    or: vi.fn(() => builder),
    order: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    single: vi.fn().mockResolvedValue(result),
  }

  return builder
}

describe('Factory Branch Context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filters BoM list to shared rows and the active branch', async () => {
    const bomQuery = createQueryBuilder({ data: [], error: null })

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
    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table !== 'production_boms') throw new Error(`Unexpected table ${table}`)
        return bomQuery
      }),
    })

    await getBoms('org-1', 'branch-1')

    expect(bomQuery.eq).toHaveBeenCalledWith('org_id', 'org-1')
    expect(bomQuery.or).toHaveBeenCalledWith('branch_id.is.null,branch_id.eq.branch-1')
  })

  it('filters work order list to the active branch', async () => {
    const workOrderQuery = createQueryBuilder({ data: [], error: null })

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
    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table !== 'production_work_orders') throw new Error(`Unexpected table ${table}`)
        return workOrderQuery
      }),
    })

    await getWorkOrders('org-1', 'branch-1')

    expect(workOrderQuery.eq).toHaveBeenCalledWith('org_id', 'org-1')
    expect(workOrderQuery.eq).toHaveBeenCalledWith('branch_id', 'branch-1')
  })

  it('stamps active branch on new BoM records', async () => {
    const bomSingle = vi.fn().mockResolvedValue({
      data: { id: 'bom-1' },
      error: null,
    })
    const bomInsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: bomSingle,
      })),
    }))
    const itemsInsert = vi.fn().mockResolvedValue({ error: null })
    const productsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [{ id: 'prod-rm', name: 'Bahan A', unit: 'Pcs' }],
        error: null,
      }),
    }

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
    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'production_boms') return { insert: bomInsert }
        if (table === 'production_bom_items') return { insert: itemsInsert }
        if (table === 'products') return productsQuery
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const result = await createBom('org-1', {
      productId: 'prod-fg',
      code: 'BOM-001',
      description: 'BoM Branch A',
      items: [{ productId: 'prod-rm', quantity: 2, unit: 'Pcs' }],
    })

    expect(result).toEqual({ success: true })
    expect(bomInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-1',
        branch_id: 'branch-1',
        product_id: 'prod-fg',
      })
    )
    expect(itemsInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        product_id: 'prod-rm',
        quantity: 2,
        unit: 'Pcs',
      }),
    ])
  })

  it('normalizes BoM quantity into product base unit before saving', async () => {
    const bomSingle = vi.fn().mockResolvedValue({
      data: { id: 'bom-2' },
      error: null,
    })
    const bomInsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: bomSingle,
      })),
    }))
    const itemsInsert = vi.fn().mockResolvedValue({ error: null })
    const productsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [{ id: 'prod-rm', name: 'Daging Sapi', unit: 'Kg' }],
        error: null,
      }),
    }

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
    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'production_boms') return { insert: bomInsert }
        if (table === 'production_bom_items') return { insert: itemsInsert }
        if (table === 'products') return productsQuery
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const result = await createBom('org-1', {
      productId: 'prod-fg',
      code: 'BOM-002',
      description: 'Konversi satuan bahan',
      items: [{ productId: 'prod-rm', quantity: 100, unit: 'Gram' }],
    })

    expect(result).toEqual({ success: true })
    expect(itemsInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        product_id: 'prod-rm',
        quantity: 0.1,
        unit: 'Kg',
      }),
    ])
  })

  it('rejects work order creation when the selected BoM belongs to another branch', async () => {
    const bomQuery = createQueryBuilder({
      data: {
        id: 'bom-2',
        org_id: 'org-1',
        branch_id: 'branch-2',
      },
      error: null,
    })

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
    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table !== 'production_boms') throw new Error(`Unexpected table ${table}`)
        return bomQuery
      }),
    })

    const formData = new FormData()
    formData.set('bom_id', 'bom-2')
    formData.set('wo_number', 'SPK-001')
    formData.set('quantity_planned', '10')

    const result = await createWorkOrder('org-1', formData)

    expect(result).toEqual({
      error: 'Resep produksi tidak tersedia untuk unit aktif.',
    })
  })

  it('rejects production completion when the finished-goods warehouse is outside the active branch', async () => {
    const workOrderQuery = createQueryBuilder({
      data: {
        id: 'wo-1',
        org_id: 'org-1',
        branch_id: 'branch-1',
        bom_id: 'bom-1',
        status: 'RELEASED',
      },
      error: null,
    })
    const warehouseQuery = createQueryBuilder({
      data: null,
      error: null,
    })
    const rpcMock = vi.fn()

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
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'production_work_orders') return workOrderQuery
        if (table === 'warehouses') return warehouseQuery
        throw new Error(`Unexpected table ${table}`)
      }),
      rpc: rpcMock,
    })

    const result = await updateWorkOrderStatus('org-1', 'wo-1', 'COMPLETED', {
      warehouseId: 'wh-2',
      binId: 'bin-1',
    })

    expect(result).toEqual({
      error: 'Gudang hasil produksi tidak berada pada unit aktif.',
    })
    expect(rpcMock).not.toHaveBeenCalled()
  })
})
