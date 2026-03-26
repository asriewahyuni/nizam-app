import { createClient } from '@/lib/supabase/server'
import CommissionClient from './CommissionClient'

import { getActiveOrg } from '@/modules/organization/actions/org.actions'

export default async function CommissionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const orgData = await getActiveOrg()
  if (!orgData) return null

  const orgId = orgData.org.id
  
  const { data: sales } = await supabase.from('sales').select('status, grand_total, created_at, created_by')
    .eq('org_id', orgId)
    .in('status', ['FINISHED', 'ORDERED'])

  return <CommissionClient sales={sales || []} />
}
