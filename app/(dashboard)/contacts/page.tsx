import { createClient } from '@/lib/supabase/server'
import { getContacts } from '@/modules/contacts/actions/contact.actions'
import { getDashboardAnalytics } from '@/modules/accounting/actions/analytics.actions'
import ContactClient from './ContactClient'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'

export default async function ContactsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const orgData = await getActiveOrg()
  if (!orgData) return null

  const orgId = orgData.org.id

  const [contacts, analytics] = await Promise.all([
    getContacts(orgId),
    getDashboardAnalytics(orgId)
  ])
  
  return (
    <ContactClient 
      orgId={orgId} 
      contacts={contacts} 
      customerPareto={analytics.customerPareto} 
    />
  )
}
