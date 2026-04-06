'use server'

import { unstable_noStore as noStore } from 'next/cache'

import { prisma } from '@/lib/prisma'
import { addDaysToDateString, getDateInTimeZone } from '@/lib/utils'
import {
  ensureAccountingAccess,
  formatDateOnly,
  getAggregatedAccountBalances,
  parseDateOnly,
  resolveBranchFilter,
  toNumber,
  type BranchFilter,
} from '@/modules/accounting/lib/reporting.server'

function emptyProfitLoss() {
  return { revenue: [], expenses: [], totalRevenue: 0, totalExpenses: 0, netProfit: 0 }
}

function emptyCashFlow() {
  return {
    ocf: 0,
    icf: 0,
    fcf: 0,
    netChange: 0,
    ocfItems: [],
    icfItems: [],
    fcfItems: [],
    netChangeTrend: 'UP' as 'UP' | 'DOWN',
    changePercent: 0,
  }
}

type LedgerLine = {
  debit: unknown
  credit: unknown
  account_id?: string | null
  accounts?: {
    code: string | null
    name: string | null
    type: unknown
  } | null
}

type LedgerEntry = {
  entry_date: Date | string | null
  posted_at?: Date | string | null
  voided_at?: Date | string | null
  created_at?: Date | string | null
  updated_at?: Date | string | null
  journal_lines?: LedgerLine[] | null
  [key: string]: unknown
}

type AggregatedAccount = {
  id: string
  code: string
  name: string
  type: string
  normal_balance: string
  parent_id: string | null
  cash_flow_category?: string | null
  total_debit: number
  total_credit: number
}

type BalanceSheetAccount = {
  id: string
  org_id: string
  code: string
  name: string
  type: string
  normal_balance: string
  parent_id: string | null
}

type BalanceSheetRow = {
  code: string
  name: string
  type: string
  balance: number
  total_debit?: number
  total_credit?: number
}

function normalizeLedgerEntry(entry: LedgerEntry) {
  const journalLines = Array.isArray(entry.journal_lines)
    ? entry.journal_lines
        .map((line) => ({
          ...line,
          debit: toNumber(line.debit),
          credit: toNumber(line.credit),
        }))
        .sort((left, right) => toNumber(right.debit) - toNumber(left.debit))
    : []

  return {
    ...entry,
    entry_date: formatDateOnly(entry.entry_date),
    posted_at: entry.posted_at instanceof Date ? entry.posted_at.toISOString() : entry.posted_at,
    voided_at: entry.voided_at instanceof Date ? entry.voided_at.toISOString() : entry.voided_at,
    created_at: entry.created_at instanceof Date ? entry.created_at.toISOString() : entry.created_at,
    updated_at: entry.updated_at instanceof Date ? entry.updated_at.toISOString() : entry.updated_at,
    journal_lines: journalLines,
  }
}

async function resolveOrgIdsForReport(orgId: string, consolidated: boolean = false) {
  if (!consolidated) return [orgId]

  const orgRows = await prisma.organizations.findMany({
    select: { id: true, parent_org_id: true },
  })

  const childrenByParent = new Map<string, string[]>()
  for (const row of orgRows) {
    const parentId = String(row.parent_org_id || '').trim()
    if (!parentId) continue
    const bucket = childrenByParent.get(parentId) || []
    bucket.push(row.id)
    childrenByParent.set(parentId, bucket)
  }

  const resolved = new Set<string>([orgId])
  const queue = [...(childrenByParent.get(orgId) || [])]
  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || resolved.has(current)) continue
    resolved.add(current)
    queue.push(...(childrenByParent.get(current) || []))
  }

  return Array.from(resolved)
}

async function getPostedEntryIdsForReport(
  orgIds: string[],
  options: {
    branchId?: BranchFilter
    startDate?: string
    endDate?: string
    asOfDate?: string
    consolidated?: boolean
  } = {}
) {
  const entryDate: { gte?: Date; lte?: Date } = {}

  if (options.startDate) entryDate.gte = parseDateOnly(options.startDate)
  if (options.endDate) entryDate.lte = parseDateOnly(options.endDate)
  if (options.asOfDate) entryDate.lte = parseDateOnly(options.asOfDate)

  const rows = await prisma.journal_entries.findMany({
    where: {
      org_id: { in: orgIds },
      status: 'POSTED',
      ...(!options.consolidated && options.branchId ? { branch_id: options.branchId } : {}),
      ...(Object.keys(entryDate).length > 0 ? { entry_date: entryDate } : {}),
    },
    select: { id: true },
  })

  return rows.map((entry) => entry.id)
}

