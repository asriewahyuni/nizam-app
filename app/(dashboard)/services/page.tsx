import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getContacts } from '@/modules/contacts/actions/contact.actions'
import { getServiceOrders } from '@/modules/services/actions/service.actions'
import { ServiceOrderClient } from './ServiceOrderClient'
import { toPlainSerializable } from '@/lib/serialization'

export const revalidate = 0

export default async function ServiceOrdersPage() {
  const session = await auth()
  if (!session?.user?.id) return redirect('/login')

  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const [orders, contacts] = await Promise.all([
    getServiceOrders(orgData.org.id),
    getContacts(orgData.org.id),
  ])

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <ServiceOrderClient 
        orgId={orgData.org.id}
        orders={toPlainSerializable(orders)}
        contacts={toPlainSerializable(contacts)}
      />
    </div>
  )
}
