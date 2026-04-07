import { createClient } from '@/lib/supabase/server'
import { unstable_noStore as noStore } from 'next/cache'
import { addDaysToDateString, diffDateOnlyStrings, getDateInTimeZone } from '@/lib/utils'
import type { BranchSummary } from '@/modules/organization/lib/org-context'

type BranchFilter = string | null | undefined
type CashFlowCategory = 'OPERATING' | 'INVESTING' | 'FINANCING'

type CashFlowLineAccount = {
  id?: string | null
  code?: string | null
  name?: string | null
  type?: string | null
  normal_balance?: string | null
  parent_id?: string | null
  cash_flow_category?: CashFlowCategory | null
}

type CashFlowLine = {
  entry_id?: string | null
  debit?: number | string | null
  credit?: number | string | null
  accounts?: CashFlowLineAccount | null
}

type CashFlowItem = {
  code: string
  name: string
  amount: number
}

type CashFlowOptions = {
  startDate?: string
  endDate?: string
}

export type DeckCashSummary = {
  cash: number
  ocf: number
  icf: number
  fcf: number
}

async function resolveOrgIdsForReport(db: any, orgId: string, consolidated: boolean = false) {
  if (!consolidated) return [orgId]

  const { data: consolidatedOrgs, error: rpcError } = await db.rpc('get_consolidated_org_ids', { p_parent_org_id: orgId })
  if (rpcError || !Array.isArray(consolidatedOrgs)) return [orgId]

  const orgIds = consolidatedOrgs
    .map((row: any) => String(row?.org_id || '').trim())
    .filter((id: string) => id.length > 0)

  if (!orgIds.includes(orgId)) orgIds.unshift(orgId)
  return Array.from(new Set(orgIds))
}

async function getPostedEntryIds(
  db: any,
  orgId: string,
  options: {
    branchId?: BranchFilter
    startDate?: string
    endDate?: string
    asOfDate?: string
    consolidated?: boolean
  } = {}
) {
  noStore()
  const orgIdsToSearch = await resolveOrgIdsForReport(db, orgId, Boolean(options.consolidated))

  let query = db
    .from('journal_entries')
    .select('id')
    .in('org_id', orgIdsToSearch)
    .eq('status', 'POSTED')

  if (options.branchId && !options.consolidated) {
    query = query.eq('branch_id', options.branchId)
  }
  if (options.startDate) {
    query = query.gte('entry_date', options.startDate)
  }
  if (options.endDate) {
    query = query.lte('entry_date', options.endDate)
  }
  if (options.asOfDate) {
    query = query.lte('entry_date', options.asOfDate)
  }

  const { data, error } = await query
  if (error || !Array.isArray(data)) return []
  return data.map((entry: any) => entry.id)
}

async function getAccountBalancesFromEntries(
  db: any,
  entryIds: string[],
  codeFilter?: string[]
) {
  if (entryIds.length === 0) return []

  let query = db
    .from('journal_lines')
    .select('debit, credit, accounts!inner(id, code, name, type, normal_balance, parent_id, cash_flow_category)')
    .in('entry_id', entryIds) as any

  if (codeFilter && codeFilter.length > 0) {
    query = query.in('accounts.code', codeFilter)
  }

  const { data, error } = await query
  if (error || !Array.isArray(data)) return []

  const accountMap: Record<string, any> = {}
  data.forEach((line: any) => {
    const account = line.accounts
    if (!account || !account.code) return

    if (!accountMap[account.code]) {
      accountMap[account.code] = {
        ...account,
        total_debit: 0,
        total_credit: 0,
      }
    }

    accountMap[account.code].total_debit += Number(line.debit || 0)
    accountMap[account.code].total_credit += Number(line.credit || 0)
  })

  return Object.values(accountMap)
}

async function getCashAccountCodes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgIdsToSearch: string[],
  branchId?: BranchFilter,
  consolidated: boolean = false
) {
  let linkedAccountsQuery = (supabase as any)
    .from('bank_accounts')
    .select('account_id, accounts(code)')
    .in('org_id', orgIdsToSearch)

  if (branchId && !consolidated) {
    linkedAccountsQuery = linkedAccountsQuery.eq('branch_id', branchId)
  }

  const { data: linkedAccounts } = await linkedAccountsQuery
  const cashAccountCodes = (linkedAccounts || [])
    .map((la: any) => la.accounts?.code)
    .filter(Boolean)

  if (cashAccountCodes.length === 0) {
    cashAccountCodes.push('1101', '1102', '1103', '1104', '1105')
  }

  return Array.from(new Set(cashAccountCodes))
}

