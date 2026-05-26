import { canSelectAllBranches, getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'
import { redirect } from 'next/navigation'
import { getBSCMetrics, getBSCSetup } from '@/modules/accounting/actions/bsc.actions'
import { NizametricsClient } from '@/app/(dashboard)/reports/nizametrics/NizametricsClient'

export const dynamic = 'force-dynamic'

export default async function NizametricsPage() {
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')
  const activeBranch = await getActiveBranch(orgData.org.id)
  const allowAllBranchSelection = await canSelectAllBranches(orgData.org.id)

  const [metricsData, setupData] = await Promise.all([
    getBSCMetrics(orgData.org.id, activeBranch?.id),
    getBSCSetup(orgData.org.id, activeBranch?.id),
  ])

  return (
    <div className="p-5 min-h-screen">
      <NizametricsClient
        orgId={orgData.org.id}
        activeBranchId={activeBranch?.id ?? null}
        activeBranchName={activeBranch?.name ?? null}
        allowAllBranchSelection={allowAllBranchSelection}
        initialData={metricsData}
        setupData={setupData}
      />
    </div>
  )
}
