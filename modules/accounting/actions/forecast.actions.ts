'use server'

import { addDaysToDateString, getDateInTimeZone } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'

type BranchFilter = string | null | undefined

async function getCashAccountCodes(db: any, orgId: string) {
  const { data: bankAccounts } = await db
    .from('bank_accounts')
    .select('account_id')
    .eq('org_id', orgId)
    .eq('is_active', true)

  const accountIds = (bankAccounts || []).map((b: any) => b.account_id).filter(Boolean)
  if (accountIds.length === 0) return ['1101', '1102', '1103', '1104', '1105']

  const { data: accountRows } = await db
    .from('accounts')
    .select('code')
    .in('id', accountIds)

  const codes = Array.from(new Set((accountRows || []).map((a: any) => a.code).filter(Boolean))) as string[]
  return codes.length > 0 ? codes : ['1101', '1102', '1103', '1104', '1105']
}

async function getPostedEntryIds(db: any, orgId: string, branchId?: BranchFilter) {
  let query = db
    .from('journal_entries')
    .select('id')
    .eq('org_id', orgId)
    .eq('status', 'POSTED')

  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  const { data, error } = await query
  if (error || !Array.isArray(data)) return []

  return data.map((entry: any) => entry.id)
}

async function getCurrentCashBalance(db: any, orgId: string, branchId?: BranchFilter) {
  const [cashAccountCodes, entryIds] = await Promise.all([
    getCashAccountCodes(db, orgId),
    getPostedEntryIds(db, orgId, branchId),
  ])

  if (entryIds.length === 0) return 0

  // Resolve account codes → IDs dulu, lalu join di sisi aplikasi
  // menghindari sintaks !inner join yang tidak di-support postgres-client
  const { data: accountRows } = await db
    .from('accounts')
    .select('id, code')
    .eq('org_id', orgId)
    .in('code', cashAccountCodes)

  const cashAccountIds = (accountRows || []).map((a: any) => a.id)
  if (cashAccountIds.length === 0) return 0

  const { data: lines, error } = await db
    .from('journal_lines')
    .select('debit, credit')
    .in('entry_id', entryIds)
    .in('account_id', cashAccountIds)

  if (error || !Array.isArray(lines)) return 0

  return lines.reduce((sum: number, line: any) => sum + Number(line.debit || 0) - Number(line.credit || 0), 0)
}

async function getSalesForecastRows(db: any, orgId: string, branchId?: BranchFilter) {
  let salesQuery = db
    .from('sales')
    .select('id, grand_total, due_date, sale_number')
    .eq('org_id', orgId)
    .in('payment_status', ['UNPAID', 'PARTIAL'])
    .neq('status', 'VOIDED')

  if (branchId) {
    salesQuery = salesQuery.eq('branch_id', branchId)
  }

  const { data: sales } = await salesQuery
  if (!Array.isArray(sales) || sales.length === 0) return []

  const saleIds = sales.map((sale: any) => sale.id)

  let paymentsQuery = db
    .from('sales_payments')
    .select('sale_id, amount, discount_amount')
    .in('sale_id', saleIds)

  if (branchId) {
    paymentsQuery = paymentsQuery.eq('branch_id', branchId)
  }

  let returnsQuery = db
    .from('sales_returns')
    .select('sale_id, grand_total')
    .in('sale_id', saleIds)
    .neq('status', 'VOIDED')

  if (branchId) {
    returnsQuery = returnsQuery.eq('branch_id', branchId)
  }

  const [{ data: payments }, { data: returns }] = await Promise.all([
    paymentsQuery,
    returnsQuery,
  ])

  const paidBySale: Record<string, number> = {}
  for (const payment of payments || []) {
    paidBySale[payment.sale_id] = (paidBySale[payment.sale_id] || 0) + Number(payment.amount || 0) + Number(payment.discount_amount || 0)
  }

  const returnedBySale: Record<string, number> = {}
  for (const saleReturn of returns || []) {
    returnedBySale[saleReturn.sale_id] = (returnedBySale[saleReturn.sale_id] || 0) + Number(saleReturn.grand_total || 0)
  }

  return sales
    .map((sale: any) => ({
      ...sale,
      outstanding: Math.max(0, Number(sale.grand_total || 0) - (paidBySale[sale.id] || 0) - (returnedBySale[sale.id] || 0)),
    }))
    .filter((sale: any) => sale.outstanding > 0.01)
}

