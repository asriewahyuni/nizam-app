import { redirect } from 'next/navigation'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import {
  getBusUnits, getBusCrew, getBusMechanics,
  getBusServiceRecords, getBusTireRecords,
  getBusEmergencyCalls, getBusAgents,
  getBusRoutes, getBusSchedules, getBusTickets, getBusCheckpoints,
  getFixedAssetsForBus,
  getBusPools, getBusPoolTopUps, getBusPoolSettlements,
} from '@/modules/po-bus/actions/po-bus.actions'
import { getCargoShipments } from '@/modules/po-bus/actions/cargo.actions'
import { getCargoTariffs } from '@/modules/po-bus/actions/cargo-tariff.actions'
import { getTerminals } from '@/modules/fleet/actions/fleet.actions'
import { POBusClient } from './POBusClient'

export const revalidate = 0

export default async function POBusPage() {
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const orgId = orgData.org.id

  const [
    units, crew, mechanics, serviceRecords, tireRecords,
    emergencyCalls, agents, routes, schedules, tickets, checkpoints, fixedAssets,
    pools, poolTopUps, poolSettlements,
    cargoShipments, terminals, cargoTariffs
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
    getBusPools(orgId),
    getBusPoolTopUps(orgId),
    getBusPoolSettlements(orgId),
    getCargoShipments(orgId, null),
    getTerminals(orgId),
    getCargoTariffs(orgId)
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
        pools={pools}
        poolTopUps={poolTopUps}
        poolSettlements={poolSettlements}
        cargoShipments={cargoShipments}
        terminals={terminals}
        cargoTariffs={cargoTariffs}
      />
    </div>
  )
}
