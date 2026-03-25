import { createClient } from '@/lib/supabase/server'
import PipelineClient from './PipelineClient'

export default async function PipelinePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: orgMember } = await supabase.from('org_members')
    .select('org_id').eq('user_id', user.id).eq('is_active', true).single()

  if (!orgMember) return null

  const { data: sales } = await supabase.from('sales').select('*, contacts(name)')
    .eq('org_id', orgMember.org_id)
    .in('status', ['QUOTATION', 'DRAFT', 'ORDERED', 'FINISHED'])
    .order('created_at', { ascending: false })
  
  return <PipelineClient orgId={orgMember.org_id} sales={sales || []} />
}
