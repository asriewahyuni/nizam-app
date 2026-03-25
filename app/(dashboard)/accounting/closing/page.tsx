import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getFiscalPeriods } from '@/modules/accounting/actions/closing.actions'
import { redirect } from 'next/navigation'
import ClosingClient from './ClosingClient'

export default async function ClosingPage() {
  const activeOrg = await getActiveOrg()
  if (!activeOrg) redirect('/onboarding')

  const orgId = activeOrg.org.id
  const periods = await getFiscalPeriods(orgId)

  return (
    <main className="p-8 text-slate-900">
      <ClosingClient periods={periods} orgId={orgId} />
    </main>
  )
}
