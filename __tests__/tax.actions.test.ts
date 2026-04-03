import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseMock, success } from './helpers/supabase-mock'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}))

import { getTaxSummary } from '@/modules/accounting/actions/tax.actions'

describe('Tax Branch Context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filters tax journal entries by the active branch', async () => {
    const supabase = createSupabaseMock({
      tables: {
        accounts: [
          {
            result: success([{ id: 'acc-vat-in', code: '1401' }]),
          },
        ],
        journal_entries: [
          {
            result: success([{ id: 'je-1' }]),
          },
        ],
        journal_lines: [
          {
            result: success([
              {
                debit: 11000,
                credit: 0,
                memo: 'PPN Masukan',
                entry_id: 'je-1',
                account_id: 'acc-vat-in',
                accounts: { id: 'acc-vat-in', code: '1401', name: 'PPN Masukan', type: 'ASSET', normal_balance: 'DEBIT' },
                journal_entries: { entry_number: 'JE-1', entry_date: '2026-04-03', description: 'Pembelian' },
              },
            ]),
          },
        ],
      },
    })

    mocks.createClient.mockResolvedValue(supabase.client)

    const result = await getTaxSummary('org-1', '2026-04-01', '2026-04-30', 'branch-1')

    expect(result.vatIn.total).toBe(11000)

    const entryCall = supabase.calls.find((call) => call.table === 'journal_entries')
    expect(entryCall?.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'eq', args: ['org_id', 'org-1'] }),
        expect.objectContaining({ method: 'eq', args: ['branch_id', 'branch-1'] }),
      ])
    )
  })
})
