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

import { closePosShift, openPosShift } from '@/modules/sales/actions/pos-shift.actions'

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

function createEqInResolvedQuery(result: { data: unknown; error: unknown }) {
  const query = {
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue(result),
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

  it('creates an opening journal when a shift starts with opening cash', async () => {
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

    mocks.verifyInternalAuthNikForOrg.mockResolvedValue({
      sessionUserId: 'cashier-user',
      displayName: 'Kasir Utama',
      nik: 'K-0001',
    })
    mocks.queryPostgres.mockResolvedValue({
      rows: [
        {
          employee_nik: 'K-0001',
          employee_first_name: 'Kasir',
          employee_last_name: 'Utama',
          internal_display_name: 'Kasir Utama',
          internal_login_nik: 'K-0001',
          internal_login_email: 'kasir@example.com',
        },
      ],
    })

    const employeeQuery = createMaybeSingleQuery({
      data: {
        branch_id: 'branch-1',
        first_name: 'Kasir',
        last_name: 'Utama',
        nik: 'K-0001',
        employment_status: 'ACTIVE',
      },
      error: null,
    })

    const existingSessionQuery = createMaybeSingleQuery({
      data: null,
      error: null,
    })

    const insertedSession = {
      id: 'session-open-1',
      org_id: 'org-1',
      branch_id: 'branch-1',
      cashier_user_id: 'cashier-user',
      register_code: 'REG-1',
      opening_cash: 250000,
      expected_cash: 250000,
      closing_cash: null,
      variance_amount: null,
      cash_account_id: 'acc-drawer',
      transfer_account_id: 'acc-transfer',
      qris_account_id: 'acc-qris',
      opening_notes: 'Float awal shift pagi',
      closing_notes: null,
      status: 'OPEN',
      opened_at: '2026-04-18T01:00:00.000Z',
      closed_at: null,
    }

    const posSessionInsertQuery = {
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: insertedSession,
        error: null,
      }),
    }

    const posSessionMetadataUpdateQuery = createEqResolvedQuery({
      data: null,
      error: null,
    })

    const accountsQuery = createEqInResolvedQuery({
      data: [
        {
          id: 'acc-drawer',
          code: '1101-01',
          name: 'Kas Laci POS',
          type: 'ASSET',
          is_active: true,
        },
        {
          id: 'acc-transfer',
          code: '1103-01',
          name: 'Bank Operasional',
          type: 'ASSET',
          is_active: true,
        },
        {
          id: 'acc-qris',
          code: '1104-01',
          name: 'QRIS Gateway',
          type: 'ASSET',
          is_active: true,
        },
      ],
      error: null,
    })

    mocks.createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'employees') {
          return {
            select: vi.fn().mockReturnValue(employeeQuery),
          }
        }

        if (table === 'pos_shift_sessions') {
          return {
            select: vi.fn().mockReturnValue(existingSessionQuery),
            insert: vi.fn().mockReturnValue(posSessionInsertQuery),
            update: vi.fn().mockReturnValue(posSessionMetadataUpdateQuery),
          }
        }

        if (table === 'accounts') {
          return {
            select: vi.fn().mockReturnValue(accountsQuery),
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

    mocks.createJournalEntry.mockResolvedValue({
      success: true,
      entryId: 'je-opening-1',
      entryNumber: 'JU-0001',
    })

    const result = await openPosShift('org-1', {
      openingCash: 250000,
      registerCode: 'REG-1',
      openingNotes: 'Float awal shift pagi',
      cashAccountId: 'acc-drawer',
      transferAccountId: 'acc-transfer',
      qrisAccountId: 'acc-qris',
      openingSourceAccountId: 'acc-transfer',
      cashierNik: 'K-0001',
      cashierPassword: 'secret',
    })

    expect(mocks.createJournalEntry).toHaveBeenCalledWith(expect.objectContaining({
      org_id: 'org-1',
      branch_id: 'branch-1',
      description: 'Modal Awal POS REG-1',
      reference_type: 'POS_SHIFT_OPENING',
      reference_id: 'session-open-1',
      auto_post: true,
      lines: [
        expect.objectContaining({
          account_id: 'acc-drawer',
          debit: 250000,
          credit: 0,
        }),
        expect.objectContaining({
          account_id: 'acc-transfer',
          debit: 0,
          credit: 250000,
        }),
      ],
    }))
    expect(posSessionMetadataUpdateQuery.eq).toHaveBeenCalledWith('id', 'session-open-1')
    expect(posSessionMetadataUpdateQuery.eq).toHaveBeenCalledWith('org_id', 'org-1')
    expect(result).toEqual({
      success: true,
      session: expect.objectContaining({
        id: 'session-open-1',
        status: 'OPEN',
        cashierUserId: 'cashier-user',
        openingCash: 250000,
        cashAccountId: 'acc-drawer',
      }),
      warning: null,
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/pos')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/accounting/journal')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/reports')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/cash')
  })

  it('blocks shift opening when opening cash has no funding source account', async () => {
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

    mocks.verifyInternalAuthNikForOrg.mockResolvedValue({
      sessionUserId: 'cashier-user',
      displayName: 'Kasir Utama',
      nik: 'K-0001',
    })

    const employeeQuery = createMaybeSingleQuery({
      data: {
        branch_id: 'branch-1',
        first_name: 'Kasir',
        last_name: 'Utama',
        nik: 'K-0001',
        employment_status: 'ACTIVE',
      },
      error: null,
    })

    const existingSessionQuery = createMaybeSingleQuery({
      data: null,
      error: null,
    })

    const posShiftInsert = vi.fn()
    const accountsQuery = createEqInResolvedQuery({
      data: [
        {
          id: 'acc-drawer',
          code: '1101-01',
          name: 'Kas Laci POS',
          type: 'ASSET',
          is_active: true,
        },
      ],
      error: null,
    })

    mocks.createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'employees') {
          return {
            select: vi.fn().mockReturnValue(employeeQuery),
          }
        }

        if (table === 'pos_shift_sessions') {
          return {
            select: vi.fn().mockReturnValue(existingSessionQuery),
            insert: posShiftInsert,
          }
        }

        if (table === 'accounts') {
          return {
            select: vi.fn().mockReturnValue(accountsQuery),
          }
        }

        throw new Error(`Unexpected admin table ${table}`)
      }),
    })

    const result = await openPosShift('org-1', {
      openingCash: 100000,
      registerCode: 'REG-1',
      openingNotes: '',
      cashAccountId: 'acc-drawer',
      transferAccountId: null,
      qrisAccountId: null,
      openingSourceAccountId: null,
      cashierNik: 'K-0001',
      cashierPassword: 'secret',
    })

    expect(result).toEqual({
      error: 'Akun sumber modal awal wajib dipilih.',
    })
    expect(posShiftInsert).not.toHaveBeenCalled()
    expect(mocks.createJournalEntry).not.toHaveBeenCalled()
  })
})
