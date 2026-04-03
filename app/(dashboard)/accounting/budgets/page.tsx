import { canSelectAllBranches, getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'
import { redirect } from 'next/navigation'
import { getBudgets, getBudgetVsActual } from '@/modules/accounting/actions/budget.actions'
import { getChartOfAccounts } from '@/modules/accounting/actions/coa.actions'
import { BudgetClient } from '@/app/(dashboard)/accounting/budgets/BudgetClient'

export const dynamic = 'force-dynamic'

export default async function BudgetPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const params = await searchParams
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')
  const activeBranch = await getActiveBranch(orgData.org.id)

  // Set default period: This month (YYYY-MM-01)
  const now = new Date()
  const currentPeriod = params.period || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const monthEnd = new Date(`${currentPeriod}T00:00:00`)
  monthEnd.setMonth(monthEnd.getMonth() + 1)
  monthEnd.setDate(0)
  const currentPeriodEnd = monthEnd.toISOString().split('T')[0]
  
  const [budgets, bva, accounts, allowAllBranchSelection] = await Promise.all([
    getBudgets(orgData.org.id, currentPeriod, activeBranch?.id),
    getBudgetVsActual(orgData.org.id, currentPeriod, currentPeriodEnd, activeBranch?.id),
    getChartOfAccounts(orgData.org.id),
    canSelectAllBranches(orgData.org.id),
  ])

  return (
    <div className="p-10 min-h-screen bg-slate-50/20">
      <BudgetClient 
        orgId={orgData.org.id} 
        activeBranchId={activeBranch?.id ?? null}
        activeBranchName={activeBranch?.name ?? null}
        allowAllBranchSelection={allowAllBranchSelection}
        initialBudgets={budgets} 
        reportData={bva}
        accounts={accounts}
        currentPeriod={currentPeriod}
      />
    </div>
  )
}
