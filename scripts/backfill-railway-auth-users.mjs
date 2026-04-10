#!/usr/bin/env node

import process from 'node:process'
import { existsSync, readFileSync } from 'node:fs'
import { Client } from 'pg'
import nextEnv from '@next/env'

const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd())

const HELP_TEXT = `
Backfill auth.users in Railway Postgres from existing public data.

Usage:
  node scripts/backfill-railway-auth-users.mjs [--apply] [--db-url <postgres-url>]

Source priority for target DB URL:
  1) --db-url
  2) RAILWAY_DATABASE_URL / DATABASE_PUBLIC_URL / DATABASE_URL
  3) /tmp/railway_db_url.txt
`

function parseArgs(argv) {
  const args = { apply: false, dbUrl: '' }

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

    if (current === '--db-url') {
      args.dbUrl = String(argv[index + 1] || '').trim()
      index += 1
      continue
    }

    throw new Error(`Unknown argument: ${current}`)
  }

  return args
}

function resolveDbUrl(cliDbUrl) {
  const fromCli = String(cliDbUrl || '').trim()
  if (fromCli) return fromCli

  const fromEnv =
    String(process.env.RAILWAY_DATABASE_URL || '').trim() ||
    String(process.env.DATABASE_PUBLIC_URL || '').trim() ||
    String(process.env.DATABASE_URL || '').trim()
  if (fromEnv) return fromEnv

  const fallbackPath = '/tmp/railway_db_url.txt'
  if (existsSync(fallbackPath)) {
    const value = String(readFileSync(fallbackPath, 'utf8') || '').trim()
    if (value) return value
  }

  return ''
}

function normalizeEmail(value) {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return normalized || null
}

function buildFallbackEmail(userId) {
  return `${String(userId || '').trim().toLowerCase()}@users.nizam.local`
}

async function fetchCurrentOrphanCounts(client) {
  const { rows } = await client.query(`
    select
      (
        select count(*)::int
        from public.org_members m
        left join auth.users u on u.id = m.user_id
        where m.user_id is not null and u.id is null
      ) as orphan_org_members,
      (
        select count(*)::int
        from public.employees e
        left join auth.users u on u.id = e.user_id
        where e.user_id is not null and u.id is null
      ) as orphan_employees
  `)

  return rows[0] || { orphan_org_members: 0, orphan_employees: 0 }
}

async function fetchAuthCandidates(client) {
  const { rows } = await client.query(`
    with org_member_candidates as (
      select
        m.user_id::text as id,
        min(
          case
            when lower(coalesce(m.role::text, '')) = 'owner'
              then lower(nullif(trim(o.owner_email), ''))
            else null
          end
        ) as email,
        'org_member'::text as source
      from public.org_members m
      left join public.organizations o on o.id = m.org_id
      where m.user_id is not null
      group by m.user_id
    ),
    employee_candidates as (
      select
        e.user_id::text as id,
        min(lower(nullif(trim(e.email), ''))) as email,
        'employee_email'::text as source
      from public.employees e
      where e.user_id is not null
      group by e.user_id
    ),
    merged as (
      select * from org_member_candidates
      union all
      select * from employee_candidates
    ),
    ranked as (
      select
        id,
        email,
        source,
        row_number() over (
          partition by id
          order by
            case when email is not null then 0 else 1 end,
            case source when 'employee_email' then 0 else 1 end
        ) as rn
      from merged
    )
    select id, email, source
    from ranked
    where rn = 1
    order by id
  `)

  return rows
    .map((row) => ({
      id: String(row.id || '').trim(),
      email: normalizeEmail(row.email) || null,
      source: String(row.source || '').trim() || 'unknown',
    }))
    .filter((row) => row.id.length > 0)
}

async function fetchExistingAuthUsers(client) {
  const { rows } = await client.query(`
    select id::text as id, lower(nullif(trim(email), '')) as email
    from auth.users
  `)

  const byId = new Map()
  for (const row of rows) {
    const id = String(row.id || '').trim()
    if (!id) continue
    byId.set(id, normalizeEmail(row.email))
  }

  return byId
}

