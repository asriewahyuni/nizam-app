import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getSalesPageLeadsForOrg, getSalesPagesForOrg } from '@/modules/sales/lib/sales-page.server'
import SalesPageStudioClient from './SalesPageStudioClient'

export const metadata: Metadata = {
  title: 'Sales Page Studio',
  description: 'Generator sales page dengan Meta Pixel, SEO metadata, dan capture lead.',
}

export default async function SalesPageStudioPage() {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const orgId = orgData.org.id
  const orgSlug = orgData.org.slug?.trim() || orgId

  const [pages, leads] = await Promise.all([
    getSalesPagesForOrg(orgId),
    getSalesPageLeadsForOrg(orgId),
  ])

  return (
    <div className="p-10">
      <SalesPageStudioClient
        orgId={orgId}
        orgSlug={orgSlug}
        pages={pages}
        leads={leads}
      />
    </div>
  )
}
