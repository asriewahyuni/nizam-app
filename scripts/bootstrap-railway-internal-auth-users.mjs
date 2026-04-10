#!/usr/bin/env node

import process from 'node:process'
import { existsSync, readFileSync } from 'node:fs'
import { randomBytes, scryptSync } from 'node:crypto'
import { Client } from 'pg'
import nextEnv from '@next/env'

const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd())

const SCRYPT_KEY_LENGTH = 64
const SCRYPT_SALT_BYTES = 16

function parseArgs(argv) {
  const args = {
    apply: false,
    dbUrl: '',
    password: '',
    resetPasswords: false,
    help: false,
  }

  for (let index = 2; index < argv.length; index += 1) {
    const current = String(argv[index] || '').trim()
    if (!current) continue

    if (current === '--help' || current === '-h') {
      args.help = true
      continue
    }

    if (current === '--apply') {
      args.apply = true
      continue
    }

    if (current === '--reset-passwords') {
      args.resetPasswords = true
      continue
    }

    if (current === '--db-url') {
      args.dbUrl = String(argv[index + 1] || '').trim()
      index += 1
      continue
    }

    if (current === '--password') {
      args.password = String(argv[index + 1] || '').trim()
      index += 1
      continue
    }

    throw new Error(`Unknown argument: ${current}`)
  }

  return args
}

function printHelp() {
  console.log(`
Bootstrap internal auth users in Railway Postgres.

Usage:
  node scripts/bootstrap-railway-internal-auth-users.mjs [--apply] [--reset-passwords] [--password <temp-password>] [--db-url <postgres-url>]

Notes:
  - Default mode is dry-run preview.
  - --apply writes data to public.internal_auth_users.
  - --password (or INTERNAL_AUTH_BOOTSTRAP_PASSWORD env) is required only when inserting new users
    or when --reset-passwords is enabled.
  - --reset-passwords forces existing internal users to receive the new password hash.
`)
}

function normalizeInput(value) {
  return String(value || '').trim()
}

function normalizeEmail(value) {
  const normalized = normalizeInput(value).toLowerCase()
  return normalized || null
}

function normalizeNik(value) {
  const normalized = normalizeInput(value).toUpperCase()
  return normalized || null
}

function resolveDbUrl(cliDbUrl) {
  const fromCli = normalizeInput(cliDbUrl)
  if (fromCli) return fromCli

  const fromEnv =
    normalizeInput(process.env.RAILWAY_DATABASE_URL) ||
    normalizeInput(process.env.DATABASE_PUBLIC_URL) ||
    normalizeInput(process.env.DATABASE_URL)
  if (fromEnv) return fromEnv

  const fallbackPath = '/tmp/railway_db_url.txt'
  if (existsSync(fallbackPath)) {
    const value = normalizeInput(readFileSync(fallbackPath, 'utf8'))
    if (value) return value
  }

  return ''
}

function resolveSslConfig(connectionString) {
  try {
    const host = new URL(connectionString).hostname.toLowerCase()
    if (host.endsWith('.railway.internal') || host === 'localhost' || host === '127.0.0.1') {
      return false
    }
    return { rejectUnauthorized: false }
  } catch {
    return undefined
  }
}

function hashPassword(password) {
  const salt = randomBytes(SCRYPT_SALT_BYTES)
  const derived = scryptSync(password, salt, SCRYPT_KEY_LENGTH)
  return `scrypt$${salt.toString('base64url')}$${derived.toString('base64url')}`
}

function fallbackEmail(userId) {
  return `${normalizeInput(userId).toLowerCase()}@users.nizam.local`
}

function parseAdminEmails() {
  const fromEnv = normalizeInput(process.env.INTERNAL_AUTH_PLATFORM_ADMIN_EMAILS)
  const values = fromEnv
    ? fromEnv.split(',')
    : ['bob@executive.id']

  return new Set(values.map((value) => normalizeEmail(value)).filter(Boolean))
}

function inferUserType(candidate, adminEmails) {
  if (candidate.loginEmail && adminEmails.has(candidate.loginEmail)) return 'admin'
  return candidate.isOwner ? 'owner' : 'staff'
}

