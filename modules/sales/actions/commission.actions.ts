'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { normalizeCommissionType, normalizeResellerType, type SalesResellerRecord } from '@/modules/sales/lib/commission'

type ResellerMutationResult =
  | { success: true; data: SalesResellerRecord; error?: undefined }
  | { success?: false; error: string; data?: undefined }

type DeleteResellerResult =
  | { success: true; error?: undefined }
  | { success?: false; error: string }

type ResellerSnapshotResult =
  | {
      success: true
      resellerId: string | null
      resellerName: string | null
      commissionType: 'PERCENT' | 'FIXED' | null
      commissionValue: number | null
      error?: undefined
    }
  | {
      success?: false
      error: string
      resellerId?: undefined
      resellerName?: undefined
      commissionType?: undefined
      commissionValue?: undefined
    }

type ResellerMutationPayload = {
  name: string
  resellerType: 'PERSONAL' | 'COMPANY'
  companyName: string | null
  contactPerson: string | null
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
  targetAmount: number
  commissionType: 'PERCENT' | 'FIXED'
  commissionValue: number
}

function normalizeOptionalText(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizeNonNegativeNumber(value: FormDataEntryValue | null) {
  const numeric = typeof value === 'string' ? Number(value) : Number(value || 0)
  if (!Number.isFinite(numeric) || numeric < 0) return 0
  return numeric
}

function parseResellerFormData(formData: FormData): ResellerMutationPayload | { error: string } {
  const resellerType = normalizeResellerType(
    typeof formData.get('reseller_type') === 'string' ? (formData.get('reseller_type') as string) : null
  )
  const name = typeof formData.get('name') === 'string' ? (formData.get('name') as string).trim() : ''
  const commissionType = normalizeCommissionType(
    typeof formData.get('commission_type') === 'string' ? (formData.get('commission_type') as string) : null
  )
  const commissionValue = normalizeNonNegativeNumber(formData.get('commission_value'))
  const targetAmount = normalizeNonNegativeNumber(formData.get('target_amount'))

  if (!name) {
    return { error: 'Nama reseller wajib diisi.' }
  }

  if (!commissionType) {
    return { error: 'Tipe komisi wajib dipilih.' }
  }

  return {
    name,
    resellerType,
    companyName: normalizeOptionalText(formData.get('company_name')),
    contactPerson: normalizeOptionalText(formData.get('contact_person')),
    email: normalizeOptionalText(formData.get('email')),
    phone: normalizeOptionalText(formData.get('phone')),
    address: normalizeOptionalText(formData.get('address')),
    notes: normalizeOptionalText(formData.get('notes')),
    targetAmount,
    commissionType,
    commissionValue,
  }
}

function revalidateSalesCommissionPages() {
  revalidatePath('/sales')
  revalidatePath('/sales/commission')
  revalidatePath('/sales/quotations')
}

export async function getActiveResellers(orgId: string) {
  const supabase = await createClient()
  const db = supabase as any
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await db
    .from('sales_resellers')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) return []
  return (data || []) as SalesResellerRecord[]
}

export async function createReseller(orgId: string, formData: FormData): Promise<ResellerMutationResult> {
  const supabase = await createClient()
  const db = supabase as any
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  const payload = parseResellerFormData(formData)
  if ('error' in payload) return payload

  const { data, error } = await db
    .from('sales_resellers')
    .insert({
      org_id: orgId,
      name: payload.name,
      reseller_type: payload.resellerType,
      company_name: payload.companyName,
      contact_person: payload.contactPerson,
      email: payload.email,
      phone: payload.phone,
      address: payload.address,
      notes: payload.notes,
      target_amount: payload.targetAmount,
      commission_type: payload.commissionType,
      commission_value: payload.commissionValue,
      created_by: user.id,
      is_active: true,
    })
    .select()
    .single()

  if (error) return { error: 'Gagal membuat reseller: ' + error.message }

  revalidateSalesCommissionPages()
  return { success: true, data: data as SalesResellerRecord }
}

export async function updateReseller(orgId: string, resellerId: string, formData: FormData): Promise<ResellerMutationResult> {
  const supabase = await createClient()
  const db = supabase as any
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  const payload = parseResellerFormData(formData)
  if ('error' in payload) return payload

  const { data, error } = await db
    .from('sales_resellers')
    .update({
      name: payload.name,
      reseller_type: payload.resellerType,
      company_name: payload.companyName,
      contact_person: payload.contactPerson,
      email: payload.email,
      phone: payload.phone,
      address: payload.address,
      notes: payload.notes,
      target_amount: payload.targetAmount,
      commission_type: payload.commissionType,
      commission_value: payload.commissionValue,
      updated_at: new Date().toISOString(),
    })
    .eq('id', resellerId)
    .eq('org_id', orgId)
    .eq('is_active', true)
    .select()
    .single()

  if (error) return { error: 'Gagal memperbarui reseller: ' + error.message }

  revalidateSalesCommissionPages()
  return { success: true, data: data as SalesResellerRecord }
}

export async function deleteReseller(orgId: string, resellerId: string): Promise<DeleteResellerResult> {
  const supabase = await createClient()
  const db = supabase as any
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  const { error } = await db
    .from('sales_resellers')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', resellerId)
    .eq('org_id', orgId)
    .eq('is_active', true)

  if (error) return { error: 'Gagal menghapus reseller: ' + error.message }

  revalidateSalesCommissionPages()
  return { success: true }
}

export async function getResellerCommissionSnapshot(orgId: string, resellerId?: string | null): Promise<ResellerSnapshotResult> {
  const normalizedResellerId = String(resellerId || '').trim()
  if (!normalizedResellerId) {
    return {
      success: true,
      resellerId: null,
      resellerName: null,
      commissionType: null,
      commissionValue: null,
    }
  }

  const supabase = await createClient()
  const db = supabase as any

  const { data, error } = await db
    .from('sales_resellers')
    .select('id, name, commission_type, commission_value, is_active')
    .eq('org_id', orgId)
    .eq('id', normalizedResellerId)
    .maybeSingle()

  if (error) {
    return { error: 'Gagal membaca data reseller: ' + error.message }
  }

  const reseller = (data as {
    id?: string
    name?: string | null
    commission_type?: string | null
    commission_value?: number | null
    is_active?: boolean | null
  } | null) ?? null

  if (!reseller || reseller.is_active === false) {
    return { error: 'Reseller tidak ditemukan atau sudah nonaktif.' }
  }

  return {
    success: true,
    resellerId: String(reseller.id),
    resellerName: reseller.name ? String(reseller.name) : null,
    commissionType: normalizeCommissionType(reseller.commission_type) || null,
    commissionValue:
      reseller.commission_value === null || reseller.commission_value === undefined
        ? null
        : Number(reseller.commission_value),
  }
}
