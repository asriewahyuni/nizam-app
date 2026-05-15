'use server'

import { revalidatePath } from 'next/cache'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { createClient } from '@/lib/supabase/server'

function getErrorMessage(error: any): string {
  if (!error) return 'Unknown error'
  if (typeof error === 'string') return error
  if (error.message) return String(error.message)
  return 'Unknown error'
}

async function assertOrgAdmin() {
  const orgData = await getActiveOrg()
  if (!orgData) throw new Error('Not authenticated')
  if (!['owner', 'admin'].includes(orgData.role)) throw new Error('Akses ditolak')
  return orgData
}

// ── Public: Info Batch ────────────────────────────────────────────────────────

export async function getPublicBatchInfo(batchId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('lms_course_batches')
    .select('*, learning_courses(id, title, description, slug)')
    .eq('id', batchId)
    .maybeSingle()

  if (!data) return null
  return data
}

export async function getBatchRegisteredCount(batchId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('lms_registrations')
    .select('id')
    .eq('batch_id', batchId)
    .neq('status', 'CANCELLED')

  return (data || []).length
}

// ── Public: Daftar ────────────────────────────────────────────────────────────

export async function createLmsRegistration(
  _prevState: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  try {
    const batchId = formData.get('batchId') as string
    const fullName = (formData.get('fullName') as string || '').trim()
    const email = (formData.get('email') as string || '').trim().toLowerCase()
    const phone = (formData.get('phone') as string || '').trim()

    if (!batchId || !fullName || !email) {
      return { error: 'Nama lengkap dan email wajib diisi' }
    }

    const supabase = await createClient()

    // Ambil info batch
    const { data: batch } = await supabase
      .from('lms_course_batches')
      .select('id, org_id, quota, status, name')
      .eq('id', batchId)
      .maybeSingle()

    if (!batch) return { error: 'Batch tidak ditemukan' }
    if (batch.status === 'CLOSED' || batch.status === 'COMPLETED') {
      return { error: 'Pendaftaran batch ini sudah ditutup' }
    }

    // Cek kuota
    if (Number(batch.quota) > 0) {
      const { data: existing } = await supabase
        .from('lms_registrations')
        .select('id')
        .eq('batch_id', batchId)
        .neq('status', 'CANCELLED')

      if ((existing || []).length >= Number(batch.quota)) {
        return { error: 'Maaf, kuota batch ini sudah penuh' }
      }
    }

    // Cek duplikat email
    const { data: duplicate } = await supabase
      .from('lms_registrations')
      .select('id')
      .eq('batch_id', batchId)
      .eq('email', email)
      .neq('status', 'CANCELLED')
      .maybeSingle()

    if (duplicate) {
      return { error: 'Email ini sudah terdaftar di batch ini' }
    }

    // Simpan registrasi
    const { error: insertError } = await supabase
      .from('lms_registrations')
      .insert({
        org_id: batch.org_id,
        batch_id: batchId,
        full_name: fullName,
        email,
        phone: phone || null,
        status: 'PENDING_PAYMENT',
      })

    if (insertError) {
      console.error('[createLmsRegistration]', JSON.stringify(insertError))
      return { error: getErrorMessage(insertError) }
    }

    return { success: true }
  } catch (e: any) {
    return { error: e?.message || 'Terjadi kesalahan tidak terduga' }
  }
}

// ── Admin: List Registrasi ────────────────────────────────────────────────────

export async function getAllLmsRegistrations(orgId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('lms_registrations')
    .select('*, lms_course_batches(id, name, price, learning_courses(title))')
    .eq('org_id', orgId)
    .order('registered_at', { ascending: false })

  if (error) {
    console.error('[getAllLmsRegistrations]', error)
    return []
  }
  return data || []
}

export async function getLmsRegistrationsByBatch(orgId: string, batchId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('lms_registrations')
    .select('*')
    .eq('org_id', orgId)
    .eq('batch_id', batchId)
    .order('registered_at', { ascending: false })

  if (error) return []
  return data || []
}

// ── Admin: Ubah Status Registrasi ─────────────────────────────────────────────

export async function confirmLmsRegistration(registrationId: string) {
  const orgData = await assertOrgAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from('lms_registrations')
    .update({ status: 'CONFIRMED', updated_at: new Date().toISOString() })
    .eq('id', registrationId)
    .eq('org_id', orgData.org.id)

  if (error) throw new Error(getErrorMessage(error))

  revalidatePath('/lms/registrasi')
  revalidatePath('/lms/admin')
}

export async function cancelLmsRegistration(registrationId: string) {
  const orgData = await assertOrgAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from('lms_registrations')
    .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
    .eq('id', registrationId)
    .eq('org_id', orgData.org.id)

  if (error) throw new Error(getErrorMessage(error))

  revalidatePath('/lms/registrasi')
  revalidatePath('/lms/admin')
}

export async function updateRegistrationPayment(registrationId: string, amountPaid: number, paymentMethod: string) {
  const orgData = await assertOrgAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from('lms_registrations')
    .update({
      status: 'CONFIRMED',
      amount_paid: amountPaid,
      payment_method: paymentMethod,
      updated_at: new Date().toISOString(),
    })
    .eq('id', registrationId)
    .eq('org_id', orgData.org.id)

  if (error) throw new Error(getErrorMessage(error))

  revalidatePath('/lms/registrasi')
  revalidatePath('/lms/admin')
}
