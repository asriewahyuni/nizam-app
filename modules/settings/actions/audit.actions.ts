'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getAuditLogs(orgId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .rpc('get_audit_logs_with_users', { p_org_id: orgId })

  if (error) {
    console.error('Error fetching audit logs with users:', error)
    return []
  }
  
  return data
}

// Catatan: Fungsi createAuditLog bisa ditambahkan untuk trigger di sisi server actions lain
export async function createAuditLog(
   orgId: string, 
   userId: string | null, 
   action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VOID' | 'POST',
   table: string,
   recordId: string,
   oldData?: any,
   newData?: any
) {
   const supabase = await createClient()
   await supabase.from('audit_logs').insert({
      org_id: orgId,
      user_id: userId,
      action,
      table_name: table,
      record_id: recordId,
      old_data: oldData,
      new_data: newData,
      user_agent: 'NIZAM ERP System'
   })
}

export async function resetOrganizationData(orgId: string) {
   const supabase = await createClient()

   try {
      console.log('⚡ Attempting High-Performance Reset via RPC for org:', orgId)
      
      // 1. Try to use the SQL Function first (Server-side & Atomic)
      const { data: rpcRes, error: rpcError } = await supabase.rpc('reset_org_data', { p_org_id: orgId })
      
      if (!rpcError && rpcRes?.success) {
         console.log('✅ RPC Reset Success:', rpcRes.message)
         revalidatePath('/', 'layout')
         return { success: true }
      }

      console.warn('⚠️ RPC Reset Failed or missing, falling back to sequential loop:', rpcError?.message)

      // 2. Fallback: Sequential Deletion (Client-side control)
      const tables = [
         'asset_depreciation_logs',
         'fixed_assets',
         'sales_items',
         'sales',
         'purchase_items',
         'purchases',
         'inventory_stocks',
         'approval_requests',
         'journal_entries', // journal_lines cascades from here
         'audit_logs'
      ]

      for (const table of tables) {
         console.log(`🧹 Clearing table: ${table}`)
         const { error } = await supabase.from(table).delete().eq('org_id', orgId)
         
         if (error && error.code !== '42P01') { 
            // Only stop if it's a real data error, not a missing table
            if (error.code !== '42703') { // ignore missing org_id column
               console.error(`❌ Gagal di ${table}:`, error)
               return { success: false, error: `Error di tabel ${table}: ${error.message}` }
            }
         }
      }

      // Add a clean audit trail entry for the reset (if audit_logs wasn't cleared or we want a fresh start)
      await createAuditLog(orgId, null, 'DELETE', 'SYSTEM', 'RESET_ALL_DATA', { action: 'Full Reset Fallback' }, { status: 'Success' })

      revalidatePath('/', 'layout')
      return { success: true }

   } catch (error: any) {
      console.error('💣 Critical Reset Failure:', error)
      return { success: false, error: 'Internal Error: ' + error.message }
   }
}