async function fetchCandidates(client) {
  const { rows } = await client.query(`
    with employee_primary as (
      select
        user_id,
        min(upper(nullif(trim(nik), ''))) as nik,
        min(nullif(trim(concat_ws(' ', first_name, last_name)), '')) as display_name
      from public.employees
      where user_id is not null
      group by user_id
    ),
    owner_flags as (
      select
        user_id,
        bool_or(lower(role::text) = 'owner') as is_owner
      from public.org_members
      where user_id is not null
        and is_active = true
      group by user_id
    ),
    owner_emails as (
      select
        m.user_id,
        min(lower(nullif(trim(o.owner_email), ''))) as owner_email
      from public.org_members m
      join public.organizations o on o.id = m.org_id
      where m.user_id is not null
        and lower(m.role::text) = 'owner'
        and m.is_active = true
      group by m.user_id
    )
    select
      u.id::text as user_id,
      lower(nullif(trim(coalesce(u.email, oe.owner_email)), '')) as login_email,
      ep.nik as login_nik,
      ep.display_name,
      coalesce(of.is_owner, false) as is_owner
    from auth.users u
    left join employee_primary ep on ep.user_id = u.id
    left join owner_flags of on of.user_id = u.id
    left join owner_emails oe on oe.user_id = u.id
    order by u.created_at asc
  `)

  return rows.map((row) => ({
    userId: normalizeInput(row.user_id),
    loginEmail: normalizeEmail(row.login_email),
    loginNik: normalizeNik(row.login_nik),
    displayName: normalizeInput(row.display_name) || null,
    isOwner: Boolean(row.is_owner),
  })).filter((row) => row.userId.length > 0)
}

async function fetchExistingInternalUsers(client) {
  const { rows } = await client.query(`
    select
      id::text as id,
      legacy_user_id::text as legacy_user_id,
      lower(nullif(trim(login_email), '')) as login_email,
      upper(nullif(trim(login_nik), '')) as login_nik
    from public.internal_auth_users
  `)

  return rows.map((row) => ({
    id: normalizeInput(row.id),
    legacyUserId: normalizeInput(row.legacy_user_id) || null,
    loginEmail: normalizeEmail(row.login_email),
    loginNik: normalizeNik(row.login_nik),
  }))
}

function buildNikUniquenessMap(candidates) {
  const counts = new Map()
  for (const candidate of candidates) {
    if (!candidate.loginNik) continue
    counts.set(candidate.loginNik, Number(counts.get(candidate.loginNik) || 0) + 1)
  }
  return counts
}

function resolveSafeNik(candidate, nikCounts, nikToInternalId, targetInternalId) {
  if (!candidate.loginNik) return null
  if (Number(nikCounts.get(candidate.loginNik) || 0) !== 1) return null

  const existingNikOwner = nikToInternalId.get(candidate.loginNik)
  if (!existingNikOwner) return candidate.loginNik
  if (targetInternalId && existingNikOwner === targetInternalId) return candidate.loginNik
  return null
}

