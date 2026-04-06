'use server'

import { prisma } from '@/lib/prisma'
import { diffDateOnlyStrings, getDateInTimeZone } from '@/lib/utils'
import {
  ensureAccountingAccess,
  formatDateOnly,
  getPostedEntryIds,
  resolveBranchFilter,
  toNumber,
  type BranchFilter,
} from '@/modules/accounting/lib/reporting.server'

type AgingBucket = 'Current' | '0-30 Days' | '31-60 Days' | '61-90 Days' | '> 90 Days'

type AgingRow = {
  id: string
  contact_name: string
  doc_number: string
  doc_href: string
  due_date: string
  grand_total: number
  paid_amount: number
  returned_amount: number
  outstanding: number
  days_overdue: number
  aging_bucket: AgingBucket
  source_type: string
  source_label: string
  source_account_code: string | null
  settlement_account_id?: string | null
}

function getBusinessToday() {
  return getDateInTimeZone('Asia/Jakarta')
}

function agingBucket(dueDateStr: string, today: string): AgingBucket {
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

function withLegacyBranchScope(branchId?: BranchFilter) {
  return branchId ? { OR: [{ branch_id: branchId }, { branch_id: null }] } : {}
}

function toDateOnly(value: Date | string | null | undefined, fallback: string) {
  return formatDateOnly(value) ?? fallback
}

function sortAgingRows(rows: AgingRow[]) {
  return rows.sort((left, right) => right.days_overdue - left.days_overdue)
}

async function resolveAgingContext(orgId: string, branchId?: BranchFilter) {
  const membership = await ensureAccountingAccess(orgId)
  if (!membership) return null

  const branchSelection = await resolveBranchFilter(orgId, branchId)
  if ('error' in branchSelection) return null

  return { branchId: branchSelection.branchId }
}

async function getAccountCodeBalances(orgId: string, codes: string[], branchId?: BranchFilter) {
  const entryIds = await getPostedEntryIds(orgId, { branchId })
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

  return lines.reduce<Record<string, number>>((balances, line) => {
    const delta = ['LIABILITY', 'EQUITY', 'REVENUE'].includes(String(line.accounts.type))
      ? toNumber(line.credit) - toNumber(line.debit)
      : toNumber(line.debit) - toNumber(line.credit)

    balances[line.accounts.code] = (balances[line.accounts.code] || 0) + delta
    return balances
  }, {})
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
  const context = await resolveAgingContext(orgId, branchId)
  if (!context) return []

  const scopedBranchId = context.branchId ?? undefined
  const today = getBusinessToday()
  const settlementAccounts = await getSettlementAccounts(orgId, ['1201', '1205', '1404', '2101', '2201', '2301', '2401', '2602', '2603'])
  const results: AgingRow[] = []

  if (type === 'AR') {
    const sales = await prisma.sales.findMany({
      where: {
        org_id: orgId,
        status: { notIn: ['DRAFT', 'VOIDED'] },
        payment_status: { not: 'PAID' },
        ...withLegacyBranchScope(scopedBranchId),
      },
      select: {
        id: true,
        sale_number: true,
        sale_date: true,
        due_date: true,
        grand_total: true,
        shariah_mode: true,
        contacts: { select: { name: true } },
      },
    })

    if (sales.length > 0) {
      const saleIds = sales.map((sale) => sale.id)
      const payments = await prisma.sales_payments.findMany({
        where: {
          sale_id: { in: saleIds },
          ...withLegacyBranchScope(scopedBranchId),
        },
        select: {
          sale_id: true,
          amount: true,
          discount_amount: true,
        },
      })

      const paidBySale = payments.reduce<Record<string, number>>((map, payment) => {
        map[payment.sale_id] = (map[payment.sale_id] || 0) + toNumber(payment.amount) + toNumber(payment.discount_amount)
        return map
      }, {})

      const returns = await prisma.sales_returns.findMany({
        where: {
          sale_id: { in: saleIds },
          status: { not: 'VOIDED' },
          ...withLegacyBranchScope(scopedBranchId),
        },
        select: {
          sale_id: true,
          grand_total: true,
        },
      })

      const returnedBySale = returns.reduce<Record<string, number>>((map, saleReturn) => {
        map[saleReturn.sale_id] = (map[saleReturn.sale_id] || 0) + toNumber(saleReturn.grand_total)
        return map
      }, {})

      results.push(
        ...sales
          .map((sale) => {
            const outstanding = toNumber(sale.grand_total) - (paidBySale[sale.id] || 0) - (returnedBySale[sale.id] || 0)
            const finalDueDate = toDateOnly(sale.due_date, toDateOnly(sale.sale_date, today))
            const isSalamSale = isSalamMode(sale.shariah_mode)
            const isIstishnaSale = isIstishnaMode(sale.shariah_mode)

            return {
              id: sale.id,
              contact_name: sale.contacts?.name || 'Unknown',
              doc_number: sale.sale_number,
              doc_href: `/sales?pay=${sale.id}`,
              due_date: finalDueDate,
              grand_total: toNumber(sale.grand_total),
              paid_amount: paidBySale[sale.id] || 0,
              returned_amount: returnedBySale[sale.id] || 0,
              outstanding,
              days_overdue: Math.max(0, diffDateOnlyStrings(today, finalDueDate)),
              aging_bucket: agingBucket(finalDueDate, today),
              source_type: 'SALES',
              source_label: isSalamSale
                ? 'Tagihan Sales SALAM (SO)'
                : isIstishnaSale
                  ? 'Tagihan Sales ISTISHNA (SO)'
                  : 'Piutang Usaha (1201)',
              source_account_code: isSalamSale || isIstishnaSale ? null : '1201',
            } satisfies AgingRow
          })
          .filter((row) => row.outstanding > 0.01)
      )
    }

    const salamPurchases = await prisma.purchases.findMany({
      where: {
        org_id: orgId,
        status: { notIn: ['DRAFT', 'VOIDED', 'RECEIVED'] },
        ...withLegacyBranchScope(scopedBranchId),
      },
      select: {
        id: true,
        purchase_number: true,
        purchase_date: true,
        due_date: true,
        grand_total: true,
        shariah_mode: true,
        contacts: { select: { name: true } },
      },
    })

    const salamPurchasesFiltered = (salamPurchases || []).filter(
      (purchase) => isSalamMode(purchase.shariah_mode) || isIstishnaMode(purchase.shariah_mode)
    )

    if (salamPurchasesFiltered.length > 0) {
      const purchaseIds = salamPurchasesFiltered.map((purchase) => purchase.id)
      const salamPayments = await prisma.purchase_payments.findMany({
        where: {
          purchase_id: { in: purchaseIds },
        },
        select: {
          purchase_id: true,
          amount: true,
          discount_amount: true,
        },
      })

      const paidByPurchase = salamPayments.reduce<Record<string, number>>((map, payment) => {
        map[payment.purchase_id] = (map[payment.purchase_id] || 0) + toNumber(payment.amount) + toNumber(payment.discount_amount)
        return map
      }, {})

      const salamReturns = await prisma.purchase_returns.findMany({
        where: {
          purchase_id: { in: purchaseIds },
        },
        select: {
          purchase_id: true,
          total_amount: true,
        },
      })

      const returnedByPurchase = salamReturns.reduce<Record<string, number>>((map, purchaseReturn) => {
        map[purchaseReturn.purchase_id] = (map[purchaseReturn.purchase_id] || 0) + toNumber(purchaseReturn.total_amount)
        return map
      }, {})

      results.push(
        ...salamPurchasesFiltered
          .map((purchase) => {
            const outstanding = (paidByPurchase[purchase.id] || 0) - (returnedByPurchase[purchase.id] || 0)
            const finalDueDate = toDateOnly(purchase.due_date, toDateOnly(purchase.purchase_date, today))
            const isSalamPurchase = isSalamMode(purchase.shariah_mode)

            return {
              id: purchase.id,
              contact_name: purchase.contacts?.name || 'Unknown',
              doc_number: purchase.purchase_number,
              doc_href: `/purchasing?pay=${purchase.id}`,
              due_date: finalDueDate,
              grand_total: toNumber(purchase.grand_total),
              paid_amount: paidByPurchase[purchase.id] || 0,
              returned_amount: returnedByPurchase[purchase.id] || 0,
              outstanding,
              days_overdue: Math.max(0, diffDateOnlyStrings(today, finalDueDate)),
              aging_bucket: agingBucket(finalDueDate, today),
              source_type: isSalamPurchase ? 'SALAM_VENDOR_RECEIVABLE' : 'ISTISHNA_VENDOR_RECEIVABLE',
              source_label: isSalamPurchase ? 'Piutang Salam Vendor (1404)' : 'Piutang Barang Istishna (1205)',
              source_account_code: isSalamPurchase ? '1404' : '1205',
            } satisfies AgingRow
          })
          .filter((row) => row.outstanding > 0.01)
      )
    }

    const balances = await getAccountCodeBalances(orgId, ['1201', '1404', '1205'], scopedBranchId)
    const tradeArModuleTotal = results
      .filter((row) => row.source_type === 'SALES')
      .reduce((sum, row) => sum + toNumber(row.outstanding), 0)
    const tradeArDiff = toNumber(balances['1201']) - tradeArModuleTotal

    if (Math.abs(tradeArDiff) > 10) {
      results.push({
        id: 'manual-ar-adj',
        contact_name: 'Unallocated (Buku Besar)',
        doc_number: 'GL-1201-ADJ',
        doc_href: '',
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

    const salamReceivableModuleTotal = results
      .filter((row) => row.source_type === 'SALAM_VENDOR_RECEIVABLE')
      .reduce((sum, row) => sum + toNumber(row.outstanding), 0)
    const salamReceivableDiff = toNumber(balances['1404']) - salamReceivableModuleTotal

    if (Math.abs(salamReceivableDiff) > 10) {
      results.push({
        id: 'manual-salam-ar-adj',
        contact_name: 'Unallocated (Buku Besar)',
        doc_number: 'GL-1404-ADJ',
        doc_href: '',
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

    const istishnaReceivableModuleTotal = results
      .filter((row) => row.source_type === 'ISTISHNA_VENDOR_RECEIVABLE')
      .reduce((sum, row) => sum + toNumber(row.outstanding), 0)
    const istishnaReceivableDiff = toNumber(balances['1205']) - istishnaReceivableModuleTotal

    if (Math.abs(istishnaReceivableDiff) > 10) {
      results.push({
        id: 'manual-istishna-ar-adj',
        contact_name: 'Unallocated (Buku Besar)',
        doc_number: 'GL-1205-ADJ',
        doc_href: '',
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

    return sortAgingRows(results)
  }

  const purchases = await prisma.purchases.findMany({
    where: {
      org_id: orgId,
      status: { notIn: ['DRAFT', 'VOIDED'] },
      payment_status: { not: 'PAID' },
      ...withLegacyBranchScope(scopedBranchId),
    },
    select: {
      id: true,
      purchase_number: true,
      purchase_date: true,
      due_date: true,
      grand_total: true,
      shariah_mode: true,
      contacts: { select: { name: true } },
    },
  })

  if (purchases.length > 0) {
    const purchaseIds = purchases.map((purchase) => purchase.id)
    const payments = await prisma.purchase_payments.findMany({
      where: {
        purchase_id: { in: purchaseIds },
      },
      select: {
        purchase_id: true,
        amount: true,
        discount_amount: true,
      },
    })

    const paidByPurchase = payments.reduce<Record<string, number>>((map, payment) => {
      map[payment.purchase_id] = (map[payment.purchase_id] || 0) + toNumber(payment.amount) + toNumber(payment.discount_amount)
      return map
    }, {})

    const returns = await prisma.purchase_returns.findMany({
      where: {
        purchase_id: { in: purchaseIds },
      },
      select: {
        purchase_id: true,
        total_amount: true,
      },
    })

    const returnedByPurchase = returns.reduce<Record<string, number>>((map, purchaseReturn) => {
      map[purchaseReturn.purchase_id] = (map[purchaseReturn.purchase_id] || 0) + toNumber(purchaseReturn.total_amount)
      return map
    }, {})

    results.push(
      ...purchases
        .map((purchase) => {
          const finalDueDate = toDateOnly(purchase.due_date, toDateOnly(purchase.purchase_date, today))
          const outstanding = toNumber(purchase.grand_total) - (paidByPurchase[purchase.id] || 0) - (returnedByPurchase[purchase.id] || 0)
          const isSalamPurchase = isSalamMode(purchase.shariah_mode)
          const isIstishnaPurchase = isIstishnaMode(purchase.shariah_mode)

          return {
            id: purchase.id,
            contact_name: purchase.contacts?.name || 'Unknown',
            doc_number: purchase.purchase_number,
            doc_href: `/purchasing?pay=${purchase.id}`,
            due_date: finalDueDate,
            grand_total: toNumber(purchase.grand_total),
            paid_amount: paidByPurchase[purchase.id] || 0,
            returned_amount: returnedByPurchase[purchase.id] || 0,
            outstanding,
            days_overdue: Math.max(0, diffDateOnlyStrings(today, finalDueDate)),
            aging_bucket: agingBucket(finalDueDate, today),
            source_type: 'PURCHASING',
            source_label: isSalamPurchase
              ? 'Hutang Pembelian SALAM'
              : isIstishnaPurchase
                ? 'Hutang Pembelian ISTISHNA'
                : 'Hutang Usaha (2101)',
            source_account_code: isSalamPurchase || isIstishnaPurchase ? null : '2101',
          } satisfies AgingRow
        })
        .filter((row) => row.outstanding > 0.01)
    )
  }

  const salamSales = await prisma.sales.findMany({
    where: {
      org_id: orgId,
      status: { notIn: ['DRAFT', 'VOIDED', 'FINISHED'] },
      ...withLegacyBranchScope(scopedBranchId),
    },
    select: {
      id: true,
      sale_number: true,
      sale_date: true,
      due_date: true,
      grand_total: true,
      shariah_mode: true,
      contacts: { select: { name: true } },
    },
  })

  const salamSalesFiltered = salamSales.filter((sale) => isSalamMode(sale.shariah_mode) || isIstishnaMode(sale.shariah_mode))

  if (salamSalesFiltered.length > 0) {
    const saleIds = salamSalesFiltered.map((sale) => sale.id)
    const salamSalesPayments = await prisma.sales_payments.findMany({
      where: {
        sale_id: { in: saleIds },
        ...withLegacyBranchScope(scopedBranchId),
      },
      select: {
        sale_id: true,
        amount: true,
        discount_amount: true,
      },
    })

    const receivedBySale = salamSalesPayments.reduce<Record<string, number>>((map, payment) => {
      map[payment.sale_id] = (map[payment.sale_id] || 0) + toNumber(payment.amount) + toNumber(payment.discount_amount)
      return map
    }, {})

    const salamSalesReturns = await prisma.sales_returns.findMany({
      where: {
        sale_id: { in: saleIds },
        status: { not: 'VOIDED' },
        ...withLegacyBranchScope(scopedBranchId),
      },
      select: {
        sale_id: true,
        grand_total: true,
      },
    })

    const returnedBySale = salamSalesReturns.reduce<Record<string, number>>((map, saleReturn) => {
      map[saleReturn.sale_id] = (map[saleReturn.sale_id] || 0) + toNumber(saleReturn.grand_total)
      return map
    }, {})

    results.push(
      ...salamSalesFiltered
        .map((sale) => {
          const outstanding = (receivedBySale[sale.id] || 0) - (returnedBySale[sale.id] || 0)
          const finalDueDate = toDateOnly(sale.due_date, toDateOnly(sale.sale_date, today))
          const isSalamSale = isSalamMode(sale.shariah_mode)

          return {
            id: sale.id,
            contact_name: sale.contacts?.name || 'Unknown',
            doc_number: sale.sale_number,
            doc_href: `/sales?pay=${sale.id}`,
            due_date: finalDueDate,
            grand_total: toNumber(sale.grand_total),
            paid_amount: receivedBySale[sale.id] || 0,
            returned_amount: returnedBySale[sale.id] || 0,
            outstanding,
            days_overdue: Math.max(0, diffDateOnlyStrings(today, finalDueDate)),
            aging_bucket: agingBucket(finalDueDate, today),
            source_type: isSalamSale ? 'SALAM_SALES_LIABILITY' : 'ISTISHNA_SALES_LIABILITY',
            source_label: isSalamSale ? 'Hutang Salam (2602)' : 'Hutang Istishna (2603)',
            source_account_code: isSalamSale ? '2602' : '2603',
          } satisfies AgingRow
        })
        .filter((row) => row.outstanding > 0.01)
    )
  }

  const balances = await getAccountCodeBalances(orgId, ['2101', '2201', '2301', '2401', '2602', '2603'], scopedBranchId)
  const tradeApModuleTotal = results
    .filter((row) => row.source_type === 'PURCHASING')
    .reduce((sum, row) => sum + toNumber(row.outstanding), 0)
  const tradeApDiff = toNumber(balances['2101']) - tradeApModuleTotal

  if (Math.abs(tradeApDiff) > 10) {
    results.push({
      id: 'gl-2101-manual',
      contact_name: 'Unallocated (Buku Besar)',
      doc_number: 'GL-2101-ADJ',
      doc_href: '',
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
    .filter((row) => row.source_type === 'SALAM_SALES_LIABILITY')
    .reduce((sum, row) => sum + toNumber(row.outstanding), 0)
  const salamLiabilityDiff = toNumber(balances['2602']) - salamLiabilityModuleTotal

  if (Math.abs(salamLiabilityDiff) > 10) {
    results.push({
      id: 'gl-2602-adj',
      contact_name: 'Unallocated (Buku Besar)',
      doc_number: 'GL-2602-ADJ',
      doc_href: '',
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
    .filter((row) => row.source_type === 'ISTISHNA_SALES_LIABILITY')
    .reduce((sum, row) => sum + toNumber(row.outstanding), 0)
  const istishnaLiabilityDiff = toNumber(balances['2603']) - istishnaLiabilityModuleTotal

  if (Math.abs(istishnaLiabilityDiff) > 10) {
    results.push({
      id: 'gl-2603-adj',
      contact_name: 'Unallocated (Buku Besar)',
      doc_number: 'GL-2603-ADJ',
      doc_href: '',
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

  const taxOutstanding = toNumber(balances['2201'])
  if (Math.abs(taxOutstanding) > 0.01) {
    results.push({
      id: 'gl-tax-2201',
      contact_name: 'Pajak / Negara (PDI)',
      doc_number: 'PPN-OUTSTANDING',
      doc_href: '',
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

  for (const liability of [
    { code: '2301', label: 'Pendapatan Diterima di Muka (2301)' },
    { code: '2401', label: 'Hutang Gaji (2401)' },
  ]) {
    const balance = toNumber(balances[liability.code])
    if (Math.abs(balance) <= 0.01) continue

    results.push({
      id: `gl-${liability.code}-out`,
      contact_name: 'Unallocated (Buku Besar)',
      doc_number: `GL-${liability.code}-OUT`,
      doc_href: '',
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

  return sortAgingRows(results)
}

export async function getAgingSummary(orgId: string, branchId?: BranchFilter) {
  const ar = await getAgingReport(orgId, 'AR', branchId)
  const ap = await getAgingReport(orgId, 'AP', branchId)
  const buckets: AgingBucket[] = ['Current', '0-30 Days', '31-60 Days', '61-90 Days', '> 90 Days']

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
