'use server'

import { createClient } from '@/lib/supabase/server'

export async function getResetRequestsCount(orgId: string) {
  const supabase = await createClient()
  
  const { count, error } = await supabase
    .from('employees')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('reset_requested', true)

  if (error) return 0
  return count || 0
}
