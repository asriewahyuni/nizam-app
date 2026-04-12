/**
 * Shadow auth bridge: memastikan setiap internal_auth_user punya entri yang
 * sesuai di org_members (via legacy_user_id).
 *
 * Di Railway mode (internal auth provider), kita tidak perlu membuat user
 * di Supabase auth. Cukup pastikan legacy_user_id di internal_auth_users
 * sudah terpetakan ke auth.users (Railway), dan gunakan itu sebagai authUserId.
 */

import { queryPostgres } from '@/lib/db/postgres'
import { setInternalAuthLegacyUserId } from './internal-auth.server'

function normalizeEmail(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return normalized || null
}

function normalizeUuid(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (!normalized) return null
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)) {
    return null
  }
  return normalized
}

async function findAuthUserIdByEmailInPostgres(email: string): Promise<string | null> {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) return null

  try {
    const result = await queryPostgres<{ id: string }>(
      `SELECT id::text as id FROM auth.users WHERE lower(email) = $1::text LIMIT 1`,
      [normalizedEmail]
    )
    return result.rows[0]?.id ?? null
  } catch {
    return null
  }
}

async function createAuthUserInPostgres(email: string): Promise<string | null> {
  try {
    const newId = crypto.randomUUID()
    await queryPostgres(
      `
        INSERT INTO auth.users (id, email, aud, role, created_at, updated_at)
        VALUES ($1::uuid, $2::text, 'authenticated', 'authenticated', now(), now())
        ON CONFLICT (id) DO NOTHING
      `,
      [newId, email]
    )
    return newId
  } catch (err) {
    console.error('createAuthUserInPostgres failed:', err instanceof Error ? err.message : String(err))
    return null
  }
}

export async function ensureShadowAuthUserForInternalUser(input: {
  internalUserId?: string | null
  currentAuthUserId?: string | null
  email?: string | null
  fullName?: string | null
  loginType?: string | null
}) {
  const normalizedInternalUserId = normalizeUuid(input.internalUserId)
  const normalizedCurrentAuthUserId = normalizeUuid(input.currentAuthUserId)
  const normalizedEmail = normalizeEmail(input.email)

  // Jika currentAuthUserId sudah ada dan valid (= legacy_user_id), langsung pakai.
  if (normalizedCurrentAuthUserId) {
    return {
      success: true as const,
      authUserId: normalizedCurrentAuthUserId,
      created: false,
    }
  }

  if (!normalizedInternalUserId) {
    return { error: 'Internal user ID tidak valid.' as const }
  }

  try {
    // Cek apakah internal_auth_users sudah punya legacy_user_id
    const userRow = await queryPostgres<{ legacy_user_id: string | null }>(
      `SELECT legacy_user_id::text FROM public.internal_auth_users WHERE id = $1::uuid LIMIT 1`,
      [normalizedInternalUserId]
    )

    const existingLegacyId = normalizeUuid(userRow.rows[0]?.legacy_user_id)
    if (existingLegacyId) {
      return {
        success: true as const,
        authUserId: existingLegacyId,
        created: false,
      }
    }

    // Harus buat legacy_user_id
    if (!normalizedEmail) {
      return { error: 'Email user internal belum tersedia untuk bootstrap auth.' as const }
    }

    // Cari atau buat di auth.users (Railway)
    let authUserId = await findAuthUserIdByEmailInPostgres(normalizedEmail)
    let created = false

    if (!authUserId) {
      authUserId = await createAuthUserInPostgres(normalizedEmail)
      created = Boolean(authUserId)
    }

    const normalizedAuthUserId = normalizeUuid(authUserId)
    if (!normalizedAuthUserId) {
      return { error: 'Auth user shadow tidak berhasil dibuat di Railway.' as const }
    }

    // Tautkan legacy_user_id
    const linkResult = await setInternalAuthLegacyUserId({
      internalUserId: normalizedInternalUserId,
      legacyUserId: normalizedAuthUserId,
    })
    if ('error' in linkResult) {
      return { error: linkResult.error }
    }

    return {
      success: true as const,
      authUserId: normalizedAuthUserId,
      created,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || '')
    return { error: message || 'Gagal menautkan auth user shadow.' }
  }
}
