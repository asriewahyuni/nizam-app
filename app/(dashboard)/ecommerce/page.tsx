import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getEcommerceDashboardData } from '@/modules/ecommerce/lib/ecommerce.server'
import EcommerceAdminClient from './EcommerceAdminClient'

export const metadata: Metadata = {
  title: 'E-Commerce',
  description: 'Kelola store, katalog, theme builder, order, dan review pembayaran e-commerce.',
}

export default async function EcommercePage() {
  const orgData = await getActiveOrg()
  if (!orgData?.org?.id) redirect('/onboarding')

  const dashboardData = await getEcommerceDashboardData()

  return (
    <div className="p-10">
      <EcommerceAdminClient
        orgSlug={String(orgData.org.slug || orgData.org.id)}
        orgName={String(orgData.org.name || '')}
        dashboardData={dashboardData}
      />
    </div>
  )
}
