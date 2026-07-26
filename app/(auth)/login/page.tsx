import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { resolveLmsTenantDomain } from '@/modules/ecommerce/domains/lms-domain.server'
import LoginFormClient from './LoginFormClient'

export default async function LoginPage() {
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

  if (tenant && await getInternalAuthSession()) {
    redirect('/dashboard')
  }

  return (
    <LoginFormClient
      orgContext={null}
      tenantContext={tenant ? {
        id: tenant.orgId,
        name: tenant.orgName,
        logo_url: null,
        slug: tenant.orgSlug,
      } : null}
    />
  )
}