async function getAccountBalancesFromEntries(entryIds: string[], codeFilter?: string[]) {
  if (entryIds.length === 0) return []

  const lines = await prisma.journal_lines.findMany({
    where: {
      entry_id: { in: entryIds },
      ...(codeFilter && codeFilter.length > 0
        ? {
            accounts: {
              is: {
                code: { in: codeFilter },
              },
            },
          }
        : {}),
    },
    include: {
      accounts: {
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          normal_balance: true,
          parent_id: true,
          cash_flow_category: true,
        },
      },
    },
  })

  const accountMap = new Map<string, AggregatedAccount>()
  lines.forEach((line) => {
    const account = line.accounts
    if (!account?.code) return

    const existing = accountMap.get(account.code)
    if (existing) {
      existing.total_debit += toNumber(line.debit)
      existing.total_credit += toNumber(line.credit)
      return
    }

    accountMap.set(account.code, {
      ...account,
      type: String(account.type),
      normal_balance: String(account.normal_balance),
      total_debit: toNumber(line.debit),
      total_credit: toNumber(line.credit),
    })
  })

  return Array.from(accountMap.values())
}

async function getCashAccountCodesForScope(orgIds: string[], branchId?: BranchFilter, consolidated: boolean = false) {
  const linkedAccounts = await prisma.bank_accounts.findMany({
    where: {
      org_id: { in: orgIds },
      is_active: true,
      ...(!consolidated && branchId ? { branch_id: branchId } : {}),
    },
    select: {
      accounts: {
        select: { code: true },
      },
    },
  })

  const codes = Array.from(new Set(linkedAccounts.map((account) => account.accounts.code).filter(Boolean)))
  return codes.length > 0 ? codes : ['1101', '1102', '1103', '1104', '1105']
}

async function resolveReportContext(orgId: string, branchId?: BranchFilter, consolidated: boolean = false) {
  const membership = await ensureAccountingAccess(orgId)
  if (!membership) return null

  const branchSelection = consolidated ? { branchId: null as string | null } : await resolveBranchFilter(orgId, branchId)
  if (branchSelection && 'error' in branchSelection) return null

  const orgIds = await resolveOrgIdsForReport(orgId, consolidated)
  return {
    orgIds,
    branchId: consolidated ? null : (branchSelection?.branchId ?? null),
  }
}

export async function getGeneralLedger(orgId: string, branchId?: BranchFilter, consolidated: boolean = false) {
  noStore()

  const context = await resolveReportContext(orgId, branchId, consolidated)
  if (!context) return []

  const entryIds = await getPostedEntryIdsForReport(context.orgIds, {
    branchId: context.branchId,
    consolidated,
  })
  if (entryIds.length === 0) return []

  const entries = await prisma.journal_entries.findMany({
    where: { id: { in: entryIds } },
    include: {
      journal_lines: {
        include: {
          accounts: {
            select: { code: true, name: true, type: true },
          },
        },
      },
    },
    orderBy: { entry_date: 'asc' },
  })

  return entries.map(normalizeLedgerEntry)
}

