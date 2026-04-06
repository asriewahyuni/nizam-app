import { canSelectAllBranches, getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'
import { redirect } from 'next/navigation'
import { getBSCMetrics, getBSCSetup } from '@/modules/accounting/actions/bsc.actions'
import { BSCClient } from '@/app/(dashboard)/reports/bsc/BSCClient'

export const dynamic = 'force-dynamic'

export default async function BSCPage() {
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')
  const activeBranch = await getActiveBranch(orgData.org.id)
  const allowAllBranchSelection = await canSelectAllBranches(orgData.org.id)

  const [bscData, bscSetup] = await Promise.all([
    getBSCMetrics(orgData.org.id, activeBranch?.id),
    getBSCSetup(orgData.org.id, activeBranch?.id),
  ])

  return (
    <div className="p-10 min-h-screen">
      <BSCClient 
        orgId={orgData.org.id}
        activeBranchId={activeBranch?.id ?? null}
        activeBranchName={activeBranch?.name ?? null}
        allowAllBranchSelection={allowAllBranchSelection}
        initialData={bscData}
        setupData={bscSetup}
      />
    </div>
  )
}
