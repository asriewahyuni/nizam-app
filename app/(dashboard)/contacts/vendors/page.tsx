import { redirect } from 'next/navigation'
import { getContacts, getVendorGlobalStats } from '@/modules/contacts/actions/contact.actions'
import ContactClient from '../ContactClient'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'

export default async function VendorsPage() {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const orgId = orgData.org.id

  const [contacts, vendorStats] = await Promise.all([
    getContacts(orgId, 'SUPPLIER'),
    getVendorGlobalStats(orgId),
  ])

  return (
    <ContactClient
      orgId={orgId}
      contacts={contacts}
      customerPareto={null}
      lockedFilter="SUPPLIER"
      vendorStats={vendorStats}
    />
  )
}
