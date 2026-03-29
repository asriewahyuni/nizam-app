import { createClient } from '@/lib/supabase/server'

export async function getGeneralLedger(orgId: string) {
  const supabase = await createClient()
  const db = supabase as any

  const { data, error } = await db
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
    .order('entry_date', { ascending: true })

  if (error || !data) return []
  return data
}

export async function getBalanceSheet(orgId: string, asOfDate: string = new Date().toISOString().split('T')[0]) {
  const supabase = await createClient()
  const db = supabase as any

  // Anchor: only fetch journal_entries for THIS org, then get their lines
  const { data: entries, error: entErr } = await db
    .from('journal_entries')
    .select('id')
    .eq('org_id', orgId)
    .eq('status', 'POSTED')
    .lte('entry_date', asOfDate)

  if (entErr || !entries || entries.length === 0) {
    const pl = await getProfitLoss(orgId, '1970-01-01', asOfDate)
    return { assets: [], liabilities: [], equity: [{ code: '9999', name: 'Laba Ditahan / Periode Berjalan', balance: pl.netProfit, type: 'EQUITY' }] }
  }

  const entryIds = entries.map((e: any) => e.id)

  const { data, error } = await db
    .from('journal_lines')
    .select('debit, credit, accounts!inner(id, code, name, type, normal_balance)')
    .in('entry_id', entryIds) as any

  if (error || !data) return { assets: [], liabilities: [], equity: [] }

  const accountMap: Record<string, any> = {}
  data.forEach((l: any) => {
    const acc = l.accounts
    if (!accountMap[acc.id]) accountMap[acc.id] = { ...acc, total_debit: 0, total_credit: 0 }
    accountMap[acc.id].total_debit += Number(l.debit)
    accountMap[acc.id].total_credit += Number(l.credit)
  })

  const assets = Object.values(accountMap)
    .filter((a: any) => a.type === 'ASSET' || a.code.startsWith('1'))
    .map((a: any) => ({ ...a, balance: a.total_debit - a.total_credit }))
    .sort((a: any, b: any) => a.code.localeCompare(b.code))

  const liabilities = Object.values(accountMap)
    .filter((a: any) => a.type === 'LIABILITY' || a.code.startsWith('2'))
    .map((a: any) => ({ ...a, balance: a.total_credit - a.total_debit }))
    .sort((a: any, b: any) => a.code.localeCompare(b.code))

  const equity = Object.values(accountMap)
    .filter((a: any) => a.type === 'EQUITY' || a.code.startsWith('3'))
    .map((a: any) => ({ ...a, balance: a.total_credit - a.total_debit }))
    .sort((a: any, b: any) => a.code.localeCompare(b.code))

  const pl = await getProfitLoss(orgId, '1970-01-01', asOfDate)
  equity.push({ code: '9999', name: 'Laba Ditahan / Periode Berjalan', balance: pl.netProfit, type: 'EQUITY' })

  return { assets, liabilities, equity }
}

export async function getProfitLoss(orgId: string, startDate?: string, endDate?: string) {
  const supabase = await createClient()
  const db = supabase as any

  const now = new Date()
  const sDate = startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const eDate = endDate || new Date().toISOString().split('T')[0]

  // Anchor by org_id first via journal_entries, then fetch lines
  const { data: entries, error: entErr } = await db
    .from('journal_entries')
    .select('id')
    .eq('org_id', orgId)
    .eq('status', 'POSTED')
    .gte('entry_date', sDate)
    .lte('entry_date', eDate)

  if (entErr || !entries || entries.length === 0) {
    return { revenue: [], expenses: [], totalRevenue: 0, totalExpenses: 0, netProfit: 0 }
  }

  const entryIds = entries.map((e: any) => e.id)

  const { data, error } = await db
    .from('journal_lines')
    .select('debit, credit, accounts!inner(id, code, name, type, normal_balance)')
    .in('entry_id', entryIds) as any

  if (error || !data) return { revenue: [], expenses: [], totalRevenue: 0, totalExpenses: 0, netProfit: 0 }

  const accMap: Record<string, any> = {}
  data.forEach((l: any) => {
    const acc = l.accounts
    if (!accMap[acc.id]) accMap[acc.id] = { ...acc, debit: 0, credit: 0 }
    accMap[acc.id].debit += Number(l.debit)
    accMap[acc.id].credit += Number(l.credit)
  })

  const results = Object.values(accMap).map((a: any) => ({
    ...a,
    balance: ['REVENUE', 'LIABILITY', 'EQUITY'].includes(a.type) || ['4', '7', '8'].includes(a.code[0])
      ? a.credit - a.debit
      : a.debit - a.credit
  }))

  const revenue = results.filter((a: any) => a.type === 'REVENUE' || ['4', '7', '8'].includes(a.code[0])).sort((a: any, b: any) => a.code.localeCompare(b.code))
  const expenses = results.filter((a: any) => a.type === 'EXPENSE' || ['5', '6', '9'].includes(a.code[0])).sort((a: any, b: any) => a.code.localeCompare(b.code))

  const totalRevenue = revenue.reduce((sum: number, r: any) => sum + (r.balance || 0), 0)
  const totalExpenses = expenses.reduce((sum: number, e: any) => sum + (e.balance || 0), 0)

  return { revenue, expenses, totalRevenue, totalExpenses, netProfit: totalRevenue - totalExpenses }
}

export async function getCashFlow(orgId: string) {
  const supabase = await createClient()
  const db = supabase as any

  const now = new Date()
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]

  // Get all accounts linked to bank/cash module to treat them as cash accounts
  const { data: linkedAccounts } = await (supabase as any).from('bank_accounts').select('account_id, accounts(code)')
  const cashAccountCodes = (linkedAccounts || [])
    .map((la: any) => la.accounts?.code)
    .filter(Boolean)
  
  // Add defaults if still empty (fallback)
  if (cashAccountCodes.length === 0) {
    cashAccountCodes.push('1101', '1102', '1103', '1104', '1105')
  }

  const { data: accounts, error } = await db
    .from('account_balances')
    .select('*')
    .eq('org_id', orgId)

  if (error || !accounts) return { ocf: 0, icf: 0, fcf: 0, netChange: 0, ocfItems: [], icfItems: [], fcfItems: [] }

  // 1. Calculate Periods for Trend — anchor by org via journal_entries first
  const { data: currentEntries } = await db
    .from('journal_entries').select('id')
    .eq('org_id', orgId).eq('status', 'POSTED')
    .gte('entry_date', currentMonthStart)

  const currentEntryIds = (currentEntries || []).map((e: any) => e.id)
  const currentMonthLines = currentEntryIds.length > 0
    ? (await (supabase as any).from('journal_lines')
        .select('debit, credit, accounts!inner(code)')
        .in('entry_id', currentEntryIds)
        .in('accounts.code', cashAccountCodes) as any).data || []
    : []

  const { data: lastEntries } = await db
    .from('journal_entries').select('id')
    .eq('org_id', orgId).eq('status', 'POSTED')
    .gte('entry_date', lastMonthStart).lte('entry_date', lastMonthEnd)

  const lastEntryIds = (lastEntries || []).map((e: any) => e.id)
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


