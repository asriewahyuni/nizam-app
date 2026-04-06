'use server'

/**
 * coa.actions.ts
 * Aturan Hierarki Pengendalian Rekening:
 *   - PARENT (Holding/Induk) : Dapat membuat/edit/hapus rekening CoA langsung
 *   - CHILD  (Anak Perusahaan): WAJIB ajukan request ke Parent terlebih dahulu
 *   - BRANCH (Cabang)        : WAJIB ajukan request ke Parent melalui Child
 * Lihat: coa-request.actions.ts untuk alur pengajuan request
 */

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import type { Account, AccountType, NormalBalance, AccountBalance } from '@/types/database.types'
import { prisma } from '@/lib/prisma'
import { getAuthUser, getMembership } from '@/lib/auth/permissions'

type MirrorableAccount = Pick<
  Account,
  'id' | 'code' | 'name' | 'type' | 'normal_balance' | 'parent_id' | 'description' | 'is_system' | 'is_active'
>

function buildMirrorPayload(
  source: MirrorableAccount,
  childParentId: string | null,
  currentChildAccountId?: string
) {
  return {
    code: source.code,
    name: source.name,
    type: source.type,
    normal_balance: source.normal_balance,
    parent_id: childParentId && childParentId !== currentChildAccountId ? childParentId : null,
    description: source.description,
    is_system: source.is_system,
    is_active: source.is_active,
  }
}

async function getDescendantOrganizationIds(parentOrgId: string): Promise<string[]> {
  const rows = await prisma.organizations.findMany({
    select: { id: true, parent_org_id: true },
  })

  const childrenByParent = new Map<string, string[]>()
  for (const row of rows) {
    const id = String(row.id || '').trim()
    const parentId = String(row.parent_org_id || '').trim()
    if (!id || !parentId) continue
    const bucket = childrenByParent.get(parentId) || []
    bucket.push(id)
    childrenByParent.set(parentId, bucket)
  }

  const descendants: string[] = []
  const queue = [...(childrenByParent.get(parentOrgId) || [])]
  const visited = new Set<string>()

  while (queue.length > 0) {
    const current = queue.shift() as string
    if (!current || visited.has(current)) continue
    visited.add(current)
    descendants.push(current)

    const directChildren = childrenByParent.get(current) || []
    for (const childId of directChildren) {
      if (!visited.has(childId)) queue.push(childId)
    }
  }

  return descendants
}

