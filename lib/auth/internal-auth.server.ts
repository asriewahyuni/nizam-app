import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { cookies, headers } from 'next/headers'
import { queryPostgres } from '@/lib/db/postgres'
import { INTERNAL_AUTH_SESSION_COOKIE, INTERNAL_AUTH_SESSION_MAX_AGE } from './internal-auth.shared'

const SCRYPT_KEY_LENGTH = 64
const SCRYPT_SALT_BYTES = 16

type InternalAuthSessionRow = {
  session_id: string
  user_id: string
  legacy_user_id: string | null
  expires_at: string
  login_email: string | null
  login_nik: string | null
  display_name: string | null
  user_type: string | null
}

export type InternalAuthSessionUser = {
  id: string
  email: string | null
  user_metadata: Record<string, unknown>
  app_metadata: Record<string, unknown>
}

type InternalAuthSession = {
  sessionId: string
  user: InternalAuthSessionUser
}

type InternalCredentialRow = {
  id: string
  legacy_user_id: string | null
  preferred_org_match: boolean
  active_org_ids: string[] | null
  stored_active_org_id: string | null
  login_email: string | null
  login_nik: string | null
  password_hash: string
  display_name: string | null
  user_type: string | null
  is_active: boolean
}

type InternalAuthUserRow = {
  id: string
  is_active: boolean
}

function normalizeInput(value: unknown) {
  return String(value || '').trim()
}

function normalizeEmail(value: unknown) {
  const normalized = normalizeInput(value).toLowerCase()
  return normalized || null
}

function normalizeNik(value: unknown) {
  const normalized = normalizeInput(value).toUpperCase()
  return normalized || null
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error || '')
}

function resolveInternalAuthDatabaseError(error: unknown, fallbackMessage: string) {
  const message = getErrorMessage(error).toLowerCase()

  if (message.includes('duplicate key')) {
    return 'Akun sudah terdaftar. Silakan login.'
  }

  if (message.includes('password authentication failed')) {
    return 'Koneksi database auth gagal (password PostgreSQL tidak valid).'
  }

  if (
    message.includes('missing database_url') ||
    message.includes('database_public_url') ||
    message.includes('railway_database_url')
  ) {
    return 'Koneksi database auth belum dikonfigurasi.'
  }

  if (
    message.includes('relation "public.internal_auth_users" does not exist') ||
    message.includes('relation "public.internal_auth_sessions" does not exist')
  ) {
    return 'Tabel auth internal belum tersedia. Jalankan migrasi internal auth dahulu.'
  }

  if (
    message.includes('connect') ||
    message.includes('connection terminated') ||
    message.includes('timeout') ||
    message.includes('econnrefused')
  ) {
    return 'Koneksi database auth sedang bermasalah. Coba lagi sebentar.'
  }

  return fallbackMessage
}

function normalizeUuid(value: unknown) {
  const normalized = normalizeInput(value).toLowerCase()
  if (!normalized) return null
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)) {
    return null
  }
  return normalized
}

function getInternalSessionSecret() {
  const secret = normalizeInput(process.env.INTERNAL_AUTH_SESSION_SECRET)
  if (secret) return secret
  return normalizeInput(process.env.NEXTAUTH_SECRET)
}

function hashSessionToken(rawToken: string) {
  const secret = getInternalSessionSecret()
  if (!secret) {
    throw new Error('Missing INTERNAL_AUTH_SESSION_SECRET/NEXTAUTH_SECRET for internal auth sessions.')
  }
  return createHash('sha256').update(`${secret}:${rawToken}`).digest('hex')
}

function hashPasswordWithScrypt(password: string, saltBuffer?: Buffer) {
  const salt = saltBuffer || randomBytes(SCRYPT_SALT_BYTES)
  const derivedKey = scryptSync(password, salt, SCRYPT_KEY_LENGTH)
  return `scrypt$${salt.toString('base64url')}$${derivedKey.toString('base64url')}`
}

