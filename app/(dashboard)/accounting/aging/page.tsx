import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'
import { redirect } from 'next/navigation'
import { getAgingSummary } from '@/modules/accounting/actions/aging.actions'
import { AgingClient } from '@/app/(dashboard)/accounting/aging/AgingClient'

export const dynamic = 'force-dynamic'

export default async function AgingPage({ searchParams }: { searchParams: { view?: string } }) {
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const activeBranch = await getActiveBranch(orgData.org.id)
  const summary = await getAgingSummary(orgData.org.id, activeBranch?.id)
  const initialView = (searchParams.view as 'AR' | 'AP') || 'AR'

  return (
    <div className="p-10 min-h-screen bg-slate-50/20">
      <AgingClient 
        initialData={summary} 
        initialView={initialView}
      />
    </div>
  )
}
