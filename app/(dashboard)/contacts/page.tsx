import { createClient } from '@/lib/supabase/server'
import { getContacts } from '@/modules/contacts/actions/contact.actions'
import { getDashboardAnalytics } from '@/modules/accounting/actions/analytics.actions'
import ContactClient from './ContactClient'

export default async function ContactsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: orgMember } = await supabase.from('org_members')
    .select('org_id').eq('user_id', user.id).eq('is_active', true).single()

  if (!orgMember) return null

  const [contacts, analytics] = await Promise.all([
    getContacts(orgMember.org_id),
    getDashboardAnalytics(orgMember.org_id)
  ])
  
  return (
    <ContactClient 
      orgId={orgMember.org_id} 
      contacts={contacts} 
      customerPareto={analytics.customerPareto} 
    />
  )
}
