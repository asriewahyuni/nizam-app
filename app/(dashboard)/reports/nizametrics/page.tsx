import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { redirect } from 'next/navigation'
import { getBSCMetrics } from '@/modules/accounting/actions/bsc.actions'
import { NizametricsClient } from '@/app/(dashboard)/reports/nizametrics/NizametricsClient'

export const dynamic = 'force-dynamic'

export default async function NizametricsPage() {
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const metrics = await getBSCMetrics(orgData.org.id).catch(() => null)

  return <NizametricsClient initialData={metrics ?? undefined} />
}