/**
 * Mengambil saldo bersih piutang/hutang dari jurnal manual per kontak,
 * agar forecast menyertakan AR/AP yang tidak lewat modul Sales/Purchase.
 */
async function getManualJournalForecastRows(
  db: any,
  orgId: string,
  accountCodes: string[],
  type: 'AR' | 'AP',
  branchId?: BranchFilter
): Promise<Array<{ outstanding: number; due_date: string | null }>> {
  let entryQuery = db
    .from('journal_entries')
    .select('id, contact_id, entry_date, due_date')
    .eq('org_id', orgId)
    .eq('status', 'POSTED')
    .not('reference_type', 'in', '("SALE","PURCHASE","SALES_RETURN","PURCHASE_RETURN","PAYMENT_IN","PAYMENT_OUT","PURCHASE_PAYMENT")')

  if (branchId) {
    entryQuery = entryQuery.or(`branch_id.eq.${branchId},branch_id.is.null`)
  }

  const { data: entries } = await entryQuery
  if (!Array.isArray(entries) || entries.length === 0) return []

  const entryIds = entries.map((e: any) => e.id)

  const { data: accountRows } = await db
    .from('accounts')
    .select('id, code')
    .eq('org_id', orgId)
    .in('code', accountCodes)

  const accountIds = (accountRows || []).map((a: any) => a.id)
  if (accountIds.length === 0) return []

  const { data: lines } = await db
    .from('journal_lines')
    .select('entry_id, account_id, debit, credit')
    .in('entry_id', entryIds)
    .in('account_id', accountIds)

  if (!Array.isArray(lines) || lines.length === 0) return []

  // Aggregate net per contact_id (atau per entry jika tidak ada contact)
  const netByKey: Record<string, number> = {}
  const dueDateByKey: Record<string, string | null> = {}
  const entryById: Record<string, any> = {}
  for (const e of entries) entryById[e.id] = e

  for (const line of lines) {
    const entry = entryById[line.entry_id]
    if (!entry) continue
    const key = entry.contact_id || line.entry_id
    const net = type === 'AR'
      ? Number(line.debit || 0) - Number(line.credit || 0)
      : Number(line.credit || 0) - Number(line.debit || 0)
    netByKey[key] = (netByKey[key] || 0) + net
    if (!dueDateByKey[key]) {
      dueDateByKey[key] = entry.due_date
        ? String(entry.due_date).slice(0, 10)
        : String(entry.entry_date || '').slice(0, 10) || null
    }
  }

  return Object.entries(netByKey)
    .filter(([, net]) => net > 0.01)
    .map(([key, net]) => ({ outstanding: net, due_date: dueDateByKey[key] ?? null }))
}

