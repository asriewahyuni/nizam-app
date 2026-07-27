import { redirect } from 'next/navigation'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { resolveAuthTenantBranding } from '../tenant-branding.server'
import LoginFormClient from './LoginFormClient'

export default async function LoginPage() {
  const tenant = await resolveAuthTenantBranding()

  if (tenant && await getInternalAuthSession()) {
    redirect('/dashboard')
  }

  return (
    <LoginFormClient
      orgContext={null}
      tenantContext={tenant ? {
        id: tenant.orgId,
        name: tenant.name,
        logo_url: tenant.logoUrl,
        slug: tenant.orgSlug,
      } : null}
    />
  )
}
