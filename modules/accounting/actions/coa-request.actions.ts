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

import { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import type { AccountType, NormalBalance } from '@/types/database.types'
import { prisma } from '@/lib/prisma'
import { getAuthUser, getMembership } from '@/lib/auth/permissions'
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

type CoaRequestListRow = {
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
  reviewed_at: Date | string | null
  review_notes: string | null
  created_account_id: string | null
  created_account_code: string | null
  created_account_name: string | null
  created_at: Date | string
  updated_at: Date | string
}

type CoaRequestDetailRow = {
  id: string
  org_id: string
  requester_org_id: string
  requester_branch_id: string | null
  requested_by: string
  proposed_code: string
  proposed_name: string
  proposed_type: string
  proposed_normal_balance: string
  proposed_parent_id: string | null
  proposed_description: string | null
  business_reason: string
  status: CoaRequestStatus
  created_account_id: string | null
}

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : String(value)
}

async function getDefaultBranchId(orgId: string): Promise<string | null> {
  const branches = await prisma.branches.findMany({
    where: { org_id: orgId },
    select: { id: true, code: true, name: true, is_active: true, created_at: true },
  })

  if (branches.length === 0) return null

  const sortedBranches = [...branches].sort((left, right) => {
    const leftRank = left.is_active && (left.code === 'MAIN' || left.name === 'Unit Utama')
      ? 0
      : left.is_active
        ? 1
        : left.code === 'MAIN' || left.name === 'Unit Utama'
          ? 2
          : 3
    const rightRank = right.is_active && (right.code === 'MAIN' || right.name === 'Unit Utama')
      ? 0
      : right.is_active
        ? 1
        : right.code === 'MAIN' || right.name === 'Unit Utama'
          ? 2
          : 3

    if (leftRank !== rightRank) return leftRank - rightRank
    if (left.created_at.getTime() !== right.created_at.getTime()) {
      return left.created_at.getTime() - right.created_at.getTime()
    }
    return left.id.localeCompare(right.id)
  })

  return sortedBranches[0]?.id ?? null
}

async function canManageFinanceMaster(orgId: string): Promise<boolean> {
  const user = await getAuthUser()
  if (!user) return false

  const [organization, membership, defaultBranchId] = await Promise.all([
    prisma.organizations.findUnique({
      where: { id: orgId },
      select: { id: true, parent_org_id: true },
    }),
    prisma.org_members.findFirst({
      where: { org_id: orgId, user_id: user.userId, is_active: true },
      select: {
        role: true,
        last_active_branch_id: true,
        roles: { select: { permissions: true } },
      },
    }),
    getDefaultBranchId(orgId),
  ])

  if (!organization || organization.parent_org_id) return false
  if (!membership || !defaultBranchId) return false
  if (membership.last_active_branch_id && membership.last_active_branch_id !== defaultBranchId) return false

  if (membership.role === 'owner' || membership.role === 'admin') return true

  const permissions = Array.isArray(membership.roles?.permissions)
    ? membership.roles.permissions.filter((permission): permission is string => typeof permission === 'string')
    : []

  return permissions.some((permission) => {
    const normalized = permission.toLowerCase()
    return normalized.includes('coa:write') || normalized.includes('accounting:write')
  })
}

