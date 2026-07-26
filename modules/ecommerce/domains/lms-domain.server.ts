/**
 * Service domain tenant LMS. Modul ini menjadi satu-satunya tempat yang
 * mengubah status domain, menjalankan provider, dan mencatat audit domain.
 */
import 'server-only'

import { randomBytes } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { headers } from 'next/headers'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { queryPostgres } from '@/lib/db/postgres'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import {
  normalizeLmsHostname,
  type LmsDomainDnsRecord,
  type LmsDomainRootBehavior,
  type LmsDomainStatus,
  type LmsTenantDomainView,
  type ResolvedLmsTenantDomain,
} from '@/modules/ecommerce/lib/lms-domain'
import {
  createRailwayDomain,
  deleteCloudflareDnsRecords,
  deleteRailwayDomain,
  getRailwayDomainStatus,
  isRailwayDomainAutomationReady,
  resolveManagedCloudflareZone,
  upsertCloudflareDnsRecords,
} from './domain-providers.server'

type DomainAdminContext = {
  orgId: string
  orgSlug: string
  actorUserId: string | null
}

type DomainRow = {
  id: string
  org_id: string
  store_id: string | null
  hostname: string
  purpose: 'LMS' | 'MEMBER_PORTAL'
  root_behavior: LmsDomainRootBehavior
  status: LmsDomainStatus
  provider_mode: 'MANUAL' | 'RAILWAY' | 'RAILWAY_CLOUDFLARE'
  is_primary: boolean
  railway_domain_id: string | null
  cloudflare_zone_id: string | null
  required_dns_records: unknown
  cloudflare_record_ids: unknown
  dns_status: string | null
  certificate_status: string | null
  last_checked_at: string | null
  last_error: string | null
  verified_at: string | null
  verification_token: string
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item || '').trim()).filter(Boolean)
}

function normalizeDnsRecords(value: unknown): LmsDomainDnsRecord[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const row = item && typeof item === 'object'
      ? item as Record<string, unknown>
      : {}
    return {
      type: String(row.type || '').toUpperCase(),
      name: String(row.name || ''),
      value: String(row.value || ''),
      status: row.status ? String(row.status) : undefined,
      proxied: Boolean(row.proxied),
    }
  }).filter((record) => record.type && record.name && record.value)
}

function mapDomainRow(row: DomainRow): LmsTenantDomainView {
  return {
    id: row.id,
    orgId: row.org_id,
    storeId: row.store_id,
    hostname: row.hostname,
    purpose: row.purpose,
    rootBehavior: row.root_behavior,
    status: row.status,
    providerMode: row.provider_mode,
    isPrimary: row.is_primary,
    dnsStatus: String(row.dns_status || 'PENDING'),
    certificateStatus: String(row.certificate_status || 'PENDING'),
    requiredDnsRecords: normalizeDnsRecords(row.required_dns_records),
    lastCheckedAt: row.last_checked_at,
    lastError: row.last_error,
    verifiedAt: row.verified_at,
  }
}

async function requireDomainAdminContext(): Promise<DomainAdminContext> {
  const orgData = await getActiveOrg()
  if (!orgData?.org?.id) throw new Error('Organisasi aktif tidak ditemukan.')

  const role = String(orgData.role || '').trim().toLowerCase()
  if (!['owner', 'admin', 'manager'].includes(role)) {
    throw new Error('Pengaturan domain hanya dapat diubah oleh owner, admin, atau manager.')
  }

  const session = await getInternalAuthSession()
  return {
    orgId: orgData.org.id,
    orgSlug: String(orgData.org.slug || orgData.org.id),
    actorUserId: session?.user?.id || null,
  }
}

async function getDomainRowForAdmin(
  domainId: string,
  context: DomainAdminContext,
): Promise<DomainRow> {
  const { rows } = await queryPostgres<DomainRow>(
    `SELECT *
       FROM public.organization_domains
      WHERE id = $1::uuid
        AND org_id = $2::uuid
        AND purpose IN ('LMS', 'MEMBER_PORTAL')
      LIMIT 1`,
    [domainId, context.orgId],
  )
  if (!rows[0]) throw new Error('Domain LMS tidak ditemukan.')
  return rows[0]
}

