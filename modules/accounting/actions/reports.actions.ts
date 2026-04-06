import { createClient } from '@/lib/supabase/server'
import { unstable_noStore as noStore } from 'next/cache'
import { addDaysToDateString, getDateInTimeZone } from '@/lib/utils'

type BranchFilter = string | null | undefined

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
  }>
}

    accountMap[account.code].total_debit += Number(line.debit || 0)
    accountMap[account.code].total_credit += Number(line.credit || 0)
  })

function emptyCashFlow() {
  return { ocf: 0, icf: 0, fcf: 0, netChange: 0, ocfItems: [], icfItems: [], fcfItems: [], netChangeTrend: 'UP' as 'UP' | 'DOWN', changePercent: 0 }
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

  return data.map(normalizeLedgerEntry)
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

  const pl = await getProfitLoss(orgId, '1970-01-01', finalAsOfDate, branchId, consolidated)
  equity.push({ code: '9999', name: 'Laba Ditahan / Periode Berjalan', balance: pl.netProfit, type: 'EQUITY' })

  return { assets, liabilities, equity }
}

export async function getProfitLoss(orgId: string, startDate?: string, endDate?: string, branchId?: BranchFilter, consolidated: boolean = false) {
  noStore()
  const supabase = await createClient()
  const db = supabase as any

  const todayInJakarta = getDateInTimeZone('Asia/Jakarta')
  const sDate = startDate || `${todayInJakarta.slice(0, 7)}-01`
  const eDate = endDate || todayInJakarta

  const entryIds = await getPostedEntryIds(orgId, {
    branchId: branchSelection.branchId,
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
  const supabase = await createClient()
  const db = supabase as any
  const orgIdsToSearch = await resolveOrgIdsForReport(db, orgId, consolidated)

  const todayInJakarta = getDateInTimeZone('Asia/Jakarta')
  const currentMonthStart = `${todayInJakarta.slice(0, 7)}-01`
  const lastMonthEnd = addDaysToDateString(currentMonthStart, -1)
  const lastMonthStart = `${lastMonthEnd.slice(0, 7)}-01`

  // Get all accounts linked to bank/cash module to treat them as cash accounts
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
  
  // Add defaults if still empty (fallback)
  if (cashAccountCodes.length === 0) {
    cashAccountCodes.push('1101', '1102', '1103', '1104', '1105')
  }

  const allEntryIds = await getPostedEntryIds(db, orgId, { branchId, consolidated })
  const accounts = await getAccountBalancesFromEntries(db, allEntryIds)

  const currentEntryIds = await getPostedEntryIds(orgId, {
    branchId: branchSelection.branchId,
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

  const lastEntryIds = await getPostedEntryIds(orgId, {
    branchId: branchSelection.branchId,
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
