import { redirect } from 'next/navigation'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { resolveAuthTenantBranding } from '../tenant-branding.server'
import LoginFormClient from './LoginFormClient'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const tenant = await resolveAuthTenantBranding()
  const resolvedSearchParams = await searchParams
  const redirectTo = typeof resolvedSearchParams.redirectTo === 'string' ? resolvedSearchParams.redirectTo : '/dashboard'

  if (await getInternalAuthSession()) {
    redirect(redirectTo)
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
