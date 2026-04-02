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

import { createInventoryAdjustment, createInventoryTransfer } from '@/modules/inventory/actions/inventory.actions'
import { createWarehouse, deleteWarehouseBin, getWarehouses } from '@/modules/inventory/actions/warehouse.actions'

function createWarehouseListQuery(result: any[] = []) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    or: vi.fn(() => builder),
    order: vi.fn().mockResolvedValue({
      data: result,
      error: null,
    }),
  }

  return builder
}

describe('Inventory Branch Context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filters warehouses strictly by active branch', async () => {
    const warehouseQuery = createWarehouseListQuery([{ id: 'wh-1', name: 'Gudang A' }])

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
        if (table !== 'warehouses') throw new Error(`Unexpected table ${table}`)
        return warehouseQuery
      }),
    })

    const result = await getWarehouses('org-1')

    expect(warehouseQuery.eq).toHaveBeenCalledWith('branch_id', 'branch-1')
    expect(warehouseQuery.or).not.toHaveBeenCalled()
    expect(result).toEqual([{ id: 'wh-1', name: 'Gudang A' }])
  })

  it('stamps active branch when creating a warehouse', async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: {
        id: 'wh-1',
        org_id: 'org-1',
        branch_id: 'branch-1',
        code: 'GD-1',
        name: 'Gudang Unit A',
      },
      error: null,
    })
    const insertMock = vi.fn(() => ({
      select: vi.fn(() => ({
        single: singleMock,
      })),
    }))

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
        if (table !== 'warehouses') throw new Error(`Unexpected table ${table}`)
        return {
          insert: insertMock,
        }
      }),
    })

    const result = await createWarehouse('org-1', {
      code: 'gd-1',
      name: 'Gudang Unit A',
    })

    expect(insertMock).toHaveBeenCalledWith([
      expect.objectContaining({
        org_id: 'org-1',
        branch_id: 'branch-1',
        code: 'GD-1',
        name: 'Gudang Unit A',
      }),
    ])
    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({
        id: 'wh-1',
        branch_id: 'branch-1',
      }),
    })
  })

  it('rejects creating a warehouse when no active branch is selected', async () => {
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

    const result = await createWarehouse('org-1', {
      code: 'gd-1',
      name: 'Gudang Unit A',
    })

    expect(result).toEqual({
      error: 'Pilih unit aktif terlebih dahulu untuk mengelola gudang.',
    })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('rejects stock adjustment when no active branch is selected', async () => {
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

    const result = await createInventoryAdjustment('org-1', {
      adj_date: '2026-04-02',
      type: 'STOCK_COUNT',
      notes: 'Opname test',
      items: [
        {
          product_id: 'prod-1',
          warehouse_id: 'wh-1',
          actual_quantity: 10,
          diff_quantity: 2,
          unit_cost: 1000,
          notes: 'Test line',
        },
      ],
    })

    expect(result).toEqual({
      error: 'Pilih unit aktif terlebih dahulu untuk melakukan stok opname atau write-off.',
    })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('rejects stock transfer when one warehouse is outside the active branch', async () => {
    const warehousesQuery = {
      select: vi.fn(() => warehousesQuery),
      eq: vi.fn(() => warehousesQuery),
      in: vi.fn(() => warehousesQuery),
      or: vi.fn().mockResolvedValue({
        data: [{ id: 'wh-1', branch_id: 'branch-1', is_active: true }],
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
        if (table !== 'warehouses') throw new Error(`Unexpected table ${table}`)
        return warehousesQuery
      }),
    })

    const result = await createInventoryTransfer('org-1', {
      transfer_date: '2026-04-02',
      source_wh_id: 'wh-1',
      target_wh_id: 'wh-2',
      notes: 'Transfer test',
      items: [
        {
          product_id: 'prod-1',
          quantity: 1,
          notes: 'Test line',
        },
      ],
    })

    expect(result).toEqual({
      error: 'Gudang transfer tidak tersedia pada unit aktif.',
    })
  })

  it('rejects deleting warehouse bin outside the active branch', async () => {
    const binLookupQuery = {
      select: vi.fn(() => binLookupQuery),
      eq: vi.fn(() => binLookupQuery),
      or: vi.fn(() => binLookupQuery),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    }
    const deleteBuilder = {
      eq: vi.fn(() => deleteBuilder),
    }
    const deleteMock = vi.fn(() => deleteBuilder)
    let warehouseBinsCalls = 0

    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranches: [], accessibleBranchIds: ['branch-1'], canAccessAllBranches: false, membershipId: 'member-1', role: 'staff' },
      branchId: 'branch-1',
    })
    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table !== 'warehouse_bins') throw new Error(`Unexpected table ${table}`)
        warehouseBinsCalls += 1
        if (warehouseBinsCalls === 1) return binLookupQuery
        return { delete: deleteMock }
      }),
    })

    const result = await deleteWarehouseBin('org-1', 'bin-9')

    expect(result).toEqual({
      error: 'Bin tidak tersedia pada unit aktif.',
    })
    expect(deleteMock).not.toHaveBeenCalled()
  })
})
