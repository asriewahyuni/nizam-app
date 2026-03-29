'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getPendingApprovals(orgId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('approval_requests')
    .select('*')
    .eq('org_id', orgId)
    .eq('status', 'PENDING')
    .order('requested_at', { ascending: false })

  if (error) {
    (console as any).error('Error fetching approvals:', error)
    return []
  }
  
  return data
}

export async function getApprovalHistory(orgId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('approval_requests')
    .select('*')
    .eq('org_id', orgId)
    .neq('status', 'PENDING')
    .order('decided_at', { ascending: false })
    .limit(50)

  if (error) {
    (console as any).error('Error fetching approval history:', error)
    return []
  }
  
  return data
}
export async function getApprovalDetail(orgId: string, sourceId: string, sourceType: string) {
  const supabase = await createClient()

  let dataRes: any = { data: null, error: null }
  
  if (sourceType === 'PURCHASE_ORDER') {
    dataRes = await (supabase as any).from('purchases' as any).select('*, purchase_items(*, products(name, unit))').eq('id', sourceId).eq('org_id', orgId).single()
  } else if (sourceType === 'SALES_ORDER') {
    dataRes = await (supabase as any).from('sales' as any).select('*, contacts(name, phone, email), sales_items(*, products(name, sku, unit))').eq('id', sourceId).eq('org_id', orgId).single()
  } else if (sourceType === 'REIMBURSEMENT') {
    dataRes = await (supabase as any).from('reimbursements').select('*, items:reimbursement_items(*, account:accounts(code, name))').eq('id', sourceId).eq('org_id', orgId).single()
  }

  if ((dataRes as any).error) return { data: null, error: (dataRes as any).error.message }

  // Fetch History Logs
  const { data: logs } = await supabase
    .from('approval_requests')
    .select('*')
    .eq('source_id', sourceId)
    .eq('source_type', sourceType)
    .order('requested_at', { ascending: true })

  return { data: dataRes.data, logs: logs || [], error: null }
}

export async function getPendingApprovalsCount(orgId: string) {
  const supabase = await createClient()

  const { count, error } = await supabase
    .from('approval_requests')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'PENDING')

  if (error) {
    (console as any).error('Error fetching approval counts:', error)
    return 0
  }
  
  return count || 0
}

export async function decideApproval(id: string, orgId: string, status: 'APPROVED' | 'REJECTED', notes?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // 1. Ambil info request terlebih dahulu untuk mengetahui source_type dan source_id
  const { data: reqData, error: reqErr } = await supabase
    .from('approval_requests')
    .select('source_type, source_id')
    .eq('id', id)
    .single()

  if (reqErr || !reqData) return { error: 'Request tidak ditemukan' }

  // 2. Update status di tabel approval
  const { error } = await supabase
    .from('approval_requests')
    .update({ 
      status, 
      notes, 
      approver_id: user.id,
      decided_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('org_id', orgId)

  if (error) return { error: error.message }

  // 3. Efek Samping (Side Effects) ke dokumen asli
  if (reqData.source_type === 'PURCHASE_ORDER') {
      const newPoStatus = status === 'APPROVED' ? 'ORDERED' : 'VOIDED'
      await supabase
        .from('purchases' as any)
        .update({ status: newPoStatus })
        .eq('id', reqData.source_id)
        .eq('org_id', orgId)
  }

  if (reqData.source_type === 'SALES_ORDER') {
      const newSoStatus = status === 'APPROVED' ? 'ORDERED' : 'VOIDED'
      await supabase
        .from('sales' as any)
        .update({ status: newSoStatus })
        .eq('id', reqData.source_id)
        .eq('org_id', orgId)
  }

  if (reqData.source_type === 'REIMBURSEMENT') {
      await supabase
        .from('reimbursements')
        .update({ status: status }) // APPROVED or REJECTED
        .eq('id', reqData.source_id)
        .eq('org_id', orgId)
  }

  revalidatePath('/', 'layout') // Global refresh agar indikator lonceng berubah
  return { success: true }
}

export async function getApprovalForSource(orgId: string, sourceId: string, sourceType: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('approval_requests')
    .select('status, approver_id, decided_at')
    .eq('source_id', sourceId)
    .eq('source_type', sourceType)
    .eq('org_id', orgId)
    .single()

  if (error || !data) return null;
  return data;
}