function normalizeInternalUserType(value: unknown) {
  const normalized = normalizeInput(value).toLowerCase()
  if (normalized === 'owner' || normalized === 'admin' || normalized === 'staff') return normalized
  return 'staff'
}

async function findInternalAuthUserByIdentity(input: {
  userId?: string | null
  email?: string | null
  nik?: string | null
}) {
  const normalizedUserId = normalizeUuid(input.userId)
  const normalizedEmail = normalizeEmail(input.email)
  const normalizedNik = normalizeNik(input.nik)

  if (!normalizedUserId && !normalizedEmail && !normalizedNik) {
    return null as InternalAuthUserRow | null
  }

  const lookup = await queryPostgres<InternalAuthUserRow>(
    `
      select id::text as id, is_active
      from public.internal_auth_users
      where
        (
          $1::uuid is not null
          and (
            id = $1::uuid
            or legacy_user_id = $1::uuid
          )
        )
        or ($2::text is not null and lower(login_email) = $2::text)
        or ($3::text is not null and upper(login_nik) = $3::text)
      order by
        case
          when $1::uuid is not null and id = $1::uuid then 0
          when $1::uuid is not null and legacy_user_id = $1::uuid then 1
          when $2::text is not null and lower(login_email) = $2::text then 2
          when $3::text is not null and upper(login_nik) = $3::text then 3
          else 4
        end,
        created_at asc
      limit 1
    `,
    [normalizedUserId, normalizedEmail, normalizedNik]
  )

  return lookup.rows[0] || null
}

function verifyScryptPassword(password: string, storedHash: string) {
  const [scheme, saltPart, hashPart] = String(storedHash || '').split('$')
  if (scheme !== 'scrypt' || !saltPart || !hashPart) return false

  const salt = Buffer.from(saltPart, 'base64url')
  const expectedHash = Buffer.from(hashPart, 'base64url')
  const actualHash = scryptSync(password, salt, expectedHash.length)

  if (actualHash.length !== expectedHash.length) return false
  return timingSafeEqual(actualHash, expectedHash)
}

function toInternalSessionUser(row: InternalAuthSessionRow): InternalAuthSessionUser {
  const sessionUserId = normalizeInput(row.legacy_user_id) || row.user_id
  return {
    id: sessionUserId,
    email: normalizeEmail(row.login_email),
    user_metadata: {
      internal_user_id: row.user_id,
      legacy_user_id: normalizeInput(row.legacy_user_id) || null,
      full_name: row.display_name || null,
      login_nik: row.login_nik || null,
      login_type: row.user_type || null,
      auth_provider: 'internal',
    },
    app_metadata: {
      provider: 'internal',
      providers: ['internal'],
    },
  }
}

async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url')
  const tokenHash = hashSessionToken(token)
  const expiresAt = new Date(Date.now() + INTERNAL_AUTH_SESSION_MAX_AGE * 1000).toISOString()
  const requestHeaders = await headers()

  const userAgent = normalizeInput(requestHeaders.get('user-agent')) || null
  const ipAddress =
    normalizeInput(requestHeaders.get('x-forwarded-for')).split(',')[0]?.trim() ||
    normalizeInput(requestHeaders.get('x-real-ip')) ||
    null

  const result = await queryPostgres<{ id: string }>(
    `
      insert into public.internal_auth_sessions (
        user_id,
        token_hash,
        expires_at,
        user_agent,
        ip_address
      )
      values ($1::uuid, $2::text, $3::timestamptz, $4::text, $5::text)
      returning id
    `,
    [userId, tokenHash, expiresAt, userAgent, ipAddress]
  )

  const sessionId = String(result.rows[0]?.id || '').trim()
  if (!sessionId) {
    throw new Error('Gagal membuat sesi internal.')
  }

  const cookieStore = await cookies()
  cookieStore.set(INTERNAL_AUTH_SESSION_COOKIE, token, {
    maxAge: INTERNAL_AUTH_SESSION_MAX_AGE,
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })

  return sessionId
}

