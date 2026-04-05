import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'
import { redirect } from 'next/navigation'
import { getBalanceSheet, getProfitLoss, getCashFlow } from '@/modules/accounting/actions/reports.actions'
import ReportsClient from './ReportsClient'

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ startDate?: string, endDate?: string, consolidated?: string }> }) {
  const params = await searchParams
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')
  const activeBranch = await getActiveBranch(orgData.org.id)
  const activeOrgWithParent = orgData.org as typeof orgData.org & { parent_org_id?: string | null }
  const isParentOrg = !activeOrgWithParent.parent_org_id

  const startDate = params.startDate
  const endDate = params.endDate
  const isConsolidated = isParentOrg && params.consolidated === 'true'

  const [balanceSheet, profitLoss, cashFlow] = await Promise.all([
    getBalanceSheet(orgData.org.id, endDate, activeBranch?.id, isConsolidated),
    getProfitLoss(orgData.org.id, startDate, endDate, activeBranch?.id, isConsolidated),
    getCashFlow(orgData.org.id, activeBranch?.id, isConsolidated)
  ])

  return (
    <ReportsClient 
      orgId={orgData.org.id}
      orgName={orgData.org.name}
      branchId={activeBranch?.id ?? null}
      balanceSheet={balanceSheet} 
      profitLoss={profitLoss} 
      cashFlow={cashFlow}
      isConsolidated={isConsolidated}
      isParentOrg={isParentOrg}
    />
  )
}
