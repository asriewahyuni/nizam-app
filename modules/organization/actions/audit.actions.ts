'use server'

import { createClient } from '@/lib/supabase/server'

export async function getAuditLogs(limit: number = 50) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // 1. Try specialized RPC first (Phase 1)
  const { data: rpcData, error: rpcError } = await supabase
    .rpc('get_admin_audit_trail', { p_limit: limit })

  if (!rpcError && rpcData) {
    return rpcData
  }

  // 2. Fallback: Direct Query (Phase 2)
  // If RPC is missing (PGRST202/PGRST205), we fetch directly to ensure the UI doesn't crash
  console.warn('RPC Audit failed, using fallback query...')
  const { data: directData, error: directError } = await supabase
    .from('audit_logs')
    .select(`
      id,
      org_id,
      created_at,
      action,
      table_name,
      record_id,
      old_data,
      new_data
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (directError) {
    console.error('Audit Fallback Error:', directError)
    return []
  }

  // Map to the format expected by the UI (v_admin_audit_trail format)
  return directData.map(log => ({
    ...log,
    user_email: 'System / User', // auth.users isn't directly joinable via anon/direct query easily
    user_name: 'Logged Actor',
    description: `${log.action} pada ${log.table_name}`
  }))
}