async function addDomainEvent(input: {
  context: DomainAdminContext
  domainId: string
  eventType: string
  previousStatus?: string | null
  nextStatus?: string | null
  detail?: Record<string, unknown>
}) {
  await queryPostgres(
    `INSERT INTO public.store_domain_events (
       org_id, organization_domain_id, event_type, previous_status,
       next_status, actor_user_id, detail
     ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::uuid, $7::jsonb)`,
    [
      input.context.orgId,
      input.domainId,
      input.eventType,
      input.previousStatus || null,
      input.nextStatus || null,
      input.context.actorUserId,
      JSON.stringify(input.detail || {}),
    ],
  )
}

async function assertStoreCanServeDomain(input: {
  orgId: string
  storeId: string
  rootBehavior: LmsDomainRootBehavior
}) {
  const { rows } = await queryPostgres<{
    id: string
    is_active: boolean
    is_published: boolean
    published_theme_count: string
  }>(
    `SELECT
       store.id,
       store.is_active,
       store.is_published,
       COUNT(theme.id)::text AS published_theme_count
     FROM public.stores store
     LEFT JOIN public.store_theme_versions theme
       ON theme.store_id = store.id
      AND theme.org_id = store.org_id
      AND theme.status = 'PUBLISHED'
     WHERE store.id = $1::uuid
       AND store.org_id = $2::uuid
     GROUP BY store.id
     LIMIT 1`,
    [input.storeId, input.orgId],
  )
  const store = rows[0]
  if (!store) throw new Error('Toko tidak ditemukan pada organisasi aktif.')
  if (input.rootBehavior === 'STOREFRONT') {
    if (!store.is_active || !store.is_published) {
      throw new Error('Mode Storefront membutuhkan toko yang aktif dan tayang.')
    }
    if (Number(store.published_theme_count || 0) < 1) {
      throw new Error('Publikasikan tema toko sebelum memakai mode Storefront.')
    }
  }
}

export async function resolveLmsTenantDomain(
  host: string,
): Promise<ResolvedLmsTenantDomain | null> {
  const hostname = normalizeLmsHostname(host)
  if (!hostname) return null

  const { rows } = await queryPostgres<{
    domain_id: string
    org_id: string
    org_slug: string
    org_name: string
    store_id: string | null
    store_slug: string | null
    root_behavior: LmsDomainRootBehavior
    purpose: 'LMS' | 'MEMBER_PORTAL'
  }>(
    `SELECT * FROM public.resolve_lms_tenant_domain($1)`,
    [hostname],
  )
  const row = rows[0]
  if (!row) return null

  return {
    domainId: row.domain_id,
    orgId: row.org_id,
    orgSlug: row.org_slug,
    orgName: row.org_name,
    storeId: row.store_id,
    storeSlug: row.store_slug,
    rootBehavior: row.root_behavior,
    purpose: row.purpose,
  }
}

export async function resolveCurrentLmsTenantDomain() {
  const requestHeaders = await headers()
  const hostname = String(
    requestHeaders.get('x-forwarded-host') || requestHeaders.get('host') || '',
  ).split(',')[0].trim()
  try {
    return await resolveLmsTenantDomain(hostname)
  } catch {
    return null
  }
}

export async function getLmsDomainAdminData() {
  const context = await requireDomainAdminContext()
  const [domainResult, eventResult] = await Promise.all([
    queryPostgres<DomainRow>(
      `SELECT *
         FROM public.organization_domains
        WHERE org_id = $1::uuid
          AND purpose IN ('LMS', 'MEMBER_PORTAL')
        ORDER BY is_primary DESC, created_at ASC`,
      [context.orgId],
    ),
    queryPostgres<{
      id: string
      organization_domain_id: string
      event_type: string
      previous_status: string | null
      next_status: string | null
      detail: unknown
      created_at: string
    }>(
      `SELECT
         id, organization_domain_id, event_type, previous_status,
         next_status, detail, created_at::text
       FROM public.store_domain_events
       WHERE org_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT 50`,
      [context.orgId],
    ),
  ])

  return {
    domains: domainResult.rows.map(mapDomainRow),
    events: eventResult.rows.map((event) => ({
      id: event.id,
      domainId: event.organization_domain_id,
      eventType: event.event_type,
      previousStatus: event.previous_status,
      nextStatus: event.next_status,
      detail: event.detail,
      createdAt: event.created_at,
    })),
    automation: {
      railway: isRailwayDomainAutomationReady(),
      cloudflare: Boolean(String(process.env.CLOUDFLARE_API_TOKEN || '').trim()),
    },
  }
}

