import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    service_orders: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
  revalidatePath: vi.fn(),
  resolveAccessibleBranchSelection: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

vi.mock('@/modules/organization/lib/branch-access.server', () => ({
  resolveAccessibleBranchSelection: mocks.resolveAccessibleBranchSelection,
}))

import {
  createServiceOrder,
  getServiceOrders,
  updateServiceStatus,
} from '@/modules/services/actions/service.actions'

function buildServiceOrderForm(overrides: Record<string, string> = {}) {
  const formData = new FormData()
  formData.set('contact_id', overrides.contact_id || 'contact-1')
  formData.set('job_number', overrides.job_number || 'JOB-0001')
  formData.set('description', overrides.description || 'Servis AC utama')
  formData.set('start_date', overrides.start_date || '2026-04-03')
  formData.set('notes', overrides.notes || 'Handle dengan prioritas tinggi')
  formData.set('estimated_cost', overrides.estimated_cost || '1250000')
  return formData
}

describe('Service Order Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filters service orders by resolved branch selection', async () => {
    mocks.prisma.service_orders.findMany.mockResolvedValue([])
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranchIds: ['branch-1'] },
      branchId: 'branch-1',
    })

    await getServiceOrders('org-1')

    const findManyArgs = mocks.prisma.service_orders.findMany.mock.calls[0]?.[0]
    expect(findManyArgs.where.branch_id).toBe('branch-1')
  })

  it('stamps branch_id when creating a service order', async () => {
    mocks.prisma.service_orders.create.mockResolvedValue({ id: 'service-1' })
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranchIds: ['branch-1'] },
      branchId: 'branch-1',
    })

    const result = await createServiceOrder('org-1', buildServiceOrderForm())
    const payload = mocks.prisma.service_orders.create.mock.calls[0]?.[0]?.data as Record<string, string>

    expect(result).toEqual({ success: true })
    expect(payload.branch_id).toBe('branch-1')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/services')
  })

  it('updates service status only inside the document branch', async () => {
    mocks.prisma.service_orders.findFirst.mockResolvedValue({
      id: 'service-1',
      branch_id: 'branch-1',
    })
    mocks.prisma.service_orders.update.mockResolvedValue({ id: 'service-1' })
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranchIds: ['branch-1'] },
      branchId: 'branch-1',
    })

    const result = await updateServiceStatus('org-1', 'service-1', 'COMPLETED')
    const resolveArgs = mocks.resolveAccessibleBranchSelection.mock.calls[0]
    const updateArgs = mocks.prisma.service_orders.update.mock.calls[0]?.[0]

    expect(result).toEqual({ success: true })
    expect(resolveArgs).toEqual(['org-1', 'branch-1'])
    expect(updateArgs.where.id).toBe('service-1')
  })
})
