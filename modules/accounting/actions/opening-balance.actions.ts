'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getOpeningBalances(orgId: string, periodId?: string) {
  const supabase = await createClient()
  let query = (supabase as any)
    .from('opening_balances')
    .select('*, account:accounts(id, code, name, type)')
    .eq('org_id', orgId)

  if (periodId) query = query.eq('period_id', periodId)

  const { data, error } = await query
  if (error) return []
  return data
}

export async function upsertOpeningBalance(orgId: string, input: {
  account_id: string
  amount: number
  period_id?: string
  notes?: string
}) {
  const supabase = await createClient()

  // Cek balance sebelum insert — total debit harus = total credit
  const { data: existing } = await (supabase as any)
    .from('opening_balances')
    .select('amount')
    .eq('org_id', orgId)
    .eq('account_id', input.account_id)

  if (existing && existing.length > 0) {
    // Update
    const { error } = await (supabase as any)
      .from('opening_balances')
      .update({
        amount: input.amount,
        notes: input.notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('org_id', orgId)
      .eq('account_id', input.account_id)

    if (error) return { error: error.message }
  } else {
    // Insert
    const { error } = await (supabase as any)
      .from('opening_balances')
      .insert({
        org_id: orgId,
        account_id: input.account_id,
        amount: input.amount,
        period_id: input.period_id || null,
        notes: input.notes || null
      })

    if (error) return { error: error.message }
  }

  revalidatePath('/accounting/opening-balance')
  return { success: true }
}

export async function applyOpeningBalances(orgId: string, periodId?: string) {
  const supabase = await createClient()

  // Panggil function SQL
  const { queryPostgres } = await import('@/lib/db/postgres')
  const { rows } = await queryPostgres<{ apply_opening_balances: any }>(
    `SELECT apply_opening_balances($1::uuid, $2::uuid) as result`,
    [orgId, periodId || null]
  )

  const result = rows?.[0]?.apply_opening_balances
  if (!result?.success) {
    return { error: result?.error || 'Gagal apply opening balance.' }
  }

  revalidatePath('/accounting/opening-balance')
  revalidatePath('/accounting/reports')
  return { success: true, entry_id: result.entry_id }
}

export async function checkOpeningBalanceBalance(orgId: string, periodId?: string) {
  const supabase = await createClient()
  let query = (supabase as any)
    .from('opening_balances')
    .select('amount')
    .eq('org_id', orgId)

  if (periodId) query = query.eq('period_id', periodId)

  const { data } = await query
  const total = (data || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0)
  return {
    total,
    isBalanced: Math.abs(total) < 1,
    count: (data || []).length
  }
}

export async function deleteOpeningBalance(orgId: string, accountId: string) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('opening_balances')
    .delete()
    .eq('org_id', orgId)
    .eq('account_id', accountId)

  if (error) return { error: error.message }
  revalidatePath('/accounting/opening-balance')
  return { success: true }
}
