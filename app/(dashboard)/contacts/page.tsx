import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getContacts } from '@/modules/contacts/actions/contact.actions'
import { getDashboardAnalytics } from '@/modules/accounting/actions/analytics.actions'
import ContactClient from './ContactClient'
import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'

function toPlainValue(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map((item) => toPlainValue(item))
  if (typeof value === 'object') {
    if ('toNumber' in (value as Record<string, unknown>) && typeof (value as { toNumber?: unknown }).toNumber === 'function') {
      return (value as { toNumber: () => number }).toNumber()
    }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, toPlainValue(entry)])
    )
  }
  return value
}

type ContactsSearchParams = Promise<{
  type?: string | string[] | undefined
}>

export default async function ContactsPage({
  searchParams,
}: {
  searchParams?: ContactsSearchParams
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const orgId = orgData.org.id
  const activeBranch = await getActiveBranch(orgId)
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const rawType = Array.isArray(resolvedSearchParams.type) ? resolvedSearchParams.type[0] : resolvedSearchParams.type
  const initialTypeFilter = rawType === 'CUSTOMER' || rawType === 'SUPPLIER' ? rawType : 'ALL'

  const [contacts, analytics] = await Promise.all([
    getContacts(orgId),
    getDashboardAnalytics(orgId, activeBranch?.id)
  ])

  const safeContacts = toPlainValue(contacts) as any[]
  const safeCustomerPareto = toPlainValue(analytics.customerPareto)
  
  return (
    <ContactClient 
      orgId={orgId} 
      contacts={safeContacts} 
      customerPareto={safeCustomerPareto} 
      initialTypeFilter={initialTypeFilter}
    />
  )
}
