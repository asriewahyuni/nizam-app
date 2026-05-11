'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getFiscalPeriods(orgId: string) {
  const supabase = await createClient()

  const { data, error } = await (supabase as any)
    .from('fiscal_periods')
    .select('*')
    .eq('org_id', orgId)
    .order('start_date', { ascending: false })

  if (error) return []
  return data
}

export async function createFiscalPeriod(orgId: string, input: {
  name: string,
  start_date: string,
  end_date: string
}) {
  const supabase = await createClient()

  const { error } = await (supabase as any)
    .from('fiscal_periods')
    .insert({
      org_id: orgId,
      name: input.name,
      start_date: input.start_date,
      end_date: input.end_date,
      is_closed: false
    })

  if (error) {
    console.error('Create fiscal period error:', error)
    if (error.code === '23505') return { error: 'Nama periode ini sudah ada.' }
    return { error: `Gagal membuat periode fiskal: ${error.message}` }
  }

  revalidatePath('/accounting/closing')
  return { success: true }
}

export async function closeFiscalPeriod(id: string, orgId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi.' }

  // Panggil function SQL untuk generate closing journal entry
  const { queryPostgres } = await import('@/lib/db/postgres')
  const { rows } = await queryPostgres<{ generate_period_closing_journal: any }>(
    `SELECT generate_period_closing_journal($1::uuid, $2::uuid) as result`,
    [id, user.id]
  )

  const result = rows?.[0]?.generate_period_closing_journal
  if (!result?.success) {
    return { error: result?.error || 'Gagal membuat jurnal penutup.' }
  }

  // Update is_closed = true
  const { error } = await (supabase as any)
    .from('fiscal_periods')
    .update({ 
      is_closed: true,
      closed_at: new Date().toISOString(),
      closed_by: user.id
    })
    .eq('id', id)
    .eq('org_id', orgId)

  if (error) return { error: 'Gagal menutup periode.' }

  revalidatePath('/accounting/closing')
  return { 
    success: true,
    entry_id: result.entry_id,
    total_revenue: result.total_revenue,
    total_expense: result.total_expense,
    net_profit: result.net_profit
  }
}

export async function openFiscalPeriod(id: string, orgId: string) {
  const supabase = await createClient()

  const { error } = await (supabase as any)
    .from('fiscal_periods')
    .update({ 
      is_closed: false,
      closed_at: null,
      closed_by: null
    })
    .eq('id', id)
    .eq('org_id', orgId)

  if (error) return { error: 'Gagal membuka kembali periode.' }

  revalidatePath('/accounting/closing')
  return { success: true }
}

export async function getPeriodClosingJournal(periodId: string) {
  const supabase = await createClient()
  const { data } = await (supabase as any)
    .from('journal_entries')
    .select(`
      *,
      lines:journal_lines(*),
      accounts:journal_lines!inner(account_id, accounts:accounts(id, code, name))
    `)
    .eq('reference_type', 'CLOSING')
    .eq('reference_id', periodId)
    .eq('status', 'POSTED')
    .maybeSingle()

  return data
}
