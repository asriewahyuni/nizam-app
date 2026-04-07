import { canSelectAllBranches, getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'
import { redirect } from 'next/navigation'
import { getBalanceSheet, getProfitLoss, getCashFlow } from '@/modules/accounting/actions/reports.actions'
import { unstable_noStore as noStore } from 'next/cache'
import ReportsClient from './ReportsClient'

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ startDate?: string, endDate?: string, consolidated?: string }> }) {
  noStore()
  const params = await searchParams
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')
  const activeBranch = await getActiveBranch(orgData.org.id)
  const canAccessAllBranches = await canSelectAllBranches(orgData.org.id)
  const activeOrgWithParent = orgData.org as typeof orgData.org & { parent_org_id?: string | null }
  const isParentOrg = !activeOrgWithParent.parent_org_id

  const startDate = params.startDate
  const endDate = params.endDate
  const isConsolidated = isParentOrg && params.consolidated === 'true'
  const reportBranchId = isConsolidated ? null : (canAccessAllBranches ? null : (activeBranch?.id ?? null))

  const [balanceSheet, profitLoss, cashFlow] = await Promise.all([
    getBalanceSheet(orgData.org.id, endDate, reportBranchId, isConsolidated),
    getProfitLoss(orgData.org.id, startDate, endDate, reportBranchId, isConsolidated),
    getCashFlow(orgData.org.id, reportBranchId, isConsolidated, { startDate, endDate })
  ])

  return (
    <ReportsClient 
      orgId={orgData.org.id}
      orgName={orgData.org.name}
      branchId={reportBranchId}
      balanceSheet={balanceSheet} 
      profitLoss={profitLoss} 
      cashFlow={cashFlow}
      isConsolidated={isConsolidated}
      isParentOrg={isParentOrg}
    />
  )
}
