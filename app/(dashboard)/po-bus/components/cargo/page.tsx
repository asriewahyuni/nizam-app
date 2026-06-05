import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { redirect } from 'next/navigation'
import { getCargoShipments } from '@/modules/po-bus/actions/cargo.actions'
import { getTerminals, getSchedules } from '@/modules/fleet/actions/fleet.actions'
import { getCargoTariffs } from '@/modules/po-bus/actions/cargo-tariff.actions'
import { CargoClient } from './CargoClient'

export const revalidate = 0

export default async function CargoPage() {
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const orgId = orgData.org.id


  const [shipments, terminals, schedules, tariffs] = await Promise.all([
    getCargoShipments(orgId),
    getTerminals(orgId),
    getSchedules(orgId),
    getCargoTariffs(orgId)
  ])

  return (
    <div className="p-4 md:p-8 min-h-screen bg-slate-50/30">
      <CargoClient
        orgId={orgId}
        initialShipments={shipments}
        terminals={terminals}
        schedules={schedules}
        tariffs={tariffs}
        role={orgData.role || ''}
        permissions={orgData.permissions || []}
      />
    </div>
  )
}
