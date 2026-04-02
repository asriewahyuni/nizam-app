'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'

async function resolveApprovalBranchId(orgId: string, branchId?: string | null) {
  const branchSelection = await resolveAccessibleBranchSelection(orgId, branchId)
  return branchSelection
}

export async function getPendingApprovals(orgId: string, branchId?: string | null) {
  const supabase = await createClient()
  const branchSelection = await resolveApprovalBranchId(orgId, branchId)
  if ('error' in branchSelection) return []
  const effectiveBranchId = branchSelection.branchId

  let query = (supabase as any)
    .from('approval_requests')
    .select('*')
    .eq('org_id', orgId)
    .eq('status', 'PENDING')

  if (effectiveBranchId) {
    query = query.eq('branch_id', effectiveBranchId)
  }

  const { data, error } = await query.order('requested_at', { ascending: false })

  if (error) {
    (console as any).error('Error fetching approvals:', error)
    return []
  }
  
  return data
}

export async function getApprovalHistory(orgId: string, branchId?: string | null) {
  const supabase = await createClient()
  const branchSelection = await resolveApprovalBranchId(orgId, branchId)
  if ('error' in branchSelection) return []
  const effectiveBranchId = branchSelection.branchId

  let query = (supabase as any)
    .from('approval_requests')
    .select('*')
    .eq('org_id', orgId)
    .neq('status', 'PENDING')

  if (effectiveBranchId) {
    query = query.eq('branch_id', effectiveBranchId)
  }

  const { data, error } = await query
    .order('decided_at', { ascending: false })
    .limit(50)

  if (error) {
    (console as any).error('Error fetching approval history:', error)
    return []
  }
  
  return data
}
export async function getApprovalDetail(orgId: string, sourceId: string, sourceType: string, branchId?: string | null) {
  const supabase = await createClient()
  const branchSelection = await resolveApprovalBranchId(orgId, branchId)
  if ('error' in branchSelection) return { data: null, error: branchSelection.error }
  const effectiveBranchId = branchSelection.branchId

  let dataRes: any = { data: null, error: null }
  
  if (sourceType === 'PURCHASE_ORDER') {
    let query = (supabase as any).from('purchases' as any).select('*, purchase_items(*, products(name, unit))').eq('id', sourceId).eq('org_id', orgId)
    if (effectiveBranchId) {
      query = query.eq('branch_id', effectiveBranchId)
    }
    dataRes = await query.single()
  } else if (sourceType === 'SALES_ORDER') {
    let query = (supabase as any).from('sales' as any).select('*, contacts(name, phone, email), sales_items(*, products(name, sku, unit))').eq('id', sourceId).eq('org_id', orgId)
    if (effectiveBranchId) {
      query = query.eq('branch_id', effectiveBranchId)
    }
    dataRes = await query.single()
  } else if (sourceType === 'REIMBURSEMENT') {
    let query = (supabase as any)
      .from('reimbursements')
      .select('*, items:reimbursement_items(*, account:accounts(code, name))')
      .eq('id', sourceId)
      .eq('org_id', orgId)

    if (effectiveBranchId) {
      query = query.eq('branch_id', effectiveBranchId)
    }
    dataRes = await query.single()
  }

  if ((dataRes as any).error) return { data: null, error: (dataRes as any).error.message }

  // Fetch History Logs
  const { data: logs } = await (supabase as any)
    .from('approval_requests')
    .select('*')
    .eq('source_id', sourceId)
    .eq('source_type', sourceType)
    .order('requested_at', { ascending: true })

  const scopedLogs = effectiveBranchId
    ? (logs || []).filter((log: any) => log.branch_id === effectiveBranchId)
    : (logs || [])

  return { data: dataRes.data, logs: scopedLogs, error: null }
}

export async function getPendingApprovalsCount(orgId: string, branchId?: string | null) {
  const supabase = await createClient()
  const branchSelection = await resolveApprovalBranchId(orgId, branchId)
  if ('error' in branchSelection) return 0
  const effectiveBranchId = branchSelection.branchId

  let query = (supabase as any)
    .from('approval_requests')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'PENDING')

  if (effectiveBranchId) {
    query = query.eq('branch_id', effectiveBranchId)
  }

  const { count, error } = await query

  if (error) {
    (console as any).error('Error fetching approval counts:', error)
    return 0
  }
  
  return count || 0
}

export async function decideApproval(id: string, orgId: string, status: 'APPROVED' | 'REJECTED', notes?: string, branchId?: string | null) {
  const supabase = await createClient()
  const { data: { user } } = await (supabase as any).auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const branchSelection = await resolveApprovalBranchId(orgId, branchId)
  if ('error' in branchSelection) return { error: branchSelection.error }
  const effectiveBranchId = branchSelection.branchId

  let requestLookup = (supabase as any)
    .from('approval_requests')
    .select('source_type, source_id, branch_id')
    .eq('id', id)

  if (effectiveBranchId) {
    requestLookup = requestLookup.eq('branch_id', effectiveBranchId)
  }

  const { data: reqData, error: reqErr } = await requestLookup.single()

  if (reqErr || !reqData) return { error: 'Request tidak ditemukan' }

  let approvalUpdate = (supabase as any)
    .from('approval_requests')
    .update({ 
      status, 
      notes, 
      approver_id: user.id,
      decided_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('org_id', orgId)

  if (effectiveBranchId) {
    approvalUpdate = approvalUpdate.eq('branch_id', effectiveBranchId)
  }

  const { error } = await approvalUpdate

  if (error) return { error: error.message }

  // 3. Efek Samping (Side Effects) ke dokumen asli
  if (reqData.source_type === 'PURCHASE_ORDER') {
      const newPoStatus = status === 'APPROVED' ? 'ORDERED' : 'VOIDED'
      let query = (supabase as any)
        .from('purchases' as any)
        .update({ status: newPoStatus })
        .eq('id', reqData.source_id)
        .eq('org_id', orgId)
      if (reqData.branch_id) {
        query = query.eq('branch_id', reqData.branch_id)
      }
      await query
  }

  if (reqData.source_type === 'SALES_ORDER') {
      const newSoStatus = status === 'APPROVED' ? 'ORDERED' : 'VOIDED'
      let query = (supabase as any)
        .from('sales' as any)
        .update({ status: newSoStatus })
        .eq('id', reqData.source_id)
        .eq('org_id', orgId)
      if (reqData.branch_id) {
        query = query.eq('branch_id', reqData.branch_id)
      }
      await query
  }

  if (reqData.source_type === 'REIMBURSEMENT') {
      let query = (supabase as any)
        .from('reimbursements')
        .update({ status: status }) // APPROVED or REJECTED
        .eq('id', reqData.source_id)
        .eq('org_id', orgId)
      if (reqData.branch_id) {
        query = query.eq('branch_id', reqData.branch_id)
      }
      await query
  }

  revalidatePath('/', 'layout') // Global refresh agar indikator lonceng berubah
  return { success: true }
}

export async function getApprovalForSource(orgId: string, sourceId: string, sourceType: string, branchId?: string | null) {
  const supabase = await createClient()
  const branchSelection = await resolveApprovalBranchId(orgId, branchId)
  if ('error' in branchSelection) return null
  const effectiveBranchId = branchSelection.branchId

  let query = (supabase as any)
    .from('approval_requests')
    .select('status, approver_id, decided_at')
    .eq('source_id', sourceId)
    .eq('source_type', sourceType)
    .eq('org_id', orgId)

  if (effectiveBranchId) {
    query = query.eq('branch_id', effectiveBranchId)
  }

  const { data, error } = await query.single()

  if (error || !data) return null;
  return data;
}