export async function requestLmsTenantDomain(input: {
  hostname: string
  storeId: string
  rootBehavior: LmsDomainRootBehavior
  isPrimary: boolean
}) {
  const context = await requireDomainAdminContext()
  const hostname = normalizeLmsHostname(input.hostname)
  if (!hostname) throw new Error('Nama domain tidak valid. Contoh: kelas.domainanda.com.')
  if (!input.storeId) throw new Error('Pilih toko yang menjadi sumber penjualan.')
  if (!['STOREFRONT', 'LOGIN'].includes(input.rootBehavior)) {
    throw new Error('Perilaku homepage tidak valid.')
  }
  await assertStoreCanServeDomain({
    orgId: context.orgId,
    storeId: input.storeId,
    rootBehavior: input.rootBehavior,
  })

  const existing = await queryPostgres<DomainRow>(
    `SELECT *
       FROM public.organization_domains
      WHERE lower(hostname) = lower($1)
      LIMIT 1`,
    [hostname],
  )
  if (existing.rows[0] && existing.rows[0].org_id !== context.orgId) {
    throw new Error('Domain ini sudah dipakai oleh organisasi lain.')
  }

  const currentPrimary = await queryPostgres<{ id: string }>(
    `SELECT id::text
       FROM public.organization_domains
      WHERE org_id = $1::uuid
        AND purpose = 'LMS'
        AND is_primary = TRUE
        AND status <> 'DISABLED'
      LIMIT 1`,
    [context.orgId],
  )
  const shouldAssignPrimary = Boolean(
    input.isPrimary
    && (
      !currentPrimary.rows[0]
      || currentPrimary.rows[0].id === existing.rows[0]?.id
    ),
  )

  const verificationToken = randomBytes(24).toString('hex')
  const { rows } = await queryPostgres<DomainRow>(
    `INSERT INTO public.organization_domains (
       org_id, store_id, hostname, purpose, root_behavior, is_primary,
       status, provider_mode, verification_token, dns_status,
       certificate_status, last_error, disabled_at
     ) VALUES (
       $1::uuid, $2::uuid, $3, 'LMS', $4, $5,
       'PENDING', 'MANUAL', $6, 'PENDING', 'PENDING', NULL, NULL
     )
     ON CONFLICT ((lower(hostname))) DO UPDATE SET
       store_id = EXCLUDED.store_id,
       purpose = 'LMS',
       root_behavior = EXCLUDED.root_behavior,
       is_primary = EXCLUDED.is_primary,
       status = CASE
         WHEN organization_domains.status = 'VERIFIED' THEN 'VERIFIED'
         ELSE 'PENDING'
       END,
       disabled_at = NULL,
       last_error = NULL,
       updated_at = NOW()
     WHERE organization_domains.org_id = EXCLUDED.org_id
     RETURNING *`,
    [
      context.orgId,
      input.storeId,
      hostname,
      input.rootBehavior,
      shouldAssignPrimary,
      verificationToken,
    ],
  )
  const domain = rows[0]
  if (!domain) throw new Error('Domain gagal disimpan.')

  await addDomainEvent({
    context,
    domainId: domain.id,
    eventType: 'DOMAIN_REQUESTED',
    previousStatus: existing.rows[0]?.status,
    nextStatus: domain.status,
    detail: {
      hostname,
      rootBehavior: input.rootBehavior,
      storeId: input.storeId,
      requestedPrimary: input.isPrimary,
      assignedPrimary: shouldAssignPrimary,
    },
  })

  if (!isRailwayDomainAutomationReady()) {
    return mapDomainRow(domain)
  }

  try {
    const railway = domain.railway_domain_id
      ? await getRailwayDomainStatus(domain.railway_domain_id)
      : await createRailwayDomain(hostname)
    const managedZone = resolveManagedCloudflareZone(hostname)
    const recordIds = managedZone && String(process.env.CLOUDFLARE_API_TOKEN || '').trim()
      ? await upsertCloudflareDnsRecords({
          zoneId: managedZone.zoneId,
          records: railway.dnsRecords,
        })
      : []
    const providerMode = managedZone && recordIds.length
      ? 'RAILWAY_CLOUDFLARE'
      : 'RAILWAY'
    const status: LmsDomainStatus = railway.ready ? 'VERIFIED' : 'VERIFYING'
    const updated = await queryPostgres<DomainRow>(
      `UPDATE public.organization_domains
          SET railway_domain_id = $1,
              cloudflare_zone_id = $2,
              cloudflare_record_ids = $3::jsonb,
              required_dns_records = $4::jsonb,
              provider_mode = $5,
              dns_status = $6,
              certificate_status = $7,
              status = $8,
              verified_at = CASE WHEN $8 = 'VERIFIED' THEN COALESCE(verified_at, NOW()) ELSE verified_at END,
              activated_at = CASE WHEN $8 = 'VERIFIED' THEN COALESCE(activated_at, NOW()) ELSE activated_at END,
              last_checked_at = NOW(),
              last_error = NULL
        WHERE id = $9::uuid AND org_id = $10::uuid
        RETURNING *`,
      [
        railway.id,
        managedZone?.zoneId || null,
        JSON.stringify(recordIds),
        JSON.stringify(railway.dnsRecords),
        providerMode,
        railway.dnsStatus,
        railway.certificateStatus,
        status,
        domain.id,
        context.orgId,
      ],
    )
    await addDomainEvent({
      context,
      domainId: domain.id,
      eventType: 'PROVISIONING_STARTED',
      previousStatus: domain.status,
      nextStatus: status,
      detail: { providerMode, managedDns: Boolean(managedZone) },
    })
    return mapDomainRow(updated.rows[0] || domain)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Provisioning domain gagal.'
    await queryPostgres(
      `UPDATE public.organization_domains
          SET status = 'FAILED', last_error = $1, last_checked_at = NOW()
        WHERE id = $2::uuid AND org_id = $3::uuid`,
      [message, domain.id, context.orgId],
    )
    await addDomainEvent({
      context,
      domainId: domain.id,
      eventType: 'PROVIDER_FAILED',
      previousStatus: domain.status,
      nextStatus: 'FAILED',
      detail: { error: message },
    })
    throw new Error(`Domain tersimpan, tetapi otomasi provider gagal: ${message}`)
  }
}

