import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseMock } from './helpers/supabase-mock'

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

import { generateBSCKpisFromExistingData, getBSCMetrics } from '@/modules/accounting/actions/bsc.actions'

describe('BSC Branch Context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: {
        accessibleBranches: [],
        accessibleBranchIds: ['branch-1'],
        canAccessAllBranches: false,
        membershipId: 'member-1',
        role: 'manager',
      },
      branchId: 'branch-1',
    })
  })

  it('scopes BSC metrics to the active branch across all underlying modules', async () => {
    const supabase = createSupabaseMock({
      tables: {
        journal_entries: [
          {
            result: { data: [{ id: 'je-current' }], error: null },
          },
          {
            result: { data: [{ id: 'je-last' }], error: null },
          },
        ],
        journal_lines: [
          {
            result: {
              data: [
                {
                  debit: 0,
                  credit: 250000,
                  accounts: { type: 'REVENUE', code: '4001' },
                },
                {
                  debit: 50000,
                  credit: 0,
                  accounts: { type: 'EXPENSE', code: '5001' },
                },
              ],
              error: null,
            },
          },
          {
            result: {
              data: [
                {
                  debit: 0,
                  credit: 100000,
                  accounts: { type: 'REVENUE', code: '4001' },
                },
              ],
              error: null,
            },
          },
        ],
        sales: [
          {
            result: { data: [{ id: 'sale-1', grand_total: 250000, status: 'FINISHED', customer_id: 'cust-1' }], error: null },
          },
          {
            result: { data: null, error: null, count: 2 } as unknown as { data: null; error: null },
          },
        ],
        purchases: [
          {
            result: { data: null, error: null, count: 1 } as unknown as { data: null; error: null },
          },
        ],
        fixed_assets: [
          {
            result: { data: null, error: null, count: 3 } as unknown as { data: null; error: null },
          },
          {
            result: { data: null, error: null, count: 1 } as unknown as { data: null; error: null },
          },
        ],
        employees: [
          {
            result: { data: null, error: null, count: 5 } as unknown as { data: null; error: null },
          },
        ],
        payroll_runs: [
          {
            result: { data: null, error: null, count: 1 } as unknown as { data: null; error: null },
          },
        ],
      },
    })

    mocks.createClient.mockResolvedValue(supabase.client)

    const result = await getBSCMetrics('org-1', 'branch-1')

    expect(result.financial.currentRevenue).toBe(250000)
    expect(result.financial.currentExpenses).toBe(50000)
    expect(result.customer.totalOrders).toBe(1)
    expect(result.internal.pendingPurchases).toBe(1)
    expect(result.internal.pendingSales).toBe(2)
    expect(result.internal.totalAssets).toBe(3)
    expect(result.learning.activeEmployees).toBe(5)
    expect(result.learning.payrollRunsCompleted).toBe(1)

    const branchScopedTables = ['journal_entries', 'sales', 'purchases', 'fixed_assets', 'employees', 'payroll_runs']
    branchScopedTables.forEach((table) => {
      const calls = supabase.calls.filter((call) => call.table === table)
      expect(calls.length).toBeGreaterThan(0)
      calls.forEach((call) => {
        expect(call.operations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ method: 'eq', args: ['branch_id', 'branch-1'] }),
          ])
        )
      })
    })
  })

  it('generates quick-start KPIs from existing data and syncs their initial measurements', async () => {
    const countResult = (count: number) => ({ data: null, error: null, count } as unknown as { data: null; error: null })

    const generatedKpis = [
      { id: 'kpi-fin-1', perspective: 'FINANCIAL', name: 'Revenue Growth', formula_key: 'revenue_growth' },
      { id: 'kpi-fin-2', perspective: 'FINANCIAL', name: 'Net Profit Margin', formula_key: 'net_profit_margin' },
      { id: 'kpi-fin-3', perspective: 'FINANCIAL', name: 'Operating Expense Ratio', formula_key: 'operating_expense_ratio' },
      { id: 'kpi-cus-1', perspective: 'CUSTOMER', name: 'MTD Sales', formula_key: 'mtd_sales' },
      { id: 'kpi-cus-2', perspective: 'CUSTOMER', name: 'Total Orders', formula_key: 'total_orders' },
      { id: 'kpi-cus-3', perspective: 'CUSTOMER', name: 'Unique Customers', formula_key: 'unique_customers' },
      { id: 'kpi-int-1', perspective: 'INTERNAL_PROCESS', name: 'Draft Document Backlog', formula_key: 'draft_document_backlog' },
      { id: 'kpi-int-2', perspective: 'INTERNAL_PROCESS', name: 'Process Health', formula_key: 'process_health' },
      { id: 'kpi-int-3', perspective: 'INTERNAL_PROCESS', name: 'Pending Purchases', formula_key: 'pending_purchases' },
      { id: 'kpi-lrn-1', perspective: 'LEARNING_GROWTH', name: 'Active Employees', formula_key: 'active_employees' },
      { id: 'kpi-lrn-2', perspective: 'LEARNING_GROWTH', name: 'Payroll Runs Completed', formula_key: 'payroll_runs_completed' },
      { id: 'kpi-lrn-3', perspective: 'LEARNING_GROWTH', name: 'HR Completion Rate', formula_key: 'hr_completion_rate' },
    ]

    const supabase = createSupabaseMock({
      tables: {
        bsc_cycles: [
          {
            maybeSingleResult: {
              data: {
                id: 'cycle-1',
                org_id: 'org-1',
                branch_id: 'branch-1',
                cycle_key: '2026-04',
                cycle_name: 'BSC 2026-04',
                period_type: 'MONTHLY',
                start_date: '2026-04-01',
                end_date: '2026-04-30',
                status: 'ACTIVE',
              },
              error: null,
            },
          },
          {
            maybeSingleResult: {
              data: {
                id: 'cycle-1',
                org_id: 'org-1',
                branch_id: 'branch-1',
                cycle_key: '2026-04',
                cycle_name: 'BSC 2026-04',
                period_type: 'MONTHLY',
                start_date: '2026-04-01',
                end_date: '2026-04-30',
                status: 'ACTIVE',
              },
              error: null,
            },
          },
        ],
        bsc_kpis: [
          {
            result: { data: [], error: null },
          },
          {
            result: { data: [], error: null },
          },
          {
            result: { data: generatedKpis, error: null },
          },
        ],
        journal_entries: [
          { result: { data: [{ id: 'je-current-1' }], error: null } },
          { result: { data: [{ id: 'je-last-1' }], error: null } },
          { result: { data: [{ id: 'je-current-2' }], error: null } },
          { result: { data: [{ id: 'je-last-2' }], error: null } },
        ],
        journal_lines: [
          {
            result: {
              data: [
                { debit: 0, credit: 250000, accounts: { type: 'REVENUE', code: '4001' } },
                { debit: 50000, credit: 0, accounts: { type: 'EXPENSE', code: '5001' } },
              ],
              error: null,
            },
          },
          {
            result: {
              data: [{ debit: 0, credit: 100000, accounts: { type: 'REVENUE', code: '4001' } }],
              error: null,
            },
          },
          {
            result: {
              data: [
                { debit: 0, credit: 250000, accounts: { type: 'REVENUE', code: '4001' } },
                { debit: 50000, credit: 0, accounts: { type: 'EXPENSE', code: '5001' } },
              ],
              error: null,
            },
          },
          {
            result: {
              data: [{ debit: 0, credit: 100000, accounts: { type: 'REVENUE', code: '4001' } }],
              error: null,
            },
          },
        ],
        sales: [
          {
            result: {
              data: [{ id: 'sale-1', grand_total: 250000, status: 'FINISHED', customer_id: 'cust-1' }],
              error: null,
            },
          },
          { result: countResult(2) },
          {
            result: {
              data: [{ id: 'sale-1', grand_total: 250000, status: 'FINISHED', customer_id: 'cust-1' }],
              error: null,
            },
          },
          { result: countResult(2) },
        ],
        purchases: [{ result: countResult(1) }, { result: countResult(1) }],
        fixed_assets: [
          { result: countResult(3) },
          { result: countResult(1) },
          { result: countResult(3) },
          { result: countResult(1) },
        ],
        employees: [{ result: countResult(5) }, { result: countResult(5) }],
        payroll_runs: [{ result: countResult(1) }, { result: countResult(1) }],
      },
    })

    mocks.createClient.mockResolvedValue(supabase.client)

    const result = await generateBSCKpisFromExistingData('org-1', 'branch-1')

    expect(result.success).toBe(true)
    expect(result.inserted_count).toBe(12)
    expect(result.synced_count).toBe(12)
    expect(result.generated?.some((item) => item.name === 'Revenue Growth')).toBe(true)

    const insertedRows = supabase.calls.find((call) => call.table === 'bsc_kpis' && call.operations.some((op) => op.method === 'insert'))
    expect(insertedRows).toBeTruthy()
    expect(insertedRows?.operations.find((op) => op.method === 'insert')?.args[0]).toHaveLength(12)

    const measurementUpsert = supabase.calls.find(
      (call) => call.table === 'bsc_kpi_measurements' && call.operations.some((op) => op.method === 'upsert')
    )
    expect(measurementUpsert).toBeTruthy()
    expect(measurementUpsert?.operations.find((op) => op.method === 'upsert')?.args[0]).toHaveLength(12)
  })
})
