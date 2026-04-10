'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'
import { ensureSellableBranchStockAvailability, shouldGuardOrderedSaleStock } from '@/modules/sales/lib/stock-guard.server'

async function resolveApprovalBranchId(orgId: string, branchId?: string | null) {
  const branchSelection = await resolveAccessibleBranchSelection(orgId, branchId)
  return branchSelection
}

async function resolveMetadataReadClient(sessionClient: any) {
  try {
    return await createAdminClient()
  } catch {
    return sessionClient
  }
}

function toTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function toTitleWords(input: string): string {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function mapLegacyRoleLabel(role: string | null): string | null {
  if (!role) return null
  const normalized = role.trim().toLowerCase()
  if (!normalized) return null

  if (normalized === 'owner') return 'Owner'
  if (normalized === 'admin') return 'Admin'
  if (normalized === 'manager') return 'Manager'
  if (normalized === 'staff') return 'Staff'
  if (normalized === 'viewer') return 'Viewer'
  if (normalized === 'hr') return 'HR'
  return toTitleWords(normalized.replace(/[_-]+/g, ' '))
}

function deriveNameFromEmail(email: string | null): string | null {
  if (!email) return null
  const localPart = String(email).split('@')[0]?.trim()
  if (!localPart) return null
  const withSpaces = localPart.replace(/[._-]+/g, ' ').trim()
  if (!withSpaces) return null
  return toTitleWords(withSpaces)
}

async function getOrgMemberIdentityByUserIds(supabase: any, orgId: string, userIds: string[]) {
  const result = new Map<string, { roleName: string | null; email: string | null }>()
  if (!Array.isArray(userIds) || userIds.length === 0) return result

  const { data: memberRows } = await (supabase as any)
    .from('org_members')
    .select(`
      user_id,
      role,
      custom_role:roles(name),
      user:user_id(email)
    `)
    .eq('org_id', orgId)
    .eq('is_active', true)
    .in('user_id', userIds)

  for (const row of (memberRows as any[]) || []) {
    const userId = toTrimmedString(row?.user_id)
    if (!userId || result.has(userId)) continue

    const customRoleName = toTrimmedString((row as any)?.custom_role?.name)
    const legacyRoleName = mapLegacyRoleLabel(toTrimmedString(row?.role))
    const roleName = customRoleName || legacyRoleName || null
    const email = toTrimmedString((row as any)?.user?.email)

    result.set(userId, { roleName, email })
  }

  return result
}

async function getAuthDisplayNameByUserIds(supabase: any, userIds: string[]) {
  const result = new Map<string, string>()
  if (!Array.isArray(userIds) || userIds.length === 0) return result

  const adminApi = (supabase as any)?.auth?.admin
  if (!adminApi || typeof adminApi.getUserById !== 'function') return result

  await Promise.all(
    userIds.map(async (userId) => {
      try {
        const { data, error } = await adminApi.getUserById(userId)
        if (error || !data?.user) return

        const user = data.user as any
        const metadata = (user.user_metadata || {}) as Record<string, unknown>
        const rawMetadata = (user.raw_user_meta_data || {}) as Record<string, unknown>
        const displayName =
          toTrimmedString(metadata.full_name) ||
          toTrimmedString(metadata.name) ||
          toTrimmedString(metadata.display_name) ||
          toTrimmedString(rawMetadata.full_name) ||
          toTrimmedString(rawMetadata.name) ||
          toTrimmedString(rawMetadata.display_name) ||
          null

        if (displayName) {
          result.set(userId, displayName)
        }
      } catch {
        // noop: fallback handled by caller
      }
    })
  )

  return result
}

async function enrichApproverMetadata(supabase: any, orgId: string, rows: any[]) {
  const list = Array.isArray(rows) ? rows : []
  if (list.length === 0) return list

  const approverIds = Array.from(
    new Set(
      list
        .map((row: any) => toTrimmedString(row?.approver_id))
        .filter((id: string | null): id is string => Boolean(id) && id.toUpperCase() !== 'SYSTEM')
    )
  )

  if (approverIds.length === 0) {
    return list.map((row: any) => ({
      ...row,
      approver_name: toTrimmedString(row?.approver_id)?.toUpperCase() === 'SYSTEM' ? 'Otomasi Sistem' : null,
      approver_job_title: toTrimmedString(row?.approver_id)?.toUpperCase() === 'SYSTEM' ? 'Sistem' : null,
      approver_unit_name: null,
    }))
  }

  const { data: employeeRows } = await (supabase as any)
    .from('employees')
    .select('user_id, first_name, last_name, job_title, branches(name)')
    .eq('org_id', orgId)
    .in('user_id', approverIds)

  const orgMemberByUserId = await getOrgMemberIdentityByUserIds(supabase, orgId, approverIds)
  const authNameByUserId = await getAuthDisplayNameByUserIds(supabase, approverIds)

  const employeeByUserId = new Map<string, { name: string | null; jobTitle: string | null; unitName: string | null }>()
  for (const employee of (employeeRows as any[]) || []) {
    const userId = toTrimmedString(employee?.user_id)
    if (!userId || employeeByUserId.has(userId)) continue

    const firstName = toTrimmedString(employee?.first_name)
    const lastName = toTrimmedString(employee?.last_name)
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || null
    const unitName = toTrimmedString((employee as any)?.branches?.name)
    const jobTitle = toTrimmedString(employee?.job_title)

    employeeByUserId.set(userId, {
      name: fullName,
      jobTitle,
      unitName,
    })
  }

  return list.map((row: any) => {
    const approverId = toTrimmedString(row?.approver_id)
    if (!approverId) {
      return {
        ...row,
        approver_name: null,
        approver_job_title: null,
        approver_unit_name: null,
      }
    }

    if (approverId.toUpperCase() === 'SYSTEM') {
      return {
        ...row,
        approver_name: 'Otomasi Sistem',
        approver_job_title: 'Sistem',
        approver_unit_name: null,
      }
    }

    const employee = employeeByUserId.get(approverId)
    const memberIdentity = orgMemberByUserId.get(approverId)
    const fallbackNameFromAuth = authNameByUserId.get(approverId) || null
    const fallbackNameFromEmail = deriveNameFromEmail(memberIdentity?.email || null)
    return {
      ...row,
      approver_name: employee?.name || fallbackNameFromAuth || fallbackNameFromEmail || null,
      approver_job_title: employee?.jobTitle || memberIdentity?.roleName || null,
      approver_unit_name: employee?.unitName || null,
    }
  })
}

async function enrichRequesterMetadata(supabase: any, orgId: string, rows: any[]) {
  const list = Array.isArray(rows) ? rows : []
  if (list.length === 0) return list

  const requesterIds = Array.from(
    new Set(
      list
        .map((row: any) => toTrimmedString(row?.requester_id))
        .filter((id: string | null): id is string => Boolean(id) && id.toUpperCase() !== 'SYSTEM')
    )
  )

  const requestBranchIds = Array.from(
    new Set(
      list
        .map((row: any) => toTrimmedString(row?.branch_id))
        .filter((id: string | null): id is string => Boolean(id))
    )
  )

  const branchNameById = new Map<string, string>()
  if (requestBranchIds.length > 0) {
    const { data: branchRows } = await (supabase as any)
      .from('branches')
      .select('id, name')
      .eq('org_id', orgId)
      .in('id', requestBranchIds)

    for (const branch of (branchRows as Array<{ id?: string; name?: string | null }> | null) || []) {
      const branchId = toTrimmedString(branch?.id)
      const branchName = toTrimmedString(branch?.name)
      if (!branchId || !branchName) continue
      branchNameById.set(branchId, branchName)
    }
  }

  if (requesterIds.length === 0) {
    return list.map((row: any) => {
      const requesterId = toTrimmedString(row?.requester_id)
      const branchName = toTrimmedString(row?.branch_id) ? branchNameById.get(String(row.branch_id)) || null : null
      if (requesterId?.toUpperCase() === 'SYSTEM') {
        return {
          ...row,
          requester_name: 'Otomasi Sistem',
          requester_job_title: 'Sistem',
          requester_unit_name: branchName,
        }
      }

      return {
        ...row,
        requester_name: null,
        requester_job_title: null,
        requester_unit_name: branchName,
      }
    })
  }

  const { data: employeeRows } = await (supabase as any)
    .from('employees')
    .select('user_id, first_name, last_name, job_title, branches(name)')
    .eq('org_id', orgId)
    .in('user_id', requesterIds)

  const orgMemberByUserId = await getOrgMemberIdentityByUserIds(supabase, orgId, requesterIds)
  const authNameByUserId = await getAuthDisplayNameByUserIds(supabase, requesterIds)

  const employeeByUserId = new Map<string, { name: string | null; jobTitle: string | null; unitName: string | null }>()
  for (const employee of (employeeRows as any[]) || []) {
    const userId = toTrimmedString(employee?.user_id)
    if (!userId || employeeByUserId.has(userId)) continue

    const firstName = toTrimmedString(employee?.first_name)
    const lastName = toTrimmedString(employee?.last_name)
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || null
    const unitName = toTrimmedString((employee as any)?.branches?.name)
    const jobTitle = toTrimmedString(employee?.job_title)

    employeeByUserId.set(userId, {
      name: fullName,
      jobTitle,
      unitName,
    })
  }

  return list.map((row: any) => {
    const requesterId = toTrimmedString(row?.requester_id)
    const requestBranchId = toTrimmedString(row?.branch_id)
    const fallbackUnitName = requestBranchId ? branchNameById.get(requestBranchId) || null : null

    if (!requesterId) {
      return {
        ...row,
        requester_name: null,
        requester_job_title: null,
        requester_unit_name: fallbackUnitName,
      }
    }

    if (requesterId.toUpperCase() === 'SYSTEM') {
      return {
        ...row,
        requester_name: 'Otomasi Sistem',
        requester_job_title: 'Sistem',
        requester_unit_name: fallbackUnitName,
      }
    }

    const employee = employeeByUserId.get(requesterId)
    const memberIdentity = orgMemberByUserId.get(requesterId)
    const fallbackNameFromAuth = authNameByUserId.get(requesterId) || null
    const fallbackNameFromEmail = deriveNameFromEmail(memberIdentity?.email || null)
    return {
      ...row,
      requester_name: employee?.name || fallbackNameFromAuth || fallbackNameFromEmail || null,
      requester_job_title: employee?.jobTitle || memberIdentity?.roleName || null,
      requester_unit_name: employee?.unitName || fallbackUnitName,
    }
  })
}

export async function getPendingApprovals(orgId: string, branchId?: string | null) {
  const supabase = await createClient()
  const metadataClient = await resolveMetadataReadClient(supabase)
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

  return enrichRequesterMetadata(metadataClient, orgId, data || [])
}

export async function getApprovalHistory(orgId: string, branchId?: string | null) {
  const supabase = await createClient()
  const metadataClient = await resolveMetadataReadClient(supabase)
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

  const withApprover = await enrichApproverMetadata(metadataClient, orgId, data || [])
  return enrichRequesterMetadata(metadataClient, orgId, withApprover)
}
export async function getApprovalDetail(orgId: string, sourceId: string, sourceType: string, branchId?: string | null) {
  const supabase = await createClient()
  const metadataClient = await resolveMetadataReadClient(supabase)
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
  } else if (sourceType === 'LEAVE_REQUEST') {
    let query = (supabase as any)
      .from('leave_requests')
      .select(`
        *,
        branch:branches(id, name, code),
        employee:employee_id(id, first_name, last_name, nik, job_title, branch_id)
      `)
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
    .eq('org_id', orgId)
    .eq('source_id', sourceId)
    .eq('source_type', sourceType)
    .order('requested_at', { ascending: true })

  const scopedLogs = effectiveBranchId
    ? (logs || []).filter((log: any) => log.branch_id === effectiveBranchId)
    : (logs || [])

  const logsWithApprover = await enrichApproverMetadata(metadataClient, orgId, scopedLogs)
  const enrichedLogs = await enrichRequesterMetadata(metadataClient, orgId, logsWithApprover)

  return { data: dataRes.data, logs: enrichedLogs, error: null }
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

  if (reqData.source_type === 'SALES_ORDER' && status === 'APPROVED') {
    const approvalBranchId = reqData.branch_id || effectiveBranchId
    if (!approvalBranchId) {
      return { error: 'Sales order tidak memiliki unit aktif untuk validasi stok.' }
    }

    let salesLookup = (supabase as any)
      .from('sales' as any)
      .select('id, shariah_mode, sales_items(product_id, description, quantity)')
      .eq('id', reqData.source_id)
      .eq('org_id', orgId)

    if (reqData.branch_id) {
      salesLookup = salesLookup.eq('branch_id', reqData.branch_id)
    }

    const { data: saleDetail, error: saleDetailError } = await salesLookup.single()
    if (saleDetailError || !saleDetail) {
      return { error: 'Sales order tidak ditemukan untuk validasi stok.' }
    }

    if (shouldGuardOrderedSaleStock((saleDetail as any).shariah_mode)) {
      const stockGuard = await ensureSellableBranchStockAvailability(supabase as any, {
        orgId,
        branchId: approvalBranchId,
        lines: Array.isArray((saleDetail as any).sales_items)
          ? (saleDetail as any).sales_items.map((item: any) => ({
              product_id: item?.product_id || null,
              product_name: item?.description || null,
              quantity: Number(item?.quantity || 0),
            }))
          : [],
      })

      if ('error' in stockGuard) {
        return { error: stockGuard.error }
      }
    }
  }

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

  if (reqData.source_type === 'LEAVE_REQUEST') {
      let query = (supabase as any)
        .from('leave_requests')
        .update({
          status,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
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
  const metadataClient = await resolveMetadataReadClient(supabase)
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
  const enriched = await enrichApproverMetadata(metadataClient, orgId, [data])
  return enriched[0] || data
}
