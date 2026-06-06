import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import {
  getBusCrewById,
  getSchedulesByCrewId,
  getBusTickets,
} from '@/modules/po-bus/actions/po-bus.actions'
import { CrewDetailClient } from './CrewDetailClient'

export const revalidate = 0

export default async function CrewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const orgId = orgData.org.id

  const [crew, schedules] = await Promise.all([
    getBusCrewById(orgId, id),
    getSchedulesByCrewId(orgId, id),
  ])

  if (!crew) notFound()

  // tickets on schedules driven by this crew (recent 20 schedules)
  const recentScheduleIds = schedules.slice(0, 20).map(s => s.id)
  const allTickets = recentScheduleIds.length > 0
    ? await getBusTickets(orgId, recentScheduleIds[0])
    : []

  return (
    <div className="p-4 md:p-8 min-h-screen bg-slate-50/30">
      <div className="mb-4">
        <Link href="/po-bus?tab=CREW" className="text-sm text-slate-500 hover:text-slate-700 transition-colors cursor-pointer flex items-center gap-1">
          ← Kembali ke Tim Bus
        </Link>
      </div>
      <CrewDetailClient
        crew={crew}
        schedules={schedules}
        orgId={orgId}
      />
    </div>
  )
}
