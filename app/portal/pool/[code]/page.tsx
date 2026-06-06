import { notFound } from 'next/navigation'
import { queryPostgres } from '@/lib/db/postgres'
import type { BusPool, BusPoolTopUp, BusPoolSettlement, BusTicket, BusAgent } from '@/modules/po-bus/lib/po-bus-types'
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

  const [agentsRes, topUpsRes, settlementsRes, ticketsRes] = await Promise.all([
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
  ])

  return {
    pool,
    agents: agentsRes.rows as BusAgent[],
    topUps: topUpsRes.rows as BusPoolTopUp[],
    settlements: settlementsRes.rows as BusPoolSettlement[],
    tickets: ticketsRes.rows as (BusTicket & { departure_time?: string; origin?: string; destination?: string })[],
  }
}

export default async function PoolPortalPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const data = await getPoolDataByCode(code)
  if (!data) notFound()

  return <PoolPortalClient {...data} />
}
