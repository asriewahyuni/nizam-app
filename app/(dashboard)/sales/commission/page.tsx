import { redirect } from 'next/navigation'
import CommissionClient from './CommissionClient'
import { getActiveResellers } from '@/modules/sales/actions/commission.actions'
import { getSales } from '@/modules/sales/actions/sales.actions'
import { getSaasSalesForCommission } from '@/modules/saas/actions/operator-sales.actions'
import { getChartOfAccounts } from '@/modules/accounting/actions/coa.actions'

import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'

export default async function CommissionPage() {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const orgId = orgData.org.id
  const activeBranch = await getActiveBranch(orgId)
  const [sales, saasSales, resellers, accounts] = await Promise.all([
    getSales(orgId, activeBranch?.id),
    getSaasSalesForCommission(orgId),
    getActiveResellers(orgId),
    getChartOfAccounts(orgId),
  ])

  const combinedSales = [...(sales || []), ...(saasSales || [])]

  return (
    <CommissionClient
      orgId={orgId}
      sales={combinedSales}
      resellers={resellers || []}
      accounts={accounts || []}
      activeBranchName={activeBranch?.name || null}
    />
  )
}
