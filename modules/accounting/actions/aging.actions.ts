'use server'

import { prisma } from '@/lib/prisma'
import { diffDateOnlyStrings, getDateInTimeZone } from '@/lib/utils'
import {
  ensureAccountingAccess,
  getPostedEntryIds,
  resolveBranchFilter,
  toNumber,
  type BranchFilter,
} from '@/modules/accounting/lib/reporting.server'

function getBusinessToday() {
  return getDateInTimeZone('Asia/Jakarta')
}

function agingBucket(dueDateStr: string, today: string) {
  if (!dueDateStr) return '> 90 Days'
  const days = diffDateOnlyStrings(today, dueDateStr)
  if (days <= 0) return 'Current'
  if (days <= 30) return '0-30 Days'
  if (days <= 60) return '31-60 Days'
  if (days <= 90) return '61-90 Days'
  return '> 90 Days'
}

function isSalamMode(value: unknown) {
  return String(value || '').trim().toUpperCase() === 'SALAM'
}

function isIstishnaMode(value: unknown) {
  return String(value || '').trim().toUpperCase() === 'ISTISHNA'
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
    // Include legacy rows with NULL branch_id so historical data is still visible after branch rollout.
    query = query.or(`branch_id.eq.${branchId},branch_id.is.null`)
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

  const lines = await prisma.journal_lines.findMany({
    where: {
      entry_id: { in: entryIds },
      accounts: {
        is: {
          code: { in: codes },
        },
      },
    },
    include: {
      accounts: {
        select: {
          code: true,
          type: true,
        },
      },
    },
  })

  const balances: Record<string, number> = {}
  lines.forEach((line) => {
    const delta = ['LIABILITY', 'EQUITY', 'REVENUE'].includes(String(line.accounts.type))
      ? toNumber(line.credit) - toNumber(line.debit)
      : toNumber(line.debit) - toNumber(line.credit)

    balances[line.accounts.code] = (balances[line.accounts.code] || 0) + delta
  })

  return balances
}

async function getSettlementAccounts(orgId: string, codes: string[]) {
  const accounts = await prisma.accounts.findMany({
    where: {
      org_id: orgId,
      code: { in: codes },
    },
    select: {
      id: true,
      code: true,
    },
  })

  return accounts.reduce<Record<string, string>>((map, account) => {
    map[account.code] = account.id
    return map
  }, {})
}

