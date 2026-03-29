'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getContacts(orgId: string, type?: 'CUSTOMER' | 'SUPPLIER') {
  const supabase = await createClient()

  let query = supabase.from('contacts' as any).select('*').eq('org_id', orgId).eq('is_active', true)
  if (type) query = query.eq('type', type)

  const { data, error } = await (query.order('name', { ascending: true }) as any)
  if (error) return []
  return data
}

export async function createContact(orgId: string, formData: FormData) {
  const supabase = await createClient()

  const name = formData.get('name') as string
  const type = formData.get('type') as string
  const email = formData.get('email') as string
  const phone = formData.get('phone') as string
  const address = formData.get('address') as string
  const phone_wa = formData.get('phone_wa') as string
  const instagram = formData.get('instagram') as string

  if (!name || !type) return { error: 'Nama dan Tipe wajib diisi.' }

  const { data, error } = await (supabase as any).from('contacts').insert({
    org_id: orgId,
    name,
    type,
    email,
    phone,
    phone_wa,
    instagram,
    address,
    is_active: true
  }).select().single()

  if (error) return { error: 'Gagal membuat kontak: ' + error.message }

  revalidatePath('/sales')
  revalidatePath('/purchasing')
  return { success: true, data }
}
