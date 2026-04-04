'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getAuditOverview(orgId: string) {
  const supabase = await createClient()
  const db = supabase as any

  // ======================================================
  // 1. Unbalanced Journals (POSTED)
  // ======================================================
  const { data: postedEntries } = await db
    .from('journal_entries')
    .select('id, entry_date, description, reference_type')
    .eq('org_id', orgId)
    .eq('status', 'POSTED')

  const entryIds = (postedEntries || []).map((e: any) => e.id)
  let unbalanced: any[] = []

  if (entryIds.length > 0) {
    const { data: lines } = await db
      .from('journal_lines')
      .select('entry_id, debit, credit')
      .in('entry_id', entryIds)

    const entryTotals: Record<string, { debit: number; credit: number }> = {}
    for (const l of lines || []) {
      if (!entryTotals[l.entry_id]) entryTotals[l.entry_id] = { debit: 0, credit: 0 }
      entryTotals[l.entry_id].debit += Number(l.debit)
      entryTotals[l.entry_id].credit += Number(l.credit)
    }

    unbalanced = (postedEntries || [])
      .filter((e: any) => {
        const t = entryTotals[e.id]
        if (!t) return true
        return Math.abs(t.debit - t.credit) > 0.01
      })
      .map((e: any) => {
        const t = entryTotals[e.id] || { debit: 0, credit: 0 }
        return {
          entry_id: e.id,
          entry_date: e.entry_date,
          description: e.description,
          reference_type: e.reference_type,
          total_debit: t.debit,
          total_credit: t.credit,
          diff: Math.abs(t.debit - t.credit)
        }
      })
  }

  // ======================================================
  // 2. Overdue Depreciation
  // ======================================================
  const lastMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().split('T')[0]

  const { data: assets } = await db
    .from('fixed_assets')
    .select('id, code, name, purchase_date, last_depreciation_date, current_book_value, current_value')
    .eq('org_id', orgId)
    .eq('status', 'ACTIVE')

  const overdueAssets = ((assets as any[]) || []).filter((a: any) => {
    if (!a.last_depreciation_date) return true
    return a.last_depreciation_date < lastMonthEnd
  }).map((a: any) => ({
    ...a,
    current_book_value: a.current_book_value ?? a.current_value ?? 0
  }))

  // ======================================================
  // 3. Inventory Sub-Ledger (Movements) vs General Ledger (1301-1399)
  // ======================================================
  const { data: products } = await db
    .from('products')
    .select('id, name, average_cost')
    .eq('org_id', orgId)

  const productIds = (products || []).map((p: any) => p.id)

  // Sub-Ledger Truth: Stock Movements
  const { data: movements } = await db
    .from('stock_movements')
    .select('product_id, quantity')
    .in('product_id', productIds)

  const stockByProduct: Record<string, number> = {}
  for (const m of movements || []) {
    stockByProduct[m.product_id] = (stockByProduct[m.product_id] || 0) + Number(m.quantity)
  }

  // GL Inventory balance (inventory asset block 1301-1399)
  const { data: inventoryAccounts } = await db
    .from('accounts')
    .select('id, code')
    .eq('org_id', orgId)
    .gte('code', '1301')
    .lte('code', '1399')

  let glInventoryBalance = 0
  const inventoryAccountIds = (inventoryAccounts || []).map((acc: any) => acc.id)
  if (inventoryAccountIds.length > 0 && entryIds.length > 0) {
    const { data: invLines } = await db
      .from('journal_lines')
      .select('debit, credit')
      .in('account_id', inventoryAccountIds)
      .in('entry_id', entryIds)

    for (const l of invLines || []) {
      glInventoryBalance += Number(l.debit) - Number(l.credit)
    }
  }

  const totalSubLedgerValue = (products || []).reduce((sum: any, p: any) => {
    return sum + ((stockByProduct[p.id] || 0) * Number(p.average_cost || 0))
  }, 0)

  // Distributed GL value per product
  const inventory = (products || []).map((p: any) => {
    const qty = stockByProduct[p.id] || 0
    const subLedgerValue = qty * Number(p.average_cost || 0)
    const proportion = totalSubLedgerValue > 0 ? subLedgerValue / totalSubLedgerValue : 0
    const ledgerValue = glInventoryBalance * proportion
    
    return {
      product_id: p.id,
      product_name: p.name,
      stock_qty: qty,
      avg_cost: Number(p.average_cost || 0),
      on_hand_value: subLedgerValue,
      ledger_value: ledgerValue,
      variance: subLedgerValue - ledgerValue
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