async function upsertAuthUsers(client, candidates) {
  await client.query('begin')
  try {
    for (const candidate of candidates) {
      const email = candidate.email || buildFallbackEmail(candidate.id)
      const appMeta = {
        provider: 'railway-backfill',
        providers: ['railway-backfill'],
        source: candidate.source,
      }
      const userMeta = {
        backfilled_by: 'scripts/backfill-railway-auth-users.mjs',
        backfilled_at: new Date().toISOString(),
      }

      await client.query(
        `
          insert into auth.users (
            id,
            email,
            encrypted_password,
            raw_app_meta_data,
            raw_user_meta_data,
            aud,
            role,
            created_at,
            updated_at
          )
          values (
            $1::uuid,
            $2::text,
            null,
            $3::jsonb,
            $4::jsonb,
            'authenticated',
            'authenticated',
            now(),
            now()
          )
          on conflict (id) do update
          set
            email = coalesce(auth.users.email, excluded.email),
            raw_app_meta_data = coalesce(auth.users.raw_app_meta_data, excluded.raw_app_meta_data),
            raw_user_meta_data = coalesce(auth.users.raw_user_meta_data, excluded.raw_user_meta_data),
            aud = coalesce(auth.users.aud, excluded.aud),
            role = coalesce(auth.users.role, excluded.role),
            updated_at = now()
        `,
        [candidate.id, email, JSON.stringify(appMeta), JSON.stringify(userMeta)]
      )
    }

    await client.query('commit')
  } catch (error) {
    await client.query('rollback')
    throw error
  }
}

async function main() {
  const args = parseArgs(process.argv)
  if (args.help) {
    console.log(HELP_TEXT.trim())
    process.exit(0)
  }

  const dbUrl = resolveDbUrl(args.dbUrl)
  if (!dbUrl) {
    throw new Error([
      'Target Railway DB URL is missing.',
      'Provide --db-url, or set RAILWAY_DATABASE_URL / DATABASE_PUBLIC_URL / DATABASE_URL,',
      'or place URL in /tmp/railway_db_url.txt.',
    ].join(' '))
  }

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

  try {
    await client.connect()

    const beforeOrphans = await fetchCurrentOrphanCounts(client)
    const candidates = await fetchAuthCandidates(client)
    const existingUsers = await fetchExistingAuthUsers(client)

    const missingIds = candidates.filter((candidate) => !existingUsers.has(candidate.id))
    const existingWithoutEmail = candidates.filter((candidate) => {
      if (!existingUsers.has(candidate.id)) return false
      const email = existingUsers.get(candidate.id)
      return !email
    })

    console.log('=== Railway Auth Backfill (Preview) ===')
    console.log(`Candidates from public data : ${candidates.length}`)
    console.log(`Missing in auth.users       : ${missingIds.length}`)
    console.log(`Existing without email      : ${existingWithoutEmail.length}`)
    console.log(`Orphan org_members (before) : ${beforeOrphans.orphan_org_members}`)
    console.log(`Orphan employees (before)   : ${beforeOrphans.orphan_employees}`)

    if (candidates.length === 0) {
      console.log('No candidate user_id found in public tables. Nothing to backfill.')
      return
    }

    const sampleRows = candidates.slice(0, 10).map((candidate) => ({
      id: candidate.id,
      email: candidate.email || buildFallbackEmail(candidate.id),
      source: candidate.source,
    }))
    console.table(sampleRows)

    if (!args.apply) {
      console.log('Dry-run mode. Re-run with --apply to write auth.users rows.')
      return
    }

    await upsertAuthUsers(client, candidates)

    const afterOrphans = await fetchCurrentOrphanCounts(client)
    const authCount = await client.query(`select count(*)::int as total from auth.users`)

    const totalAuthUsers = Number(authCount.rows?.[0]?.total || 0)

    console.log('')
    console.log('=== Backfill Result ===')
    console.log(`Total auth.users            : ${totalAuthUsers}`)
    console.log(`Orphan org_members (after)  : ${afterOrphans.orphan_org_members}`)
    console.log(`Orphan employees (after)    : ${afterOrphans.orphan_employees}`)
    console.log('Backfill completed.')
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error('[backfill-railway-auth-users] Failed:', error?.message || error)
  process.exit(1)
})
