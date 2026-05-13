import { unstable_noStore as noStore } from 'next/cache'
import { redirect } from 'next/navigation'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getFxGainLossHistory } from '@/modules/accounting/actions/forex.actions'
import { ForexClient } from './ForexClient'

export default async function ForexPage() {
  noStore()

  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const { data: history } = await getFxGainLossHistory(orgData.org.id)

  return <ForexClient orgId={orgData.org.id} history={history || []} />
}
