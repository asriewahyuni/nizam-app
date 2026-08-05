import { redirect } from 'next/navigation'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { resolveAuthTenantBranding } from '../tenant-branding.server'
import RegisterMemberClient from './RegisterMemberClient'

export default async function RegisterMemberPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const tenant = await resolveAuthTenantBranding()
  const resolvedSearchParams = await searchParams
  const redirectTo = typeof resolvedSearchParams.redirectTo === 'string' ? resolvedSearchParams.redirectTo : '/dashboard'

  // Jika bukan tenant, jangan izinkan buka halaman ini, redirect ke halaman register utama
  if (!tenant) {
    redirect('/register')
  }

  if (await getInternalAuthSession()) {
    redirect(redirectTo)
  }

  return (
    <RegisterMemberClient
      tenantContext={{
        id: tenant.orgId,
        name: tenant.name,
        logo_url: tenant.logoUrl,
        slug: tenant.orgSlug,
      }}
    />
  )
}
