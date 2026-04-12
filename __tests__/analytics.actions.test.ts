import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseMock, success } from './helpers/supabase-mock'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}))

import { getDashboardAnalytics } from '@/modules/accounting/actions/analytics.actions'

describe('Analytics actions guard for missing accounts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should not throw when journal lines lack accounts', async () => {
    const supabase = createSupabaseMock({
      tables: {
        journal_entries: [
          {
            result: success([
              { id: 'je-1', entry_date: '2024-01-15' },
            ]),
          },
        ],
        journal_lines: [
          {
            result: success([
              {
                debit: 0,
                credit: 1000,
                entry_id: 'je-1',
                accounts: { type: 'REVENUE', code: '4001', name: 'Penjualan' },
              },
              {
                debit: 2000,
                credit: 0,
                entry_id: 'je-1',
                // No accounts field – should be safely ignored
              },
            ]),
          },
        ],
      },
    })

    mocks.createClient.mockResolvedValue(supabase.client)

    // Execute function – should resolve without throwing
    const result = await getDashboardAnalytics('org-1')

    // Expect chartData for January 2024 (single month)
    expect(Array.isArray(result.chartData)).toBe(true)
    expect(result.chartData.length).toBeGreaterThan(0)
    // The expense for the missing accounts line should be ignored, so expense should be 0 for that month
    const jan = result.chartData.find((c: any) => c.name === 'Jan 2024' || c.name === 'Jan 2024')
    // We cannot rely on exact month format, just ensure revenue was recorded
    expect(jan?.revenue).toBe(1000)
    // topExpenses should be empty because only revenue line present
    expect(result.topExpenses).toEqual([])
  })
})
