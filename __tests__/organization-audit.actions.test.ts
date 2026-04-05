import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getMembership: vi.fn(),
  prisma: {
    audit_logs: {
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/auth', () => ({
  auth: mocks.auth,
}))

vi.mock('@/lib/auth/permissions', () => ({
  getMembership: mocks.getMembership,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}))

import { getAuditLogs } from '@/modules/organization/actions/audit.actions'

function makeMembership(overrides: Record<string, unknown> = {}) {
  return {
    memberId: 'member-1',
    userId: 'user-1',
    orgId: 'org-1',
    role: 'owner',
    roleId: null,
    permissions: [],
    isOwner: true,
    isAdmin: false,
    isOwnerOrAdmin: true,
    ...overrides,
  }
}

describe('Organization Audit Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
  })

  it('returns empty logs when actor is not owner/admin', async () => {
    mocks.getMembership.mockResolvedValue(
      makeMembership({
        role: 'manager',
        isOwner: false,
        isAdmin: false,
        isOwnerOrAdmin: false,
      })
    )

    const result = await getAuditLogs('org-1', 100)

    expect(result).toEqual([])
    expect(mocks.prisma.audit_logs.findMany).not.toHaveBeenCalled()
  })

  it('maps audit logs into the UI-friendly structure', async () => {
    mocks.getMembership.mockResolvedValue(makeMembership())
    mocks.prisma.audit_logs.findMany.mockResolvedValue([
      {
        id: 'log-1',
        org_id: 'org-1',
        created_at: new Date('2026-04-05T01:00:00.000Z'),
        user_id: 'user-2',
        action: 'UPDATE',
        table_name: 'journal_entries',
        record_id: 'record-1',
        old_data: { status: 'DRAFT' },
        new_data: { status: 'POSTED' },
      },
      {
        id: 'log-2',
        org_id: 'org-1',
        created_at: new Date('2026-04-05T02:00:00.000Z'),
        user_id: null,
        action: 'DELETE',
        table_name: 'contacts',
        record_id: 'record-2',
        old_data: null,
        new_data: null,
      },
    ])
    mocks.prisma.user.findMany.mockResolvedValue([
      {
        id: 'user-2',
        name: 'Finance Lead',
        email: 'finance@example.com',
      },
    ])

    const result = await getAuditLogs('org-1', 100)

    expect(result).toEqual([
      {
        id: 'log-1',
        org_id: 'org-1',
        created_at: '2026-04-05T01:00:00.000Z',
        user_email: 'finance@example.com',
        user_name: 'Finance Lead',
        action: 'UPDATE',
        table_name: 'journal_entries',
        record_id: 'record-1',
        old_data: { status: 'DRAFT' },
        new_data: { status: 'POSTED' },
        description: 'Mengubah data di journal_entries',
      },
      {
        id: 'log-2',
        org_id: 'org-1',
        created_at: '2026-04-05T02:00:00.000Z',
        user_email: 'System / User',
        user_name: 'Logged Actor',
        action: 'DELETE',
        table_name: 'contacts',
        record_id: 'record-2',
        old_data: null,
        new_data: null,
        description: 'Menghapus data dari contacts',
      },
    ])
  })
})