async function getCashBalance(
  db: any,
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  branchId?: BranchFilter,
  consolidated: boolean = false
) {
  const orgIdsToSearch = await resolveOrgIdsForReport(db, orgId, consolidated)
  const cashAccountCodes = await getCashAccountCodes(supabase, orgIdsToSearch, branchId, consolidated)
  const entryIds = await getPostedEntryIds(db, orgId, { branchId, consolidated })
  const balances = await getAccountBalancesFromEntries(db, entryIds, cashAccountCodes)

  return balances.reduce((sum: number, account: any) => {
    const totalDebit = Number(account?.total_debit || 0)
    const totalCredit = Number(account?.total_credit || 0)
    return sum + (totalDebit - totalCredit)
  }, 0)
}

function resolveCashFlowCategory(account: CashFlowLineAccount | null | undefined): CashFlowCategory {
  const mappedCategory = account?.cash_flow_category
  if (mappedCategory === 'OPERATING' || mappedCategory === 'INVESTING' || mappedCategory === 'FINANCING') {
    return mappedCategory
  }

  const code = String(account?.code || '').trim()
  if (code.startsWith('15') || code.startsWith('16')) return 'INVESTING'
  if (code.startsWith('25') || code.startsWith('26') || code.startsWith('3')) return 'FINANCING'
  return 'OPERATING'
}

async function getJournalLinesForEntries(
  db: any,
  entryIds: string[],
  cashAccountCodes?: string[]
): Promise<CashFlowLine[]> {
  if (entryIds.length === 0) return []

  let query = db
    .from('journal_lines')
    .select('entry_id, debit, credit, accounts!inner(id, code, name, type, normal_balance, parent_id, cash_flow_category)')
    .in('entry_id', entryIds) as any

  if (Array.isArray(cashAccountCodes) && cashAccountCodes.length > 0) {
    query = query.in('accounts.code', cashAccountCodes)
  }

  const { data, error } = await query
  if (error || !Array.isArray(data)) return []
  return data as CashFlowLine[]
}

function summarizeCashFlowFromLines(lines: CashFlowLine[], cashAccountCodes: string[]) {
  if (lines.length === 0) {
    return {
      ocf: 0,
      icf: 0,
      fcf: 0,
      netChange: 0,
      ocfItems: [] as CashFlowItem[],
      icfItems: [] as CashFlowItem[],
      fcfItems: [] as CashFlowItem[],
    }
  }

  const linesByEntryId = new Map<string, CashFlowLine[]>()
  lines.forEach((line) => {
    const entryId = String(line?.entry_id || '').trim()
    if (!entryId) return
    const existing = linesByEntryId.get(entryId) || []
    existing.push(line)
    linesByEntryId.set(entryId, existing)
  })

  let ocf = 0
  let icf = 0
  let fcf = 0
  const itemMap = new Map<string, CashFlowItem>()

  for (const entryLines of linesByEntryId.values()) {
    const cashLines = entryLines.filter((line) => cashAccountCodes.includes(String(line?.accounts?.code || '')))
    if (cashLines.length === 0) continue

    const nonCashLines = entryLines.filter((line) => !cashAccountCodes.includes(String(line?.accounts?.code || '')))
    if (nonCashLines.length === 0) continue

    nonCashLines.forEach((line) => {
      const account = line.accounts
      const code = String(account?.code || '').trim()
      if (!code) return

      const amount = Number(line.credit || 0) - Number(line.debit || 0)
      if (Math.abs(amount) < 0.01) return

      const category = resolveCashFlowCategory(account)
      const itemKey = `${category}:${code}`
      const existingItem = itemMap.get(itemKey)
      if (existingItem) {
        existingItem.amount += amount
      } else {
        itemMap.set(itemKey, {
          code,
          name: String(account?.name || 'Tanpa Nama Akun'),
          amount,
        })
      }

      if (category === 'OPERATING') ocf += amount
      else if (category === 'INVESTING') icf += amount
      else fcf += amount
    })
  }

  const toSortedItems = (category: CashFlowCategory) =>
    Array.from(itemMap.entries())
      .filter(([key]) => key.startsWith(`${category}:`))
      .map(([, item]) => item)
      .filter((item) => Math.abs(item.amount) > 0.01)
      .sort((a, b) => a.code.localeCompare(b.code))

  return {
    ocf,
    icf,
    fcf,
    netChange: ocf + icf + fcf,
    ocfItems: toSortedItems('OPERATING'),
    icfItems: toSortedItems('INVESTING'),
    fcfItems: toSortedItems('FINANCING'),
  }
}

