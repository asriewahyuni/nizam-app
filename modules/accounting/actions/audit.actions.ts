'use server'

import { getAuthUser, getMembership } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

function createEmptyAuditOverview() {
  return {
    unbalanced: [],
    overdueAssets: [],
    inventory: [],
    inventoryVariance: 0,
    onHandValue: 0,
    glInventoryBalance: 0,
    stats: {
      unbalancedCount: 0,
      overdueAssetCount: 0,
      inventoryVariance: 0,
    },
  }
}

export async function getAuditOverview(orgId: string) {
  const user = await getAuthUser()
  if (!user) return createEmptyAuditOverview()

  const membership = await getMembership(user.userId, orgId)
  if (!membership || !membership.isOwnerOrAdmin) {
    return createEmptyAuditOverview()
  }

  // ======================================================
  // 1. Unbalanced Journals (POSTED)
  // ======================================================
  const postedEntries = await prisma.journal_entries.findMany({
    where: {
      org_id: orgId,
      status: 'POSTED',
    },
    select: {
      id: true,
      entry_date: true,
      description: true,
      reference_type: true,
    },
  })

  const entryIds = postedEntries.map((entry) => entry.id)
  let unbalanced: any[] = []

  if (entryIds.length > 0) {
    const lines = await prisma.journal_lines.findMany({
      where: {
        entry_id: {
          in: entryIds,
        },
      },
      select: {
        entry_id: true,
        debit: true,
        credit: true,
      },
    })

    const entryTotals: Record<string, { debit: number; credit: number }> = {}
    for (const line of lines) {
      const debit = Number(line.debit || 0)
      const credit = Number(line.credit || 0)
      if (!entryTotals[line.entry_id]) entryTotals[line.entry_id] = { debit: 0, credit: 0 }
      entryTotals[line.entry_id].debit += debit
      entryTotals[line.entry_id].credit += credit
    }

    unbalanced = postedEntries
      .filter((entry) => {
        const totals = entryTotals[entry.id]
        if (!totals) return true
        return Math.abs(totals.debit - totals.credit) > 0.01
      })
      .map((entry) => {
        const totals = entryTotals[entry.id] || { debit: 0, credit: 0 }
        return {
          entry_id: entry.id,
          entry_date: entry.entry_date.toISOString(),
          description: entry.description,
          reference_type: entry.reference_type,
          total_debit: totals.debit,
          total_credit: totals.credit,
          diff: Math.abs(totals.debit - totals.credit),
        }
      })
  }

  // ======================================================
  // 2. Overdue Depreciation
  // ======================================================
  const now = new Date()
  const lastMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0))

  const assets = await prisma.fixed_assets.findMany({
    where: {
      org_id: orgId,
      status: 'ACTIVE',
    },
    select: {
      id: true,
      code: true,
      name: true,
      purchase_date: true,
      last_depreciation_date: true,
      current_book_value: true,
    },
  })

  const overdueAssets = assets
    .filter((asset) => {
      if (!asset.last_depreciation_date) return true
      return asset.last_depreciation_date.getTime() < lastMonthEnd.getTime()
    })
    .map((asset) => ({
      id: asset.id,
      code: asset.code,
      name: asset.name,
      purchase_date: asset.purchase_date?.toISOString() ?? null,
      last_depreciation_date: asset.last_depreciation_date?.toISOString() ?? null,
      current_book_value: Number(asset.current_book_value ?? 0),
    }))

  // ======================================================
  // 3. Inventory Sub-Ledger (Movements) vs General Ledger (1301)
  // ======================================================
  const products = await prisma.products.findMany({
    where: { org_id: orgId },
    select: {
      id: true,
      name: true,
      average_cost: true,
    },
  })

  const productIds = products.map((product) => product.id)

  // Sub-Ledger Truth: Stock Movements
  const movements = productIds.length > 0
    ? await prisma.stock_movements.findMany({
        where: {
          product_id: {
            in: productIds,
          },
        },
        select: {
          product_id: true,
          quantity: true,
        },
      })
    : []

  const stockByProduct: Record<string, number> = {}
  for (const movement of movements) {
    stockByProduct[movement.product_id] =
      (stockByProduct[movement.product_id] || 0) + Number(movement.quantity || 0)
  }

  // GL Inventory balance (account 1301)
  const invAcc = await prisma.accounts.findFirst({
    where: {
      org_id: orgId,
      code: '1301',
    },
    select: {
      id: true,
    },
  })

  let glInventoryBalance = 0
  if (invAcc && entryIds.length > 0) {
    const invLines = await prisma.journal_lines.findMany({
      where: {
        account_id: invAcc.id,
        entry_id: {
          in: entryIds,
        },
      },
      select: {
        debit: true,
        credit: true,
      },
    })

    for (const line of invLines) {
      glInventoryBalance += Number(line.debit || 0) - Number(line.credit || 0)
    }
  }

  const totalSubLedgerValue = products.reduce((sum, product) => {
    return sum + ((stockByProduct[product.id] || 0) * Number(product.average_cost || 0))
  }, 0)

  // Distributed GL value per product
  const inventory = products.map((product) => {
    const qty = stockByProduct[product.id] || 0
    const avgCost = Number(product.average_cost || 0)
    const subLedgerValue = qty * avgCost
    const proportion = totalSubLedgerValue > 0 ? subLedgerValue / totalSubLedgerValue : 0
    const ledgerValue = glInventoryBalance * proportion

    return {
      product_id: product.id,
      product_name: product.name,
      stock_qty: qty,
      avg_cost: avgCost,
      on_hand_value: subLedgerValue,
      ledger_value: ledgerValue,
      variance: subLedgerValue - ledgerValue,
    }
  })

  const inventoryVariance = totalSubLedgerValue - glInventoryBalance

  return {
    unbalanced,
    overdueAssets,
    inventory,
    inventoryVariance,
    onHandValue: totalSubLedgerValue,
    glInventoryBalance,
    stats: {
      unbalancedCount: unbalanced.length,
      overdueAssetCount: overdueAssets.length,
      inventoryVariance
    }
  }
}

export async function forceReconcileAudit(orgId: string, type: 'JOURNAL' | 'INVENTORY' | 'ASSETS') {
  revalidatePath('/accounting/audit')
  return { success: true, message: `Audit re-crawling completed for ${type}.` }
}
