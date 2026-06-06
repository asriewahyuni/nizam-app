import { notFound } from 'next/navigation'
import { queryPostgres } from '@/lib/db/postgres'
import type { BusCrew, BusSchedule } from '@/modules/po-bus/lib/po-bus-types'
import { CrewPortalClient } from './CrewPortalClient'

export const revalidate = 0

async function getCrewDataByNik(nik: string) {
  const crewRes = await queryPostgres(
    `SELECT * FROM bus_crew WHERE nik = $1 LIMIT 1`,
    [nik]
  )
  if (!crewRes.rows[0]) return null
  const crew = crewRes.rows[0] as BusCrew

  const schedulesRes = await queryPostgres(
    `SELECT s.*,
       r.id as route_id, r.name as route_name, r.origin, r.destination, r.base_price,
       b.id as bus_id, b.plate_number, b.model as bus_model
     FROM bus_schedules s
     LEFT JOIN bus_routes r ON s.route_id = r.id
     LEFT JOIN bus_units b ON s.bus_id = b.id
     WHERE s.org_id = $1
       AND (s.driver_id = $2 OR s.helper_id = $2)
     ORDER BY s.departure_time DESC
     LIMIT 60`,
    [crew.org_id, crew.id]
  )

  const schedules = schedulesRes.rows.map(row => ({
    id: row.id,
    org_id: row.org_id,
    branch_id: row.branch_id,
    route_id: row.route_id,
    bus_id: row.bus_id,
    driver_id: row.driver_id,
    helper_id: row.helper_id,
    departure_time: row.departure_time,
    arrival_time: row.arrival_time,
    status: row.status,
    notes: row.notes,
    created_at: row.created_at,
    route: row.route_id ? { id: row.route_id, name: row.route_name, origin: row.origin, destination: row.destination, base_price: row.base_price } : null,
    bus: row.bus_id ? { id: row.bus_id, plate_number: row.plate_number, model: row.bus_model } : null,
  })) as BusSchedule[]

  return { crew, schedules }
}

export default async function CrewPortalPage({ params }: { params: Promise<{ nik: string }> }) {
  const { nik } = await params
  const data = await getCrewDataByNik(nik)
  if (!data) notFound()

  return <CrewPortalClient crew={data.crew} schedules={data.schedules} />
}
