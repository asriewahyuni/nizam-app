'use server'

/**
 * coa-request.actions.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Server actions untuk sistem request pembuatan rekening CoA secara hierarkis.
 *
 * Alur:
 *   1. Child/Branch  → submit_coa_request  (ajukan request)
 *   2. Parent        → approve_coa_request (setujui + buat akun otomatis)
 *              atau  → reject_coa_request  (tolak + tulis alasan)
 *   3. Child/Branch  → cancel_coa_request  (batalkan jika masih pending)
 *
 * Aturan Bisnis:
 *   - Parent/Holding tidak perlu request — bisa buat langsung via coa.actions
 *   - Child dan Branch WAJIB request dulu ke Parent
 *   - Approval otomatis membuat akun di CoA Parent (bukan di Child)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { syncParentAccountToDescendants } from './coa.actions'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CoaRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export type CoaRequestSummary = {
  id: string
  org_id: string
  requester_org_id: string
  requester_org_name: string | null
  requester_branch_id: string | null
  requester_branch_name: string | null
  requested_by: string
  proposed_code: string
  proposed_name: string
  proposed_type: string
  proposed_normal_balance: string
  proposed_description: string | null
  business_reason: string
  status: CoaRequestStatus
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  created_account_id: string | null
  created_account_code: string | null
  created_account_name: string | null
  created_at: string
  updated_at: string
}

export type SubmitCoaRequestInput = {
  /** ID org Parent/Holding (pemilik CoA master) */
  parentOrgId: string
  /** ID org pengaju (Child org) */
  requesterOrgId: string
  /** ID branch pengaju (opsional, diisi jika request dari branch) */
  requesterBranchId?: string | null
  /** Kode akun yang diusulkan (belum tentu disetujui apa adanya) */
  proposedCode: string
  /** Nama akun yang diusulkan */
  proposedName: string
  /** Tipe akun: asset | liability | equity | revenue | expense */
  proposedType: string
  /** Saldo normal: debit | credit */
  proposedNormalBalance: string
  /** ID akun induk (parent account) jika ada */
  proposedParentId?: string | null
  /** Deskripsi singkat akun */
  proposedDescription?: string | null
  /** Alasan bisnis — WAJIB diisi untuk justifikasi ke Parent */
  businessReason: string
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * submitCoaRequest
 * ────────────────
 * Dipanggil oleh Child Org atau Branch untuk mengajukan rekening baru.
 * Request masuk ke antrian Parent untuk disetujui.
 */
export async function submitCoaRequest(input: SubmitCoaRequestInput) {
  const supabase = await createClient()

  const { data, error } = await (supabase as any).rpc('submit_coa_request', {
    p_parent_org_id:           input.parentOrgId,
    p_requester_org_id:        input.requesterOrgId,
    p_requester_branch_id:     input.requesterBranchId ?? null,
    p_proposed_code:           input.proposedCode,
    p_proposed_name:           input.proposedName,
    p_proposed_type:           input.proposedType,
    p_proposed_normal_balance: input.proposedNormalBalance,
    p_proposed_parent_id:      input.proposedParentId ?? null,
    p_proposed_description:    input.proposedDescription ?? null,
    p_business_reason:         input.businessReason,
  })

  if (error) {
    return { error: error.message ?? 'Gagal mengajukan request rekening CoA.' }
  }

  revalidatePath('/accounting/coa-requests')
  return { success: true, requestId: data as string }
}

/**
 * approveCoaRequest
 * ─────────────────
 * Dipanggil oleh Parent (owner/admin di main org + main branch).
 * Sekaligus membuat rekening baru di CoA secara otomatis.
 */
export async function approveCoaRequest(requestId: string, reviewNotes?: string) {
  const supabase = await createClient()

  const { data, error } = await (supabase as any).rpc('approve_coa_request', {
    p_request_id:   requestId,
    p_review_notes: reviewNotes ?? null,
  })

  if (error) {
    return { error: error.message ?? 'Gagal menyetujui request CoA.' }
  }

  const admin = await createAdminClient()
  const { data: reqRow } = await (admin as any)
    .from('coa_account_requests')
    .select('org_id, created_account_id')
    .eq('id', requestId)
    .maybeSingle()

  if (reqRow?.org_id && reqRow?.created_account_id) {
    const { data: createdAccount } = await (admin as any)
      .from('accounts')
      .select('id, code, name, type, normal_balance, parent_id, description, is_system, is_active')
      .eq('org_id', reqRow.org_id)
      .eq('id', reqRow.created_account_id)
      .maybeSingle()

    if (createdAccount) {
      const syncResult = await syncParentAccountToDescendants(String(reqRow.org_id), createdAccount)
      if (!syncResult.success) {
        ;(console as any).warn('CoA sync warning (approveCoaRequest):', syncResult.errors)
      }
    }
  }

  revalidatePath('/accounting/coa-requests')
  revalidatePath('/settings/accounts')
  return { success: true, newAccountId: data as string }
}