export async function getBalanceSheet(
  orgId: string,
  asOfDate?: string,
  branchId?: BranchFilter,
  consolidated: boolean = false
) {
  noStore()

  const context = await resolveReportContext(orgId, branchId, consolidated)
  if (!context) return { assets: [], liabilities: [], equity: [] }

  const finalAsOfDate = asOfDate || getDateInTimeZone('Asia/Jakarta')
  const accountRows = await prisma.accounts.findMany({
    where: {
      org_id: { in: context.orgIds },
      is_active: true,
    },
    select: {
      id: true,
      org_id: true,
      code: true,
      name: true,
      type: true,
      normal_balance: true,
      parent_id: true,
    },
    orderBy: [{ code: 'asc' }, { name: 'asc' }],
  })

  const dedupedByCode = new Map<string, BalanceSheetAccount>()
  const sortedRows = accountRows.sort((left, right) => {
    const byCode = String(left.code || '').localeCompare(String(right.code || ''))
    if (byCode !== 0) return byCode
    if (left.org_id === orgId && right.org_id !== orgId) return -1
    if (left.org_id !== orgId && right.org_id === orgId) return 1
    return String(left.name || '').localeCompare(String(right.name || ''))
  })

  for (const account of sortedRows) {
    const code = String(account.code || '').trim()
    if (!code || dedupedByCode.has(code)) continue
    dedupedByCode.set(code, { ...account, type: String(account.type), normal_balance: String(account.normal_balance) })
  }

  const entryIds = await getPostedEntryIdsForReport(context.orgIds, {
    branchId: context.branchId,
    asOfDate: finalAsOfDate,
    consolidated,
  })

  const balances = entryIds.length > 0 ? await getAccountBalancesFromEntries(entryIds) : []
  const balancesByCode = new Map<string, AggregatedAccount>(balances.map((balance) => [balance.code, balance]))

  const mapBalance = (account: BalanceSheetAccount, positiveSide: 'DEBIT' | 'CREDIT'): BalanceSheetRow => {
    const existing = balancesByCode.get(account.code)
    const totalDebit = toNumber(existing?.total_debit)
    const totalCredit = toNumber(existing?.total_credit)
    return {
      ...account,
      total_debit: totalDebit,
      total_credit: totalCredit,
      balance: positiveSide === 'DEBIT' ? totalDebit - totalCredit : totalCredit - totalDebit,
    }
  }

  const accounts = Array.from(dedupedByCode.values())
  const assets: BalanceSheetRow[] = accounts
    .filter((account) => account.type === 'ASSET' || String(account.code || '').startsWith('1'))
    .map((account) => mapBalance(account, 'DEBIT'))
    .sort((left, right) => String(left.code || '').localeCompare(String(right.code || '')))

  const liabilities: BalanceSheetRow[] = accounts
    .filter((account) => account.type === 'LIABILITY' || String(account.code || '').startsWith('2'))
    .map((account) => mapBalance(account, 'CREDIT'))
    .sort((left, right) => String(left.code || '').localeCompare(String(right.code || '')))

  const equity: BalanceSheetRow[] = accounts
    .filter((account) => account.type === 'EQUITY' || String(account.code || '').startsWith('3'))
    .map((account) => mapBalance(account, 'CREDIT'))
    .sort((left, right) => String(left.code || '').localeCompare(String(right.code || '')))

  const profitLoss = await getProfitLoss(orgId, '1970-01-01', finalAsOfDate, branchId, consolidated)
  equity.push({ code: '9999', name: 'Laba Ditahan / Periode Berjalan', balance: profitLoss.netProfit, type: 'EQUITY' })

  return { assets, liabilities, equity }
}

export async function getProfitLoss(
  orgId: string,
  startDate?: string,
  endDate?: string,
  branchId?: BranchFilter,
  consolidated: boolean = false
) {
  noStore()

  const context = await resolveReportContext(orgId, branchId, consolidated)
  if (!context) return emptyProfitLoss()

  const todayInJakarta = getDateInTimeZone('Asia/Jakarta')
  const sDate = startDate || `${todayInJakarta.slice(0, 7)}-01`
  const eDate = endDate || todayInJakarta
  const entryIds = await getPostedEntryIdsForReport(context.orgIds, {
    branchId: context.branchId,
    startDate: sDate,
    endDate: eDate,
    consolidated,
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

export async function getCashFlow(orgId: string, branchId?: BranchFilter, consolidated: boolean = false) {
  noStore()

  const context = await resolveReportContext(orgId, branchId, consolidated)
  if (!context) return emptyCashFlow()

  const todayInJakarta = getDateInTimeZone('Asia/Jakarta')
  const currentMonthStart = `${todayInJakarta.slice(0, 7)}-01`
  const lastMonthEnd = addDaysToDateString(currentMonthStart, -1)
  const lastMonthStart = `${lastMonthEnd.slice(0, 7)}-01`

  const cashAccountCodes = await getCashAccountCodesForScope(context.orgIds, context.branchId, consolidated)
  const allEntryIds = await getPostedEntryIdsForReport(context.orgIds, {
    branchId: context.branchId,
    consolidated,
  })
  const accounts = await getAccountBalancesFromEntries(allEntryIds)

  const currentEntryIds = await getPostedEntryIdsForReport(context.orgIds, {
    branchId: context.branchId,
    startDate: currentMonthStart,
    consolidated,
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

  const lastEntryIds = await getPostedEntryIdsForReport(context.orgIds, {
    branchId: context.branchId,
    startDate: lastMonthStart,
    endDate: lastMonthEnd,
    consolidated,
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