async function resolveParentAccountCode(
  parentOrgId: string,
  parentAccountId: string | null
): Promise<string | null> {
  if (!parentAccountId) return null

  const data = await prisma.accounts.findFirst({
    where: { org_id: parentOrgId, id: parentAccountId },
    select: { code: true },
  })

  return data?.code ? String(data.code) : null
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

export async function syncParentAccountToDescendants(
  parentOrgId: string,
  sourceAccount: MirrorableAccount,
  options?: { previousCode?: string | null }
) {
  const descendants = await getDescendantOrganizationIds(parentOrgId)
  if (descendants.length === 0) return { success: true, syncedOrgCount: 0, errors: [] as string[] }

  const errors: string[] = []
  const previousCode = String(options?.previousCode || '').trim() || null
  const parentAccountParentCode = await resolveParentAccountCode(parentOrgId, sourceAccount.parent_id || null)

  for (const childOrgId of descendants) {
    const candidateCodes = Array.from(
      new Set(
        [previousCode, sourceAccount.code]
          .map((code) => String(code || '').trim())
          .filter(Boolean)
      )
    )

    const childRows = await prisma.accounts.findMany({
      where: {
        org_id: childOrgId,
        ...(candidateCodes.length > 0 ? { code: { in: candidateCodes } } : { code: sourceAccount.code }),
      },
      select: { id: true, code: true },
    })

    const rowByCode = new Map<string, { id: string; code: string }>()
    for (const row of childRows) {
      const code = String(row.code || '').trim()
      if (code) rowByCode.set(code, row)
    }

    const byOldCode = previousCode ? rowByCode.get(previousCode) : null
    const byNewCode = rowByCode.get(sourceAccount.code)
    let targetRow = byOldCode || byNewCode || null

    let childParentId: string | null = null
    if (parentAccountParentCode) {
      const childParent = await prisma.accounts.findFirst({
        where: { org_id: childOrgId, code: parentAccountParentCode },
        select: { id: true },
      })
      childParentId = childParent?.id ? String(childParent.id) : null
    }

    if (byOldCode && byNewCode && byOldCode.id !== byNewCode.id) {
      targetRow = byNewCode
      try {
        await prisma.accounts.updateMany({
          where: { org_id: childOrgId, id: byOldCode.id },
          data: { is_active: false },
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`Org ${childOrgId}: gagal menonaktifkan akun duplikat lama (${message}).`)
      }
    }

    const payload = buildMirrorPayload(sourceAccount, childParentId, targetRow?.id ? String(targetRow.id) : undefined)

    if (targetRow?.id) {
      try {
        await prisma.accounts.updateMany({
          where: { org_id: childOrgId, id: targetRow.id },
          data: payload,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`Org ${childOrgId}: gagal sinkron update akun ${sourceAccount.code} (${message}).`)
      }
      continue
    }

    try {
      await prisma.accounts.create({
        data: {
          org_id: childOrgId,
          ...payload,
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      errors.push(`Org ${childOrgId}: gagal sinkron create akun ${sourceAccount.code} (${message}).`)
    }
  }

  return {
    success: errors.length === 0,
    syncedOrgCount: descendants.length,
    errors,
  }
}

export async function syncParentCoAToChildOrg(parentOrgId: string, childOrgId: string) {
  const parentRows = await prisma.accounts.findMany({
    where: { org_id: parentOrgId },
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
    orderBy: { code: 'asc' },
  }) as MirrorableAccount[]

  if (parentRows.length === 0) return { success: true, syncedCount: 0 }

  const parentIdToCode = new Map<string, string>(
    parentRows.map((row) => [row.id, row.code])
  )

  const childAccounts = await prisma.accounts.findMany({
    where: { org_id: childOrgId },
    select: { id: true, code: true },
  })

  const childByCode = new Map<string, { id: string; code: string }>()
  for (const row of childAccounts) {
    const code = String(row.code || '').trim()
    const id = String(row.id || '').trim()
    if (!code || !id) continue
    childByCode.set(code, { id, code })
  }

  let syncedCount = 0
  for (const source of parentRows) {
    const parentCode = source.parent_id ? parentIdToCode.get(source.parent_id) || null : null
    const childParentId = parentCode ? childByCode.get(parentCode)?.id || null : null
    const existing = childByCode.get(source.code)
    const payload = buildMirrorPayload(source, childParentId, existing?.id)

    if (existing?.id) {
      try {
        await prisma.accounts.updateMany({
          where: { org_id: childOrgId, id: existing.id },
          data: payload,
        })
        syncedCount += 1
      } catch {}
      continue
    }

    try {
      const inserted = await prisma.accounts.create({
        data: {
          org_id: childOrgId,
          ...payload,
        },
        select: { id: true, code: true },
      })

      childByCode.set(String(inserted.code), {
        id: String(inserted.id),
        code: String(inserted.code),
      })
      syncedCount += 1
    } catch {}
  }

  return { success: true, syncedCount }
}

async function propagateDeletedParentAccountToDescendants(parentOrgId: string, deletedCode: string) {
  const descendants = await getDescendantOrganizationIds(parentOrgId)
  if (descendants.length === 0) return { success: true, syncedOrgCount: 0, errors: [] as string[] }

  const errors: string[] = []
  for (const childOrgId of descendants) {
    const childAccount = await prisma.accounts.findFirst({
      where: { org_id: childOrgId, code: deletedCode },
      select: { id: true },
    })

    if (!childAccount?.id) continue

    try {
      await prisma.accounts.deleteMany({
        where: { org_id: childOrgId, id: childAccount.id },
      })
      continue
    } catch {
      try {
        await prisma.accounts.updateMany({
          where: { org_id: childOrgId, id: childAccount.id },
          data: { is_active: false },
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`Org ${childOrgId}: gagal sinkron hapus akun ${deletedCode} (${message}).`)
      }
    }
  }

  return {
    success: errors.length === 0,
    syncedOrgCount: descendants.length,
    errors,
  }
}

function normalizeAccount(account: {
  id: string
  org_id: string
  code: string
  name: string
  type: string
  normal_balance: string
  parent_id: string | null
  description: string | null
  is_system: boolean
  is_active: boolean
  created_at: Date
  updated_at: Date
}): Account {
  return {
    id: account.id,
    org_id: account.org_id,
    code: account.code,
    name: account.name,
    type: account.type as AccountType,
    normal_balance: account.normal_balance as NormalBalance,
    parent_id: account.parent_id,
    description: account.description,
    is_system: account.is_system,
    is_active: account.is_active,
    created_at: account.created_at.toISOString(),
    updated_at: account.updated_at.toISOString(),
  }
}

async function ensureOrgAccess(orgId: string) {
  const user = await getAuthUser()
  if (!user) return null
  return getMembership(user.userId, orgId)
}

// ─────────────────────────────────────────────────────────────
// getChartOfAccounts — fetch all accounts for an org, tree-structured
// ─────────────────────────────────────────────────────────────
export async function getChartOfAccounts(orgId: string) {
  const membership = await ensureOrgAccess(orgId)
  if (!membership) return []

  const data = await prisma.accounts.findMany({
    where: { org_id: orgId },
    orderBy: { code: 'asc' },
  })

  return data.map(normalizeAccount)
}

// ─────────────────────────────────────────────────────────────
// checkCanManageCoA — Cek apakah org saat ini bisa buat akun
// langsung (Parent), atau harus lewat sistem request (Child/Branch)
// ─────────────────────────────────────────────────────────────
export async function checkCanManageCoA(orgId: string): Promise<{
  canManageDirect: boolean
  isParentOrg: boolean
}> {
  const [organization, canManageDirect] = await Promise.all([
    prisma.organizations.findUnique({
      where: { id: orgId },
      select: { parent_org_id: true },
    }),
    canManageFinanceMaster(orgId),
  ])

  return {
    canManageDirect,
    isParentOrg: !organization?.parent_org_id,
  }
}

// ─────────────────────────────────────────────────────────────
// createAccount — Add a custom account to CoA
// HANYA untuk Parent/Holding. Child/Branch gunakan:
// → submitCoaRequest() di coa-request.actions.ts
// ─────────────────────────────────────────────────────────────
export async function createAccount(orgId: string, formData: FormData) {
  const membership = await ensureOrgAccess(orgId)
  if (!membership) return { error: 'Unauthorized' }

  // ── Validasi Hierarki: Hanya Parent yang boleh buat akun langsung ──
  const canManage = await canManageFinanceMaster(orgId)
  if (!canManage) {
    return {
      error:
        'Hanya Organisasi Utama (Parent/Holding) pada konteks Unit Utama yang dapat membuat rekening CoA secara langsung. ' +
        'Silakan ajukan melalui menu "Pengajuan Rekening CoA".',
      requiresRequest: true,
    }
  }

  const code = (formData.get('code') as string).trim()
  const name = (formData.get('name') as string).trim()
  const type = formData.get('type') as AccountType
  const normalBalance = formData.get('normal_balance') as NormalBalance
  const parentId = formData.get('parent_id') as string | null
  const description = formData.get('description') as string | null

  if (!code || !name || !type || !normalBalance) {
    return { error: 'Kode, nama, tipe, dan saldo normal wajib diisi.' }
  }

  try {
    const insertedAccount = await prisma.accounts.create({
      data: {
      org_id: orgId,
      code,
      name,
      type,
      normal_balance: normalBalance,
      parent_id: parentId || null,
      description: description || null,
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

    const syncResult = await syncParentAccountToDescendants(orgId, insertedAccount as MirrorableAccount)
    if (!syncResult.success) {
      ;(console as any).warn('CoA sync warning (createAccount):', syncResult.errors)
    }

    revalidatePath('/settings/accounts')
    return {
      success: true,
      warning: syncResult.success
        ? null
        : 'Akun parent berhasil disimpan, tetapi sinkronisasi ke sebagian cabang/anak belum sempurna.',
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { error: `Kode akun ${code} sudah digunakan.` }
    }
    return { error: error instanceof Error ? error.message : 'Gagal menyimpan akun.' }
  }
}

// ─────────────────────────────────────────────────────────────
// updateAccount — Edit name/description (not code, not system)
// ─────────────────────────────────────────────────────────────
export async function updateAccount(
  accountId: string,
  orgId: string,
  updates: { 
    name?: string; 
    description?: string; 
    is_active?: boolean;
    code?: string;
    type?: AccountType;
    normal_balance?: NormalBalance;
    parent_id?: string | null;
  }
) {
  const membership = await ensureOrgAccess(orgId)
  if (!membership) return { error: 'Unauthorized' }
  if (!(await canManageFinanceMaster(orgId))) {
    return { error: 'Hanya Organisasi Utama pada konteks Unit Utama yang dapat mengubah rekening CoA.' }
  }

  // Prevent editing system accounts' critical fields
  const existing = await prisma.accounts.findFirst({
    where: { id: accountId, org_id: orgId },
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

  if (!existing) return { error: 'Akun tidak ditemukan.' }

  try {
    await prisma.accounts.update({
      where: { id: accountId },
      data: updates,
    })
  } catch {
    return { error: 'Gagal memperbarui akun.' }
  }

  const updatedAccount = await prisma.accounts.findFirst({
    where: { id: accountId, org_id: orgId },
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

  if (updatedAccount) {
    const syncResult = await syncParentAccountToDescendants(orgId, updatedAccount as MirrorableAccount, {
      previousCode: existing.code || null,
    })
    if (!syncResult.success) {
      ;(console as any).warn('CoA sync warning (updateAccount):', syncResult.errors)
    }
  }

  revalidatePath('/settings/accounts')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// deleteAccount — Only non-system, no journal lines
// ─────────────────────────────────────────────────────────────
export async function deleteAccount(accountId: string, orgId: string) {
  const membership = await ensureOrgAccess(orgId)
  if (!membership) return { error: 'Unauthorized' }
  if (!(await canManageFinanceMaster(orgId))) {
    return { error: 'Hanya Organisasi Utama pada konteks Unit Utama yang dapat menghapus rekening CoA.' }
  }

  const existing = await prisma.accounts.findFirst({
    where: { id: accountId, org_id: orgId },
    select: { id: true, code: true, is_system: true },
  })

  if (!existing) return { error: 'Akun tidak ditemukan.' }
  if (existing.is_system) return { error: 'Akun sistem tidak dapat dihapus.' }

  // Check for existing journal lines
  const count = await prisma.journal_lines.count({
    where: {
      account_id: accountId,
    },
  })

  if ((count ?? 0) > 0) {
    return { error: 'Akun ini sudah memiliki transaksi. Nonaktifkan saja, jangan hapus.' }
  }

  try {
    await prisma.accounts.delete({
      where: { id: accountId },
    })
  } catch {
    return { error: 'Gagal menghapus akun.' }
  }

  const syncDeleteResult = await propagateDeletedParentAccountToDescendants(
    orgId,
    String(existing.code || '')
  )
  if (!syncDeleteResult.success) {
    ;(console as any).warn('CoA sync warning (deleteAccount):', syncDeleteResult.errors)
  }

  revalidatePath('/settings/accounts')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// getAccountBalances — for dashboard/reports
// ─────────────────────────────────────────────────────────────
export async function getAccountBalances(orgId: string): Promise<AccountBalance[]> {
  const membership = await ensureOrgAccess(orgId)
  if (!membership) return []

  const rows = await prisma.$queryRaw<AccountBalance[]>`
    SELECT
      org_id::text AS org_id,
      account_id::text AS account_id,
      code,
      name,
      type::text AS type,
      normal_balance::text AS normal_balance,
      COALESCE(balance, 0)::double precision AS balance,
      COALESCE(total_debit, 0)::double precision AS total_debit,
      COALESCE(total_credit, 0)::double precision AS total_credit
    FROM public.account_balances
    WHERE org_id = CAST(${orgId} AS uuid)
    ORDER BY code ASC
  `

  return rows
}
// ─────────────────────────────────────────────────────────────
// seedInitialCoA — Manual trigger to seed default PSAK CoA if empty
// ─────────────────────────────────────────────────────────────
export async function seedInitialCoA(orgId: string) {
  const membership = await ensureOrgAccess(orgId)
  if (!membership) return { error: 'Unauthorized' }

  // First check if already has accounts to prevent double seeding
  const existing = await prisma.accounts.findFirst({
    where: { org_id: orgId },
    select: { id: true },
  })

  if (existing) {
    return { error: 'Sudah ada akun CoA untuk organisasi ini.' }
  }

  try {
    await prisma.$queryRaw`SELECT public.seed_default_coa(CAST(${orgId} AS uuid))`
  } catch (error) {
    console.error('Seed CoA Error:', error)
    return { error: 'Gagal menyiapkan akun standar. Silakan hubungi dukungan.' }
  }

  revalidatePath('/settings/accounts')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// setShariahAccountsActive — Toggle Syariah Accounts
// ─────────────────────────────────────────────────────────────
export async function setShariahAccountsActive(orgId: string, active: boolean) {
  const membership = await ensureOrgAccess(orgId)
  if (!membership) return { error: 'Unauthorized' }

  // Common syariah codes from migration 1006
  const syariahCodes = ['1404', '2600', '2601', '2602', '3100', '3110', '3120', '6100', '6110', '6120', '6200', '6210', '6220', '6230']

  try {
    await prisma.accounts.updateMany({
      where: {
        org_id: orgId,
        code: {
          in: syariahCodes,
        },
      },
      data: {
        is_active: active,
      },
    })
  } catch (error) {
    console.error('Toggle Syariah Error:', error)
    return { error: 'Gagal mengubah status akun Syariah.' }
  }

  revalidatePath('/settings/accounts')
  return { success: true }
}
