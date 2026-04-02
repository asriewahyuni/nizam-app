import { createClient } from '@/lib/supabase/server'
import { getContacts } from '@/modules/contacts/actions/contact.actions'
import { getDashboardAnalytics } from '@/modules/accounting/actions/analytics.actions'
import ContactClient from './ContactClient'
import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'

type ContactsSearchParams = Promise<{
  type?: string | string[] | undefined
}>

export default async function ContactsPage({
  searchParams,
}: {
  searchParams?: ContactsSearchParams
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const orgData = await getActiveOrg()
  if (!orgData) return null

  const orgId = orgData.org.id
  const activeBranch = await getActiveBranch(orgId)
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const rawType = Array.isArray(resolvedSearchParams.type) ? resolvedSearchParams.type[0] : resolvedSearchParams.type
  const initialTypeFilter = rawType === 'CUSTOMER' || rawType === 'SUPPLIER' ? rawType : 'ALL'

  const [contacts, analytics] = await Promise.all([
    getContacts(orgId),
    getDashboardAnalytics(orgId, activeBranch?.id)
  ])
  
  return (
    <ContactClient 
      orgId={orgId} 
      contacts={contacts} 
      customerPareto={analytics.customerPareto} 
      initialTypeFilter={initialTypeFilter}
    />
  )
}
