'use server'

/**
 * Klaim akun checkout tamu memakai token sekali pakai yang disimpan sebagai hash.
 */
import { createHash } from 'node:crypto'
import {
  createInternalAuthSessionByUserId,
  hashPasswordWithScrypt,
} from '@/lib/auth/internal-auth.server'
import { connectPostgresClient } from '@/lib/db/postgres'

export type AccountClaimState = {
  error?: string
  success?: boolean
}
function clean(value: FormDataEntryValue | null, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export async function claimMemberAccount(
  _previous: AccountClaimState,
  formData: FormData,
): Promise<AccountClaimState> {
  const orgSlug = clean(formData.get('orgSlug'), 120)
  const token = clean(formData.get('token'), 200)
  const password = clean(formData.get('password'), 200)
  const passwordConfirmation = clean(formData.get('passwordConfirmation'), 200)
  if (!orgSlug || !token) return { error: 'Tautan klaim akun tidak valid.' }
  if (password.length < 8) return { error: 'Password minimal 8 karakter.' }
  if (password !== passwordConfirmation) return { error: 'Konfirmasi password belum sama.' }

  const client = await connectPostgresClient()
  try {
    await client.query('BEGIN')
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const claim = await client.query<{ id: string; internal_user_id: string }>(
      `SELECT claim.id::text, claim.internal_user_id::text
       FROM public.internal_auth_account_claims claim
       JOIN public.organizations organization
         ON organization.id = claim.org_id
        AND organization.slug = $1
       WHERE claim.token_hash = $2
         AND claim.used_at IS NULL
         AND claim.expires_at > NOW()
       LIMIT 1
       FOR UPDATE OF claim`,
      [orgSlug, tokenHash],
    )
    const row = claim.rows[0]
    if (!row) throw new Error('Tautan sudah tidak berlaku atau sudah pernah digunakan.')

    await client.query(
      `UPDATE public.internal_auth_users
       SET password_hash = $2, is_active = TRUE, updated_at = NOW()
       WHERE id = $1::uuid`,
      [row.internal_user_id, hashPasswordWithScrypt(password)],
    )
    await client.query(
      `UPDATE public.internal_auth_account_claims
       SET used_at = NOW()
       WHERE id = $1::uuid`,
      [row.id],
    )
    await client.query('COMMIT')

    const session = await createInternalAuthSessionByUserId(row.internal_user_id)
    if ('error' in session) return { error: session.error }
    return { success: true }
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {
      // Transaksi mungkin sudah selesai.
    }
    return {
      error: error instanceof Error
        ? error.message
        : 'Akun belum berhasil diaktifkan.',
    }
  } finally {
    client.release()
  }
}
