'use server'

import { prisma } from '@/lib/prisma'
import { addDaysToDateString, getDateInTimeZone } from '@/lib/utils'
import {
  ensureAccountingAccess,
  getCashAccountCodes,
  getPostedEntryIds,
  resolveBranchFilter,
  toNumber,
  type BranchFilter,
} from '@/modules/accounting/lib/reporting.server'

async function getCurrentCashBalance(orgId: string, branchId?: BranchFilter) {
  const [cashAccountCodes, entryIds] = await Promise.all([
    getCashAccountCodes(orgId, branchId),
    getPostedEntryIds(orgId, { branchId }),
  ])

  if (entryIds.length === 0) return 0

  const lines = await prisma.journal_lines.findMany({
    where: {
      entry_id: { in: entryIds },
      accounts: {
        is: {
          code: { in: cashAccountCodes },
        },
      },
    },
    select: {
      debit: true,
      credit: true,
    },
  })

  return lines.reduce((sum, line) => sum + toNumber(line.debit) - toNumber(line.credit), 0)
}

async function getSalesForecastRows(orgId: string, branchId?: BranchFilter) {
  const sales = await prisma.sales.findMany({
    where: {
      org_id: orgId,
      payment_status: { in: ['UNPAID', 'PARTIAL'] },
      status: { not: 'VOIDED' },
      ...(branchId ? { branch_id: branchId } : {}),
    },
    select: {
      id: true,
      grand_total: true,
      due_date: true,
      sale_number: true,
    },
  })

  if (sales.length === 0) return []

  const saleIds = sales.map((sale) => sale.id)
  const [payments, returns] = await Promise.all([
    prisma.sales_payments.findMany({
      where: {
        sale_id: { in: saleIds },
        ...(branchId ? { branch_id: branchId } : {}),
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
        ...(branchId ? { branch_id: branchId } : {}),
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

  return sales
    .map((sale) => ({
      id: sale.id,
      grand_total: toNumber(sale.grand_total),
      due_date: sale.due_date?.toISOString().slice(0, 10) || null,
      sale_number: sale.sale_number,
      outstanding: Math.max(0, toNumber(sale.grand_total) - (paidBySale[sale.id] || 0) - (returnedBySale[sale.id] || 0)),
    }))
    .filter((sale) => sale.outstanding > 0.01)
}

async function getPurchaseForecastRows(orgId: string, branchId?: BranchFilter) {
  const purchases = await prisma.purchases.findMany({
    where: {
      org_id: orgId,
      payment_status: { in: ['UNPAID', 'PARTIAL'] },
      status: { not: 'VOIDED' },
      ...(branchId ? { branch_id: branchId } : {}),
    },
    select: {
      id: true,
      grand_total: true,
      due_date: true,
      purchase_number: true,
    },
  })

  if (purchases.length === 0) return []

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

  return purchases
    .map((purchase) => ({
      id: purchase.id,
      grand_total: toNumber(purchase.grand_total),
      due_date: purchase.due_date?.toISOString().slice(0, 10) || null,
      purchase_number: purchase.purchase_number,
      outstanding: Math.max(0, toNumber(purchase.grand_total) - (paidByPurchase[purchase.id] || 0) - (returnedByPurchase[purchase.id] || 0)),
    }))
    .filter((purchase) => purchase.outstanding > 0.01)
}

export async function getCashFlowForecast(orgId: string, days: number = 90, branchId?: BranchFilter) {
  const membership = await ensureAccountingAccess(orgId)
  if (!membership) {
    return { currentCash: 0, forecast: [], totalProjectedInflow: 0, totalProjectedOutflow: 0, lowestPoint: 0, days }
  }

  const branchSelection = await resolveBranchFilter(orgId, branchId)
  if ('error' in branchSelection) {
    return { currentCash: 0, forecast: [], totalProjectedInflow: 0, totalProjectedOutflow: 0, lowestPoint: 0, days }
  }

  const currentCash = await getCurrentCashBalance(orgId, branchSelection.branchId)
  const [sales, purchases] = await Promise.all([
    getSalesForecastRows(orgId, branchSelection.branchId),
    getPurchaseForecastRows(orgId, branchSelection.branchId),
  ])

  const forecast: Array<{ date: string; inflow: number; outflow: number; balance: number; isNegative: boolean }> = []
  let runningBalance = currentCash
  const todayDateStr = getDateInTimeZone('Asia/Jakarta')

  for (let index = 0; index < days; index += 1) {
    const dateStr = addDaysToDateString(todayDateStr, index)
    const dayInflow = sales
      .filter((sale) => (index === 0 ? !sale.due_date || sale.due_date <= dateStr : sale.due_date === dateStr))
      .reduce((sum, sale) => sum + sale.outstanding, 0)
    const dayOutflow = purchases
      .filter((purchase) => (index === 0 ? !purchase.due_date || purchase.due_date <= dateStr : purchase.due_date === dateStr))
      .reduce((sum, purchase) => sum + purchase.outstanding, 0)

    runningBalance += dayInflow - dayOutflow

    forecast.push({
      date: dateStr,
      inflow: dayInflow,
      outflow: dayOutflow,
      balance: runningBalance,
      isNegative: runningBalance < 0,
    })
  }

  return {
    currentCash,
    forecast,
    totalProjectedInflow: sales.reduce((sum, sale) => sum + sale.outstanding, 0),
    totalProjectedOutflow: purchases.reduce((sum, purchase) => sum + purchase.outstanding, 0),
    lowestPoint: forecast.length > 0 ? Math.min(...forecast.map((item) => item.balance)) : currentCash,
    days,
  }
}
