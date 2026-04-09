import { redirect } from 'next/navigation'
import CommissionClient from './CommissionClient'
import { getActiveResellers } from '@/modules/sales/actions/commission.actions'
import { getSales } from '@/modules/sales/actions/sales.actions'

import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'

export default async function CommissionPage() {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const orgId = orgData.org.id
  const activeBranch = await getActiveBranch(orgId)
  const [sales, resellers] = await Promise.all([
    getSales(orgId, activeBranch?.id),
    getActiveResellers(orgId),
  ])

  return (
    <CommissionClient
      orgId={orgId}
      sales={sales || []}
      resellers={resellers || []}
      activeBranchName={activeBranch?.name || null}
    />
  )
}
