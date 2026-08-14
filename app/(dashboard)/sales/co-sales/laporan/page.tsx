import { redirect } from 'next/navigation'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getCanvasserVans } from '@/modules/canvasser/actions/canvasser.actions'
import { getCanvasserPerformanceReport } from '@/modules/canvasser/actions/canvasser-reports.actions'
import { getOrgBrandColor } from '@/modules/canvasser/lib/canvasser-theme.server'
import { CanvasserReportClient } from './CanvasserReportClient'

function defaultDateRange() {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 6)
  const iso = (d: Date) => d.toISOString().split('T')[0]
  return { from: iso(from), to: iso(to) }
}

export default async function CanvasserReportPage() {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')
  const orgId = orgData.org.id

  const { from, to } = defaultDateRange()
  const [vans, report, brandColor] = await Promise.all([
    getCanvasserVans(orgId),
    getCanvasserPerformanceReport(orgId, { from, to }),
    getOrgBrandColor(orgId),
  ])

  return (
    <CanvasserReportClient
      orgId={orgId}
      vans={vans}
      initialReport={report}
      initialFrom={from}
      initialTo={to}
      brandColor={brandColor}
    />
  )
}
