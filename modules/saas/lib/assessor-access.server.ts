import { createAdminClient } from '@/lib/supabase/server'
import { isPlatformAdminEmail, isSaasMemberEmail } from '@/lib/saas/platform-admin'

export type SaasAssessorRecord = {
  id: string
  email: string
  displayName: string | null
  isActive: boolean
  createdAt: string | null
}

type SaasAssessorRow = {
  id?: string | null
  email?: string | null
  display_name?: string | null
  is_active?: boolean | null
  created_at?: string | null
}

type QueryError = { message?: string } | null

type SaasAssessorQuery = {
  select(columns?: string): SaasAssessorQuery
  eq(column: string, value: unknown): SaasAssessorQuery
  order(column: string, options?: { ascending: boolean }): SaasAssessorQuery
  limit(count: number): SaasAssessorQuery
  maybeSingle(): Promise<{ data: SaasAssessorRow | null; error: QueryError }>
  then<TResult1 = { data: SaasAssessorRow[] | null; error: QueryError }, TResult2 = never>(
    onfulfilled?: ((value: { data: SaasAssessorRow[] | null; error: QueryError }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>
}

type SaasAssessorDb = {
  from(table: 'saas_assessors'): SaasAssessorQuery
}

export function normalizeSaasAssessorEmail(email?: string | null) {
  return String(email || '').trim().toLowerCase()
}

export function canRegisterSaasAssessorEmail(email?: string | null) {
  const normalizedEmail = normalizeSaasAssessorEmail(email)
  return Boolean(normalizedEmail) && isSaasMemberEmail(normalizedEmail)
}

function mapAssessorRow(row: SaasAssessorRow): SaasAssessorRecord {
  return {
    id: String(row.id || ''),
    email: normalizeSaasAssessorEmail(row.email),
    displayName: row.display_name ? String(row.display_name) : null,
    isActive: row.is_active !== false,
    createdAt: row.created_at ? String(row.created_at) : null,
  }
}

export async function listSaasAssessors(options: { includeInactive?: boolean } = {}) {
  const admin = await createAdminClient()
  let query = (admin as unknown as SaasAssessorDb)
    .from('saas_assessors')
    .select('id, email, display_name, is_active, created_at')
    .order('created_at', { ascending: false })

  if (!options.includeInactive) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query
  if (error) {
    console.error('[saas-assessors] Failed to list assessors:', error.message)
    return []
  }

  return (data || [])
    .map(mapAssessorRow)
    .filter((record) => record.id && record.email)
}

export async function hasSaasAssessorAccess(email?: string | null) {
  const normalizedEmail = normalizeSaasAssessorEmail(email)
  if (!normalizedEmail) return false

  if (isPlatformAdminEmail(normalizedEmail)) {
    return true
  }

  if (!isSaasMemberEmail(normalizedEmail)) {
    return false
  }

  const admin = await createAdminClient()
  const { data, error } = await (admin as unknown as SaasAssessorDb)
    .from('saas_assessors')
    .select('id, is_active')
    .eq('email', normalizedEmail)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[saas-assessors] Failed to verify assessor access:', error.message)
    return false
  }

  return Boolean(data?.id)
}