export async function createInternalAuthSessionByUserId(internalUserId: string) {
  const normalizedUserId = normalizeUuid(internalUserId)
  if (!normalizedUserId) {
    return { error: 'User internal tidak valid.' as const }
  }

  const result = await queryPostgres<{ id: string; is_active: boolean }>(
    `
      select id::text as id, is_active
      from public.internal_auth_users
      where id = $1::uuid
      limit 1
    `,
    [normalizedUserId]
  )

  const userRow = result.rows[0]
  if (!userRow || !userRow.is_active) {
    return { error: 'Akun internal tidak ditemukan atau nonaktif.' as const }
  }

  const sessionId = await createSession(normalizedUserId)
  await queryPostgres(
    `
      update public.internal_auth_users
      set last_login_at = now()
      where id = $1::uuid
    `,
    [normalizedUserId]
  )

  return {
    success: true as const,
    sessionId,
    userId: normalizedUserId,
  }
}

export async function setInternalAuthLegacyUserId(input: {
  internalUserId: string
  legacyUserId: string
}) {
  const normalizedInternalUserId = normalizeUuid(input.internalUserId)
  const normalizedLegacyUserId = normalizeUuid(input.legacyUserId)

  if (!normalizedInternalUserId || !normalizedLegacyUserId) {
    return { error: 'Identitas user legacy internal tidak valid.' as const }
  }

  try {
    await queryPostgres(
      `
        update public.internal_auth_users
        set
          legacy_user_id = $2::uuid,
          updated_at = now()
        where id = $1::uuid
      `,
      [normalizedInternalUserId, normalizedLegacyUserId]
    )

    return {
      success: true as const,
      internalUserId: normalizedInternalUserId,
      legacyUserId: normalizedLegacyUserId,
    }
  } catch (error) {
    console.error('setInternalAuthLegacyUserId failed:', getErrorMessage(error))
    return {
      error: resolveInternalAuthDatabaseError(error, 'Gagal menautkan akun internal ke auth user legacy.'),
    }
  }
}

export async function ensureInternalAuthUserRecord(input: {
  userId?: string | null
  email?: string | null
  nik?: string | null
  fullName?: string | null
  userType?: string | null
}) {
  const normalizedUserId = normalizeUuid(input.userId)
  const normalizedEmail = normalizeEmail(input.email)
  const normalizedNik = normalizeNik(input.nik)
  const normalizedFullName = normalizeInput(input.fullName) || null
  const normalizedUserType = normalizeInternalUserType(input.userType || 'staff')

  if (!normalizedUserId && !normalizedEmail && !normalizedNik) {
    return { error: 'Identitas akun internal tidak valid.' as const }
  }

  try {
    const existing = await findInternalAuthUserByIdentity({
      userId: normalizedUserId,
      email: normalizedEmail,
      nik: normalizedNik,
    })

    if (existing?.id) {
      await queryPostgres(
        `
          update public.internal_auth_users
          set
            is_active = true,
            updated_at = now()
          where id = $1::uuid
        `,
        [existing.id]
      )

      // Best effort metadata fill; ignored if uniqueness prevents update.
      try {
        await queryPostgres(
          `
            update public.internal_auth_users
            set
              legacy_user_id = case
                when legacy_user_id is null and $2::uuid is not null then $2::uuid
                else legacy_user_id
              end,
              login_email = case
                when login_email is null and $3::text is not null then $3::text
                else login_email
              end,
              login_nik = case
                when login_nik is null and $4::text is not null then $4::text
                else login_nik
              end,
              display_name = case
                when nullif(trim(coalesce(display_name, '')), '') is null and $5::text is not null then $5::text
                else display_name
              end,
              user_type = case
                when nullif(trim(coalesce(user_type, '')), '') is null then $6::text
                else user_type
              end,
              updated_at = now()
            where id = $1::uuid
          `,
          [
            existing.id,
            normalizedUserId,
            normalizedEmail,
            normalizedNik,
            normalizedFullName,
            normalizedUserType,
          ]
        )
      } catch (updateError) {
        console.warn('ensureInternalAuthUserRecord metadata fill skipped:', getErrorMessage(updateError))
      }

      return {
        success: true as const,
        userId: existing.id,
      }
    }

    const fallbackEmail =
      normalizedEmail ||
      (normalizedUserId ? `${normalizedUserId}@owners.nizam.local` : null)

    const randomBootstrapPassword = randomBytes(32).toString('base64url')
    const passwordHash = hashPasswordWithScrypt(randomBootstrapPassword)

    const inserted = await queryPostgres<{ id: string }>(
      `
        insert into public.internal_auth_users (
          legacy_user_id,
          login_email,
          login_nik,
          password_hash,
          display_name,
          user_type,
          is_active
        )
        values (
          $1::uuid,
          $2::text,
          $3::text,
          $4::text,
          $5::text,
          $6::text,
          true
        )
        returning id::text as id
      `,
      [
        normalizedUserId,
        fallbackEmail,
        normalizedNik,
        passwordHash,
        normalizedFullName,
        normalizedUserType,
      ]
    )

    const insertedId = normalizeUuid(inserted.rows[0]?.id)
    if (!insertedId) {
      return { error: 'Gagal menyiapkan akun internal owner.' as const }
    }

    return {
      success: true as const,
      userId: insertedId,
    }
  } catch (error) {
    const duplicate = getErrorMessage(error).toLowerCase().includes('duplicate key')
    if (duplicate) {
      const recovered = await findInternalAuthUserByIdentity({
        userId: normalizedUserId,
        email: normalizedEmail,
        nik: normalizedNik,
      })

      const recoveredId = normalizeUuid(recovered?.id)
      if (recoveredId) {
        return {
          success: true as const,
          userId: recoveredId,
        }
      }
    }

    console.error('ensureInternalAuthUserRecord failed:', getErrorMessage(error))
    return {
      error: resolveInternalAuthDatabaseError(error, 'Gagal menyiapkan akun internal.'),
    }
  }
}

