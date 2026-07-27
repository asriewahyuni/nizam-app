import { notFound, redirect } from 'next/navigation'
import {
  getPortalAffiliateDashboard,
  getPortalMemberContext,
  getPortalTenant,
} from '@/modules/member/lib/portal.server'
import { MemberAffiliatePageClient } from './MemberAffiliatePageClient'

export default async function MemberAffiliatePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const tenant = await getPortalTenant(orgSlug)
  if (!tenant) notFound()

  const member = await getPortalMemberContext(tenant)
  if (!member) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/member/${orgSlug}/afiliasi`)}`)
  }

  const dashboard = await getPortalAffiliateDashboard(tenant, member)
  const referralHost = tenant.primaryHostname || 'member.coreisec.id'

  return (
    <MemberAffiliatePageClient
      orgSlug={orgSlug}
      tenantName={tenant.portalName || tenant.name}
      referralHost={referralHost}
      dashboard={dashboard}
    />
  )
}
