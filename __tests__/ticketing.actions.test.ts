import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getActiveOrg: vi.fn(),
  revalidatePath: vi.fn(),
  uploadSupportTicketScreenshot: vi.fn(),
  prisma: {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}))

vi.mock('@/auth', () => ({
  auth: mocks.auth,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}))

vi.mock('@/modules/organization/actions/org.actions', () => ({
  getActiveOrg: mocks.getActiveOrg,
}))

vi.mock('@/modules/saas/lib/support-ticket-storage.server', () => ({
  uploadSupportTicketScreenshot: mocks.uploadSupportTicketScreenshot,
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

import {
  createSupportTicket,
  getOperatorTicketingSnapshot,
  getSupportDocUpdatesForCurrentOrg,
  postSupportTicketProgress,
} from '@/modules/saas/actions/ticketing.actions'

describe('Ticketing Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.auth.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'bob@executive.id',
      },
    })
    mocks.getActiveOrg.mockResolvedValue({
      org: { id: 'org-1', name: 'PT Alpha' },
    })
    mocks.uploadSupportTicketScreenshot.mockResolvedValue({
      url: 'https://cdn.test/support.png',
    })
    mocks.prisma.$queryRaw.mockResolvedValue([])
    mocks.prisma.$executeRaw.mockResolvedValue(1)
    mocks.prisma.$transaction.mockImplementation(async (callback: any) => callback({
      $queryRaw: mocks.prisma.$queryRaw,
      $executeRaw: mocks.prisma.$executeRaw,
    }))
  })

  it('builds operator ticketing snapshot from raw Prisma queries', async () => {
    mocks.prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          id: 'ticket-1',
          org_id: 'org-1',
          ticket_no: 'TCK-20260406-AAA111',
          title: 'Error save sale',
          description: 'Tidak bisa simpan sale',
          severity: 'HIGH',
          status: 'OPEN',
          found_in_menu: 'Sales',
          found_during: 'Klik simpan',
          found_at: '2026-04-06T08:00:00.000Z',
          screenshot_url: null,
          created_at: '2026-04-06T08:05:00.000Z',
          organization_name: 'PT Alpha',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'upd-1',
          ticket_id: 'ticket-1',
          org_id: 'org-1',
          update_title: 'Investigasi dimulai',
          update_body: 'Tim sedang cek log',
          status_after: 'IN_PROGRESS',
          is_public: true,
          created_at: '2026-04-06T09:00:00.000Z',
          updated_by_user_id: 'user-1',
        },
      ])

    const result = await getOperatorTicketingSnapshot()

    expect(result).toEqual({
      tickets: [
        {
          id: 'ticket-1',
          org_id: 'org-1',
          ticket_no: 'TCK-20260406-AAA111',
          title: 'Error save sale',
          description: 'Tidak bisa simpan sale',
          severity: 'HIGH',
          status: 'OPEN',
          found_in_menu: 'Sales',
          found_during: 'Klik simpan',
          found_at: '2026-04-06T08:00:00.000Z',
          screenshot_url: null,
          created_at: '2026-04-06T08:05:00.000Z',
          organization: { name: 'PT Alpha' },
        },
      ],
      updates: [
        {
          id: 'upd-1',
          ticket_id: 'ticket-1',
          org_id: 'org-1',
          update_title: 'Investigasi dimulai',
          update_body: 'Tim sedang cek log',
          status_after: 'IN_PROGRESS',
          is_public: true,
          created_at: '2026-04-06T09:00:00.000Z',
          updated_by_user_id: 'user-1',
        },
      ],
    })
  })

  it('loads current-org public doc updates with joined ticket info', async () => {
    mocks.prisma.$queryRaw.mockResolvedValueOnce([
      {
        id: 'upd-1',
        ticket_id: 'ticket-1',
        org_id: 'org-1',
        update_title: 'Patch dirilis',
        update_body: 'Silakan refresh browser',
        status_after: 'RESOLVED',
        created_at: '2026-04-06T10:00:00.000Z',
        ticket_no: 'TCK-20260406-AAA111',
        ticket_title: 'Error save sale',
        ticket_severity: 'HIGH',
        ticket_found_in_menu: 'Sales',
      },
    ])

    const result = await getSupportDocUpdatesForCurrentOrg()

    expect(result).toEqual([
      {
        id: 'upd-1',
        ticket_id: 'ticket-1',
        update_title: 'Patch dirilis',
        update_body: 'Silakan refresh browser',
        status_after: 'RESOLVED',
        created_at: '2026-04-06T10:00:00.000Z',
        ticket: {
          ticket_no: 'TCK-20260406-AAA111',
          title: 'Error save sale',
          severity: 'HIGH',
          found_in_menu: 'Sales',
        },
      },
    ])
  })

  it('creates support ticket via Prisma raw SQL and screenshot wrapper', async () => {
    const formData = new FormData()
    formData.set('title', 'Bug stok negatif')
    formData.set('description', 'Nilai stok turun jadi minus')
    formData.set('found_in_menu', 'Inventory')
    formData.set('found_during', 'Klik adjust')
    formData.set('found_at', '2026-04-06T10:15')
    formData.set('severity', 'HIGH')
    formData.set('screenshot', new File(['img'], 'bug.png', { type: 'image/png' }))

    const result = await createSupportTicket(formData)

    expect(result).toEqual({ success: true })
    expect(mocks.uploadSupportTicketScreenshot).toHaveBeenCalledWith(
      'user-1',
      'org-1',
      expect.any(File),
    )
    expect(mocks.prisma.$executeRaw).toHaveBeenCalledTimes(1)
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/settings/ticketing')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/settings/ticketing/doc-update')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/saas/ticketing')
  })

  it('posts ticket progress via Prisma transaction', async () => {
    mocks.prisma.$queryRaw.mockResolvedValueOnce([
      {
        id: 'ticket-1',
        org_id: 'org-1',
        status: 'OPEN',
      },
    ])

    const formData = new FormData()
    formData.set('ticket_id', 'ticket-1')
    formData.set('update_title', 'Investigasi dimulai')
    formData.set('update_body', 'Sedang cek query')
    formData.set('status_after', 'IN_PROGRESS')
    formData.set('is_public', 'true')

    const result = await postSupportTicketProgress(formData)

    expect(result).toEqual({ success: true })
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(mocks.prisma.$executeRaw).toHaveBeenCalledTimes(2)
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/saas/ticketing')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/settings/ticketing')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/settings/ticketing/doc-update')
  })
})