async function getCoaRequestById(requestId: string): Promise<CoaRequestDetailRow | null> {
  const rows = await prisma.$queryRaw<CoaRequestDetailRow[]>(Prisma.sql`
    SELECT
      r.id::text,
      r.org_id::text,
      r.requester_org_id::text,
      r.requester_branch_id::text,
      r.requested_by::text,
      r.proposed_code,
      r.proposed_name,
      r.proposed_type,
      r.proposed_normal_balance,
      r.proposed_parent_id::text,
      r.proposed_description,
      r.business_reason,
      r.status::text AS status,
      r.created_account_id::text
    FROM public.coa_account_requests r
    WHERE r.id = ${requestId}::uuid
    LIMIT 1
  `)

  return rows[0] ?? null
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * submitCoaRequest
 * ────────────────
 * Dipanggil oleh Child Org atau Branch untuk mengajukan rekening baru.
 * Request masuk ke antrian Parent untuk disetujui.
 */
export async function submitCoaRequest(input: SubmitCoaRequestInput) {
  const user = await getAuthUser()
  if (!user) return { error: 'Autentikasi diperlukan.' }

  const membership = await getMembership(user.userId, input.requesterOrgId)
  if (!membership) return { error: 'Unauthorized' }

  if (!input.businessReason?.trim()) {
    return { error: 'Alasan bisnis wajib diisi saat mengajukan request rekening CoA.' }
  }

  try {
    const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      INSERT INTO public.coa_account_requests (
        org_id,
        requester_org_id,
        requester_branch_id,
        requested_by,
        proposed_code,
        proposed_name,
        proposed_type,
        proposed_normal_balance,
        proposed_parent_id,
        proposed_description,
        business_reason
      ) VALUES (
        ${input.parentOrgId}::uuid,
        ${input.requesterOrgId}::uuid,
        ${input.requesterBranchId ?? null}::uuid,
        ${user.userId}::uuid,
        ${input.proposedCode.trim()},
        ${input.proposedName.trim()},
        ${input.proposedType},
        ${input.proposedNormalBalance},
        ${input.proposedParentId ?? null}::uuid,
        ${input.proposedDescription ?? null},
        ${input.businessReason.trim()}
      )
      RETURNING id::text AS id
    `)

    revalidatePath('/accounting/coa-requests')
    return { success: true, requestId: rows[0]?.id ?? null }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Gagal mengajukan request rekening CoA.' }
  }
}

/**
 * approveCoaRequest
 * ─────────────────
 * Dipanggil oleh Parent (owner/admin di main org + main branch).
 * Sekaligus membuat rekening baru di CoA secara otomatis.
 */
export async function approveCoaRequest(requestId: string, reviewNotes?: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Autentikasi diperlukan.' }

  const request = await getCoaRequestById(requestId)
  if (!request) return { error: 'Request CoA tidak ditemukan.' }
  if (request.status !== 'pending') {
    return { error: `Hanya request berstatus pending yang dapat disetujui. Status saat ini: ${request.status}` }
  }
  if (!(await canManageFinanceMaster(request.org_id))) {
    return { error: 'Hanya Organisasi Utama (Parent) pada konteks Unit Utama yang dapat menyetujui request CoA.' }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const createdAccount = await tx.accounts.create({
        data: {
          org_id: request.org_id,
          code: request.proposed_code,
          name: request.proposed_name,
          type: request.proposed_type as AccountType,
          normal_balance: request.proposed_normal_balance as NormalBalance,
          parent_id: request.proposed_parent_id,
          description: request.proposed_description,
          is_system: false,
        },
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          normal_balance: true,
          parent_id: true,
          description: true,
          is_system: true,
          is_active: true,
        },
      })

      await tx.$executeRaw(Prisma.sql`
        UPDATE public.coa_account_requests
        SET
          status = 'approved',
          reviewed_by = ${user.userId}::uuid,
          reviewed_at = now(),
          review_notes = ${reviewNotes ?? null},
          created_account_id = ${createdAccount.id}::uuid
        WHERE id = ${requestId}::uuid
      `)

      return createdAccount
    })

    const syncResult = await syncParentAccountToDescendants(request.org_id, result)
    if (!syncResult.success) {
      ;(console as any).warn('CoA sync warning (approveCoaRequest):', syncResult.errors)
    }

    revalidatePath('/accounting/coa-requests')
    revalidatePath('/settings/accounts')
    return { success: true, newAccountId: result.id }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Gagal menyetujui request CoA.' }
  }
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

  const user = await getAuthUser()
  if (!user) return { error: 'Autentikasi diperlukan.' }

  const request = await getCoaRequestById(requestId)
  if (!request) return { error: 'Request CoA tidak ditemukan.' }
  if (request.status !== 'pending') {
    return { error: `Hanya request berstatus pending yang dapat ditolak. Status saat ini: ${request.status}` }
  }
  if (!(await canManageFinanceMaster(request.org_id))) {
    return { error: 'Hanya Organisasi Utama (Parent) yang dapat menolak request CoA.' }
  }

  try {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE public.coa_account_requests
      SET
        status = 'rejected',
        reviewed_by = ${user.userId}::uuid,
        reviewed_at = now(),
        review_notes = ${reviewNotes.trim()}
      WHERE id = ${requestId}::uuid
    `)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Gagal menolak request CoA.' }
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
  const user = await getAuthUser()
  if (!user) return { error: 'Autentikasi diperlukan.' }

  const request = await getCoaRequestById(requestId)
  if (!request) return { error: 'Request CoA tidak ditemukan.' }
  if (request.status !== 'pending') {
    return { error: 'Hanya request berstatus pending yang dapat dibatalkan.' }
  }
  if (request.requested_by !== user.userId) {
    return { error: 'Anda tidak memiliki izin membatalkan request ini.' }
  }

  try {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE public.coa_account_requests
      SET status = 'cancelled'
      WHERE id = ${requestId}::uuid
    `)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Gagal membatalkan request CoA.' }
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
    requester_org_name: row.requester_org_name ?? null,
    requester_branch_id: row.requester_branch_id,
    requester_branch_name: row.requester_branch_name ?? null,
    requested_by: row.requested_by,
    proposed_code: row.proposed_code,
    proposed_name: row.proposed_name,
    proposed_type: row.proposed_type,
    proposed_normal_balance: row.proposed_normal_balance,
    proposed_description: row.proposed_description,
    business_reason: row.business_reason,
    status: row.status,
    reviewed_by: row.reviewed_by,
    reviewed_at: toIsoString(row.reviewed_at),
    review_notes: row.review_notes,
    created_account_id: row.created_account_id,
    created_account_code: row.created_account_code ?? null,
    created_account_name: row.created_account_name ?? null,
    created_at: toIsoString(row.created_at) ?? '',
    updated_at: toIsoString(row.updated_at) ?? '',
  }
}

function buildCoaRequestListQuery(whereClause: Prisma.Sql) {
  return Prisma.sql`
    SELECT
      r.id::text,
      r.org_id::text,
      r.requester_org_id::text,
      o.name AS requester_org_name,
      r.requester_branch_id::text,
      b.name AS requester_branch_name,
      r.requested_by::text,
      r.proposed_code,
      r.proposed_name,
      r.proposed_type,
      r.proposed_normal_balance,
      r.proposed_description,
      r.business_reason,
      r.status::text AS status,
      r.reviewed_by::text,
      r.reviewed_at,
      r.review_notes,
      r.created_account_id::text,
      a.code AS created_account_code,
      a.name AS created_account_name,
      r.created_at,
      r.updated_at
    FROM public.coa_account_requests r
    LEFT JOIN public.organizations o ON o.id = r.requester_org_id
    LEFT JOIN public.branches b ON b.id = r.requester_branch_id
    LEFT JOIN public.accounts a ON a.id = r.created_account_id
    WHERE ${whereClause}
    ORDER BY r.created_at DESC
  `
}

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
  try {
    const statusClause = statusFilter && statusFilter !== 'all'
      ? Prisma.sql` AND r.status = ${statusFilter}::public.coa_request_status`
      : Prisma.empty

    const data = await prisma.$queryRaw<CoaRequestListRow[]>(buildCoaRequestListQuery(Prisma.sql`
      r.org_id = ${parentOrgId}::uuid
      ${statusClause}
    `))

    return data.map(mapRowToSummary)
  } catch (error) {
    console.error('getCoaRequestsByParent error:', error)
    return []
  }
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
  try {
    const statusClause = statusFilter && statusFilter !== 'all'
      ? Prisma.sql` AND r.status = ${statusFilter}::public.coa_request_status`
      : Prisma.empty

    const data = await prisma.$queryRaw<CoaRequestListRow[]>(buildCoaRequestListQuery(Prisma.sql`
      r.requester_org_id = ${requesterOrgId}::uuid
      ${statusClause}
    `))

    return data.map(mapRowToSummary)
  } catch (error) {
    console.error('getCoaRequestsByRequester error:', error)
    return []
  }
}

/**
 * getPendingCoaRequestCount
 * ─────────────────────────
 * Untuk notifikasi badge di Parent dashboard — berapa request pending?
 */
export async function getPendingCoaRequestCount(parentOrgId: string): Promise<number> {
  try {
    const rows = await prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM public.coa_account_requests
      WHERE org_id = ${parentOrgId}::uuid
        AND status = 'pending'::public.coa_request_status
    `)

    return Number(rows[0]?.count ?? 0)
  } catch {
    return 0
  }
}
