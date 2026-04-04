'use server'

import { addDaysToDateString, getDateInTimeZone } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'

type BranchFilter = string | null | undefined

async function getCashAccountCodes(db: any, orgId: string) {
  const { data: linkedAccounts } = await db
    .from('bank_accounts')
    .select('account_id, accounts(code)')
    .eq('org_id', orgId)
    .eq('is_active', true)

  const codes = Array.from(
    new Set(
      (linkedAccounts || [])
        .map((account: any) => account.accounts?.code)
        .filter(Boolean)
    )
  )

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

  const { data: lines, error } = await db
    .from('journal_lines')
    .select('debit, credit, accounts!inner(code)')
    .in('entry_id', entryIds)
    .in('accounts.code', cashAccountCodes) as any

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
  const [sales, purchases] = await Promise.all([
    getSalesForecastRows(db, orgId, branchId),
    getPurchaseForecastRows(db, orgId, branchId),
  ])
    
  // 5. Generate Time Series
  const forecast = []
  let runningBalance = currentCash
  
  const todayDateStr = getDateInTimeZone('Asia/Jakarta')

  for (let i = 0; i < days; i++) {
    const dateStr = addDaysToDateString(todayDateStr, i)

    // Calculate delta for this day
    const dayInflow = (sales || [])
        .filter((s: any) => {
           // For Day 0, include ALL overdue (past dates) AND null due dates
           if (i === 0) return !s.due_date || s.due_date <= dateStr;
           return s.due_date === dateStr;
        })
        .reduce((sum: any, s: any) => sum + Number(s.outstanding), 0)
    
    const dayOutflow = (purchases || [])
        .filter((p: any) => {
           // For Day 0, include ALL overdue (past dates) AND null due dates
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
    totalProjectedInflow: sales.reduce((sum: number, sale: any) => sum + Number(sale.outstanding || 0), 0),
    totalProjectedOutflow: purchases.reduce((sum: number, purchase: any) => sum + Number(purchase.outstanding || 0), 0),
    lowestPoint: Math.min(...forecast.map((f: any) => f.balance)),
    days
  }
}
