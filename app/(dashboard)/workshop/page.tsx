import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import {
  getWorkshopWorkOrders,
  getWorkshopVehicles,
} from '@/modules/workshop/actions/workshop.actions'
import { WorkshopClient } from './WorkshopClient'

export const revalidate = 0

export default async function WorkshopPage() {
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const orgId = orgData.org.id
  const supabase = await createClient()

  const [workOrders, vehicles, { data: contacts }] = await Promise.all([
    getWorkshopWorkOrders(orgId),
    getWorkshopVehicles(orgId),
    supabase.from('contacts').select('id, name').eq('org_id', orgId).order('name'),
  ])

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <WorkshopClient
        orgId={orgId}
        workOrders={workOrders}
        vehicles={vehicles}
        contacts={contacts || []}
      />
    </div>
  )
}
