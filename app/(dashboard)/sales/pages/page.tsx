import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getModuleInstanceStatus } from '@/modules/marketplace/actions/marketplace.actions'
import { getSalesPageAiProfileForOrg, getSalesPageLeadsForOrg, getSalesPagesForOrg } from '@/modules/sales/lib/sales-page.server'
import { getServiceOrderSeeds } from '@/modules/services/actions/service.actions'
import SalesPageStudioClient from './SalesPageStudioClient'

export const metadata: Metadata = {
  title: 'Sales Page Studio',
  description: 'Generator sales page dengan Meta Pixel, SEO metadata, dan capture lead.',
}

export default async function SalesPageStudioPage() {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  // ── Module Onboarding Guard ──
  const moduleInstance = await getModuleInstanceStatus(orgData.org.id, 'Sales Page')
  if (!moduleInstance || moduleInstance.status !== 'READY') {
    return redirect('/sales/pages/onboarding')
  }

  const orgId = orgData.org.id
  const orgSlug = orgData.org.slug?.trim() || orgId

  const [pages, leads, serviceSeeds, aiProfile] = await Promise.all([
    getSalesPagesForOrg(orgId),
    getSalesPageLeadsForOrg(orgId),
    getServiceOrderSeeds(orgId),
    getSalesPageAiProfileForOrg(orgId),
  ])

  return (
    <div className="p-10">
      <SalesPageStudioClient
        orgId={orgId}
        orgName={orgData.org.name}
        orgSlug={orgSlug}
        pages={pages}
        leads={leads}
        serviceSeeds={serviceSeeds}
        aiProfile={aiProfile}
      />
    </div>
  )
}
