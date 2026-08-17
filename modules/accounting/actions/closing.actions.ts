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

  const { data: overlap } = await (supabase as any)
    .from('fiscal_periods')
    .select('id, name, start_date, end_date')
    .eq('org_id', orgId)
    .lte('start_date', input.end_date)
    .gte('end_date', input.start_date)
    .maybeSingle()

  if (overlap) {
    return { error: `Rentang tanggal bentrok dengan periode "${overlap.name}" (${overlap.start_date} – ${overlap.end_date}).` }
  }

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
    if (error.code === '23P01') return { error: 'Rentang tanggal bentrok dengan periode fiskal lain.' }
    return { error: `Gagal membuat periode fiskal: ${error.message}` }
  }

  revalidatePath('/accounting/closing')
  return { success: true }
}

const FISCAL_PERIOD_MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

/**
 * Generate N periode fiskal bulanan berturut-turut mulai dari startYear/startMonth,
 * semua is_closed=false. Dipakai untuk setup awal org yang belum punya fiscal_periods
 * sama sekali (mis. AHE), tanpa perlu klik createFiscalPeriod manual satu-per-satu.
 */
export async function bulkCreateFiscalPeriods(orgId: string, input: {
  startYear: number
  startMonth: number // 1-12
  count: number
}) {
  const created: string[] = []
  const skipped: string[] = []

  let year = input.startYear
  let month = input.startMonth

  for (let i = 0; i < input.count; i++) {
    const start = new Date(Date.UTC(year, month - 1, 1))
    const end = new Date(Date.UTC(year, month, 0)) // hari terakhir bulan ini
    const name = `${FISCAL_PERIOD_MONTH_NAMES[month - 1]} ${year}`
    const start_date = start.toISOString().split('T')[0]
    const end_date = end.toISOString().split('T')[0]

    const result = await createFiscalPeriod(orgId, { name, start_date, end_date })
    if ((result as any).error) {
      skipped.push(`${name}: ${(result as any).error}`)
    } else {
      created.push(name)
    }

    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }

  revalidatePath('/accounting/closing')
  return { success: true, created, skipped }
}

export async function closeFiscalPeriod(id: string, orgId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi.' }

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
  return { success: true }
}

export async function openFiscalPeriod(id: string, orgId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi.' }

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
