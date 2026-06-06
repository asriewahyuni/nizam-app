import { notFound } from 'next/navigation'
import { queryPostgres } from '@/lib/db/postgres'
import type { BusPool, BusPoolTopUp, BusPoolSettlement, BusTicket, BusAgent, BusSchedule } from '@/modules/po-bus/lib/po-bus-types'
import type { FleetTerminal } from '@/types/database.types'
import { PoolPortalClient } from './PoolPortalClient'

export const revalidate = 0

async function getPoolDataByCode(code: string) {
  // Find pool by code across all orgs (portal is org-agnostic via code)
  const poolRes = await queryPostgres(
    `SELECT * FROM bus_pools WHERE UPPER(code) = $1 AND is_active = true LIMIT 1`,
    [code.toUpperCase()]
  )
  if (!poolRes.rows[0]) return null
  const pool = poolRes.rows[0] as BusPool

  const [agentsRes, topUpsRes, settlementsRes, ticketsRes, schedulesRes, terminalsRes] = await Promise.all([
    queryPostgres(`SELECT * FROM bus_agents WHERE org_id = $1 AND pool_id = $2 ORDER BY name`, [pool.org_id, pool.id]),
    queryPostgres(`SELECT * FROM bus_pool_top_ups WHERE org_id = $1 AND pool_id = $2 ORDER BY created_at DESC`, [pool.org_id, pool.id]),
    queryPostgres(`SELECT * FROM bus_pool_settlements WHERE org_id = $1 AND pool_id = $2 ORDER BY created_at DESC`, [pool.org_id, pool.id]),
    queryPostgres(
      `SELECT t.*, s.departure_time, r.origin, r.destination
       FROM bus_tickets t
       LEFT JOIN bus_schedules s ON t.schedule_id = s.id
       LEFT JOIN bus_routes r ON s.route_id = r.id
       WHERE t.org_id = $1 AND t.pool_id = $2
       ORDER BY t.created_at DESC
       LIMIT 200`,
      [pool.org_id, pool.id]
    ),
    queryPostgres(
      `SELECT s.*, r.name as route_name, r.origin, r.destination, r.base_price,
              b.plate_number, b.model
       FROM bus_schedules s
       LEFT JOIN bus_routes r ON s.route_id = r.id
       LEFT JOIN bus_units b ON s.bus_id = b.id
       WHERE s.org_id = $1 AND s.status != 'SELESAI'
       ORDER BY s.departure_time ASC
       LIMIT 50`,
      [pool.org_id]
    ),
    queryPostgres(
      `SELECT * FROM fleet_terminals WHERE org_id = $1 ORDER BY name`,
      [pool.org_id]
    ),
  ])

  return {
    pool,
    agents: agentsRes.rows as BusAgent[],
    topUps: topUpsRes.rows as BusPoolTopUp[],
    settlements: settlementsRes.rows as BusPoolSettlement[],
    tickets: ticketsRes.rows as (BusTicket & { departure_time?: string; origin?: string; destination?: string })[],
    schedules: schedulesRes.rows as (BusSchedule & { route_name?: string; origin?: string; destination?: string; base_price?: number; plate_number?: string; model?: string })[],
    terminals: terminalsRes.rows as FleetTerminal[],
  }
}

export default async function PoolPortalPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const data = await getPoolDataByCode(code)
  if (!data) notFound()

  return <PoolPortalClient {...data} />
}