export async function createInternalAuthUser(input: {
  email?: string | null
  nik?: string | null
  password: string
  fullName?: string | null
  userType?: string | null
  legacyUserId?: string | null
}) {
  const normalizedEmail = normalizeEmail(input.email)
  const normalizedNik = normalizeNik(input.nik)
  const normalizedPassword = normalizeInput(input.password)
  const normalizedFullName = normalizeInput(input.fullName)
  const normalizedUserType = normalizeInput(input.userType || 'owner').toLowerCase() || 'owner'
  const normalizedLegacyUserId = normalizeInput(input.legacyUserId) || null

  if (!normalizedEmail && !normalizedNik) {
    return { error: 'Email atau NIK wajib diisi.' as const }
  }
  if (normalizedPassword.length < 8) {
    return { error: 'Password minimal 8 karakter.' as const }
  }

  const passwordHash = hashPasswordWithScrypt(normalizedPassword)

  try {
    // Tentukan legacy_user_id agar org_members.user_id langsung cocok saat query.
    // Priority: (1) input legacyUserId, (2) auth.users existing by email, (3) buat entry baru.
    let resolvedLegacyUserId = normalizeUuid(normalizedLegacyUserId)

    if (!resolvedLegacyUserId && normalizedEmail) {
      const authUserLookup = await queryPostgres<{ id: string }>(
        `SELECT id::text as id FROM auth.users WHERE lower(email) = $1::text LIMIT 1`,
        [normalizedEmail.toLowerCase()]
      )
      if (authUserLookup.rows[0]?.id) {
        resolvedLegacyUserId = normalizeUuid(authUserLookup.rows[0].id)
      }
    }

    if (!resolvedLegacyUserId) {
      const newAuthUserId = crypto.randomUUID()
      await queryPostgres(
        `
          INSERT INTO auth.users (id, email, aud, role, created_at, updated_at)
          VALUES ($1::uuid, $2::text, 'authenticated', 'authenticated', now(), now())
          ON CONFLICT (id) DO NOTHING
        `,
        [newAuthUserId, normalizedEmail]
      )
      resolvedLegacyUserId = newAuthUserId
    }

    const result = await queryPostgres<{ id: string }>(
      `
        insert into public.internal_auth_users (
          legacy_user_id,
          login_email,
          login_nik,
          password_hash,
          display_name,
          user_type,
          is_active
        )
        values (
          $1::uuid,
          $2::text,
          $3::text,
          $4::text,
          $5::text,
          $6::text,
          true
        )
        returning id
      `,
      [
        resolvedLegacyUserId,
        normalizedEmail,
        normalizedNik,
        passwordHash,
        normalizedFullName || null,
        normalizedUserType,
      ]
    )

    const userId = String(result.rows[0]?.id || '').trim()
    if (!userId) {
      return { error: 'Gagal membuat user internal.' as const }
    }

    // Session dibuat dengan internal user id; toInternalSessionUser() akan menggunakan
    // legacy_user_id sebagai user.id — cocok dengan org_members.user_id.
    await createSession(userId)

    return {
      success: true as const,
      userId: resolvedLegacyUserId ?? userId,
      internalUserId: userId,
      email: normalizedEmail,
      nik: normalizedNik,
    }
  } catch (error) {
    console.error('createInternalAuthUser failed:', getErrorMessage(error))
    return {
      error: resolveInternalAuthDatabaseError(error, 'Gagal membuat user internal.'),
    }
  }
}
export async function signInWithInternalAuth(input: {
  email?: string | null
  nik?: string | null
  password: string
  preferredOrgId?: string | null
}) {
  const email = normalizeEmail(input.email)
  const nik = normalizeNik(input.nik)
  const password = normalizeInput(input.password)
  const preferredOrgId = normalizeUuid(input.preferredOrgId)

  if ((!email && !nik) || !password) {
    return { error: 'Kredensial login tidak lengkap.' as const }
  }

  try {
    const result = await queryPostgres<InternalCredentialRow>(
      `
        select
          id,
          legacy_user_id::text,
          (
            $3::uuid is not null and exists (
              select 1
              from public.org_members om
              where
                om.user_id = coalesce(legacy_user_id, id)
                and om.org_id = $3::uuid
                and om.is_active = true
            )
          ) as preferred_org_match,
          (
            select array_agg(distinct om.org_id::text)
            from public.org_members om
            where
              om.user_id = coalesce(legacy_user_id, id)
              and om.is_active = true
          ) as active_org_ids,
          (
            select om.org_id::text
            from public.org_members om
            where
              om.user_id = coalesce(legacy_user_id, id)
              and om.is_active = true
            order by om.last_active_at desc nulls last, om.joined_at asc, om.org_id asc
            limit 1
          ) as stored_active_org_id,
          login_email,
          login_nik,
          password_hash,
          display_name,
          user_type,
          is_active
        from public.internal_auth_users
        where
          ($1::text is not null and lower(login_email) = $1::text)
          or (
            $2::text is not null
            and (
              upper(login_nik) = $2::text
              or legacy_user_id in (
                select e.user_id
                from public.employees e
                where
                  e.user_id is not null
                  and upper(trim(coalesce(e.nik, ''))) = $2::text
              )
            )
          )
        order by
          case
            when $1::text is not null and lower(login_email) = $1::text then 0
            when $2::text is not null and upper(login_nik) = $2::text then 1
            when $3::uuid is not null and exists (
              select 1
              from public.org_members om
              where
                om.user_id = coalesce(legacy_user_id, id)
                and om.org_id = $3::uuid
                and om.is_active = true
            ) then 2
            else 2
          end,
          created_at asc
        limit 10
      `,
      [email, nik, preferredOrgId]
    )

    const candidates = result.rows.filter((row) => row && row.is_active)
    if (candidates.length === 0) return { error: 'Email/NIK atau password salah.' as const }

    const passwordMatched: InternalCredentialRow[] = []
    for (const candidate of candidates) {
      if (verifyScryptPassword(password, candidate.password_hash)) {
        passwordMatched.push(candidate)
      }
    }
    if (passwordMatched.length === 0) return { error: 'Email/NIK atau password salah.' as const }

    let matched: InternalCredentialRow | null = passwordMatched[0] || null

    if (!email && nik && passwordMatched.length > 1) {
      if (preferredOrgId) {
        const matchedByPreferredOrg = passwordMatched.filter((candidate) => candidate.preferred_org_match)
        if (matchedByPreferredOrg.length === 1) {
          matched = matchedByPreferredOrg[0]
        } else if (matchedByPreferredOrg.length > 1) {
          return { error: 'NIK terhubung ke lebih dari satu akun pada organisasi yang sama. Gunakan login email.' as const }
        } else {
          return { error: 'NIK ditemukan di organisasi lain. Isi ID organisasi yang benar atau login email.' as const }
        }
      } else {
        const exactNikCandidates = passwordMatched.filter((candidate) => normalizeNik(candidate.login_nik) === nik)
        if (exactNikCandidates.length === 1) {
          matched = exactNikCandidates[0]
        } else {
          return { error: 'NIK terhubung ke lebih dari satu organisasi. Isi ID organisasi atau login email.' as const }
        }
      }
    }

    if (!matched) return { error: 'Email/NIK atau password salah.' as const }

    const sessionId = await createSession(matched.id)
    await queryPostgres(
      `
        update public.internal_auth_users
        set last_login_at = now()
        where id = $1::uuid
      `,
      [matched.id]
    )

    const resolvedOrgId =
      preferredOrgId && matched.preferred_org_match
        ? preferredOrgId
        : (normalizeInput(matched.stored_active_org_id) ||
          (Array.isArray(matched.active_org_ids) && matched.active_org_ids.length === 1
            ? normalizeInput(matched.active_org_ids[0])
            : null))

    return {
      success: true as const,
      sessionId,
      userId: matched.id,
      email: matched.login_email,
      nik: matched.login_nik,
      resolvedOrgId: resolvedOrgId || null,
    }
  } catch (error) {
    console.error('signInWithInternalAuth failed:', getErrorMessage(error))
    return {
      error: resolveInternalAuthDatabaseError(error, 'Gagal membuat sesi internal. Cek konfigurasi server.'),
    }
  }
}

