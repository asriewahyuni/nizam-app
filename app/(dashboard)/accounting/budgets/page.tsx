import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { redirect } from 'next/navigation'
import { getBudgets, getBudgetVsActual } from '@/modules/accounting/actions/budget.actions'
import { getChartOfAccounts } from '@/modules/accounting/actions/coa.actions'
import { BudgetClient } from '@/app/(dashboard)/accounting/budgets/BudgetClient'

export const dynamic = 'force-dynamic'

export default async function BudgetPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const params = await searchParams
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  // Set default period: This month (YYYY-MM-01)
  const now = new Date()
  const currentPeriod = params.period || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  
  const [budgets, bva, accounts] = await Promise.all([
    getBudgets(orgData.org.id, currentPeriod),
    getBudgetVsActual(orgData.org.id, currentPeriod, currentPeriod),
    getChartOfAccounts(orgData.org.id)
  ])

  return (
    <div className="p-10 min-h-screen bg-slate-50/20">
      <BudgetClient 
        orgId={orgData.org.id} 
        initialBudgets={budgets} 
        reportData={bva}
        accounts={accounts}
        currentPeriod={currentPeriod}
      />
    </div>
  )
}
