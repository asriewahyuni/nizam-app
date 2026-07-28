'use server'

/**
 * Impersonation admin LMS ke member portal ("Login sebagai Member") — admin
 * bisa melihat portal persis seperti member tsb, lalu kembali ke sesi admin
 * semula lewat cookie cadangan sendiri (terpisah dari impersonation
 * platform-admin/HRIS yang sudah ada di modules/auth/actions/auth.actions.ts,
 * supaya tidak saling bersinggungan).
 */
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { queryPostgres } from '@/lib/db/postgres'
import {
  createInternalAuthSessionByUserId,
  getInternalAuthSession,
} from '@/lib/auth/internal-auth.server'
import { INTERNAL_AUTH_SESSION_COOKIE, INTERNAL_AUTH_SESSION_MAX_AGE } from '@/lib/auth/internal-auth.shared'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'

const LMS_IMPERSONATION_COOKIE = 'nizam_lms_member_impersonation'
const LMS_IMPERSONATION_MAX_AGE = 60 * 60 * 4 // 4 jam

type LmsImpersonationPayload = {
  backupSessionToken: string
  adminUserId: string
  adminEmail: string
  orgId: string
  orgSlug: string
}

function encodePayload(payload: LmsImpersonationPayload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

function decodePayload(raw?: string | null): LmsImpersonationPayload | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<LmsImpersonationPayload>
    if (!parsed.backupSessionToken || !parsed.adminUserId || !parsed.orgId || !parsed.orgSlug) return null
    return {
      backupSessionToken: parsed.backupSessionToken,
      adminUserId: parsed.adminUserId,
      adminEmail: parsed.adminEmail || '',
      orgId: parsed.orgId,
      orgSlug: parsed.orgSlug,
    }
  } catch {
    return null
  }
}

function impersonationCookieOptions(maxAge: number) {
  return {
    maxAge,
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
  }
}

async function logImpersonationEvent(input: {
  orgId: string
  actorUserId: string
  action: 'IMPERSONATE_START' | 'IMPERSONATE_END'
  targetUserId?: string | null
  meta?: Record<string, unknown>
}) {
  try {
    await queryPostgres(
      `INSERT INTO public.audit_logs (org_id, user_id, action, table_name, record_id, new_data, user_agent)
       VALUES ($1::uuid, $2::uuid, $3, 'LMS_MEMBER_IMPERSONATION', $4::uuid, $5::jsonb, 'NIZAM LMS Admin')`,
      [
        input.orgId,
        input.actorUserId,
        input.action,
        input.targetUserId || null,
        JSON.stringify(input.meta || {}),
      ],
    )
  } catch {
    // Kegagalan pencatatan log tidak boleh menghentikan alur impersonation.
  }
}

export async function impersonateLmsMemberAction(orgSlug: string, targetUserId: string) {
  const trimmedTargetUserId = String(targetUserId || '').trim()
  if (!trimmedTargetUserId) return { error: 'Member tidak valid.' }

  const orgData = await getActiveOrg()
  if (!orgData?.org?.id) return { error: 'Sesi tidak valid.' }
  if (!['owner', 'admin', 'manager'].includes(orgData.role)) {
    return { error: 'Hanya admin yang dapat login sebagai member.' }
  }
  const orgId = orgData.org.id

  const session = await getInternalAuthSession()
  if (!session?.user?.id) return { error: 'Sesi admin tidak ditemukan.' }

  // Pastikan target benar-benar member aktif di organisasi ini (defense-in-depth,
  // di luar filter yang sudah dilakukan di daftar member admin).
  const memberCheck = await queryPostgres<{ user_id: string }>(
    `SELECT user_id::text FROM public.org_members
     WHERE org_id = $1::uuid AND user_id = $2::uuid AND is_active = true
     LIMIT 1`,
    [orgId, trimmedTargetUserId],
  )
  if (!memberCheck.rows[0]) {
    return { error: 'Member tidak ditemukan atau tidak aktif di organisasi ini.' }
  }

  // org_members.user_id bisa berupa legacy_user_id ATAU internal_auth_users.id langsung —
  // resolve dulu ke internal_auth_users.id yang sebenarnya dipakai createInternalAuthSessionByUserId.
  const resolvedTarget = await queryPostgres<{ id: string }>(
    `SELECT id::text FROM public.internal_auth_users
     WHERE (id = $1::uuid OR legacy_user_id = $1::uuid) AND is_active = true
     ORDER BY CASE WHEN id = $1::uuid THEN 0 ELSE 1 END
     LIMIT 1`,
    [trimmedTargetUserId],
  )
  const resolvedTargetId = resolvedTarget.rows[0]?.id
  if (!resolvedTargetId) {
    return { error: 'Akun internal member ini tidak ditemukan.' }
  }
  if (resolvedTargetId === session.user.id) {
    return { error: 'Anda sudah login sebagai akun ini.' }
  }

  const cookieStore = await cookies()
  const backupSessionToken = String(cookieStore.get(INTERNAL_AUTH_SESSION_COOKIE)?.value || '').trim()
  if (!backupSessionToken) return { error: 'Sesi admin tidak ditemukan.' }

  cookieStore.set(
    LMS_IMPERSONATION_COOKIE,
    encodePayload({
      backupSessionToken,
      adminUserId: session.user.id,
      adminEmail: session.user.email || '',
      orgId,
      orgSlug,
    }),
    impersonationCookieOptions(LMS_IMPERSONATION_MAX_AGE),
  )

  const switched = await createInternalAuthSessionByUserId(resolvedTargetId)
  if ('error' in switched) {
    cookieStore.delete(LMS_IMPERSONATION_COOKIE)
    return { error: `Gagal login sebagai member: ${switched.error}` }
  }

  await logImpersonationEvent({
    orgId,
    actorUserId: session.user.id,
    action: 'IMPERSONATE_START',
    targetUserId: resolvedTargetId,
    meta: { adminEmail: session.user.email, targetUserId: resolvedTargetId },
  })

  redirect(`/member/${orgSlug}`)
}

export async function restoreLmsAdminSessionAction() {
  const cookieStore = await cookies()
  const payload = decodePayload(cookieStore.get(LMS_IMPERSONATION_COOKIE)?.value)
  if (!payload) return { error: 'Sesi admin cadangan tidak ditemukan atau sudah kedaluwarsa.' }

  cookieStore.set(
    INTERNAL_AUTH_SESSION_COOKIE,
    payload.backupSessionToken,
    impersonationCookieOptions(INTERNAL_AUTH_SESSION_MAX_AGE),
  )

  const restoredSession = await getInternalAuthSession()
  if (!restoredSession?.user?.id) {
    cookieStore.delete(INTERNAL_AUTH_SESSION_COOKIE)
    cookieStore.delete(LMS_IMPERSONATION_COOKIE)
    return { error: 'Sesi admin cadangan tidak valid atau sudah berakhir.' }
  }

  cookieStore.delete(LMS_IMPERSONATION_COOKIE)

  await logImpersonationEvent({
    orgId: payload.orgId,
    actorUserId: restoredSession.user.id,
    action: 'IMPERSONATE_END',
    meta: { adminEmail: payload.adminEmail },
  })

  redirect('/lms/admin/members')
}

export async function getLmsMemberImpersonationState() {
  const cookieStore = await cookies()
  const payload = decodePayload(cookieStore.get(LMS_IMPERSONATION_COOKIE)?.value)
  if (!payload) return null
  return { adminEmail: payload.adminEmail, orgId: payload.orgId }
}
