import { redirect } from 'next/navigation'
import { unstable_noStore as noStore } from 'next/cache'
import { getActiveOrg, getActiveBranch } from '@/modules/organization/actions/org.actions'
import { getFinancialDashboardData } from '@/modules/accounting/actions/financial-dashboard.actions'
import FinancialDashboardClient from './FinancialDashboardClient'

export default async function FinancialDashboardPage() {
  noStore()
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const activeBranch = await getActiveBranch(orgData.org.id)
  const data = await getFinancialDashboardData(orgData.org.id, activeBranch?.id ?? null)

  return <FinancialDashboardClient data={data} orgId={orgData.org.id} />
}