export async function getInternalAuthSession(): Promise<InternalAuthSession | null> {
  const cookieStore = await cookies()
  const rawToken = normalizeInput(cookieStore.get(INTERNAL_AUTH_SESSION_COOKIE)?.value)
  if (!rawToken) return null

  const tokenHash = hashSessionToken(rawToken)

  const result = await queryPostgres<InternalAuthSessionRow>(
    `
      select
        s.id as session_id,
        s.user_id::text,
        u.legacy_user_id::text,
        s.expires_at::text,
        u.login_email,
        u.login_nik,
        u.display_name,
        u.user_type
      from public.internal_auth_sessions s
      join public.internal_auth_users u on u.id = s.user_id
      where
        s.token_hash = $1::text
        and s.expires_at > now()
        and u.is_active = true
      limit 1
    `,
    [tokenHash]
  )

  const row = result.rows[0]
  if (!row) {
    // Session expired or not found — return null without touching cookies
    // (cookies can only be modified in Server Actions, not Server Components)
    return null
  }

  await queryPostgres(
    `
      update public.internal_auth_sessions
      set last_seen_at = now()
      where id = $1::uuid
    `,
    [row.session_id]
  )

  return {
    sessionId: row.session_id,
    user: toInternalSessionUser(row),
  }
}

export async function signOutInternalAuth() {
  const cookieStore = await cookies()
  const rawToken = normalizeInput(cookieStore.get(INTERNAL_AUTH_SESSION_COOKIE)?.value)

  if (rawToken) {
    const tokenHash = hashSessionToken(rawToken)
    await queryPostgres(
      `
        delete from public.internal_auth_sessions
        where token_hash = $1::text
      `,
      [tokenHash]
    )
  }

  cookieStore.delete(INTERNAL_AUTH_SESSION_COOKIE)
}