export async function refreshLmsTenantDomain(domainId: string) {
  const context = await requireDomainAdminContext()
  const domain = await getDomainRowForAdmin(domainId, context)
  if (!domain.railway_domain_id) {
    try {
      const addresses = await lookup(domain.hostname, { all: true, verbatim: true })
      if (!addresses.length || addresses.some(({ address }) => (
        address === '::1'
        || address.startsWith('127.')
        || address.startsWith('10.')
        || address.startsWith('192.168.')
        || address.startsWith('169.254.')
        || /^172\.(1[6-9]|2\d|3[01])\./.test(address)
        || address.startsWith('fc')
        || address.startsWith('fd')
        || address.startsWith('fe80:')
      ))) {
        throw new Error('DNS domain belum mengarah ke alamat publik yang aman.')
      }
      const probeUrl = new URL('/api/lms/domain-probe', `https://${domain.hostname}`)
      probeUrl.searchParams.set('token', domain.verification_token)
      const response = await fetch(probeUrl, {
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
      })
      const payload = await response.json() as { data?: { domainId?: string } }
      if (!response.ok || payload.data?.domainId !== domain.id) {
        throw new Error('Aplikasi belum dapat memverifikasi domain ini melalui HTTPS.')
      }
      const { rows } = await queryPostgres<DomainRow>(
        `UPDATE public.organization_domains
            SET status = 'VERIFIED',
                dns_status = 'VERIFIED',
                certificate_status = 'ACTIVE',
                verified_at = COALESCE(verified_at, NOW()),
                activated_at = COALESCE(activated_at, NOW()),
                last_checked_at = NOW(),
                last_error = NULL
          WHERE id = $1::uuid AND org_id = $2::uuid
          RETURNING *`,
        [domain.id, context.orgId],
      )
      await addDomainEvent({
        context,
        domainId: domain.id,
        eventType: 'MANUAL_DOMAIN_VERIFIED',
        previousStatus: domain.status,
        nextStatus: 'VERIFIED',
      })
      return mapDomainRow(rows[0] || domain)
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Pemeriksaan domain manual gagal.'
      await queryPostgres(
        `UPDATE public.organization_domains
            SET status = 'VERIFYING', last_error = $1, last_checked_at = NOW()
          WHERE id = $2::uuid AND org_id = $3::uuid`,
        [message, domain.id, context.orgId],
      )
      throw new Error(message)
    }
  }

  try {
    const railway = await getRailwayDomainStatus(domain.railway_domain_id)
    const status: LmsDomainStatus = railway.ready ? 'VERIFIED' : 'VERIFYING'
    const { rows } = await queryPostgres<DomainRow>(
      `UPDATE public.organization_domains
          SET required_dns_records = $1::jsonb,
              dns_status = $2,
              certificate_status = $3,
              status = $4,
              verified_at = CASE WHEN $4 = 'VERIFIED' THEN COALESCE(verified_at, NOW()) ELSE verified_at END,
              activated_at = CASE WHEN $4 = 'VERIFIED' THEN COALESCE(activated_at, NOW()) ELSE activated_at END,
              last_checked_at = NOW(),
              last_error = NULL
        WHERE id = $5::uuid AND org_id = $6::uuid
        RETURNING *`,
      [
        JSON.stringify(railway.dnsRecords),
        railway.dnsStatus,
        railway.certificateStatus,
        status,
        domain.id,
        context.orgId,
      ],
    )
    await addDomainEvent({
      context,
      domainId: domain.id,
      eventType: 'STATUS_CHECKED',
      previousStatus: domain.status,
      nextStatus: status,
      detail: {
        dnsStatus: railway.dnsStatus,
        certificateStatus: railway.certificateStatus,
      },
    })
    return mapDomainRow(rows[0] || domain)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Pemeriksaan provider gagal.'
    await queryPostgres(
      `UPDATE public.organization_domains
          SET status = 'FAILED', last_error = $1, last_checked_at = NOW()
        WHERE id = $2::uuid AND org_id = $3::uuid`,
      [message, domain.id, context.orgId],
    )
    throw error
  }
}

