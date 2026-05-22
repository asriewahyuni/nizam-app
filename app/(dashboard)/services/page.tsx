import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getServiceOrders } from '@/modules/services/actions/service.actions'
import { ServiceOrderClient } from './ServiceOrderClient'

export const revalidate = 0

export default async function ServiceOrdersPage() {
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const supabase = await createClient()

  // Fetch all necessary data
  const [orders, { data: contacts }] = await Promise.all([
    getServiceOrders(orgData.org.id),
    supabase.from('contacts').select('id, name').eq('org_id', orgData.org.id)
  ])

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <ServiceOrderClient 
        orgId={orgData.org.id}
        orders={orders}
        contacts={contacts || []}
      />
    </div>
  )
}
