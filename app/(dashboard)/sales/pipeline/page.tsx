import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PipelineClient from './PipelineClient'

import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'

export default async function PipelinePage() {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const supabase = await createClient()
  const orgId = orgData.org.id
  const activeBranch = await getActiveBranch(orgId)

  let query = supabase.from('sales').select('*, contacts(name, phone, email)')
    .eq('org_id', orgId)
    .in('status', ['QUOTATION', 'DRAFT', 'ORDERED', 'FINISHED'])

  if (activeBranch?.id) {
    query = query.eq('branch_id', activeBranch.id)
  }

  const { data: sales } = await query.order('created_at', { ascending: false })
  
  return <PipelineClient orgId={orgId} sales={sales || []} />
}
