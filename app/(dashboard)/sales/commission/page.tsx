import { createClient } from '@/lib/supabase/server'
import CommissionClient from './CommissionClient'

import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'

export default async function CommissionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const orgData = await getActiveOrg()
  if (!orgData) return null

  const orgId = orgData.org.id
  const activeBranch = await getActiveBranch(orgId)
  
  let query = supabase.from('sales').select('status, grand_total, created_at, created_by')
    .eq('org_id', orgId)
    .in('status', ['FINISHED', 'ORDERED'])

  if (activeBranch?.id) {
    query = query.eq('branch_id', activeBranch.id)
  }

  const { data: sales } = await query

  return <CommissionClient sales={sales || []} />
}
