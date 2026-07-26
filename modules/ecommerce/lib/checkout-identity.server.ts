/**
 * Identitas checkout bersama untuk portal member dan toko publik LMS.
 * Akun baru tidak dapat dipakai sebelum pemilik mengklaimnya lewat tautan sekali pakai.
 */
import 'server-only'

import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { PoolClient } from 'pg'
import { hashPasswordWithScrypt } from '@/lib/auth/internal-auth.server'

export type CheckoutIdentity = {
  userId: string
  internalUserId: string
  email: string
  name: string
  phone: string
  created: boolean
}

export function normalizeCheckoutEmail(value: string): string {
  const normalized = value.trim().toLowerCase().slice(0, 200)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : ''
}

export function normalizeCheckoutPhone(value: string): string {
  return value.replace(/[^\d+]/g, '').slice(0, 30)
}

function appBaseUrl() {
  const configured = String(process.env.NEXT_PUBLIC_APP_URL || '').trim()
  return configured ? configured.replace(/\/+$/, '') : 'https://member.coreisec.id'
}

export async function ensureCheckoutIdentity(
  client: PoolClient,
  input: {
    orgId: string
    fullName: string
    email: string
    phone: string
  },
): Promise<CheckoutIdentity> {
  await client.query(
    `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
    [`guest-checkout:${input.email}`],
  )
  const existing = await client.query<{
    id: string
    legacy_user_id: string | null
  }>(
    `SELECT id::text, legacy_user_id::text
     FROM public.internal_auth_users
     WHERE lower(login_email) = $1
     ORDER BY created_at
     LIMIT 1
     FOR UPDATE`,
    [input.email],
  )

  let internalUserId = existing.rows[0]?.id || null
  let authUserId = existing.rows[0]?.legacy_user_id || null
  const created = !internalUserId

  if (!authUserId) {
    const authUser = await client.query<{ id: string }>(
      `SELECT id::text
       FROM auth.users
       WHERE lower(email) = $1
       ORDER BY created_at
       LIMIT 1`,
      [input.email],
    )
    authUserId = authUser.rows[0]?.id || randomUUID()
    await client.query(
      `INSERT INTO auth.users (id, email, aud, role, created_at, updated_at)
       VALUES ($1::uuid, $2, 'authenticated', 'authenticated', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [authUserId, input.email],
    )
  }

  if (!internalUserId) {
    const bootstrapPassword = hashPasswordWithScrypt(randomBytes(32).toString('base64url'))
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO public.internal_auth_users (
         legacy_user_id, login_email, password_hash, display_name,
         user_type, is_active
       ) VALUES (
         $1::uuid, $2, $3, $4, 'member', TRUE
       )
       ON CONFLICT (login_email) DO UPDATE
       SET
         display_name = CASE
           WHEN NULLIF(TRIM(public.internal_auth_users.display_name), '') IS NULL
             THEN EXCLUDED.display_name
           ELSE public.internal_auth_users.display_name
         END,
         is_active = TRUE,
         updated_at = NOW()
       RETURNING id::text`,
      [authUserId, input.email, bootstrapPassword, input.fullName],
    )
    internalUserId = inserted.rows[0].id
  } else if (!existing.rows[0]?.legacy_user_id) {
    await client.query(
      `UPDATE public.internal_auth_users
       SET legacy_user_id = $2::uuid, updated_at = NOW()
       WHERE id = $1::uuid`,
      [internalUserId, authUserId],
    )
  }

  await client.query(
    `INSERT INTO public.org_members (org_id, user_id, role, is_active)
     VALUES ($1::uuid, $2::uuid, 'viewer', TRUE)
     ON CONFLICT (org_id, user_id) DO UPDATE
     SET is_active = TRUE`,
    [input.orgId, authUserId],
  )

  return {
    userId: authUserId,
    internalUserId,
    email: input.email,
    name: input.fullName,
    phone: input.phone,
    created,
  }
}

export async function enqueueCheckoutAccountClaim(
  client: PoolClient,
  input: {
    orgId: string
    orgSlug: string
    orderId: string
    orderNumber: string
    identity: CheckoutIdentity
  },
) {
  if (!input.identity.created || !input.identity.internalUserId) return

  const claimToken = randomBytes(32).toString('base64url')
  const claimTokenHash = createHash('sha256').update(claimToken).digest('hex')
  const claim = await client.query<{ id: string }>(
    `INSERT INTO public.internal_auth_account_claims (
       org_id, internal_user_id, auth_user_id, order_id,
       token_hash, expires_at
     ) VALUES (
       $1::uuid, $2::uuid, $3::uuid, $4::uuid,
       $5, NOW() + INTERVAL '48 hours'
     )
     RETURNING id::text`,
    [
      input.orgId,
      input.identity.internalUserId,
      input.identity.userId,
      input.orderId,
      claimTokenHash,
    ],
  )
  const claimUrl = `${appBaseUrl()}/member/${input.orgSlug}/klaim-akun?token=${encodeURIComponent(claimToken)}`
  await client.query(
    `INSERT INTO public.notification_outbox (
       org_id, user_id, event_type, channel, recipient,
       subject, body, payload, idempotency_key
     ) VALUES (
       $1::uuid, $2::uuid, 'ACCOUNT_CLAIM_CREATED', 'EMAIL', $3,
       'Aktifkan akun belajar Anda',
       $4, $5::jsonb, $6
     )
     ON CONFLICT (org_id, idempotency_key) DO NOTHING`,
    [
      input.orgId,
      input.identity.userId,
      input.identity.email,
      `Halo ${input.identity.name}, aktifkan akun belajar Anda melalui tautan ini: ${claimUrl}. Tautan berlaku 48 jam dan hanya dapat dipakai sekali.`,
      JSON.stringify({
        claimId: claim.rows[0].id,
        orderId: input.orderId,
        orderNumber: input.orderNumber,
      }),
      `account-claim:${claim.rows[0].id}`,
    ],
  )
}