async function getPurchaseForecastRows(db: any, orgId: string, branchId?: BranchFilter) {
  let purchasesQuery = db
    .from('purchases')
    .select('id, grand_total, due_date, purchase_number')
    .eq('org_id', orgId)
    .in('payment_status', ['UNPAID', 'PARTIAL'])
    .neq('status', 'VOIDED')

  if (branchId) {
    purchasesQuery = purchasesQuery.eq('branch_id', branchId)
  }

  const { data: purchases } = await purchasesQuery
  if (!Array.isArray(purchases) || purchases.length === 0) return []

  const purchaseIds = purchases.map((purchase: any) => purchase.id)

  let paymentsQuery = db
    .from('purchase_payments')
    .select('purchase_id, amount, discount_amount')
    .in('purchase_id', purchaseIds)

  if (branchId) {
    paymentsQuery = paymentsQuery.eq('branch_id', branchId)
  }

  let returnsQuery = db
    .from('purchase_returns')
    .select('purchase_id, total_amount, status')
    .in('purchase_id', purchaseIds)

  if (branchId) {
    returnsQuery = returnsQuery.eq('branch_id', branchId)
  }

  const [{ data: payments }, { data: returns }] = await Promise.all([
    paymentsQuery,
    returnsQuery,
  ])

  const paidByPurchase: Record<string, number> = {}
  for (const payment of payments || []) {
    paidByPurchase[payment.purchase_id] = (paidByPurchase[payment.purchase_id] || 0) + Number(payment.amount || 0) + Number(payment.discount_amount || 0)
  }

  const returnedByPurchase: Record<string, number> = {}
  for (const purchaseReturn of returns || []) {
    if (purchaseReturn.status === 'VOIDED') continue
    returnedByPurchase[purchaseReturn.purchase_id] = (returnedByPurchase[purchaseReturn.purchase_id] || 0) + Number(purchaseReturn.total_amount || 0)
  }

  return purchases
    .map((purchase: any) => ({
      ...purchase,
      outstanding: Math.max(0, Number(purchase.grand_total || 0) - (paidByPurchase[purchase.id] || 0) - (returnedByPurchase[purchase.id] || 0)),
    }))
    .filter((purchase: any) => purchase.outstanding > 0.01)
}

export async function getCashFlowForecast(orgId: string, days: number = 90, branchId?: BranchFilter) {
  const supabase = await createClient()
  const db = supabase as any

  // 1. Current Total Cash
  const currentCash = await getCurrentCashBalance(db, orgId, branchId)

  // 2. Projected Inflow/Outflow based on outstanding amounts
  const [sales, purchases, manualAR, manualAP] = await Promise.all([
    getSalesForecastRows(db, orgId, branchId),
    getPurchaseForecastRows(db, orgId, branchId),
    getManualJournalForecastRows(db, orgId, ['1201', '1205', '1404'], 'AR', branchId),
    getManualJournalForecastRows(db, orgId, ['2101', '2602', '2603'], 'AP', branchId),
  ])

  const allInflows  = [...sales, ...manualAR]
  const allOutflows = [...purchases, ...manualAP]
    
  // 5. Generate Time Series
  const forecast = []
  let runningBalance = currentCash
  
  const todayDateStr = getDateInTimeZone('Asia/Jakarta')

  for (let i = 0; i < days; i++) {
    const dateStr = addDaysToDateString(todayDateStr, i)

    // Calculate delta for this day
    const dayInflow = allInflows
        .filter((s: any) => {
           if (i === 0) return !s.due_date || s.due_date <= dateStr;
           return s.due_date === dateStr;
        })
        .reduce((sum: any, s: any) => sum + Number(s.outstanding), 0)

    const dayOutflow = allOutflows
        .filter((p: any) => {
           if (i === 0) return !p.due_date || p.due_date <= dateStr;
           return p.due_date === dateStr;
        })
        .reduce((sum: any, p: any) => sum + Number(p.outstanding), 0)

    runningBalance += (dayInflow - dayOutflow)

    forecast.push({
      date: dateStr,
      inflow: dayInflow,
      outflow: dayOutflow,
      balance: runningBalance,
      isNegative: runningBalance < 0
    })
  }

  return {
    currentCash,
    forecast,
    totalProjectedInflow: allInflows.reduce((sum: number, r: any) => sum + Number(r.outstanding || 0), 0),
    totalProjectedOutflow: allOutflows.reduce((sum: number, r: any) => sum + Number(r.outstanding || 0), 0),
    lowestPoint: Math.min(...forecast.map((f: any) => f.balance)),
    days
  }
}