/**
 * rejectCoaRequest
 * ────────────────
 * Dipanggil oleh Parent untuk menolak request.
 * Catatan alasan penolakan WAJIB diisi.
 */
export async function rejectCoaRequest(requestId: string, reviewNotes: string) {
  if (!reviewNotes?.trim()) {
    return { error: 'Catatan alasan penolakan wajib diisi.' }
  }

  const supabase = await createClient()

  const { error } = await (supabase as any).rpc('reject_coa_request', {
    p_request_id:   requestId,
    p_review_notes: reviewNotes.trim(),
  })

  if (error) {
    return { error: error.message ?? 'Gagal menolak request CoA.' }
  }

  revalidatePath('/accounting/coa-requests')
  return { success: true }
}

/**
 * cancelCoaRequest
 * ────────────────
 * Dipanggil oleh pengaju sendiri untuk membatalkan requestnya.
 * Hanya bisa jika masih berstatus pending.
 */
export async function cancelCoaRequest(requestId: string) {
  const supabase = await createClient()

  const { error } = await (supabase as any).rpc('cancel_coa_request', {
    p_request_id: requestId,
  })

  if (error) {
    return { error: error.message ?? 'Gagal membatalkan request CoA.' }
  }

  revalidatePath('/accounting/coa-requests')
  return { success: true }
}

// ─── Query Actions ────────────────────────────────────────────────────────────

/**
 * mapRowToSummary
 * ───────────────
 * Transforms raw join result from coa_account_requests into CoaRequestSummary.
 */
function mapRowToSummary(row: any): CoaRequestSummary {
  return {
    id: row.id,
    org_id: row.org_id,
    requester_org_id: row.requester_org_id,
    requester_org_name: row.requester_org?.name ?? null,
    requester_branch_id: row.requester_branch_id,
    requester_branch_name: row.requester_branch?.name ?? null,
    requested_by: row.requested_by,
    proposed_code: row.proposed_code,
    proposed_name: row.proposed_name,
    proposed_type: row.proposed_type,
    proposed_normal_balance: row.proposed_normal_balance,
    proposed_description: row.proposed_description,
    business_reason: row.business_reason,
    status: row.status,
    reviewed_by: row.reviewed_by,
    reviewed_at: row.reviewed_at,
    review_notes: row.review_notes,
    created_account_id: row.created_account_id,
    created_account_code: row.created_account?.code ?? null,
    created_account_name: row.created_account?.name ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

/** Shared select string — joins requester org, branch, and created account */
const COA_REQUEST_SELECT = `
  *,
  requester_org:organizations!coa_account_requests_requester_org_id_fkey(name),
  requester_branch:branches!coa_account_requests_requester_branch_id_fkey(name),
  created_account:accounts!coa_account_requests_created_account_id_fkey(code, name)
`

/**
 * getCoaRequestsByParent
 * ──────────────────────
 * Dashboard Parent: Tampilkan semua request yang masuk ke org Parent.
 * Bisa difilter berdasarkan status.
 */
export async function getCoaRequestsByParent(
  parentOrgId: string,
  statusFilter?: CoaRequestStatus | 'all'
): Promise<CoaRequestSummary[]> {
  // Admin client bypasses PostgREST schema cache for new tables
  const supabase = await createAdminClient()

  let query = (supabase as any)
    .from('coa_account_requests')
    .select(COA_REQUEST_SELECT)
    .eq('org_id', parentOrgId)
    .order('created_at', { ascending: false })

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }

  const { data, error } = await query

  if (error) {
    console.error('getCoaRequestsByParent error:', error.message, error.code, error.details)
    return []
  }

  return ((data as any[]) ?? []).map(mapRowToSummary)
}

/**
 * getCoaRequestsByRequester
 * ─────────────────────────
 * Dashboard Child/Branch: Tampilkan request yang diajukan oleh org tertentu.
 */
export async function getCoaRequestsByRequester(
  requesterOrgId: string,
  statusFilter?: CoaRequestStatus | 'all'
): Promise<CoaRequestSummary[]> {
  // Admin client bypasses PostgREST schema cache for new tables
  const supabase = await createAdminClient()

  let query = (supabase as any)
    .from('coa_account_requests')
    .select(COA_REQUEST_SELECT)
    .eq('requester_org_id', requesterOrgId)
    .order('created_at', { ascending: false })

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }

  const { data, error } = await query

  if (error) {
    console.error('getCoaRequestsByRequester error:', error.message, error.code, error.details)
    return []
  }

  return ((data as any[]) ?? []).map(mapRowToSummary)
}

/**
 * getPendingCoaRequestCount
 * ─────────────────────────
 * Untuk notifikasi badge di Parent dashboard — berapa request pending?
 */
export async function getPendingCoaRequestCount(parentOrgId: string): Promise<number> {
  const supabase = await createAdminClient()

  const { count, error } = await (supabase as any)
    .from('coa_account_requests')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', parentOrgId)
    .eq('status', 'pending')

  if (error) return 0
  return count ?? 0
}
