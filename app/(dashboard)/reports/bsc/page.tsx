import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'
import { redirect } from 'next/navigation'
import { getBSCMetrics } from '@/modules/accounting/actions/bsc.actions'
import { BSCClient } from '@/app/(dashboard)/reports/bsc/BSCClient'

export const dynamic = 'force-dynamic'

export default async function BSCPage() {
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')
  const activeBranch = await getActiveBranch(orgData.org.id)

  const bscData = await getBSCMetrics(orgData.org.id, activeBranch?.id)

  return (
    <div className="p-10 min-h-screen">
      <BSCClient 
        orgId={orgData.org.id} 
        initialData={bscData} 
      />
    </div>
  )
}
