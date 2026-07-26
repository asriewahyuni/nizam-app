/**
 * Adapter Railway dan Cloudflare untuk provisioning custom domain LMS.
 * Seluruh token hanya dibaca di server dan tidak pernah dikirim ke browser.
 */
import 'server-only'
import type { LmsDomainDnsRecord } from '@/modules/ecommerce/lib/lms-domain'

const RAILWAY_GRAPHQL_ENDPOINT = 'https://backboard.railway.com/graphql/v2'
const CLOUDFLARE_API_ENDPOINT = 'https://api.cloudflare.com/client/v4'

type RailwayDomainResult = {
  id: string
  domain: string
  dnsRecords: LmsDomainDnsRecord[]
  dnsStatus: string
  certificateStatus: string
  ready: boolean
}

function readEnv(name: string) {
  return String(process.env[name] || '').trim()
}

function normalizeRailwayDnsRecords(value: unknown): LmsDomainDnsRecord[] {
  if (!Array.isArray(value)) return []
  return value.map((record) => {
    const row = record && typeof record === 'object'
      ? record as Record<string, unknown>
      : {}
    return {
      type: String(row.type || row.recordType || '').toUpperCase(),
      name: String(row.name || row.hostlabel || row.fqdn || ''),
      value: String(row.value || row.requiredValue || row.expectedValue || ''),
      status: String(row.status || ''),
      proxied: false,
    }
  }).filter((record) => record.type && record.name && record.value)
}

function normalizeRailwayDomain(value: unknown): RailwayDomainResult {
  const row = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {}
  const status = row.status && typeof row.status === 'object'
    ? row.status as Record<string, unknown>
    : {}
  const dnsRecords = normalizeRailwayDnsRecords(status.dnsRecords || row.dnsRecords)
  const dnsStatus = String(status.dnsStatus || row.dnsStatus || (
    dnsRecords.length > 0 && dnsRecords.every((record) => (
      ['VALID', 'VERIFIED', 'ACTIVE'].includes(String(record.status || '').toUpperCase())
    )) ? 'VALID' : 'PENDING'
  )).toUpperCase()
  const certificateStatus = String(
    status.certificateStatus || row.certificateStatus || 'PENDING',
  ).toUpperCase()
  const certificateReady = ['ACTIVE', 'ISSUED', 'READY', 'SUCCESS', 'VALID'].includes(
    certificateStatus,
  )
  return {
    id: String(row.id || ''),
    domain: String(row.domain || ''),
    dnsRecords,
    dnsStatus,
    certificateStatus,
    ready: ['ACTIVE', 'READY', 'VALID', 'VERIFIED'].includes(dnsStatus) && certificateReady,
  }
}

async function railwayGraphql<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const projectToken = readEnv('RAILWAY_PROJECT_TOKEN')
  if (!projectToken) throw new Error('RAILWAY_PROJECT_TOKEN belum dikonfigurasi.')

  const response = await fetch(RAILWAY_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'project-access-token': projectToken,
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  })
  const payload = await response.json() as {
    data?: T
    errors?: Array<{ message?: string }>
  }
  if (!response.ok || payload.errors?.length || !payload.data) {
    throw new Error(
      payload.errors?.map((error) => error.message).filter(Boolean).join('; ')
      || `Railway API gagal (${response.status}).`,
    )
  }
  return payload.data
}

export function isRailwayDomainAutomationReady() {
  return Boolean(
    readEnv('RAILWAY_PROJECT_TOKEN')
    && readEnv('RAILWAY_ENVIRONMENT_ID')
    && readEnv('RAILWAY_SERVICE_ID'),
  )
}

export async function createRailwayDomain(hostname: string): Promise<RailwayDomainResult> {
  const data = await railwayGraphql<{ customDomainCreate: unknown }>(
    `mutation CreateCustomDomain($input: CustomDomainCreateInput!) {
      customDomainCreate(input: $input) {
        id
        domain
        status {
          dnsStatus
          certificateStatus
          dnsRecords {
            type
            name
            value
            status
          }
        }
      }
    }`,
    {
      input: {
        domain: hostname,
        environmentId: readEnv('RAILWAY_ENVIRONMENT_ID'),
        serviceId: readEnv('RAILWAY_SERVICE_ID'),
      },
    },
  )
  return normalizeRailwayDomain(data.customDomainCreate)
}

