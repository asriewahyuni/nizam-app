import { createClient } from '@/lib/supabase/server'
import CommissionClient from './CommissionClient'
import { getActiveResellers } from '@/modules/sales/actions/commission.actions'
import { getSales } from '@/modules/sales/actions/sales.actions'

import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'

export default async function CommissionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const orgData = await getActiveOrg()
  if (!orgData) return null

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