export async function getGeneralLedger(orgId: string, branchId?: BranchFilter, consolidated: boolean = false) {
  noStore()
  const supabase = await createClient()
  const db = supabase as any

  const entryIds = await getPostedEntryIds(db, orgId, { branchId, consolidated })
  if (entryIds.length === 0) return []

  const { data, error } = await db
    .from('journal_entries')
    .select(`
      *,
      journal_lines (
        *,
        accounts (code, name, type)
      )
    `)
    .in('id', entryIds)
    .order('entry_date', { ascending: true })

  if (error || !data) return []
  return data
}

export async function getBalanceSheet(
  orgId: string,
  asOfDate?: string,
  branchId?: BranchFilter,
  consolidated: boolean = false
) {
  noStore()
  const supabase = await createClient()
  const db = supabase as any
  const finalAsOfDate = asOfDate || getDateInTimeZone('Asia/Jakarta')

  const orgIdsToSearch = await resolveOrgIdsForReport(db, orgId, consolidated)

  // 1. Fetch reference accounts from selected org scope
  const { data: accountRows } = await db
    .from('accounts')
    .select('id, org_id, code, name, type, normal_balance, parent_id')
    .in('org_id', orgIdsToSearch)
    .eq('is_active', true)
    .order('code', { ascending: true })

  const dedupedByCode = new Map<string, any>()
  const sortedRows = (Array.isArray(accountRows) ? accountRows : []).sort((a: any, b: any) => {
    const byCode = String(a?.code || '').localeCompare(String(b?.code || ''))
    if (byCode !== 0) return byCode
    if (a?.org_id === orgId && b?.org_id !== orgId) return -1
    if (a?.org_id !== orgId && b?.org_id === orgId) return 1
    return String(a?.name || '').localeCompare(String(b?.name || ''))
  })
  for (const account of sortedRows) {
    const code = String(account?.code || '').trim()
    if (!code || dedupedByCode.has(code)) continue
    dedupedByCode.set(code, account)
  }
  const accounts = Array.from(dedupedByCode.values())

  const entryIds = await getPostedEntryIds(db, orgId, { branchId, asOfDate: finalAsOfDate, consolidated })

  const balances = entryIds.length > 0 ? await getAccountBalancesFromEntries(db, entryIds) : []
  const balancesByCode = new Map<string, any>(balances.map((b: any) => [b.code, b]))

  const mapBalance = (account: any, positiveSide: 'DEBIT' | 'CREDIT') => {
    const existing = balancesByCode.get(account.code)
    const totalDebit = Number(existing?.total_debit || 0)
    const totalCredit = Number(existing?.total_credit || 0)
    const balance = positiveSide === 'DEBIT' ? totalDebit - totalCredit : totalCredit - totalDebit
    return {
      ...account,
      total_debit: totalDebit,
      total_credit: totalCredit,
      balance,
    }
  }

  const assets = accounts
    .filter((a: any) => a.type === 'ASSET' || String(a.code || '').startsWith('1'))
    .map((a: any) => mapBalance(a, 'DEBIT'))
    .sort((a: any, b: any) => String(a.code || '').localeCompare(String(b.code || '')))

  const liabilities = accounts
    .filter((a: any) => a.type === 'LIABILITY' || String(a.code || '').startsWith('2'))
    .map((a: any) => mapBalance(a, 'CREDIT'))
    .sort((a: any, b: any) => String(a.code || '').localeCompare(String(b.code || '')))

  const equity = accounts
    .filter((a: any) => a.type === 'EQUITY' || String(a.code || '').startsWith('3'))
    .map((a: any) => mapBalance(a, 'CREDIT'))
    .sort((a: any, b: any) => String(a.code || '').localeCompare(String(b.code || '')))

  const fiscalYearStart = `${finalAsOfDate.slice(0, 4)}-01-01`
  const { data: latestClosedPeriod } = await db
    .from('fiscal_periods')
    .select('end_date')
    .eq('org_id', orgId)
    .eq('is_closed', true)
    .lte('end_date', finalAsOfDate)
    .order('end_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const latestClosedEnd = String(latestClosedPeriod?.end_date || '').trim() || null
  const nextOpenDate = latestClosedEnd ? addDaysToDateString(latestClosedEnd, 1) : null
  const currentPeriodStart = nextOpenDate && nextOpenDate > fiscalYearStart ? nextOpenDate : fiscalYearStart
  const retainedEarningsEnd = addDaysToDateString(currentPeriodStart, -1)

  const retainedProfit = retainedEarningsEnd >= '1970-01-01'
    ? (await getProfitLoss(orgId, '1970-01-01', retainedEarningsEnd, branchId, consolidated)).netProfit
    : 0
  const currentProfit = currentPeriodStart <= finalAsOfDate
    ? (await getProfitLoss(orgId, currentPeriodStart, finalAsOfDate, branchId, consolidated)).netProfit
    : 0

  const referenceByCode = new Map<string, any>(accounts.map((account: any) => [String(account?.code || ''), account]))
  const equityParent = referenceByCode.get('3000')
  const upsertDerivedEquity = (code: string, fallbackName: string, balanceDelta: number) => {
    const existingIndex = equity.findIndex((row: any) => String(row?.code || '').trim() === code)
    if (existingIndex >= 0) {
      equity[existingIndex] = {
        ...equity[existingIndex],
        balance: Number(equity[existingIndex]?.balance || 0) + balanceDelta,
        isSystemComputed: true,
      }
      return
    }

    const referenceAccount = referenceByCode.get(code)
    equity.push({
      ...(referenceAccount || {}),
      code,
      name: referenceAccount?.name || fallbackName,
      type: 'EQUITY',
      parent_id: referenceAccount?.parent_id || equityParent?.id || null,
      balance: balanceDelta,
      isSystemComputed: true,
    })
  }

  upsertDerivedEquity('3002', 'Laba Ditahan', retainedProfit)
  upsertDerivedEquity('3003', 'Laba Periode Berjalan', currentProfit)
  equity.sort((a: any, b: any) => String(a.code || '').localeCompare(String(b.code || '')))

  return { assets, liabilities, equity }
}

export async function getProfitLoss(orgId: string, startDate?: string, endDate?: string, branchId?: BranchFilter, consolidated: boolean = false) {
  noStore()
  const supabase = await createClient()
  const db = supabase as any

  const todayInJakarta = getDateInTimeZone('Asia/Jakarta')
  const sDate = startDate || `${todayInJakarta.slice(0, 7)}-01`
  const eDate = endDate || todayInJakarta

  const entryIds = await getPostedEntryIds(db, orgId, {
    branchId,
    startDate: sDate,
    endDate: eDate,
    consolidated,
  })

  if (entryIds.length === 0) {
    return { revenue: [], expenses: [], totalRevenue: 0, totalExpenses: 0, netProfit: 0 }
  }

  const balances = await getAccountBalancesFromEntries(db, entryIds)
  if (balances.length === 0) return { revenue: [], expenses: [], totalRevenue: 0, totalExpenses: 0, netProfit: 0 }

  const results = balances.map((a: any) => ({
    ...a,
    balance: ['REVENUE', 'LIABILITY', 'EQUITY'].includes(a.type) || ['4', '7', '8'].includes(a.code[0])
      ? a.total_credit - a.total_debit
      : a.total_debit - a.total_credit
  }))

  const revenue = results.filter((a: any) => a.type === 'REVENUE' || ['4', '7', '8'].includes(a.code[0])).sort((a: any, b: any) => a.code.localeCompare(b.code))
  const expenses = results.filter((a: any) => a.type === 'EXPENSE' || ['5', '6', '9'].includes(a.code[0])).sort((a: any, b: any) => a.code.localeCompare(b.code))

  const totalRevenue = revenue.reduce((sum: number, r: any) => sum + (r.balance || 0), 0)
  const totalExpenses = expenses.reduce((sum: number, e: any) => sum + (e.balance || 0), 0)

  return { revenue, expenses, totalRevenue, totalExpenses, netProfit: totalRevenue - totalExpenses }
}

export async function getCashFlow(
  orgId: string,
  branchId?: BranchFilter,
  consolidated: boolean = false,
  options: CashFlowOptions = {}
) {
  noStore()
  const supabase = await createClient()
  const db = supabase as any
  const orgIdsToSearch = await resolveOrgIdsForReport(db, orgId, consolidated)

  const todayInJakarta = getDateInTimeZone('Asia/Jakarta')
  const startDate = options.startDate || `${todayInJakarta.slice(0, 7)}-01`
  const endDate = options.endDate || todayInJakarta
  const periodLengthDays = Math.max(diffDateOnlyStrings(endDate, startDate), 0) + 1
  const previousEndDate = addDaysToDateString(startDate, -1)
  const previousStartDate = addDaysToDateString(previousEndDate, -(periodLengthDays - 1))

  const cashAccountCodes = await getCashAccountCodes(supabase, orgIdsToSearch, branchId, consolidated)

  const currentEntryIds = await getPostedEntryIds(db, orgId, {
    branchId,
    startDate,
    endDate,
    consolidated,
  })

  const previousEntryIds = await getPostedEntryIds(db, orgId, {
    branchId,
    startDate: previousStartDate,
    endDate: previousEndDate,
    consolidated,
  })

  const [currentLines, previousCashLines] = await Promise.all([
    getJournalLinesForEntries(db, currentEntryIds),
    getJournalLinesForEntries(db, previousEntryIds, cashAccountCodes),
  ])

  const currentSummary = summarizeCashFlowFromLines(currentLines, cashAccountCodes)
  const previousChangeTotal = previousCashLines.reduce(
    (sum: number, line: CashFlowLine) => sum + (Number(line.debit || 0) - Number(line.credit || 0)),
    0
  )
  const netChangeTrend = currentSummary.netChange >= previousChangeTotal ? 'UP' : 'DOWN'

  // Percent change based on real bank movements if available, otherwise 0
  let changePercent = 0
  if (previousChangeTotal !== 0) {
    changePercent = ((currentSummary.netChange - previousChangeTotal) / Math.abs(previousChangeTotal)) * 100
  } else if (currentSummary.netChange !== 0) {
    changePercent = 100
  }

  return { 
    ocf: currentSummary.ocf,
    icf: currentSummary.icf,
    fcf: currentSummary.fcf,
    netChange: currentSummary.netChange,
    ocfItems: currentSummary.ocfItems,
    icfItems: currentSummary.icfItems,
    fcfItems: currentSummary.fcfItems,
    netChangeTrend: netChangeTrend as 'UP' | 'DOWN',
    changePercent
  }
}

export async function getDeckCashSummaries(
  orgIds: string[],
  branchesByOrgId: Record<string, BranchSummary[]>
): Promise<{
  orgSummaries: Record<string, DeckCashSummary>
  branchSummaries: Record<string, DeckCashSummary>
}> {
  const normalizedOrgIds = Array.from(new Set(orgIds.map((orgId) => String(orgId || '').trim()).filter(Boolean)))
  if (normalizedOrgIds.length === 0) {
    return { orgSummaries: {}, branchSummaries: {} }
  }

  const supabase = await createClient()
  const db = supabase as any

  const orgEntries = await Promise.all(
    normalizedOrgIds.map(async (orgId) => {
      const [cashFlow, cash] = await Promise.all([
        getCashFlow(orgId, null, false),
        getCashBalance(db, supabase, orgId, null, false),
      ])

      return [orgId, {
        cash,
        ocf: Number(cashFlow?.ocf || 0),
        icf: Number(cashFlow?.icf || 0),
        fcf: Number(cashFlow?.fcf || 0),
      }] as const
    })
  )

  const branchEntries = await Promise.all(
    normalizedOrgIds.flatMap((orgId) =>
      (branchesByOrgId[orgId] || []).map(async (branch) => {
        const [cashFlow, cash] = await Promise.all([
          getCashFlow(orgId, branch.id, false),
          getCashBalance(db, supabase, orgId, branch.id, false),
        ])

        return [`${orgId}:${branch.id}`, {
          cash,
          ocf: Number(cashFlow?.ocf || 0),
          icf: Number(cashFlow?.icf || 0),
          fcf: Number(cashFlow?.fcf || 0),
        }] as const
      })
    )
  )

  return {
    orgSummaries: Object.fromEntries(orgEntries),
    branchSummaries: Object.fromEntries(branchEntries),
  }
}