export async function getRailwayDomainStatus(domainId: string): Promise<RailwayDomainResult> {
  const data = await railwayGraphql<{ customDomain: unknown }>(
    `query GetCustomDomain($id: String!) {
      customDomain(id: $id) {
        id
        domain
        status {
          dnsStatus
          certificateStatus
          dnsRecords {
            type
            name
            value
            status
          }
        }
      }
    }`,
    { id: domainId },
  )
  return normalizeRailwayDomain(data.customDomain)
}

export async function deleteRailwayDomain(domainId: string): Promise<void> {
  await railwayGraphql<{ customDomainDelete: boolean }>(
    `mutation DeleteCustomDomain($id: String!) {
      customDomainDelete(id: $id)
    }`,
    { id: domainId },
  )
}

type ManagedZone = {
  hostname: string
  zoneId: string
}

function getManagedZones(): ManagedZone[] {
  const raw = readEnv('CLOUDFLARE_MANAGED_ZONES_JSON')
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return Object.entries(parsed)
      .map(([hostname, zoneId]) => ({
        hostname: hostname.trim().toLowerCase().replace(/\.$/, ''),
        zoneId: String(zoneId || '').trim(),
      }))
      .filter((zone) => zone.hostname && zone.zoneId)
      .sort((left, right) => right.hostname.length - left.hostname.length)
  } catch {
    return []
  }
}

export function resolveManagedCloudflareZone(hostname: string): ManagedZone | null {
  return getManagedZones().find((zone) => (
    hostname === zone.hostname || hostname.endsWith(`.${zone.hostname}`)
  )) || null
}

async function cloudflareRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token = readEnv('CLOUDFLARE_API_TOKEN')
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN belum dikonfigurasi.')
  const response = await fetch(`${CLOUDFLARE_API_ENDPOINT}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  })
  const payload = await response.json() as {
    success?: boolean
    result?: T
    errors?: Array<{ message?: string }>
  }
  if (!response.ok || payload.success === false || payload.result === undefined) {
    throw new Error(
      payload.errors?.map((error) => error.message).filter(Boolean).join('; ')
      || `Cloudflare API gagal (${response.status}).`,
    )
  }
  return payload.result
}

export async function upsertCloudflareDnsRecords(input: {
  zoneId: string
  records: LmsDomainDnsRecord[]
}): Promise<string[]> {
  const ids: string[] = []
  for (const record of input.records) {
    const type = record.type.toUpperCase()
    if (!['A', 'AAAA', 'CNAME', 'TXT'].includes(type)) continue
    const query = new URLSearchParams({ type, name: record.name })
    const existing = await cloudflareRequest<Array<{
      id: string
      content: string
    }>>(`/zones/${input.zoneId}/dns_records?${query.toString()}`)
    const body = {
      type,
      name: record.name,
      content: record.value,
      ttl: 1,
      proxied: type === 'CNAME' ? Boolean(record.proxied) : false,
      comment: 'Dikelola otomatis oleh Nizam LMS',
    }
    if (existing[0]?.id) {
      const updated = await cloudflareRequest<{ id: string }>(
        `/zones/${input.zoneId}/dns_records/${existing[0].id}`,
        { method: 'PUT', body: JSON.stringify(body) },
      )
      ids.push(updated.id)
    } else {
      const created = await cloudflareRequest<{ id: string }>(
        `/zones/${input.zoneId}/dns_records`,
        { method: 'POST', body: JSON.stringify(body) },
      )
      ids.push(created.id)
    }
  }
  return ids
}

export async function deleteCloudflareDnsRecords(input: {
  zoneId: string
  recordIds: string[]
}): Promise<void> {
  for (const recordId of input.recordIds) {
    if (!recordId) continue
    await cloudflareRequest<{ id: string }>(
      `/zones/${input.zoneId}/dns_records/${encodeURIComponent(recordId)}`,
      { method: 'DELETE' },
    )
  }
}

/**
 * Kontrak adapter eksplisit agar service domain tidak bergantung pada detail API Railway.
 */
export const RailwayDomainProvider = {
  isReady: isRailwayDomainAutomationReady,
  createDomain: createRailwayDomain,
  getDomainStatus: getRailwayDomainStatus,
  deleteDomain: deleteRailwayDomain,
}

/**
 * Kontrak adapter DNS untuk zona Cloudflare yang memang diizinkan oleh konfigurasi.
 */
export const CloudflareDnsProvider = {
  resolveManagedZone: resolveManagedCloudflareZone,
  upsertRecords: upsertCloudflareDnsRecords,
  deleteRecords: deleteCloudflareDnsRecords,
}
