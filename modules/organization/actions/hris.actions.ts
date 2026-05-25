'use server'

import { createClient } from '@/lib/supabase/server'

export async function getResetRequestsCount(orgId: string, branchId?: string | null) {
  const supabase = await createClient()

  let query = supabase
    .from('employees')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('reset_requested', true)

  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  const { count, error } = await query

  if (error) return 0
  return count || 0
}