export async function getAgingReport(orgId: string, type: 'AR' | 'AP', branchId?: BranchFilter) {
  const supabase = await createClient()
  const db = supabase as any
  const today = getBusinessToday()
  const settlementAccounts = await getSettlementAccounts(db, orgId, ['1201', '1205', '1404', '2101', '2201', '2301', '2401', '2602', '2603'])

  const today = getBusinessToday()
  const settlementAccounts = await getSettlementAccounts(orgId, ['1201', '2101', '2201'])
  let results: any[] = []

  if (type === 'AR') {
    // 1. Trade AR from Sales Module
    let salesQuery = db
      .from('sales')
      .select('id, sale_number, sale_date, due_date, grand_total, shariah_mode, customer_id, contacts!customer_id(name)')
      .eq('org_id', orgId)
      .not('status', 'in', '("DRAFT","VOIDED")')
      .neq('payment_status', 'PAID')

    if (branchId) {
      salesQuery = salesQuery.or(`branch_id.eq.${branchId},branch_id.is.null`)
    }

    const { data: sales } = await salesQuery

    if (sales && sales.length > 0) {
      const saleIds = sales.map((s: any) => s.id)
      let paymentsQuery = db
        .from('sales_payments')
        .select('sale_id, amount, discount_amount')
        .in('sale_id', saleIds)
      if (branchId) {
        paymentsQuery = paymentsQuery.or(`branch_id.eq.${branchId},branch_id.is.null`)
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
        returnsQuery = returnsQuery.or(`branch_id.eq.${branchId},branch_id.is.null`)
      }
      const { data: returns } = await returnsQuery
      const returnedBySale: Record<string, number> = {}
      returns.forEach((saleReturn) => {
        returnedBySale[saleReturn.sale_id] = (returnedBySale[saleReturn.sale_id] || 0) + toNumber(saleReturn.grand_total)
      })

      results = sales
        .map((s: any) => {
          const outstanding = Number(s.grand_total) - (paidBySale[s.id] || 0) - (returnedBySale[s.id] || 0)
          const finalDueDate = s.due_date || s.sale_date
          const isSalamSale = isSalamMode(s.shariah_mode)
          return {
            id: s.id,
            contact_name: s.contacts?.name || 'Unknown',
            doc_number: s.sale_number,
            doc_href: `/sales?pay=${s.id}`,
            due_date: finalDueDate,
            grand_total: Number(s.grand_total),
            paid_amount: paidBySale[s.id] || 0,
            returned_amount: returnedBySale[s.id] || 0,
            outstanding,
            days_overdue: Math.max(0, diffDateOnlyStrings(today, finalDueDate)),
            aging_bucket: agingBucket(finalDueDate, today),
            source_type: 'SALES',
            source_label: isSalamSale ? 'Tagihan Sales SALAM (SO)' : (isIstishnaMode(s.shariah_mode) ? 'Tagihan Sales ISTISHNA (SO)' : 'Piutang Usaha (1201)'),
            source_account_code: isSalamSale ? null : (isIstishnaMode(s.shariah_mode) ? null : '1201'),
          }
        })
        .filter((row) => row.outstanding > 0.01)
    }

    // 2. SALAM vendor receivable from Purchase module (1404)
    let salamPurchasesQuery = db
      .from('purchases')
      .select('id, purchase_number, purchase_date, due_date, grand_total, status, payment_status, shariah_mode, vendor_id, contacts!vendor_id(name)')
      .eq('org_id', orgId)
      .not('status', 'in', '("DRAFT","VOIDED","RECEIVED")')

    if (branchId) {
      salamPurchasesQuery = salamPurchasesQuery.or(`branch_id.eq.${branchId},branch_id.is.null`)
    }

    const { data: salamPurchases } = await salamPurchasesQuery

    const salamPurchasesFiltered = (salamPurchases || []).filter((purchase: any) => isSalamMode(purchase.shariah_mode) || isIstishnaMode(purchase.shariah_mode))

    if (salamPurchasesFiltered.length > 0) {
      const purchaseIds = salamPurchasesFiltered.map((p: any) => p.id)

      let salamPaymentsQuery = db
        .from('purchase_payments')
        .select('purchase_id, amount, discount_amount')
        .in('purchase_id', purchaseIds)

      const { data: salamPayments } = await salamPaymentsQuery
      const paidByPurchase: Record<string, number> = {}
      for (const payment of salamPayments || []) {
        paidByPurchase[payment.purchase_id] = (paidByPurchase[payment.purchase_id] || 0) + Number(payment.amount || 0) + Number(payment.discount_amount || 0)
      }

      let salamReturnsQuery = db
        .from('purchase_returns')
        .select('purchase_id, total_amount, status')
        .in('purchase_id', purchaseIds)

      const { data: salamReturns } = await salamReturnsQuery
      const returnedByPurchase: Record<string, number> = {}
      for (const purchaseReturn of salamReturns || []) {
        if (purchaseReturn.status === 'VOIDED') continue
        returnedByPurchase[purchaseReturn.purchase_id] = (returnedByPurchase[purchaseReturn.purchase_id] || 0) + Number(purchaseReturn.total_amount || 0)
      }

      const salamRows = salamPurchasesFiltered
        .map((purchase: any) => {
          const outstanding = (paidByPurchase[purchase.id] || 0) - (returnedByPurchase[purchase.id] || 0)
          const finalDueDate = purchase.due_date || purchase.purchase_date
          return {
            id: purchase.id,
            contact_name: purchase.contacts?.name || 'Unknown',
            doc_number: purchase.purchase_number,
            doc_href: `/purchasing?pay=${purchase.id}`,
            due_date: finalDueDate,
            grand_total: Number(purchase.grand_total || 0),
            paid_amount: paidByPurchase[purchase.id] || 0,
            returned_amount: returnedByPurchase[purchase.id] || 0,
            outstanding,
            days_overdue: Math.max(0, diffDateOnlyStrings(today, finalDueDate)),
            aging_bucket: agingBucket(finalDueDate, today),
            source_type: isSalamMode(purchase.shariah_mode) ? 'SALAM_VENDOR_RECEIVABLE' : 'ISTISHNA_VENDOR_RECEIVABLE',
            source_label: isSalamMode(purchase.shariah_mode) ? 'Piutang Salam Vendor (1404)' : 'Piutang Barang Istishna (1205)',
            source_account_code: isSalamMode(purchase.shariah_mode) ? '1404' : '1205',
          }
        })
        .filter((row: any) => row.outstanding > 0.01)

      results.push(...salamRows)
    }

    // 3. Reconciliation with GL (1201 + 1404 + 1205)
    const balances = await getAccountCodeBalances(db, orgId, ['1201', '1404', '1205'], branchId)
    const tradeArGlBalance = Number(balances['1201'] || 0)
    const tradeArModuleTotal = results
      .filter((row: any) => row.source_type === 'SALES')
      .reduce((sum: number, row: any) => sum + Number(row.outstanding || 0), 0)
    const tradeArDiff = tradeArGlBalance - tradeArModuleTotal

    if (Math.abs(tradeArDiff) > 10) {
      results.push({
        id: 'manual-ar-adj',
        contact_name: 'Unallocated (Buku Besar)',
        doc_number: 'GL-1201-ADJ',
        due_date: today,
        grand_total: tradeArDiff,
        paid_amount: 0,
        returned_amount: 0,
        outstanding: tradeArDiff,
        days_overdue: 0,
        aging_bucket: 'Current',
        source_type: 'JOURNAL',
        source_label: 'Penyesuaian Piutang Usaha (1201)',
        source_account_code: '1201',
        settlement_account_id: settlementAccounts['1201'] || null,
      })
    }

    const salamReceivableGlBalance = Number(balances['1404'] || 0)
    const salamReceivableModuleTotal = results
      .filter((row: any) => row.source_type === 'SALAM_VENDOR_RECEIVABLE')
      .reduce((sum: number, row: any) => sum + Number(row.outstanding || 0), 0)
    const salamReceivableDiff = salamReceivableGlBalance - salamReceivableModuleTotal

    if (Math.abs(salamReceivableDiff) > 10) {
      results.push({
        id: 'manual-salam-ar-adj',
        contact_name: 'Unallocated (Buku Besar)',
        doc_number: 'GL-1404-ADJ',
        due_date: today,
        grand_total: salamReceivableDiff,
        paid_amount: 0,
        returned_amount: 0,
        outstanding: salamReceivableDiff,
        days_overdue: 0,
        aging_bucket: 'Current',
        source_type: 'JOURNAL',
        source_label: 'Penyesuaian Piutang Salam Vendor (1404)',
        source_account_code: '1404',
        settlement_account_id: settlementAccounts['1404'] || null,
      })
    }

    const istishnaReceivableGlBalance = Number(balances['1205'] || 0)
    const istishnaReceivableModuleTotal = results
      .filter((row: any) => row.source_type === 'ISTISHNA_VENDOR_RECEIVABLE')
      .reduce((sum: number, row: any) => sum + Number(row.outstanding || 0), 0)
    const istishnaReceivableDiff = istishnaReceivableGlBalance - istishnaReceivableModuleTotal

    if (Math.abs(istishnaReceivableDiff) > 10) {
      results.push({
        id: 'manual-istishna-ar-adj',
        contact_name: 'Unallocated (Buku Besar)',
        doc_number: 'GL-1205-ADJ',
        due_date: today,
        grand_total: istishnaReceivableDiff,
        paid_amount: 0,
        returned_amount: 0,
        outstanding: istishnaReceivableDiff,
        days_overdue: 0,
        aging_bucket: 'Current',
        source_type: 'JOURNAL',
        source_label: 'Penyesuaian Piutang Barang Istishna (1205)',
        source_account_code: '1205',
        settlement_account_id: settlementAccounts['1205'] || null,
      })
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
      purchasesQuery = purchasesQuery.or(`branch_id.eq.${branchId},branch_id.is.null`)
    }

    const { data: purchases } = await purchasesQuery

    if (purchases && purchases.length > 0) {
      const purchaseIds = purchases.map((p: any) => p.id)
      let paymentsQuery = db
        .from('purchase_payments')
        .select('purchase_id, amount, discount_amount')
        .in('purchase_id', purchaseIds)
      const { data: payments } = await paymentsQuery
      const paidByPurchase: Record<string, number> = {}
      for (const p of payments || []) {
        paidByPurchase[p.purchase_id] = (paidByPurchase[p.purchase_id] || 0) + Number(p.amount) + Number(p.discount_amount || 0)
      }
      let returnsQuery = db
        .from('purchase_returns')
        .select('purchase_id, total_amount, status')
        .in('purchase_id', purchaseIds)
      const { data: returns } = await returnsQuery
      const returnedByPurchase: Record<string, number> = {}
      returns.forEach((purchaseReturn) => {
        returnedByPurchase[purchaseReturn.purchase_id] = (returnedByPurchase[purchaseReturn.purchase_id] || 0) + toNumber(purchaseReturn.total_amount)
      })

      results = purchases
        .map((purchase) => {
          const finalDueDate = purchase.due_date || purchase.purchase_date
          const dueDate = finalDueDate.toISOString().slice(0, 10)
          const outstanding = toNumber(purchase.grand_total) - (paidByPurchase[purchase.id] || 0) - (returnedByPurchase[purchase.id] || 0)

          return {
            id: p.id,
            contact_name: p.contacts?.name || 'Unknown',
            doc_number: p.purchase_number,
            doc_href: `/purchasing?pay=${p.id}`,
            due_date: finalDueDate,
            grand_total: Number(p.grand_total),
            paid_amount: paidByPurchase[p.id] || 0,
            returned_amount: returnedByPurchase[p.id] || 0,
            outstanding,
            days_overdue: Math.max(0, diffDateOnlyStrings(today, finalDueDate)),
            aging_bucket: agingBucket(finalDueDate, today),
            source_type: 'PURCHASING',
            source_label: isSalamMode(p.shariah_mode) ? 'Hutang Pembelian SALAM' : (isIstishnaMode(p.shariah_mode) ? 'Hutang Pembelian ISTISHNA' : 'Hutang Usaha (2101)'),
            source_account_code: isSalamMode(p.shariah_mode) || isIstishnaMode(p.shariah_mode) ? null : '2101',
          }
        })
        .filter((row) => row.outstanding > 0.01)
    }

    // 2. SALAM liability (2602) from undelivered SALAM sales
    let salamSalesQuery = db
      .from('sales')
      .select('id, sale_number, sale_date, due_date, grand_total, shariah_mode, status, customer_id, contacts!customer_id(name)')
      .eq('org_id', orgId)
      .not('status', 'in', '("DRAFT","VOIDED","FINISHED")')

    if (branchId) {
      salamSalesQuery = salamSalesQuery.or(`branch_id.eq.${branchId},branch_id.is.null`)
    }

    const { data: salamSales } = await salamSalesQuery

    const salamSalesFiltered = (salamSales || []).filter((sale: any) => isSalamMode(sale.shariah_mode) || isIstishnaMode(sale.shariah_mode))

    if (salamSalesFiltered.length > 0) {
      const saleIds = salamSalesFiltered.map((sale: any) => sale.id)

      let salamSalesPaymentQuery = db
        .from('sales_payments')
        .select('sale_id, amount, discount_amount')
        .in('sale_id', saleIds)
      if (branchId) {
        salamSalesPaymentQuery = salamSalesPaymentQuery.or(`branch_id.eq.${branchId},branch_id.is.null`)
      }

      const { data: salamSalesPayments } = await salamSalesPaymentQuery
      const receivedBySale: Record<string, number> = {}
      for (const payment of salamSalesPayments || []) {
        receivedBySale[payment.sale_id] = (receivedBySale[payment.sale_id] || 0) + Number(payment.amount || 0) + Number(payment.discount_amount || 0)
      }

      let salamSalesReturnQuery = db
        .from('sales_returns')
        .select('sale_id, grand_total, status')
        .in('sale_id', saleIds)
        .neq('status', 'VOIDED')
      if (branchId) {
        salamSalesReturnQuery = salamSalesReturnQuery.or(`branch_id.eq.${branchId},branch_id.is.null`)
      }

      const { data: salamSalesReturns } = await salamSalesReturnQuery
      const returnedBySale: Record<string, number> = {}
      for (const saleReturn of salamSalesReturns || []) {
        returnedBySale[saleReturn.sale_id] = (returnedBySale[saleReturn.sale_id] || 0) + Number(saleReturn.grand_total || 0)
      }

      const salamLiabilityRows = salamSalesFiltered
        .map((sale: any) => {
          const outstanding = (receivedBySale[sale.id] || 0) - (returnedBySale[sale.id] || 0)
          const finalDueDate = sale.due_date || sale.sale_date
          return {
            id: sale.id,
            contact_name: sale.contacts?.name || 'Unknown',
            doc_number: sale.sale_number,
            doc_href: `/sales?pay=${sale.id}`,
            due_date: finalDueDate,
            grand_total: Number(sale.grand_total || 0),
            paid_amount: receivedBySale[sale.id] || 0,
            returned_amount: returnedBySale[sale.id] || 0,
            outstanding,
            days_overdue: Math.max(0, diffDateOnlyStrings(today, finalDueDate)),
            aging_bucket: agingBucket(finalDueDate, today),
            source_type: isSalamMode(sale.shariah_mode) ? 'SALAM_SALES_LIABILITY' : 'ISTISHNA_SALES_LIABILITY',
            source_label: isSalamMode(sale.shariah_mode) ? 'Hutang Salam (2602)' : 'Hutang Istishna (2603)',
            source_account_code: isSalamMode(sale.shariah_mode) ? '2602' : '2603',
          }
        })
        .filter((row: any) => row.outstanding > 0.01)

      results.push(...salamLiabilityRows)
    }

    // 3. Direct AP (Non-Trade) & Taxes from GL (2101, 2201, 2301, 2401, 2602, 2603)
    const balances = await getAccountCodeBalances(db, orgId, ['2101', '2201', '2301', '2401', '2602', '2603'], branchId)

    const tradeApModuleTotal = results
      .filter((row: any) => row.source_type === 'PURCHASING')
      .reduce((sum: number, row: any) => sum + Number(row.outstanding || 0), 0)
    const tradeApDiff = Number(balances['2101'] || 0) - tradeApModuleTotal

    if (Math.abs(tradeApDiff) > 10) {
      results.push({
        id: `gl-2101-manual`,
        contact_name: 'Unallocated (Buku Besar)',
        doc_number: 'GL-2101-ADJ',
        due_date: today,
        grand_total: tradeApDiff,
        paid_amount: 0,
        returned_amount: 0,
        outstanding: tradeApDiff,
        days_overdue: 0,
        aging_bucket: 'Current',
        source_type: 'JOURNAL',
        source_label: 'Penyesuaian Hutang Usaha (2101)',
        source_account_code: '2101',
        settlement_account_id: settlementAccounts['2101'] || null,
      })
    }

    const salamLiabilityModuleTotal = results
      .filter((row: any) => row.source_type === 'SALAM_SALES_LIABILITY')
      .reduce((sum: number, row: any) => sum + Number(row.outstanding || 0), 0)
    const salamLiabilityDiff = Number(balances['2602'] || 0) - salamLiabilityModuleTotal

    if (Math.abs(salamLiabilityDiff) > 10) {
      results.push({
        id: 'gl-2602-adj',
        contact_name: 'Unallocated (Buku Besar)',
        doc_number: 'GL-2602-ADJ',
        due_date: today,
        grand_total: salamLiabilityDiff,
        paid_amount: 0,
        returned_amount: 0,
        outstanding: salamLiabilityDiff,
        days_overdue: 0,
        aging_bucket: 'Current',
        source_type: 'JOURNAL',
        source_label: 'Penyesuaian Hutang Salam (2602)',
        source_account_code: '2602',
        settlement_account_id: settlementAccounts['2602'] || null,
      })
    }

    const istishnaLiabilityModuleTotal = results
      .filter((row: any) => row.source_type === 'ISTISHNA_SALES_LIABILITY')
      .reduce((sum: number, row: any) => sum + Number(row.outstanding || 0), 0)
    const istishnaLiabilityDiff = Number(balances['2603'] || 0) - istishnaLiabilityModuleTotal

    if (Math.abs(istishnaLiabilityDiff) > 10) {
      results.push({
        id: 'gl-2603-adj',
        contact_name: 'Unallocated (Buku Besar)',
        doc_number: 'GL-2603-ADJ',
        due_date: today,
        grand_total: istishnaLiabilityDiff,
        paid_amount: 0,
        returned_amount: 0,
        outstanding: istishnaLiabilityDiff,
        days_overdue: 0,
        aging_bucket: 'Current',
        source_type: 'JOURNAL',
        source_label: 'Penyesuaian Hutang Istishna (2603)',
        source_account_code: '2603',
        settlement_account_id: settlementAccounts['2603'] || null,
      })
    }

    const taxOutstanding = Number(balances['2201'] || 0)
    if (Math.abs(taxOutstanding) > 0.01) {
      results.push({
        id: `gl-tax-2201`,
        contact_name: 'Pajak / Negara (PDI)',
        doc_number: `PPN-OUTSTANDING`,
        due_date: today,
        grand_total: taxOutstanding,
        paid_amount: 0,
        returned_amount: 0,
        outstanding: taxOutstanding,
        days_overdue: 0,
        aging_bucket: 'Current',
        source_type: 'TAX',
        source_label: 'PPN Keluaran (2201)',
        source_account_code: '2201',
        settlement_account_id: settlementAccounts['2201'] || null,
      })
    }

    const otherLiabilityRows = [
      { code: '2301', label: 'Pendapatan Diterima di Muka (2301)' },
      { code: '2401', label: 'Hutang Gaji (2401)' },
    ]

    for (const liability of otherLiabilityRows) {
      const balance = Number((balances as any)[liability.code] || 0)
      if (Math.abs(balance) <= 0.01) continue

      results.push({
        id: `gl-${liability.code}-out`,
        contact_name: 'Unallocated (Buku Besar)',
        doc_number: `GL-${liability.code}-OUT`,
        due_date: today,
        grand_total: balance,
        paid_amount: 0,
        returned_amount: 0,
        outstanding: balance,
        days_overdue: 0,
        aging_bucket: 'Current',
        source_type: 'JOURNAL',
        source_label: liability.label,
        source_account_code: liability.code,
        settlement_account_id: settlementAccounts[liability.code] || null,
      })
    }
  }

  return results.sort((left, right) => right.days_overdue - left.days_overdue)
}

export async function getAgingSummary(orgId: string, branchId?: BranchFilter) {
  const ar = await getAgingReport(orgId, 'AR', branchId)
  const ap = await getAgingReport(orgId, 'AP', branchId)
  const buckets = ['Current', '0-30 Days', '31-60 Days', '61-90 Days', '> 90 Days']

  const arSummary = buckets.map((bucket) => ({
    bucket,
    amount: ar.filter((row) => row.aging_bucket === bucket).reduce((sum, row) => sum + toNumber(row.outstanding), 0),
  }))

  const apSummary = buckets.map((bucket) => ({
    bucket,
    amount: ap.filter((row) => row.aging_bucket === bucket).reduce((sum, row) => sum + toNumber(row.outstanding), 0),
  }))

  return { ar, ap, arSummary, apSummary }
}
