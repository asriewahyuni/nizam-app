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
  const membership = await ensureAccountingAccess(orgId)
  if (!membership) return []

  const branchSelection = await resolveBranchFilter(orgId, branchId)
  if ('error' in branchSelection) return []

  const today = getBusinessToday()
  const settlementAccounts = await getSettlementAccounts(orgId, ['1201', '2101', '2201'])
  let results: any[] = []

  if (type === 'AR') {
    const sales = await prisma.sales.findMany({
      where: {
        org_id: orgId,
        status: { notIn: ['DRAFT', 'VOIDED'] },
        payment_status: { not: 'PAID' },
        ...(branchSelection.branchId ? { branch_id: branchSelection.branchId } : {}),
      },
      select: {
        id: true,
        sale_number: true,
        sale_date: true,
        due_date: true,
        grand_total: true,
        contacts: {
          select: {
            name: true,
          },
        },
      },
    })

    if (sales.length > 0) {
      const saleIds = sales.map((sale) => sale.id)
      const [payments, returns] = await Promise.all([
        prisma.sales_payments.findMany({
          where: {
            sale_id: { in: saleIds },
            ...(branchSelection.branchId ? { branch_id: branchSelection.branchId } : {}),
          },
          select: {
            sale_id: true,
            amount: true,
            discount_amount: true,
          },
        }),
        prisma.sales_returns.findMany({
          where: {
            sale_id: { in: saleIds },
            status: { not: 'VOIDED' },
            ...(branchSelection.branchId ? { branch_id: branchSelection.branchId } : {}),
          },
          select: {
            sale_id: true,
            grand_total: true,
          },
        }),
      ])

      const paidBySale: Record<string, number> = {}
      payments.forEach((payment) => {
        paidBySale[payment.sale_id] = (paidBySale[payment.sale_id] || 0) + toNumber(payment.amount) + toNumber(payment.discount_amount)
      })

      const returnedBySale: Record<string, number> = {}
      returns.forEach((saleReturn) => {
        returnedBySale[saleReturn.sale_id] = (returnedBySale[saleReturn.sale_id] || 0) + toNumber(saleReturn.grand_total)
      })

      results = sales
        .map((sale) => {
          const finalDueDate = sale.due_date || sale.sale_date
          const dueDate = finalDueDate.toISOString().slice(0, 10)
          const outstanding = toNumber(sale.grand_total) - (paidBySale[sale.id] || 0) - (returnedBySale[sale.id] || 0)

          return {
            id: sale.id,
            contact_name: sale.contacts?.name || 'Unknown',
            doc_number: sale.sale_number,
            due_date: dueDate,
            grand_total: toNumber(sale.grand_total),
            paid_amount: paidBySale[sale.id] || 0,
            returned_amount: returnedBySale[sale.id] || 0,
            outstanding,
            days_overdue: Math.max(0, diffDateOnlyStrings(today, dueDate)),
            aging_bucket: agingBucket(dueDate, today),
            source_type: 'SALES',
          }
        })
        .filter((row) => row.outstanding > 0.01)
    }

    const balances = await getAccountCodeBalances(orgId, ['1201'], branchSelection.branchId)
    const glBalance = toNumber(balances['1201'])
    const moduleTotal = results.reduce((sum, row) => sum + toNumber(row.outstanding), 0)
    const diff = glBalance - moduleTotal

    if (Math.abs(diff) > 10) {
      results.push({
        id: 'manual-ar-adj',
        contact_name: 'Unallocated (Buku Besar)',
        doc_number: 'GL-1201-ADJ',
        due_date: today,
        grand_total: diff,
        paid_amount: 0,
        returned_amount: 0,
        outstanding: diff,
        days_overdue: 0,
        aging_bucket: 'Current',
        source_type: 'JOURNAL',
        settlement_account_id: settlementAccounts['1201'] || null,
      })
    }
  } else {
    const purchases = await prisma.purchases.findMany({
      where: {
        org_id: orgId,
        status: { notIn: ['DRAFT', 'VOIDED'] },
        payment_status: { not: 'PAID' },
        ...(branchSelection.branchId ? { branch_id: branchSelection.branchId } : {}),
      },
      select: {
        id: true,
        purchase_number: true,
        purchase_date: true,
        due_date: true,
        grand_total: true,
        contacts: {
          select: {
            name: true,
          },
        },
      },
    })

    if (purchases.length > 0) {
      const purchaseIds = purchases.map((purchase) => purchase.id)
      const [payments, returns] = await Promise.all([
        prisma.purchase_payments.findMany({
          where: {
            purchase_id: { in: purchaseIds },
          },
          select: {
            purchase_id: true,
            amount: true,
            discount_amount: true,
          },
        }),
        prisma.purchase_returns.findMany({
          where: {
            purchase_id: { in: purchaseIds },
          },
          select: {
            purchase_id: true,
            total_amount: true,
          },
        }),
      ])

      const paidByPurchase: Record<string, number> = {}
      payments.forEach((payment) => {
        paidByPurchase[payment.purchase_id] = (paidByPurchase[payment.purchase_id] || 0) + toNumber(payment.amount) + toNumber(payment.discount_amount)
      })

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
            id: purchase.id,
            contact_name: purchase.contacts.name || 'Unknown',
            doc_number: purchase.purchase_number,
            due_date: dueDate,
            grand_total: toNumber(purchase.grand_total),
            paid_amount: paidByPurchase[purchase.id] || 0,
            returned_amount: returnedByPurchase[purchase.id] || 0,
            outstanding,
            days_overdue: Math.max(0, diffDateOnlyStrings(today, dueDate)),
            aging_bucket: agingBucket(dueDate, today),
            source_type: 'PURCHASING',
          }
        })
        .filter((row) => row.outstanding > 0.01)
    }

    const balances = await getAccountCodeBalances(orgId, ['2101', '2201', '2301', '2401'], branchSelection.branchId)
    const namedBalances = [
      { code: '2101', balance: balances['2101'] || 0, name: 'Hutang Usaha' },
      { code: '2201', balance: balances['2201'] || 0, name: 'PPN Keluaran (Pajak Dipungut)' },
      { code: '2301', balance: balances['2301'] || 0, name: 'Pendapatan Diterima di Muka' },
      { code: '2401', balance: balances['2401'] || 0, name: 'Hutang Gaji' },
    ].filter((item) => Math.abs(toNumber(item.balance)) > 0.01)

    namedBalances.forEach((balanceRow) => {
      if (balanceRow.code === '2101') {
        const tradeModuleTotal = results
          .filter((row) => row.source_type === 'PURCHASING')
          .reduce((sum, row) => sum + toNumber(row.outstanding), 0)
        const diff = toNumber(balanceRow.balance) - tradeModuleTotal

        if (Math.abs(diff) > 10) {
          results.push({
            id: 'gl-2101-manual',
            contact_name: 'Unallocated (Buku Besar)',
            doc_number: 'GL-2101-ADJ',
            due_date: today,
            grand_total: diff,
            paid_amount: 0,
            returned_amount: 0,
            outstanding: diff,
            days_overdue: 0,
            aging_bucket: 'Current',
            source_type: 'JOURNAL',
            settlement_account_id: settlementAccounts['2101'] || null,
          })
        }

        return
      }

      if (balanceRow.code === '2201') {
        results.push({
          id: `gl-tax-${balanceRow.code}`,
          contact_name: 'Pajak / Negara (PDI)',
          doc_number: 'PPN-OUTSTANDING',
          due_date: today,
          grand_total: toNumber(balanceRow.balance),
          paid_amount: 0,
          returned_amount: 0,
          outstanding: toNumber(balanceRow.balance),
          days_overdue: 0,
          aging_bucket: 'Current',
          source_type: 'TAX',
          settlement_account_id: settlementAccounts['2201'] || null,
        })
      }
    })
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
