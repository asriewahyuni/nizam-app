import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  verifyInternalAuthNikForOrg: vi.fn(),
  queryPostgres: vi.fn(),
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  getActiveBranch: vi.fn(),
  createJournalEntry: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

vi.mock('@/lib/auth/internal-auth.server', () => ({
  verifyInternalAuthNikForOrg: mocks.verifyInternalAuthNikForOrg,
}))

vi.mock('@/lib/db/postgres', () => ({
  queryPostgres: mocks.queryPostgres,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
  createAdminClient: mocks.createAdminClient,
}))

vi.mock('@/modules/organization/actions/org.actions', () => ({
  getActiveBranch: mocks.getActiveBranch,
}))

vi.mock('@/modules/accounting/actions/journal.actions', () => ({
  createJournalEntry: mocks.createJournalEntry,
}))

import { closePosShift } from '@/modules/sales/actions/pos-shift.actions'

function createMaybeSingleQuery(result: { data: unknown; error: unknown }) {
  const query = {
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  }

  return query
}

function createEqResolvedQuery(result: { data: unknown; error: unknown }) {
  let eqCalls = 0
  const query = {
    eq: vi.fn(() => {
      eqCalls += 1
      if (eqCalls >= 2) {
        return Promise.resolve(result)
      }
      return query
    }),
  }

  return query
}

describe('POS Shift Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getActiveBranch.mockResolvedValue({
      id: 'branch-1',
      name: 'Unit Utama',
    })
    mocks.queryPostgres.mockResolvedValue({
      rows: [
        {
          employee_nik: null,
          employee_first_name: null,
          employee_last_name: null,
          internal_display_name: 'Owner Utama',
          internal_login_nik: null,
          internal_login_email: 'owner@example.com',
        },
      ],
    })
  })

  it('allows an owner to close their own shift without entering NIK credentials', async () => {
    const organizationsQuery = createMaybeSingleQuery({
      data: {
        settings: {
          pos_require_open_shift: true,
        },
      },
      error: null,
    })

    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: 'owner-user',
            },
          },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'organizations') {
          return {
            select: vi.fn().mockReturnValue(organizationsQuery),
          }
        }

        throw new Error(`Unexpected client table ${table}`)
      }),
    })

    const currentSession = {
      id: 'session-1',
      org_id: 'org-1',
      branch_id: 'branch-1',
      cashier_user_id: 'owner-user',
      register_code: 'REG-1',
      opening_cash: 100000,
      expected_cash: 100000,
      closing_cash: null,
      variance_amount: null,
      status: 'OPEN',
      opened_at: '2026-04-16T08:00:00.000Z',
      closed_at: null,
    }

    const updatedSession = {
      ...currentSession,
      status: 'CLOSED',
      closing_cash: 100000,
      variance_amount: 0,
      closed_at: '2026-04-16T10:00:00.000Z',
    }

    const posSessionLookupQuery = createMaybeSingleQuery({
      data: currentSession,
      error: null,
    })

    const posSessionUpdateQuery = {
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: updatedSession,
        error: null,
      }),
    }

    const orgMembersQuery = createMaybeSingleQuery({
      data: {
        role: 'owner',
      },
      error: null,
    })

    mocks.createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'pos_shift_sessions') {
          return {
            select: vi.fn().mockReturnValue(posSessionLookupQuery),
            update: vi.fn().mockReturnValue(posSessionUpdateQuery),
          }
        }

        if (table === 'org_members') {
          return {
            select: vi.fn().mockReturnValue(orgMembersQuery),
          }
        }

        if (table === 'sales') {
          return {
            select: vi.fn().mockReturnValue(createEqResolvedQuery({
              data: [],
              error: null,
            })),
          }
        }

        if (table === 'pos_shift_settlements') {
          return {
            select: vi.fn().mockReturnValue(createEqResolvedQuery({
              data: [],
              error: null,
            })),
          }
        }

        throw new Error(`Unexpected admin table ${table}`)
      }),
    })

    const result = await closePosShift('org-1', {
      sessionId: 'session-1',
      closingCash: 100000,
      closingNotes: 'Tutup shift owner',
      cashierNik: '',
      cashierPassword: '',
    })

    expect(mocks.verifyInternalAuthNikForOrg).not.toHaveBeenCalled()
    expect(posSessionUpdateQuery.eq).toHaveBeenCalledWith('id', 'session-1')
    expect(posSessionUpdateQuery.eq).toHaveBeenCalledWith('org_id', 'org-1')
    expect(result).toEqual({
      success: true,
      session: expect.objectContaining({
        id: 'session-1',
        status: 'CLOSED',
        cashierUserId: 'owner-user',
        closingCash: 100000,
        varianceAmount: 0,
      }),
      warning: null,
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/pos')
  })
})
