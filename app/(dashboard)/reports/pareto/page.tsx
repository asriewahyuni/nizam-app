import { redirect } from 'next/navigation'
import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getDashboardAnalytics } from '@/modules/accounting/actions/analytics.actions'
import { ParetoClient } from './ParetoClient'

export default async function ParetoPage() {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')
  const activeBranch = await getActiveBranch(orgData.org.id)

  const analytics = await getDashboardAnalytics(orgData.org.id, activeBranch?.id)

  return (
    <div className="p-4 md:p-10 space-y-10 min-h-screen bg-slate-50/10">
       <ParetoClient 
         orgId={orgData.org.id} 
         data={analytics}
       />
    </div>
  )
}
