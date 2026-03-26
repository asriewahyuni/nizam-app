import { createClient } from '@/lib/supabase/server'
import PipelineClient from './PipelineClient'

import { getActiveOrg } from '@/modules/organization/actions/org.actions'

export default async function PipelinePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const orgData = await getActiveOrg()
  if (!orgData) return null

  const orgId = orgData.org.id

  const { data: sales } = await supabase.from('sales').select('*, contacts(name)')
    .eq('org_id', orgId)
    .in('status', ['QUOTATION', 'DRAFT', 'ORDERED', 'FINISHED'])
    .order('created_at', { ascending: false })
  
  return <PipelineClient orgId={orgId} sales={sales || []} />
}
