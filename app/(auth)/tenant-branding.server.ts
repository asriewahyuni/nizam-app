import 'server-only'

import { cache } from 'react'
import { headers } from 'next/headers'
import { resolveLmsTenantDomain } from '@/modules/ecommerce/domains/lms-domain.server'
import { getPortalTenant } from '@/modules/member/lib/portal.server'

export type AuthTenantBranding = {
  orgId: string
  orgSlug: string
  name: string
  logoUrl: string | null
}

/**
 * Resolve branding portal member (mis. COREiSEC) dari hostname request, dipakai
 * bersama oleh layout dan page auth agar Nizam hanya tampil untuk login ERP internal.
 */
export const resolveAuthTenantBranding = cache(async (): Promise<AuthTenantBranding | null> => {
  const requestHeaders = await headers()
  const hostname = String(
    requestHeaders.get('x-forwarded-host') || requestHeaders.get('host') || '',
  ).split(',')[0].trim()

  let tenant = null
  try {
    tenant = await resolveLmsTenantDomain(hostname)
  } catch {
    // Migrasi domain bisa belum terpasang pada environment pengembangan.
  }
  if (!tenant) return null

  const portal = await getPortalTenant(tenant.orgSlug)
  return {
    orgId: tenant.orgId,
    orgSlug: tenant.orgSlug,
    name: portal?.portalName || tenant.orgName,
    logoUrl: portal?.portalLogoUrl || null,
  }
})
