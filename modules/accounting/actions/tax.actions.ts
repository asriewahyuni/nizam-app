import { createClient } from '@/lib/supabase/server'

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function normalizeDateOnlyValue(value: unknown): string | null {
  if (!value) return null

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    if (DATE_ONLY_PATTERN.test(trimmed)) return trimmed

    const parsed = new Date(trimmed)
    if (Number.isNaN(parsed.getTime())) return null
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  }

  const normalized = String(value).trim()
  if (!normalized) return null
  if (DATE_ONLY_PATTERN.test(normalized)) return normalized

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return null
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
}

export async function getTaxSummary(orgId: string, startDate?: string, endDate?: string, branchId?: string | null) {
  const supabase = await createClient()
  const db = supabase as any

  const now = new Date()
  const sDate = startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const eDate = endDate || new Date().toISOString().split('T')[0]

  // ── STEP 1: Resolve account IDs for tax codes ─────────────────────────────
  // Cannot filter journal_lines by accounts.code directly via PostgREST .or()
  // so we first fetch the account IDs for org, then filter lines by those IDs.
  const TAX_CODES = ['1401', '2201', '2202', '2203']
  const { data: taxAccounts, error: accErr } = await db
    .from('accounts')
    .select('id, code')
    .eq('org_id', orgId)
    .in('code', TAX_CODES)

  if (accErr || !taxAccounts || taxAccounts.length === 0) {
    return {
      vatIn: { total: 0, items: [] },
      vatOut: { total: 0, items: [] },
      pph21: { total: 0, items: [] },
      pph23: { total: 0, items: [] },
      netVat: 0,
      startDate: sDate,
      endDate: eDate
    }
  }

  const accIdMap: Record<string, string> = {} // code → account_id
  taxAccounts.forEach((a: any) => { accIdMap[a.code] = a.id })
  const taxAccountIds = taxAccounts.map((a: any) => a.id)

  // ── STEP 2: Get relevant journal entry IDs in date range ─────────────────
  let entriesQuery = db
    .from('journal_entries')
    .select('id')
    .eq('org_id', orgId)
    .eq('status', 'POSTED')
    .gte('entry_date', sDate)
    .lte('entry_date', eDate)

  if (branchId) {
    entriesQuery = entriesQuery.eq('branch_id', branchId)
  }

  const { data: entries, error: entErr } = await entriesQuery

  if (entErr || !entries || entries.length === 0) {
    return {
      vatIn: { total: 0, items: [] },
      vatOut: { total: 0, items: [] },
      pph21: { total: 0, items: [] },
      pph23: { total: 0, items: [] },
      netVat: 0,
      startDate: sDate,
      endDate: eDate
    }
  }

  const entryIds = entries.map((e: any) => e.id)

  // ── STEP 3: Fetch journal lines filtered by tax account IDs ───────────────
  const { data: lines, error: lineErr } = await db
    .from('journal_lines')
    .select(`
      debit, credit, memo, entry_id, account_id,
      accounts!inner(id, code, name, type, normal_balance),
      journal_entries!inner(entry_number, entry_date, description)
    `)
    .in('entry_id', entryIds)
    .in('account_id', taxAccountIds) as any

  if (lineErr || !lines) {
    return {
      vatIn: { total: 0, items: [] },
      vatOut: { total: 0, items: [] },
      pph21: { total: 0, items: [] },
      pph23: { total: 0, items: [] },
      netVat: 0,
      startDate: sDate,
      endDate: eDate
    }
  }

  const vatInItems: any[] = []
  const vatOutItems: any[] = []
  const pph21Items: any[] = []
  const pph23Items: any[] = []

  let totalVatIn = 0
  let totalVatOut = 0
  let totalPph21 = 0
  let totalPph23 = 0

  lines.forEach((l: any) => {
    const code = l.accounts.code
    const item = {
      date: normalizeDateOnlyValue(l.journal_entries.entry_date),
      ref: l.journal_entries.entry_number,
      description: l.journal_entries.description,
      memo: l.memo
    }

    if (code === '1401') {
      // VAT In: Normal balance DEBIT. Net = debit - credit
      const net = Number(l.debit) - Number(l.credit)
      if (net !== 0) { totalVatIn += net; vatInItems.push({ ...item, amount: net }) }
    } else if (code === '2201') {
      // VAT Out: Normal balance CREDIT. Net = credit - debit
      const net = Number(l.credit) - Number(l.debit)
      if (net !== 0) { totalVatOut += net; vatOutItems.push({ ...item, amount: net }) }
    } else if (code === '2202') {
      const net = Number(l.credit) - Number(l.debit)
      if (net !== 0) { totalPph21 += net; pph21Items.push({ ...item, amount: net }) }
    } else if (code === '2203') {
      const net = Number(l.credit) - Number(l.debit)
      if (net !== 0) { totalPph23 += net; pph23Items.push({ ...item, amount: net }) }
    }
  })

  return {
    vatIn: { total: totalVatIn, items: vatInItems },
    vatOut: { total: totalVatOut, items: vatOutItems },
    pph21: { total: totalPph21, items: pph21Items },
    pph23: { total: totalPph23, items: pph23Items },
    netVat: totalVatOut - totalVatIn,
    startDate: sDate,
    endDate: eDate
  }
}
