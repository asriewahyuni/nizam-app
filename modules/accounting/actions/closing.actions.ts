'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getFiscalPeriods(orgId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
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

  const { error } = await supabase
    .from('fiscal_periods')
    .insert({
      org_id: orgId,
      name: input.name,
      start_date: input.start_date,
      end_date: input.end_date,
      is_closed: false
    })

  if (error) {
    if (error.code === '23505') return { error: 'Nama periode ini sudah ada.' }
    return { error: 'Gagal membuat periode fiskal.' }
  }

  revalidatePath('/accounting/closing')
  return { success: true }
}

export async function closeFiscalPeriod(id: string, orgId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi.' }

  const { error } = await supabase
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

  const { error } = await supabase
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
