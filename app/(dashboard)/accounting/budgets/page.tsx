import { canSelectAllBranches, getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'
import { redirect } from 'next/navigation'
import { getBudgets, getBudgetPeriodStatus, getBudgetVsActual } from '@/modules/accounting/actions/budget.actions'
import { getChartOfAccounts } from '@/modules/accounting/actions/coa.actions'
import { BudgetClient } from '@/app/(dashboard)/accounting/budgets/BudgetClient'

export const dynamic = 'force-dynamic'

function getMonthEndDate(periodStart: string) {
  const [yearPart, monthPart] = periodStart.split('-')
  const year = Number(yearPart)
  const month = Number(monthPart)

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return periodStart
  }

  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${yearPart}-${monthPart}-${String(lastDayOfMonth).padStart(2, '0')}`
}

export default async function BudgetPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const params = await searchParams
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')
  const activeBranch = await getActiveBranch(orgData.org.id)

  // Set default period: This month (YYYY-MM-01)
  const now = new Date()
  const currentPeriod = params.period || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const currentPeriodEnd = getMonthEndDate(currentPeriod)
  
  const [budgets, bva, accounts, allowAllBranchSelection, periodStatus] = await Promise.all([
    getBudgets(orgData.org.id, currentPeriod, activeBranch?.id),
    getBudgetVsActual(orgData.org.id, currentPeriod, currentPeriodEnd, activeBranch?.id),
    getChartOfAccounts(orgData.org.id),
    canSelectAllBranches(orgData.org.id),
    getBudgetPeriodStatus(orgData.org.id, currentPeriod),
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
        periodStatus={periodStatus}
      />
    </div>
  )
}
