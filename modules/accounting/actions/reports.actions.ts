import { createClient } from '@/lib/supabase/server'

type BranchFilter = string | null | undefined

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
  let orgIdsToSearch = [orgId]

  if (options.consolidated) {
    const { data: consolidatedOrgs, error: rpcError } = await db.rpc('get_consolidated_org_ids', { p_parent_org_id: orgId })
    if (!rpcError && Array.isArray(consolidatedOrgs)) {
      orgIdsToSearch = consolidatedOrgs.map((o: any) => o.org_id)
    }
  }

  let query = db
    .from('journal_entries')
    .select('id')
    .in('org_id', orgIdsToSearch)
    .eq('status', 'POSTED')

  if (options.branchId) {
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

export async function getGeneralLedger(orgId: string, branchId?: BranchFilter) {
  const supabase = await createClient()
  const db = supabase as any

  let query = db
    .from('journal_entries')
    .select(`
      *,
      journal_lines (
        *,
        accounts (code, name, type)
      )
    `)
    .eq('org_id', orgId)
    .eq('status', 'POSTED')

  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  const { data, error } = await query.order('entry_date', { ascending: true })

  if (error || !data) return []
  return data
}

export async function getBalanceSheet(
  orgId: string,
  asOfDate: string = new Date().toISOString().split('T')[0],
  branchId?: BranchFilter,
  consolidated: boolean = false
) {
  const supabase = await createClient()
  const db = supabase as any

  // 1. Fetch reference accounts from current org
  const { data: accountRows } = await db
    .from('accounts')
    .select('id, code, name, type, normal_balance, parent_id')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('code', { ascending: true })

  const accounts = Array.isArray(accountRows) ? accountRows : []
  const entryIds = await getPostedEntryIds(db, orgId, { branchId, asOfDate, consolidated })

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

  const pl = await getProfitLoss(orgId, '1970-01-01', asOfDate, branchId, consolidated)
  equity.push({ code: '9999', name: 'Laba Ditahan / Periode Berjalan', balance: pl.netProfit, type: 'EQUITY' })

  return { assets, liabilities, equity }
}

export async function getProfitLoss(orgId: string, startDate?: string, endDate?: string, branchId?: BranchFilter, consolidated: boolean = false) {
  const supabase = await createClient()
  const db = supabase as any

  const now = new Date()
  const sDate = startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const eDate = endDate || new Date().toISOString().split('T')[0]

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

export async function getCashFlow(orgId: string, branchId?: BranchFilter, consolidated: boolean = false) {
  const supabase = await createClient()
  const db = supabase as any

  const now = new Date()
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]

  // Get all accounts linked to bank/cash module to treat them as cash accounts
  let linkedAccountsQuery = (supabase as any)
    .from('bank_accounts')
    .select('account_id, accounts(code)')
    .eq('org_id', orgId)

  if (branchId) {
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

  if (accounts.length === 0) return { ocf: 0, icf: 0, fcf: 0, netChange: 0, ocfItems: [], icfItems: [], fcfItems: [] }

  // 1. Calculate Periods for Trend — anchor by org via journal_entries first
  const currentEntryIds = await getPostedEntryIds(db, orgId, {
    branchId,
    startDate: currentMonthStart,
    consolidated,
  })
  const currentMonthLines = currentEntryIds.length > 0
    ? (await (supabase as any).from('journal_lines')
        .select('debit, credit, accounts!inner(code)')
        .in('entry_id', currentEntryIds)
        .in('accounts.code', cashAccountCodes) as any).data || []
    : []

  const lastEntryIds = await getPostedEntryIds(db, orgId, {
    branchId,
    startDate: lastMonthStart,
    endDate: lastMonthEnd,
    consolidated,
  })
  const lastMonthLines = lastEntryIds.length > 0
    ? (await (supabase as any).from('journal_lines')
        .select('debit, credit, accounts!inner(code)')
        .in('entry_id', lastEntryIds)
        .in('accounts.code', cashAccountCodes) as any).data || []
    : []

  const currentChangeTotal = (currentMonthLines || []).reduce((sum: number, l: any) => sum + (Number(l.debit) - Number(l.credit)), 0)
  const lastChangeTotal = (lastMonthLines || []).reduce((sum: number, l: any) => sum + (Number(l.debit) - Number(l.credit)), 0)

  let ocf = 0, icf = 0, fcf = 0
  const ocfItems: any[] = [], icfItems: any[] = [], fcfItems: any[] = []
  
  accounts.forEach((acc: any) => {
    if (cashAccountCodes.includes(acc.code)) return

    const balance = ['LIABILITY', 'EQUITY', 'REVENUE'].includes(acc.type) 
      ? (acc.total_credit || 0) - (acc.total_debit || 0)
      : (acc.total_debit || 0) - (acc.total_credit || 0)

    if (Math.abs(balance) < 0.01) return
    
    // Use stored mapping, or fallback to heuristic if not set
    const category = acc.cash_flow_category || (
      (acc.type === 'REVENUE' || acc.type === 'EXPENSE' || 
       acc.code.startsWith('12') || acc.code.startsWith('13') || acc.code.startsWith('14') ||
       acc.code.startsWith('21') || acc.code.startsWith('22') || acc.code.startsWith('23') || acc.code.startsWith('24')) ? 'OPERATING' :
      (acc.code.startsWith('15')) ? 'INVESTING' :
      (acc.code.startsWith('25') || acc.code.startsWith('3')) ? 'FINANCING' : 
      'OPERATING'
    )

    let cashImpact = ['REVENUE', 'LIABILITY', 'EQUITY'].includes(acc.type) ? balance : -balance
    const item = { code: acc.code, name: acc.name, amount: cashImpact }

    if (category === 'OPERATING') { ocf += cashImpact; ocfItems.push(item) }
    else if (category === 'INVESTING') { icf += cashImpact; icfItems.push(item) }
    else if (category === 'FINANCING') { fcf += cashImpact; fcfItems.push(item) }
  })

  // Net Change is the sum of all sections
  const netChange = ocf + icf + fcf
  const netChangeTrend = currentChangeTotal >= lastChangeTotal ? 'UP' : 'DOWN'

  // Percent change based on real bank movements if available, otherwise 0
  let changePercent = 0
  if (lastChangeTotal !== 0) {
    changePercent = ((currentChangeTotal - lastChangeTotal) / Math.abs(lastChangeTotal)) * 100
  } else if (currentChangeTotal !== 0) {
    changePercent = 100
  }

  return { 
    ocf, icf, fcf, netChange, 
    ocfItems, icfItems, fcfItems,
    netChangeTrend: (currentChangeTotal >= lastChangeTotal ? 'UP' : 'DOWN') as 'UP' | 'DOWN',
    changePercent
  }
}
