import { prisma } from '@/lib/prisma'
import {
  ensureAccountingAccess,
  formatDateOnly,
  getAggregatedAccountBalances,
  getCashAccountCodes,
  getPostedEntryIds,
  resolveBranchFilter,
  toNumber,
  type BranchFilter,
} from '@/modules/accounting/lib/reporting.server'

type LedgerEntry = {
  id: string
  org_id: string
  entry_number: string
  entry_date: string
  description: string
  reference_type: string
  reference_id: string | null
  status: string
  is_auto: boolean
  notes: string | null
  created_by: string | null
  posted_at: string | null
  voided_at: string | null
  voided_by: string | null
  void_reason: string | null
  created_at: string
  updated_at: string
  branch_id: string | null
  journal_lines: Array<{
    id: string
    entry_id: string
    account_id: string
    debit: number
    credit: number
    memo: string | null
    accounts: {
      code: string
      name: string
      type: string
    }
  }>
}

type LedgerEntryRecord = {
  id: string
  org_id: string
  entry_number: string
  entry_date: Date
  description: string
  reference_type: string
  reference_id: string | null
  status: string
  is_auto: boolean
  notes: string | null
  created_by: string | null
  posted_at: Date | null
  voided_at: Date | null
  voided_by: string | null
  void_reason: string | null
  created_at: Date
  updated_at: Date
  branch_id: string | null
  journal_lines: Array<{
    id: string
    entry_id: string
    account_id: string
    debit: unknown
    credit: unknown
    memo: string | null
    accounts: {
      code: string
      name: string
      type: string
    }
  }>
}

function emptyProfitLoss() {
  return { revenue: [], expenses: [], totalRevenue: 0, totalExpenses: 0, netProfit: 0 }
}

function emptyCashFlow() {
  return { ocf: 0, icf: 0, fcf: 0, netChange: 0, ocfItems: [], icfItems: [], fcfItems: [], netChangeTrend: 'UP' as 'UP' | 'DOWN', changePercent: 0 }
}

function normalizeLedgerEntry(entry: LedgerEntryRecord): LedgerEntry {
  return {
    id: entry.id,
    org_id: entry.org_id,
    entry_number: entry.entry_number,
    entry_date: formatDateOnly(entry.entry_date) || '',
    description: entry.description,
    reference_type: String(entry.reference_type),
    reference_id: entry.reference_id,
    status: String(entry.status),
    is_auto: entry.is_auto,
    notes: entry.notes,
    created_by: entry.created_by,
    posted_at: entry.posted_at?.toISOString() || null,
    voided_at: entry.voided_at?.toISOString() || null,
    voided_by: entry.voided_by,
    void_reason: entry.void_reason,
    created_at: entry.created_at.toISOString(),
    updated_at: entry.updated_at.toISOString(),
    branch_id: entry.branch_id,
    journal_lines: entry.journal_lines.map((line) => ({
      id: line.id,
      entry_id: line.entry_id,
      account_id: line.account_id,
      debit: toNumber(line.debit),
      credit: toNumber(line.credit),
      memo: line.memo,
      accounts: {
        code: line.accounts.code,
        name: line.accounts.name,
        type: String(line.accounts.type),
      },
    })),
  }
}

export async function getGeneralLedger(orgId: string, branchId?: BranchFilter) {
  const membership = await ensureAccountingAccess(orgId)
  if (!membership) return []

  const branchSelection = await resolveBranchFilter(orgId, branchId)
  if ('error' in branchSelection) return []

  const data = await prisma.journal_entries.findMany({
    where: {
      org_id: orgId,
      status: 'POSTED',
      ...(branchSelection.branchId ? { branch_id: branchSelection.branchId } : {}),
    },
    include: {
      journal_lines: {
        include: {
          accounts: {
            select: {
              code: true,
              name: true,
              type: true,
            },
          },
        },
      },
    },
    orderBy: { entry_date: 'asc' },
  })

  return data.map(normalizeLedgerEntry)
}

