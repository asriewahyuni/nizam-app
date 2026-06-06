import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import {
  getBusPoolById,
  getBusAgents,
  getBusPoolTopUps,
  getBusPoolSettlements,
  getBusTickets,
  getCargoCountByPool,
} from '@/modules/po-bus/actions/po-bus.actions'
import { PoolDetailClient } from './PoolDetailClient'

export const revalidate = 0

export default async function PoolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const orgId = orgData.org.id

  const [pool, agents, topUps, settlements, tickets, cargoCounts] = await Promise.all([
    getBusPoolById(orgId, id),
    getBusAgents(orgId),
    getBusPoolTopUps(orgId, id),
    getBusPoolSettlements(orgId, id),
    getBusTickets(orgId),
    getCargoCountByPool(orgId),
  ])

  if (!pool) notFound()

  const poolAgents = agents.filter(a => a.pool_id === pool.id)
  const poolTickets = tickets.filter(t => t.pool_id === pool.id)
  const cargoCount = cargoCounts[pool.id] ?? 0

  return (
    <div className="p-4 md:p-8 min-h-screen bg-slate-50/30">
      <div className="mb-4">
        <Link href="/po-bus?tab=POOL" className="text-sm text-slate-500 hover:text-slate-700 transition-colors cursor-pointer flex items-center gap-1">
          ← Kembali ke Pool & Agen
        </Link>
      </div>
      <PoolDetailClient
        pool={pool}
        agents={poolAgents}
        topUps={topUps}
        settlements={settlements}
        tickets={poolTickets}
        cargoCount={cargoCount}
        orgId={orgId}
      />
    </div>
  )
}
