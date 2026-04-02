'use server'

import { createClient } from '@/lib/supabase/server'

const TODAY = new Date().toISOString().split('T')[0]

type BranchFilter = string | null | undefined

function agingBucket(dueDateStr: string): string {
  if (!dueDateStr) return '> 90 Days'
  const due = new Date(dueDateStr)
  const today = new Date(TODAY)
  const days = Math.floor((today.getTime() - due.getTime()) / 86400000)
  if (days <= 0) return 'Current'
  if (days <= 30) return '0-30 Days'
  if (days <= 60) return '31-60 Days'
  if (days <= 90) return '61-90 Days'
  return '> 90 Days'
}

async function getPostedEntryIds(
  db: any,
  orgId: string,
  branchId?: BranchFilter
) {
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

async function getAccountCodeBalances(
  db: any,
  orgId: string,
  codes: string[],
  branchId?: BranchFilter
) {
  const entryIds = await getPostedEntryIds(db, orgId, branchId)
  if (entryIds.length === 0 || codes.length === 0) return {}

  const { data, error } = await (db
    .from('journal_lines')
    .select('debit, credit, accounts!inner(code, type)')
    .in('entry_id', entryIds)
    .in('accounts.code', codes) as any)

  if (error || !Array.isArray(data)) return {}

  const balances: Record<string, number> = {}
  data.forEach((line: any) => {
    const account = line.accounts
    if (!account?.code) return

    const delta = ['LIABILITY', 'EQUITY', 'REVENUE'].includes(account.type)
      ? Number(line.credit || 0) - Number(line.debit || 0)
      : Number(line.debit || 0) - Number(line.credit || 0)

    balances[account.code] = (balances[account.code] || 0) + delta
  })

  return balances
}

export async function getAgingReport(orgId: string, type: 'AR' | 'AP', branchId?: BranchFilter) {
  const supabase = await createClient()
  const db = supabase as any

  let results: any[] = []

  if (type === 'AR') {
    // 1. Trade AR from Sales Module
    let salesQuery = db
      .from('sales')
      .select('id, sale_number, sale_date, due_date, grand_total, customer_id, contacts!customer_id(name)')
      .eq('org_id', orgId)
      .not('status', 'in', '("DRAFT","VOIDED")')
      .neq('payment_status', 'PAID')

    if (branchId) {
      salesQuery = salesQuery.eq('branch_id', branchId)
    }

    const { data: sales } = await salesQuery

    if (sales && sales.length > 0) {
      const saleIds = sales.map((s: any) => s.id)
      let paymentsQuery = db
        .from('sales_payments')
        .select('sale_id, amount, discount_amount')
        .in('sale_id', saleIds)
      if (branchId) {
        paymentsQuery = paymentsQuery.eq('branch_id', branchId)
      }
      const { data: payments } = await paymentsQuery
      const paidBySale: Record<string, number> = {}
      for (const p of payments || []) {
        paidBySale[p.sale_id] = (paidBySale[p.sale_id] || 0) + Number(p.amount) + Number(p.discount_amount || 0)
      }
      let returnsQuery = db
        .from('sales_returns')
        .select('sale_id, grand_total')
        .in('sale_id', saleIds)
        .neq('status', 'VOIDED')
      if (branchId) {
        returnsQuery = returnsQuery.eq('branch_id', branchId)
      }
      const { data: returns } = await returnsQuery
      const returnedBySale: Record<string, number> = {}
      for (const r of returns || []) {
        returnedBySale[r.sale_id] = (returnedBySale[r.sale_id] || 0) + Number(r.grand_total)
      }

      results = sales
        .map((s: any) => {
          const outstanding = Number(s.grand_total) - (paidBySale[s.id] || 0) - (returnedBySale[s.id] || 0)
          const finalDueDate = s.due_date || s.sale_date
          return {
            id: s.id,
            contact_name: s.contacts?.name || 'Unknown',
            doc_number: s.sale_number,
            due_date: finalDueDate,
            grand_total: Number(s.grand_total),
            paid_amount: paidBySale[s.id] || 0,
            returned_amount: returnedBySale[s.id] || 0,
            outstanding,
            days_overdue: Math.max(0, Math.floor((new Date().getTime() - new Date(finalDueDate).getTime()) / 86400000)),
            aging_bucket: agingBucket(finalDueDate),
            source_type: 'SALES'
          }
        })
        .filter((r: any) => r.outstanding > 0.01)
    }

    // 2. Reconciliation with GL (1201)
    const balances = await getAccountCodeBalances(db, orgId, ['1201'], branchId)
    const glBalance = Number(balances['1201'] || 0);
    const moduleTotal = results.reduce((s: any, r: any) => s + r.outstanding, 0);
    const diff = glBalance - moduleTotal;

    if (Math.abs(diff) > 10) {
      results.push({
        id: 'manual-ar-adj',
        contact_name: 'Unallocated (Buku Besar)',
        doc_number: 'GL-1201-ADJ',
        due_date: TODAY,
        grand_total: diff,
        paid_amount: 0,
        returned_amount: 0,
        outstanding: diff,
        days_overdue: 0,
        aging_bucket: 'Current',
        source_type: 'JOURNAL'
      });
    }

  } else {
    // 1. Trade AP from Purchases Module
    let purchasesQuery = db
      .from('purchases')
      .select('id, purchase_number, purchase_date, due_date, grand_total, vendor_id, contacts!vendor_id(name)')
      .eq('org_id', orgId)
      .not('status', 'in', '("DRAFT","VOIDED")')
      .neq('payment_status', 'PAID')

    if (branchId) {
      purchasesQuery = purchasesQuery.eq('branch_id', branchId)
    }

    const { data: purchases } = await purchasesQuery

    if (purchases && purchases.length > 0) {
      const purchaseIds = purchases.map((p: any) => p.id)
      const { data: payments } = await db
        .from('purchase_payments')
        .select('purchase_id, amount, discount_amount')
        .in('purchase_id', purchaseIds)
      const paidByPurchase: Record<string, number> = {}
      for (const p of payments || []) {
        paidByPurchase[p.purchase_id] = (paidByPurchase[p.purchase_id] || 0) + Number(p.amount) + Number(p.discount_amount || 0)
      }
      const { data: returns } = await db
        .from('purchase_returns')
        .select('purchase_id, total_amount')
        .in('purchase_id', purchaseIds)
      const returnedByPurchase: Record<string, number> = {}
      for (const r of returns || []) {
        returnedByPurchase[r.purchase_id] = (returnedByPurchase[r.purchase_id] || 0) + Number(r.total_amount)
      }

      results = purchases
        .map((p: any) => {
          const outstanding = Number(p.grand_total) - (paidByPurchase[p.id] || 0) - (returnedByPurchase[p.id] || 0)
          const finalDueDate = p.due_date || p.purchase_date
          return {
            id: p.id,
            contact_name: p.contacts?.name || 'Unknown',
            doc_number: p.purchase_number,
            due_date: finalDueDate,
            grand_total: Number(p.grand_total),
            paid_amount: paidByPurchase[p.id] || 0,
            returned_amount: returnedByPurchase[p.id] || 0,
            outstanding,
            days_overdue: Math.max(0, Math.floor((new Date().getTime() - new Date(finalDueDate).getTime()) / 86400000)),
            aging_bucket: agingBucket(finalDueDate),
            source_type: 'PURCHASING'
          }
        })
        .filter((r: any) => r.outstanding > 0.01)
    }

    // 2. Direct AP (Non-Trade) & Taxes from GL (2101, 2201, 2301, 2401)
    // Account 2201: Tax (PPN), 21XX: Other Payables
    const balances = await getAccountCodeBalances(db, orgId, ['2101', '2201', '2301', '2401'], branchId)
    const namedBalances = [
      { code: '2101', balance: balances['2101'] || 0, name: 'Hutang Usaha' },
      { code: '2201', balance: balances['2201'] || 0, name: 'PPN Keluaran (Pajak Dipungut)' },
      { code: '2301', balance: balances['2301'] || 0, name: 'Pendapatan Diterima di Muka' },
      { code: '2401', balance: balances['2401'] || 0, name: 'Hutang Gaji' },
    ].filter((balance) => Math.abs(balance.balance) > 0.01)

    for (const b of namedBalances) {
      if (b.code === '2101') {
        const tradeModuleTotal = results.filter((r: any) => r.source_type === 'PURCHASING').reduce((s: any, r: any) => s + r.outstanding, 0);
        const diff = Number(b.balance) - tradeModuleTotal;
        if (Math.abs(diff) > 10) {
          results.push({
            id: `gl-2101-manual`,
            contact_name: 'Unallocated (Buku Besar)',
            doc_number: 'GL-2101-ADJ',
            due_date: TODAY,
            grand_total: diff,
            paid_amount: 0,
            returned_amount: 0,
            outstanding: diff,
            days_overdue: 0,
            aging_bucket: 'Current',
            source_type: 'JOURNAL'
          });
        }
      } else if (b.code === '2201') {
        results.push({
          id: `gl-tax-${b.code}`,
          contact_name: 'Pajak / Negara (PDI)',
          doc_number: `PPN-OUTSTANDING`,
          due_date: TODAY,
          grand_total: Number(b.balance),
          paid_amount: 0,
          returned_amount: 0,
          outstanding: Number(b.balance),
          days_overdue: 0,
          aging_bucket: 'Current',
          source_type: 'TAX'
        });
      }
    }
  }

  return results.sort((a: any, b: any) => b.days_overdue - a.days_overdue)
}


export async function getAgingSummary(orgId: string, branchId?: BranchFilter) {
  const ar = await getAgingReport(orgId, 'AR', branchId)
  const ap = await getAgingReport(orgId, 'AP', branchId)

  const buckets = ['Current', '0-30 Days', '31-60 Days', '61-90 Days', '> 90 Days']

  const arSummary = buckets.map((b: any) => ({
    bucket: b,
    amount: ar.filter((x: any) => x.aging_bucket === b).reduce((s: number, x: any) => s + Number(x.outstanding), 0)
  }))

  const apSummary = buckets.map((b: any) => ({
    bucket: b,
    amount: ap.filter((x: any) => x.aging_bucket === b).reduce((s: number, x: any) => s + Number(x.outstanding), 0)
  }))

  return {
    ar,
    ap,
    arSummary,
    apSummary,
    totalAR: ar.reduce((s: number, x: any) => s + Number(x.outstanding), 0),
    totalAP: ap.reduce((s: number, x: any) => s + Number(x.outstanding), 0)
  }
}
