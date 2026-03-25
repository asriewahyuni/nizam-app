import { redirect } from 'next/navigation'
import { getSession } from '@/modules/auth/actions/auth.actions'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getDashboardAnalytics } from '@/modules/accounting/actions/analytics.actions'
import { ParetoClient } from './ParetoClient'

export default async function ParetoPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const analytics = await getDashboardAnalytics(orgData.org.id)

  return (
    <div className="p-4 md:p-10 space-y-10 min-h-screen bg-slate-50/10">
       <ParetoClient 
         orgId={orgData.org.id} 
         data={analytics}
       />
    </div>
  )
}