export async function getBalanceSheet(
  orgId: string,
  asOfDate: string = new Date().toISOString().split('T')[0],
  branchId?: BranchFilter
) {
  const membership = await ensureAccountingAccess(orgId)
  if (!membership) return { assets: [], liabilities: [], equity: [] }

  const branchSelection = await resolveBranchFilter(orgId, branchId)
  if ('error' in branchSelection) return { assets: [], liabilities: [], equity: [] }

  const entryIds = await getPostedEntryIds(orgId, { branchId: branchSelection.branchId, asOfDate })

  if (entryIds.length === 0) {
    const pl = await getProfitLoss(orgId, '1970-01-01', asOfDate, branchSelection.branchId)
    return {
      assets: [],
      liabilities: [],
      equity: [{ code: '9999', name: 'Laba Ditahan / Periode Berjalan', balance: pl.netProfit, type: 'EQUITY' }],
    }
  }

  const balances = await getAggregatedAccountBalances(entryIds)
  const assets = balances
    .filter((account) => account.type === 'ASSET' || account.code.startsWith('1'))
    .map((account) => ({ ...account, balance: account.total_debit - account.total_credit }))
    .sort((left, right) => left.code.localeCompare(right.code))

  const liabilities = balances
    .filter((account) => account.type === 'LIABILITY' || account.code.startsWith('2'))
    .map((account) => ({ code: account.code, name: account.name, balance: account.total_credit - account.total_debit, type: account.type }))
    .sort((left, right) => left.code.localeCompare(right.code))

  const equity = balances
    .filter((account) => account.type === 'EQUITY' || account.code.startsWith('3'))
    .map((account) => ({ code: account.code, name: account.name, balance: account.total_credit - account.total_debit, type: account.type }))
    .sort((left, right) => left.code.localeCompare(right.code))

  const pl = await getProfitLoss(orgId, '1970-01-01', asOfDate, branchSelection.branchId)
  equity.push({ code: '9999', name: 'Laba Ditahan / Periode Berjalan', balance: pl.netProfit, type: 'EQUITY' })

  return { assets, liabilities, equity }
}

export async function getProfitLoss(orgId: string, startDate?: string, endDate?: string, branchId?: BranchFilter) {
  const membership = await ensureAccountingAccess(orgId)
  if (!membership) return emptyProfitLoss()

  const branchSelection = await resolveBranchFilter(orgId, branchId)
  if ('error' in branchSelection) return emptyProfitLoss()

  const now = new Date()
  const sDate = startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const eDate = endDate || new Date().toISOString().split('T')[0]

  const entryIds = await getPostedEntryIds(orgId, {
    branchId: branchSelection.branchId,
    startDate: sDate,
    endDate: eDate,
  })

  const balances = await getAggregatedAccountBalances(entryIds)
  if (balances.length === 0) return emptyProfitLoss()

  const results = balances.map((account) => ({
    ...account,
    balance:
      ['REVENUE', 'LIABILITY', 'EQUITY'].includes(account.type) || ['4', '7', '8'].includes(account.code[0])
        ? account.total_credit - account.total_debit
        : account.total_debit - account.total_credit,
  }))

  const revenue = results
    .filter((account) => account.type === 'REVENUE' || ['4', '7', '8'].includes(account.code[0]))
    .sort((left, right) => left.code.localeCompare(right.code))
  const expenses = results
    .filter((account) => account.type === 'EXPENSE' || ['5', '6', '9'].includes(account.code[0]))
    .sort((left, right) => left.code.localeCompare(right.code))

  const totalRevenue = revenue.reduce((sum, item) => sum + item.balance, 0)
  const totalExpenses = expenses.reduce((sum, item) => sum + item.balance, 0)

  return { revenue, expenses, totalRevenue, totalExpenses, netProfit: totalRevenue - totalExpenses }
}

