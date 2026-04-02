'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type ContactType = 'CUSTOMER' | 'SUPPLIER'
type ContactMutationPayload = {
  name: string
  type: ContactType
  email: string | null
  phone: string | null
  address: string | null
  phone_wa: string | null
  instagram: string | null
}
type ContactMutationResult =
  | { success: true; data: any; error?: undefined }
  | { success?: false; error: string; data?: undefined }
type DeleteContactResult =
  | { success: true; error?: undefined }
  | { success?: false; error: string }

function normalizeOptionalField(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function parseContactFormData(formData: FormData): ContactMutationPayload | { error: string } {
  const name = typeof formData.get('name') === 'string' ? (formData.get('name') as string).trim() : ''
  const typeValue = typeof formData.get('type') === 'string' ? (formData.get('type') as string).trim() : ''
  const type: ContactType | null = typeValue === 'CUSTOMER' || typeValue === 'SUPPLIER' ? typeValue : null

  if (!name || !type) {
    return { error: 'Nama dan Tipe wajib diisi.' as const }
  }

  return {
    name,
    type,
    email: normalizeOptionalField(formData.get('email')),
    phone: normalizeOptionalField(formData.get('phone')),
    address: normalizeOptionalField(formData.get('address')),
    phone_wa: normalizeOptionalField(formData.get('phone_wa')),
    instagram: normalizeOptionalField(formData.get('instagram')),
  }
}

function revalidateContactPages() {
  revalidatePath('/contacts')
  revalidatePath('/sales')
  revalidatePath('/purchasing')
  revalidatePath('/dashboard')
}

export async function getContacts(orgId: string, type?: 'CUSTOMER' | 'SUPPLIER') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return []

  let query = supabase.from('contacts' as any).select('*').eq('org_id', orgId).eq('is_active', true)
  if (type) query = query.eq('type', type)

  const { data, error } = await (query.order('name', { ascending: true }) as any)
  if (error) return []
  return data
}

export async function createContact(orgId: string, formData: FormData): Promise<ContactMutationResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  const payload = parseContactFormData(formData)
  if ('error' in payload) return payload

  const { data, error } = await (supabase as any).from('contacts').insert({
    org_id: orgId,
    ...payload,
    is_active: true
  }).select().single()

  if (error) return { error: 'Gagal membuat kontak: ' + error.message }

  revalidateContactPages()
  return { success: true, data }
}

export async function updateContact(orgId: string, contactId: string, formData: FormData): Promise<ContactMutationResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  const payload = parseContactFormData(formData)
  if ('error' in payload) return payload

  const { data, error } = await (supabase as any)
    .from('contacts')
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contactId)
    .eq('org_id', orgId)
    .eq('is_active', true)
    .select()
    .single()

  if (error) return { error: 'Gagal memperbarui kontak: ' + error.message }

  revalidateContactPages()
  return { success: true, data }
}

export async function deleteContact(orgId: string, contactId: string): Promise<DeleteContactResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  const { error } = await (supabase as any)
    .from('contacts')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contactId)
    .eq('org_id', orgId)
    .eq('is_active', true)

  if (error) return { error: 'Gagal menghapus kontak: ' + error.message }

  revalidateContactPages()
  return { success: true }
}
