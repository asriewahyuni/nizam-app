import { redirect } from 'next/navigation'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import {
  getBusUnits, getBusCrew, getBusMechanics,
  getBusServiceRecords, getBusTireRecords,
  getBusEmergencyCalls, getBusAgents,
  getBusRoutes, getBusSchedules, getBusTickets, getBusCheckpoints,
  getFixedAssetsForBus,
} from '@/modules/po-bus/actions/po-bus.actions'
import { POBusClient } from './POBusClient'

export const revalidate = 0

export default async function POBusPage() {
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const orgId = orgData.org.id

  const [
    units, crew, mechanics, serviceRecords, tireRecords,
    emergencyCalls, agents, routes, schedules, tickets, checkpoints, fixedAssets,
  ] = await Promise.all([
    getBusUnits(orgId),
    getBusCrew(orgId),
    getBusMechanics(orgId),
    getBusServiceRecords(orgId),
    getBusTireRecords(orgId),
    getBusEmergencyCalls(orgId),
    getBusAgents(orgId),
    getBusRoutes(orgId),
    getBusSchedules(orgId),
    getBusTickets(orgId),
    getBusCheckpoints(orgId),
    getFixedAssetsForBus(orgId),
  ])

  return (
    <div className="p-4 md:p-8 min-h-screen bg-slate-50/30">
      <POBusClient
        orgId={orgId}
        units={units}
        crew={crew}
        mechanics={mechanics}
        serviceRecords={serviceRecords}
        tireRecords={tireRecords}
        emergencyCalls={emergencyCalls}
        agents={agents}
        routes={routes}
        schedules={schedules}
        tickets={tickets}
        checkpoints={checkpoints}
        fixedAssets={fixedAssets}
      />
    </div>
  )
}