export async function getCashFlow(orgId: string, branchId?: BranchFilter) {
  const membership = await ensureAccountingAccess(orgId)
  if (!membership) return emptyCashFlow()

  const branchSelection = await resolveBranchFilter(orgId, branchId)
  if ('error' in branchSelection) return emptyCashFlow()

  const now = new Date()
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]

  const cashAccountCodes = await getCashAccountCodes(orgId, branchSelection.branchId)
  const allEntryIds = await getPostedEntryIds(orgId, { branchId: branchSelection.branchId })
  const accounts = await getAggregatedAccountBalances(allEntryIds)

  if (accounts.length === 0) return emptyCashFlow()

  const currentEntryIds = await getPostedEntryIds(orgId, {
    branchId: branchSelection.branchId,
    startDate: currentMonthStart,
  })
  const currentMonthLines = currentEntryIds.length > 0
    ? await prisma.journal_lines.findMany({
        where: {
          entry_id: { in: currentEntryIds },
          accounts: { is: { code: { in: cashAccountCodes } } },
        },
        include: { accounts: { select: { code: true } } },
      })
    : []

  const lastEntryIds = await getPostedEntryIds(orgId, {
    branchId: branchSelection.branchId,
    startDate: lastMonthStart,
    endDate: lastMonthEnd,
  })
  const lastMonthLines = lastEntryIds.length > 0
    ? await prisma.journal_lines.findMany({
        where: {
          entry_id: { in: lastEntryIds },
          accounts: { is: { code: { in: cashAccountCodes } } },
        },
        include: { accounts: { select: { code: true } } },
      })
    : []

  const currentChangeTotal = currentMonthLines.reduce((sum, line) => sum + toNumber(line.debit) - toNumber(line.credit), 0)
  const lastChangeTotal = lastMonthLines.reduce((sum, line) => sum + toNumber(line.debit) - toNumber(line.credit), 0)

  let ocf = 0
  let icf = 0
  let fcf = 0
  const ocfItems: Array<{ code: string; name: string; amount: number }> = []
  const icfItems: Array<{ code: string; name: string; amount: number }> = []
  const fcfItems: Array<{ code: string; name: string; amount: number }> = []

  accounts.forEach((account) => {
    if (cashAccountCodes.includes(account.code)) return

    const balance = ['LIABILITY', 'EQUITY', 'REVENUE'].includes(account.type)
      ? account.total_credit - account.total_debit
      : account.total_debit - account.total_credit

    if (Math.abs(balance) < 0.01) return

    const category = account.cash_flow_category || (
      account.type === 'REVENUE' ||
      account.type === 'EXPENSE' ||
      account.code.startsWith('12') ||
      account.code.startsWith('13') ||
      account.code.startsWith('14') ||
      account.code.startsWith('21') ||
      account.code.startsWith('22') ||
      account.code.startsWith('23') ||
      account.code.startsWith('24')
        ? 'OPERATING'
        : account.code.startsWith('15')
          ? 'INVESTING'
          : account.code.startsWith('25') || account.code.startsWith('3')
            ? 'FINANCING'
            : 'OPERATING'
    )

    const cashImpact = ['REVENUE', 'LIABILITY', 'EQUITY'].includes(account.type) ? balance : -balance
    const item = { code: account.code, name: account.name, amount: cashImpact }

    if (category === 'OPERATING') {
      ocf += cashImpact
      ocfItems.push(item)
      return
    }

    if (category === 'INVESTING') {
      icf += cashImpact
      icfItems.push(item)
      return
    }

    fcf += cashImpact
    fcfItems.push(item)
  })

  let changePercent = 0
  if (lastChangeTotal !== 0) {
    changePercent = ((currentChangeTotal - lastChangeTotal) / Math.abs(lastChangeTotal)) * 100
  } else if (currentChangeTotal !== 0) {
    changePercent = 100
  }

  return {
    ocf,
    icf,
    fcf,
    netChange: ocf + icf + fcf,
    ocfItems,
    icfItems,
    fcfItems,
    netChangeTrend: (currentChangeTotal >= lastChangeTotal ? 'UP' : 'DOWN') as 'UP' | 'DOWN',
    changePercent,
  }
}