async function main() {
  const args = parseArgs(process.argv)
  if (args.help) {
    printHelp()
    process.exit(0)
  }

  const dbUrl = resolveDbUrl(args.dbUrl)
  if (!dbUrl) {
    throw new Error('Missing Railway DB URL. Use --db-url or set RAILWAY_DATABASE_URL / DATABASE_PUBLIC_URL / DATABASE_URL.')
  }

  const client = new Client({ connectionString: dbUrl, ssl: resolveSslConfig(dbUrl) })
  await client.connect()

  try {
    const [candidates, existingInternalUsers] = await Promise.all([
      fetchCandidates(client),
      fetchExistingInternalUsers(client),
    ])

    const adminEmails = parseAdminEmails()
    const nikCounts = buildNikUniquenessMap(candidates)

    const legacyToInternal = new Map()
    const emailToInternal = new Map()
    const nikToInternal = new Map()

    for (const row of existingInternalUsers) {
      if (row.legacyUserId) legacyToInternal.set(row.legacyUserId, row.id)
      if (row.loginEmail) emailToInternal.set(row.loginEmail, row.id)
      if (row.loginNik) nikToInternal.set(row.loginNik, row.id)
    }

    const previewRows = []
    let previewNewRows = 0
    let previewExistingRows = 0

    for (const candidate of candidates) {
      const normalizedEmail = candidate.loginEmail || fallbackEmail(candidate.userId)
      const existingId = legacyToInternal.get(candidate.userId) || emailToInternal.get(normalizedEmail) || null
      if (existingId) previewExistingRows += 1
      else previewNewRows += 1

      previewRows.push({
        user_id: candidate.userId,
        login_email: normalizedEmail,
        login_nik: candidate.loginNik || '-',
        user_type: inferUserType({ ...candidate, loginEmail: normalizedEmail }, adminEmails),
        target: existingId ? `update:${existingId}` : 'insert',
      })
    }

    console.log('=== Internal Auth Bootstrap (Preview) ===')
    console.log(`Auth users candidates    : ${candidates.length}`)
    console.log(`Will insert new users    : ${previewNewRows}`)
    console.log(`Will update old users    : ${previewExistingRows}`)
    console.log(`Reset existing passwords : ${args.resetPasswords ? 'yes' : 'no'}`)

    console.table(previewRows.slice(0, 12))

    if (!args.apply) {
      console.log('Dry-run mode. Re-run with --apply to write data.')
      return
    }

    const password = normalizeInput(args.password || process.env.INTERNAL_AUTH_BOOTSTRAP_PASSWORD)
    const requiresPassword = previewNewRows > 0 || args.resetPasswords
    if (requiresPassword && password.length < 8) {
      throw new Error(
        'Password bootstrap wajib diisi minimal 8 karakter (--password atau INTERNAL_AUTH_BOOTSTRAP_PASSWORD).'
      )
    }

    const passwordHash = requiresPassword ? hashPassword(password) : null

    let inserted = 0
    let updated = 0
    let skippedLegacyConflicts = 0

    await client.query('begin')

    for (const candidate of candidates) {
      const normalizedEmail = candidate.loginEmail || fallbackEmail(candidate.userId)
      const existingByLegacy = legacyToInternal.get(candidate.userId) || null
      const existingByEmail = emailToInternal.get(normalizedEmail) || null
      const targetInternalId = existingByLegacy || existingByEmail || null
      const userType = inferUserType({ ...candidate, loginEmail: normalizedEmail }, adminEmails)
      const safeNik = resolveSafeNik(candidate, nikCounts, nikToInternal, targetInternalId)

      if (!targetInternalId) {
        const insertResult = await client.query(
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
            values ($1::uuid, $2::text, $3::text, $4::text, $5::text, $6::text, true)
            returning id::text as id
          `,
          [candidate.userId, normalizedEmail, safeNik, passwordHash, candidate.displayName, userType]
        )

        const newId = normalizeInput(insertResult.rows?.[0]?.id)
        if (newId) {
          legacyToInternal.set(candidate.userId, newId)
          emailToInternal.set(normalizedEmail, newId)
          if (safeNik) nikToInternal.set(safeNik, newId)
        }

        inserted += 1
        continue
      }

      const currentLegacy = Array.from(legacyToInternal.entries()).find(([, internalId]) => internalId === targetInternalId)?.[0] || null
      if (currentLegacy && currentLegacy !== candidate.userId) {
        skippedLegacyConflicts += 1
        continue
      }

      await client.query(
        `
          update public.internal_auth_users
          set
            legacy_user_id = coalesce(legacy_user_id, $2::uuid),
            login_email = coalesce(login_email, $3::text),
            login_nik = coalesce(login_nik, $4::text),
            display_name = coalesce(display_name, $5::text),
            user_type = coalesce(user_type, $6::text),
            is_active = true,
            password_hash = case when $7::boolean then $8::text else password_hash end,
            updated_at = now()
          where id = $1::uuid
        `,
        [
          targetInternalId,
          candidate.userId,
          normalizedEmail,
          safeNik,
          candidate.displayName,
          userType,
          Boolean(args.resetPasswords),
          passwordHash,
        ]
      )

      legacyToInternal.set(candidate.userId, targetInternalId)
      emailToInternal.set(normalizedEmail, targetInternalId)
      if (safeNik) nikToInternal.set(safeNik, targetInternalId)
      updated += 1
    }

    await client.query('commit')

    const stats = await client.query(`
      select
        count(*)::int as total,
        count(*) filter (where legacy_user_id is not null)::int as with_legacy,
        count(*) filter (where login_email is not null and trim(login_email) <> '')::int as with_email,
        count(*) filter (where login_nik is not null and trim(login_nik) <> '')::int as with_nik
      from public.internal_auth_users
    `)

    const row = stats.rows?.[0] || { total: 0, with_legacy: 0, with_email: 0, with_nik: 0 }

    console.log('')
    console.log('=== Bootstrap Result ===')
    console.log(`Inserted                     : ${inserted}`)
    console.log(`Updated                      : ${updated}`)
    console.log(`Skipped (legacy conflict)    : ${skippedLegacyConflicts}`)
    console.log(`Total internal_auth_users    : ${row.total}`)
    console.log(`Users with legacy_user_id    : ${row.with_legacy}`)
    console.log(`Users with login_email       : ${row.with_email}`)
    console.log(`Users with login_nik         : ${row.with_nik}`)
    console.log('Bootstrap selesai.')
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error('[bootstrap-railway-internal-auth-users] Failed:', error?.message || error)
  process.exit(1)
})
