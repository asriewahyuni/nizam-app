import { redirect } from 'next/navigation'
import { getContacts, getOrgSalesAssignees } from '@/modules/contacts/actions/contact.actions'
import { getDashboardAnalytics } from '@/modules/accounting/actions/analytics.actions'
import ContactClient from '../ContactClient'
import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'

export default async function CustomersPage() {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const orgId = orgData.org.id
  const activeBranch = await getActiveBranch(orgId)

  const [contacts, analytics, assignees] = await Promise.all([
    getContacts(orgId),
    getDashboardAnalytics(orgId, activeBranch?.id),
    getOrgSalesAssignees(orgId)
  ])

  return (
    <ContactClient
      orgId={orgId}
      contacts={contacts}
      customerPareto={analytics.customerPareto}
      initialTypeFilter="CUSTOMER"
      assignees={assignees}
    />
  )
}
