'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { isPlatformAdminEmail } from '@/lib/saas/platform-admin'
import {
  canRegisterSaasAssessorEmail,
  listSaasAssessors,
  normalizeSaasAssessorEmail,
  type SaasAssessorRecord,
} from '@/modules/saas/lib/assessor-access.server'

export type { SaasAssessorRecord } from '@/modules/saas/lib/assessor-access.server'

type AssessorMutationResult = {
  success?: boolean
  error?: string
}

type AssessorSnapshot = {
  assessors: SaasAssessorRecord[]
  error?: string
}

type AssessorWriteError = { message?: string } | null

type AssessorWriteQuery = {
  upsert(values: unknown, options?: Record<string, unknown>): Promise<{ error: AssessorWriteError }>
  update(values: unknown): AssessorWriteQuery
  delete(): AssessorWriteQuery
  eq(column: string, value: unknown): AssessorWriteQuery
  then<TResult1 = { error: AssessorWriteError }, TResult2 = never>(
    onfulfilled?: ((value: { error: AssessorWriteError }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>
}

type AssessorWriteDb = {
  from(table: 'saas_assessors'): AssessorWriteQuery
}

function normalizeText(value: FormDataEntryValue | null) {
  return String(value || '').trim()
}

async function requirePlatformAdminActor() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  const user = data.user

  if (error || !user?.id) {
    return { error: 'Sesi SaaS admin tidak ditemukan. Silakan login ulang.' as const }
  }

  if (!isPlatformAdminEmail(user.email)) {
    return { error: 'Akses ditolak. Hanya SaaS admin yang dapat mengelola assessor.' as const }
  }

  return { user }
}

export async function getSaasAssessorAdminSnapshot(): Promise<AssessorSnapshot> {
  const actor = await requirePlatformAdminActor()
  if ('error' in actor) {
    return { assessors: [], error: actor.error }
  }

  return {
    assessors: await listSaasAssessors({ includeInactive: true }),
  }
}

export async function addSaasAssessor(formData: FormData): Promise<AssessorMutationResult> {
  const actor = await requirePlatformAdminActor()
  if ('error' in actor) return { error: actor.error }

  const email = normalizeSaasAssessorEmail(normalizeText(formData.get('email')))
  const displayName = normalizeText(formData.get('display_name'))

  if (!email) {
    return { error: 'Email assessor wajib diisi.' }
  }

  if (!canRegisterSaasAssessorEmail(email)) {
    return { error: 'Assessor harus memakai email member SaaS, bukan email tenant.' }
  }

  const admin = await createAdminClient()
  const { error } = await (admin as unknown as AssessorWriteDb)
    .from('saas_assessors')
    .upsert({
      email,
      display_name: displayName || null,
      is_active: true,
      created_by_user_id: actor.user.id,
    }, { onConflict: 'email' })

  if (error) {
    return { error: `Gagal menambahkan assessor: ${error.message || 'Unknown error'}` }
  }

  revalidatePath('/admin')
  revalidatePath('/learning')
  return { success: true }
}

export async function setSaasAssessorActive(id: string, isActive: boolean): Promise<AssessorMutationResult> {
  const actor = await requirePlatformAdminActor()
  if ('error' in actor) return { error: actor.error }

  const assessorId = String(id || '').trim()
  if (!assessorId) return { error: 'Assessor tidak valid.' }

  const admin = await createAdminClient()
  const { error } = await (admin as unknown as AssessorWriteDb)
    .from('saas_assessors')
    .update({ is_active: Boolean(isActive) })
    .eq('id', assessorId)

  if (error) {
    return { error: `Gagal mengubah status assessor: ${error.message || 'Unknown error'}` }
  }

  revalidatePath('/admin')
  revalidatePath('/learning')
  return { success: true }
}

export async function deleteSaasAssessor(id: string): Promise<AssessorMutationResult> {
  const actor = await requirePlatformAdminActor()
  if ('error' in actor) return { error: actor.error }

  const assessorId = String(id || '').trim()
  if (!assessorId) return { error: 'Assessor tidak valid.' }

  const admin = await createAdminClient()
  const { error } = await (admin as unknown as AssessorWriteDb)
    .from('saas_assessors')
    .delete()
    .eq('id', assessorId)

  if (error) {
    return { error: `Gagal menghapus assessor: ${error.message || 'Unknown error'}` }
  }

  revalidatePath('/admin')
  revalidatePath('/learning')
  return { success: true }
}
