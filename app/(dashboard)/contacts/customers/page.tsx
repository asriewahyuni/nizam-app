import { redirect } from 'next/navigation'
import { getContacts, getOrgSalesAssignees } from '@/modules/contacts/actions/contact.actions'
import { getDashboardAnalytics } from '@/modules/accounting/actions/analytics.actions'
import ContactClient from '../ContactClient'
import CustomerDashboard from './CustomerDashboard'
import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getCustomerDashboardAnalytics } from '@/modules/contacts/actions/contact.analytics'

export default async function CustomersPage() {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const orgId = orgData.org.id
  const activeBranch = await getActiveBranch(orgId)

  const [contacts, analytics, assignees, customerAnalytics] = await Promise.all([
    getContacts(orgId, 'CUSTOMER'),
    getDashboardAnalytics(orgId, activeBranch?.id),
    getOrgSalesAssignees(orgId),
    getCustomerDashboardAnalytics(orgId),
  ])

  return (
    <div className="max-w-7xl mx-auto pb-24 space-y-8">
      {customerAnalytics && <CustomerDashboard data={customerAnalytics} />}
      <ContactClient
        orgId={orgId}
        contacts={contacts}
        customerPareto={analytics.customerPareto}
        lockedFilter="CUSTOMER"
        assignees={assignees}
      />
    </div>
  )
}