export async function setPrimaryLmsTenantDomain(domainId: string) {
  const context = await requireDomainAdminContext()
  const domain = await getDomainRowForAdmin(domainId, context)
  if (domain.status !== 'VERIFIED') {
    throw new Error('Hanya domain terverifikasi yang dapat dijadikan domain utama.')
  }
  await queryPostgres(
    `UPDATE public.organization_domains
        SET is_primary = (id = $1::uuid)
      WHERE org_id = $2::uuid
        AND purpose = 'LMS'
        AND status <> 'DISABLED'`,
    [domain.id, context.orgId],
  )
  await addDomainEvent({
    context,
    domainId: domain.id,
    eventType: 'PRIMARY_CHANGED',
    previousStatus: domain.status,
    nextStatus: domain.status,
  })
}

export async function disableLmsTenantDomain(domainId: string) {
  const context = await requireDomainAdminContext()
  const domain = await getDomainRowForAdmin(domainId, context)
  const recordIds = normalizeStringArray(domain.cloudflare_record_ids)
  const providerErrors: string[] = []

  if (domain.cloudflare_zone_id && recordIds.length) {
    try {
      await deleteCloudflareDnsRecords({
        zoneId: domain.cloudflare_zone_id,
        recordIds,
      })
    } catch (error) {
      providerErrors.push(error instanceof Error ? error.message : 'Cloudflare cleanup gagal.')
    }
  }
  if (domain.railway_domain_id) {
    try {
      await deleteRailwayDomain(domain.railway_domain_id)
    } catch (error) {
      providerErrors.push(error instanceof Error ? error.message : 'Railway cleanup gagal.')
    }
  }

  await queryPostgres(
    `UPDATE public.organization_domains
        SET status = 'DISABLED',
            is_primary = FALSE,
            disabled_at = NOW(),
            last_checked_at = NOW(),
            last_error = $1
      WHERE id = $2::uuid AND org_id = $3::uuid`,
    [providerErrors.join('; ') || null, domain.id, context.orgId],
  )
  await addDomainEvent({
    context,
    domainId: domain.id,
    eventType: 'DOMAIN_DISABLED',
    previousStatus: domain.status,
    nextStatus: 'DISABLED',
    detail: { providerErrors },
  })
}

