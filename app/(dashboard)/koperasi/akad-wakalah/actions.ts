'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getAkadWakalah } from '@/modules/koperasi/actions/koperasi.actions'

export async function createAkadWakalahAction(orgId: string, payload: {
  shahibul_maal_id: string
  jenis_barang?: string
  ujrah_flat: number
  status?: string
}) {
  const db = createAdminClient()
  // Generate nomor akad
  const { data: noResult } = await db.rpc('koperasi_generate_nomor_akad', { p_org_id: orgId })
  const nomor_akad = noResult || `KOP/WKL/${new Date().getFullYear()}/${String(Date.now()).slice(-4)}`
  
  const { data, error } = await db.from('koperasi_akad_wakalah')
    .insert({ org_id: orgId, nomor_akad, ...payload, status: payload.status || 'DRAFT' })
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/koperasi/akad-wakalah')
  return data
}
