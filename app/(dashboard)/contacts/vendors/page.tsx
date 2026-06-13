import { redirect } from 'next/navigation'
import { getContacts } from '@/modules/contacts/actions/contact.actions'
import ContactClient from '../ContactClient'
import VendorDashboard from './VendorDashboard'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getVendorDashboardAnalytics } from '@/modules/contacts/actions/contact.analytics'

export default async function VendorsPage() {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const orgId = orgData.org.id

  const [contacts, vendorAnalytics] = await Promise.all([
    getContacts(orgId, 'SUPPLIER'),
    getVendorDashboardAnalytics(orgId),
  ])

  return (
    <div className="max-w-7xl mx-auto pb-24 space-y-8">
      {vendorAnalytics && <VendorDashboard data={vendorAnalytics} />}
      <ContactClient
        orgId={orgId}
        contacts={contacts}
        customerPareto={null}
        lockedFilter="SUPPLIER"
        vendorStats={vendorAnalytics ? {
          totalVendors: vendorAnalytics.hero.totalVendors,
          totalApOutstanding: vendorAnalytics.hero.totalApOutstanding,
          totalPurchasesThisMonth: vendorAnalytics.hero.totalPurchasesThisMonth,
          totalActivePo: vendorAnalytics.hero.totalActivePo,
          topVendors: vendorAnalytics.topVendors.map(v => ({ name: v.name, total: v.total })),
        } : undefined}
      />
    </div>
  )
}
