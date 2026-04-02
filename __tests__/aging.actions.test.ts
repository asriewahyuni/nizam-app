import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseMock, success } from './helpers/supabase-mock'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}))

import { getAgingReport } from '@/modules/accounting/actions/aging.actions'

describe('Aging Branch Context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filters AR aging data and GL reconciliation by active branch', async () => {
    const supabase = createSupabaseMock({
      tables: {
        sales: [
          {
            result: success([]),
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
                debit: 100000,
                credit: 0,
                accounts: {
                  code: '1201',
                  type: 'ASSET',
                },
              },
            ]),
          },
        ],
      },
    })

    mocks.createClient.mockResolvedValue(supabase.client)

    const result = await getAgingReport('org-1', 'AR', 'branch-1')

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          doc_number: 'GL-1201-ADJ',
          outstanding: 100000,
          source_type: 'JOURNAL',
        }),
      ])
    )

    const salesCall = supabase.calls.find((call) => call.table === 'sales')
    expect(salesCall?.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'eq', args: ['org_id', 'org-1'] }),
        expect.objectContaining({ method: 'eq', args: ['branch_id', 'branch-1'] }),
      ])
    )

    const journalEntryCall = supabase.calls.find((call) => call.table === 'journal_entries')
    expect(journalEntryCall?.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'eq', args: ['org_id', 'org-1'] }),
        expect.objectContaining({ method: 'eq', args: ['branch_id', 'branch-1'] }),
      ])
    )
  })
})
