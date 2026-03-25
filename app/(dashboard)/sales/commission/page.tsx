import { createClient } from '@/lib/supabase/server'
import CommissionClient from './CommissionClient'

export default async function CommissionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: orgMember } = await supabase.from('org_members')
    .select('org_id').eq('user_id', user.id).eq('is_active', true).single()

  if (!orgMember) return null
  
  const { data: sales } = await supabase.from('sales').select('status, grand_total, created_at, created_by')
    .eq('org_id', orgMember.org_id)
    .in('status', ['FINISHED', 'ORDERED'])

  return <CommissionClient sales={sales || []} />
}