export async function refreshProvisionedLmsDomains(limit = 50) {
  const safeLimit = Math.max(1, Math.min(200, Math.trunc(limit)))
  const { rows } = await queryPostgres<DomainRow>(
    `SELECT *
       FROM public.organization_domains
      WHERE purpose = 'LMS'
        AND status IN ('PENDING', 'VERIFYING', 'FAILED')
        AND railway_domain_id IS NOT NULL
      ORDER BY COALESCE(last_checked_at, created_at) ASC
      LIMIT $1`,
    [safeLimit],
  )
  const summary = {
    checked: 0,
    verified: 0,
    pending: 0,
    failed: 0,
  }

  for (const domain of rows) {
    summary.checked += 1
    try {
      const railway = await getRailwayDomainStatus(String(domain.railway_domain_id))
      const status: LmsDomainStatus = railway.ready ? 'VERIFIED' : 'VERIFYING'
      await queryPostgres(
        `UPDATE public.organization_domains
            SET required_dns_records = $1::jsonb,
                dns_status = $2,
                certificate_status = $3,
                status = $4,
                verified_at = CASE WHEN $4 = 'VERIFIED' THEN COALESCE(verified_at, NOW()) ELSE verified_at END,
                activated_at = CASE WHEN $4 = 'VERIFIED' THEN COALESCE(activated_at, NOW()) ELSE activated_at END,
                last_checked_at = NOW(),
                last_error = NULL
          WHERE id = $5::uuid`,
        [
          JSON.stringify(railway.dnsRecords),
          railway.dnsStatus,
          railway.certificateStatus,
          status,
          domain.id,
        ],
      )
      await queryPostgres(
        `INSERT INTO public.store_domain_events (
           org_id, organization_domain_id, event_type, previous_status,
           next_status, detail
         ) VALUES ($1::uuid, $2::uuid, 'CRON_STATUS_CHECKED', $3, $4, $5::jsonb)`,
        [
          domain.org_id,
          domain.id,
          domain.status,
          status,
          JSON.stringify({
            dnsStatus: railway.dnsStatus,
            certificateStatus: railway.certificateStatus,
          }),
        ],
      )
      if (status === 'VERIFIED') summary.verified += 1
      else summary.pending += 1
    } catch (error) {
      summary.failed += 1
      const message = error instanceof Error ? error.message : 'Pemeriksaan domain gagal.'
      await queryPostgres(
        `UPDATE public.organization_domains
            SET status = 'FAILED', last_error = $1, last_checked_at = NOW()
          WHERE id = $2::uuid`,
        [message, domain.id],
      )
    }
  }

  return summary
}

/**
 * Pintu masuk tunggal domain LMS untuk route handler, server action, dan cron.
 */
export const LmsTenantDomainService = {
  resolve: resolveLmsTenantDomain,
  resolveCurrent: resolveCurrentLmsTenantDomain,
  getAdminData: getLmsDomainAdminData,
  request: requestLmsTenantDomain,
  refresh: refreshLmsTenantDomain,
  setPrimary: setPrimaryLmsTenantDomain,
  disable: disableLmsTenantDomain,
  refreshProvisioned: refreshProvisionedLmsDomains,
}
