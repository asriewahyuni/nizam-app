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
import type { Account, AccountType, NormalBalance, AccountBalance } from '@/types/database.types'
import { createAdminClient, createClient } from '@/lib/supabase/server'

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

async function getDescendantOrganizationIds(admin: any, parentOrgId: string): Promise<string[]> {
  const { data, error } = await admin
    .from('organizations')
    .select('id, parent_org_id')

  if (error || !Array.isArray(data)) return []

  const childrenByParent = new Map<string, string[]>()
  for (const row of data as any[]) {
    const id = String(row?.id || '').trim()
    const parentId = String(row?.parent_org_id || '').trim()
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
  admin: any,
  parentOrgId: string,
  parentAccountId: string | null
): Promise<string | null> {
  if (!parentAccountId) return null
  const { data } = await admin
    .from('accounts')
    .select('code')
    .eq('org_id', parentOrgId)
    .eq('id', parentAccountId)
    .maybeSingle()
  return data?.code ? String(data.code) : null
}

export async function syncParentAccountToDescendants(
  parentOrgId: string,
  sourceAccount: MirrorableAccount,
  options?: { previousCode?: string | null }
) {
  const admin = await createAdminClient()
  const descendants = await getDescendantOrganizationIds(admin as any, parentOrgId)
  if (descendants.length === 0) return { success: true, syncedOrgCount: 0, errors: [] as string[] }

  const errors: string[] = []
  const previousCode = String(options?.previousCode || '').trim() || null
  const parentAccountParentCode = await resolveParentAccountCode(
    admin as any,
    parentOrgId,
    sourceAccount.parent_id || null
  )

  for (const childOrgId of descendants) {
    const candidateCodes = Array.from(
      new Set(
        [previousCode, sourceAccount.code]
          .map((code) => String(code || '').trim())
          .filter(Boolean)
      )
    )

    let childRows: any[] = []
    if (candidateCodes.length > 1) {
      const { data } = await (admin as any)
        .from('accounts')
        .select('id, code')
        .eq('org_id', childOrgId)
        .in('code', candidateCodes)
      childRows = Array.isArray(data) ? data : []
    } else {
      const { data } = await (admin as any)
        .from('accounts')
        .select('id, code')
        .eq('org_id', childOrgId)
        .eq('code', sourceAccount.code)
      childRows = Array.isArray(data) ? data : []
    }

    const rowByCode = new Map<string, any>()
    for (const row of childRows) {
      const code = String(row?.code || '').trim()
      if (code) rowByCode.set(code, row)
    }

    const byOldCode = previousCode ? rowByCode.get(previousCode) : null
    const byNewCode = rowByCode.get(sourceAccount.code)
    let targetRow = byOldCode || byNewCode || null

    let childParentId: string | null = null
    if (parentAccountParentCode) {
      const { data: childParent } = await (admin as any)
        .from('accounts')
        .select('id')
        .eq('org_id', childOrgId)
        .eq('code', parentAccountParentCode)
        .maybeSingle()
      childParentId = childParent?.id ? String(childParent.id) : null
    }

    if (byOldCode && byNewCode && byOldCode.id !== byNewCode.id) {
      targetRow = byNewCode
      const { error: deactivateStaleError } = await (admin as any)
        .from('accounts')
        .update({ is_active: false })
        .eq('org_id', childOrgId)
        .eq('id', byOldCode.id)
      if (deactivateStaleError) {
        errors.push(`Org ${childOrgId}: gagal menonaktifkan akun duplikat lama (${deactivateStaleError.message}).`)
      }
    }

    const payload = buildMirrorPayload(sourceAccount, childParentId, targetRow?.id ? String(targetRow.id) : undefined)

    if (targetRow?.id) {
      const { error: updateError } = await (admin as any)
        .from('accounts')
        .update(payload)
        .eq('org_id', childOrgId)
        .eq('id', targetRow.id)
      if (updateError) {
        errors.push(`Org ${childOrgId}: gagal sinkron update akun ${sourceAccount.code} (${updateError.message}).`)
      }
      continue
    }

    const { error: insertError } = await (admin as any)
      .from('accounts')
      .insert({
        org_id: childOrgId,
        ...payload,
      })
    if (insertError) {
      errors.push(`Org ${childOrgId}: gagal sinkron create akun ${sourceAccount.code} (${insertError.message}).`)
    }
  }

  return {
    success: errors.length === 0,
    syncedOrgCount: descendants.length,
    errors,
  }
}

export async function syncParentCoAToChildOrg(parentOrgId: string, childOrgId: string) {
  const admin = await createAdminClient()

  const { data: parentAccounts, error: parentAccountsError } = await (admin as any)
    .from('accounts')
    .select('id, code, name, type, normal_balance, parent_id, description, is_system, is_active')
    .eq('org_id', parentOrgId)
    .order('code', { ascending: true })

  if (parentAccountsError) {
    return { success: false, error: parentAccountsError.message || 'Gagal membaca CoA parent.' }
  }

  const parentRows = (parentAccounts || []) as MirrorableAccount[]
  if (parentRows.length === 0) return { success: true, syncedCount: 0 }

  const parentIdToCode = new Map<string, string>(
    parentRows.map((row) => [row.id, row.code])
  )

  const { data: childAccounts, error: childAccountsError } = await (admin as any)
    .from('accounts')
    .select('id, code')
    .eq('org_id', childOrgId)

  if (childAccountsError) {
    return { success: false, error: childAccountsError.message || 'Gagal membaca CoA child.' }
  }

  const childByCode = new Map<string, { id: string; code: string }>()
  for (const row of (childAccounts || []) as any[]) {
    const code = String(row?.code || '').trim()
    const id = String(row?.id || '').trim()
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
      const { error: updateError } = await (admin as any)
        .from('accounts')
        .update(payload)
        .eq('org_id', childOrgId)
        .eq('id', existing.id)
      if (!updateError) syncedCount += 1
      continue
    }

    const { data: inserted, error: insertError } = await (admin as any)
      .from('accounts')
      .insert({
        org_id: childOrgId,
        ...payload,
      })
      .select('id, code')
      .single()

    if (!insertError && inserted?.id && inserted?.code) {
      childByCode.set(String(inserted.code), {
        id: String(inserted.id),
        code: String(inserted.code),
      })
      syncedCount += 1
    }
  }

  return { success: true, syncedCount }
}

async function propagateDeletedParentAccountToDescendants(parentOrgId: string, deletedCode: string) {
  const admin = await createAdminClient()
  const descendants = await getDescendantOrganizationIds(admin as any, parentOrgId)
  if (descendants.length === 0) return { success: true, syncedOrgCount: 0, errors: [] as string[] }

  const errors: string[] = []
  for (const childOrgId of descendants) {
    const { data: childAccount } = await (admin as any)
      .from('accounts')
      .select('id')
      .eq('org_id', childOrgId)
      .eq('code', deletedCode)
      .maybeSingle()

    if (!childAccount?.id) continue

    const { error: deleteError } = await (admin as any)
      .from('accounts')
      .delete()
      .eq('org_id', childOrgId)
      .eq('id', childAccount.id)

    if (!deleteError) continue

    const { error: deactivateError } = await (admin as any)
      .from('accounts')
      .update({ is_active: false })
      .eq('org_id', childOrgId)
      .eq('id', childAccount.id)

    if (deactivateError) {
      errors.push(`Org ${childOrgId}: gagal sinkron hapus akun ${deletedCode} (${deactivateError.message}).`)
    }
  }

  return {
    success: errors.length === 0,
    syncedOrgCount: descendants.length,
    errors,
  }
}

// ─────────────────────────────────────────────────────────────
// getChartOfAccounts — fetch all accounts for an org, tree-structured
// ─────────────────────────────────────────────────────────────
export async function getChartOfAccounts(orgId: string) {
  const supabase = await createClient()

  const { data, error } = await (supabase as any)
    .from('accounts')
    .select('*')
    .eq('org_id', orgId)
    .order('code', { ascending: true })

  if (error) return []
  return data as Account[]
}

// ─────────────────────────────────────────────────────────────
// checkCanManageCoA — Cek apakah org saat ini bisa buat akun
// langsung (Parent), atau harus lewat sistem request (Child/Branch)
// ─────────────────────────────────────────────────────────────
export async function checkCanManageCoA(orgId: string): Promise<{
  canManageDirect: boolean
  isParentOrg: boolean
}> {
  const supabase = await createClient()
  const rpc = (supabase as any)?.rpc

  if (typeof rpc !== 'function') {
    return { canManageDirect: true, isParentOrg: true }
  }

  const [manageResult, parentResult] = await Promise.all([
    (supabase as any).rpc('can_manage_finance_master', { p_org_id: orgId }),
    (supabase as any).rpc('is_main_organization', { p_org_id: orgId }),
  ])

  return {
    canManageDirect: manageResult.data === true,
    isParentOrg: parentResult.data === true,
  }
}

// ─────────────────────────────────────────────────────────────
// createAccount — Add a custom account to CoA
// HANYA untuk Parent/Holding. Child/Branch gunakan:
// → submitCoaRequest() di coa-request.actions.ts
// ─────────────────────────────────────────────────────────────
export async function createAccount(orgId: string, formData: FormData) {
  const supabase = await createClient()

  // ── Validasi Hierarki: Hanya Parent yang boleh buat akun langsung ──
  const { data: canManage, error: permError } = await (supabase as any)
    .rpc('can_manage_finance_master', { p_org_id: orgId })

  if (permError || !canManage) {
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

  const { data: insertedAccount, error } = await (supabase as any)
    .from('accounts')
    .insert({
      org_id: orgId,
      code,
      name,
      type,
      normal_balance: normalBalance,
      parent_id: parentId || null,
      description: description || null,
      is_system: false,
    })
    .select('id, code, name, type, normal_balance, parent_id, description, is_system, is_active')
    .single()

  if (error || !insertedAccount) {
    if (error?.code === '23505') {
      return { error: `Kode akun ${code} sudah digunakan.` }
    }
    // Tangkap pesan dari trigger enforce_accounts_governance
    return { error: error?.message ?? 'Gagal menyimpan akun.' }
  }

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

  const supabase = await createClient()

  // Prevent editing system accounts' critical fields
  const { data: existing } = await (supabase as any)
    .from('accounts')
    .select('id, code, name, type, normal_balance, parent_id, description, is_system, is_active')
    .eq('id', accountId)
    .eq('org_id', orgId)
    .single()

  if (!existing) return { error: 'Akun tidak ditemukan.' }

  const { error } = await (supabase as any)
    .from('accounts')
    .update(updates)
    .eq('id', accountId)
    .eq('org_id', orgId)

  if (error) return { error: 'Gagal memperbarui akun.' }

  const { data: updatedAccount } = await (supabase as any)
    .from('accounts')
    .select('id, code, name, type, normal_balance, parent_id, description, is_system, is_active')
    .eq('id', accountId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (updatedAccount) {
    const syncResult = await syncParentAccountToDescendants(orgId, updatedAccount as MirrorableAccount, {
      previousCode: (existing as any)?.code || null,
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
  const supabase = await createClient()

  const { data: existing } = await (supabase as any)
    .from('accounts')
    .select('id, code, is_system')
    .eq('id', accountId)
    .eq('org_id', orgId)
    .single()

  if (!existing) return { error: 'Akun tidak ditemukan.' }
  if (existing.is_system) return { error: 'Akun sistem tidak dapat dihapus.' }

  // Check for existing journal lines
  const { count } = await (supabase as any)
    .from('journal_lines')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', accountId)

  if ((count ?? 0) > 0) {
    return { error: 'Akun ini sudah memiliki transaksi. Nonaktifkan saja, jangan hapus.' }
  }

  const { error } = await (supabase as any)
    .from('accounts')
    .delete()
    .eq('id', accountId)
    .eq('org_id', orgId)

  if (error) return { error: 'Gagal menghapus akun.' }

  const syncDeleteResult = await propagateDeletedParentAccountToDescendants(
    orgId,
    String((existing as any).code || '')
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
  const supabase = await createClient()

  const { data, error } = await (supabase as any)
    .from('account_balances')
    .select('*')
    .eq('org_id', orgId)
    .order('code', { ascending: true })

  if (error) return []
  return (data as AccountBalance[]) || []
}
// ─────────────────────────────────────────────────────────────
// seedInitialCoA — Manual trigger to seed default PSAK CoA if empty
// ─────────────────────────────────────────────────────────────
export async function seedInitialCoA(orgId: string) {
  const supabase = await createClient()

  // First check if already has accounts to prevent double seeding
  const { data: existing } = await (supabase as any)
    .from('accounts')
    .select('id')
    .eq('org_id', orgId)
    .limit(1)

  if (existing && existing.length > 0) {
    return { error: 'Sudah ada akun CoA untuk organisasi ini.' }
  }

  // Use RPC if available, or just call the seed function
  const { error } = await (supabase as any).rpc('seed_default_coa', { p_org_id: orgId })

  if (error) {
    (console as any).error('Seed CoA Error:', error)
    return { error: 'Gagal menyiapkan akun standar. Silakan hubungi dukungan.' }
  }

  revalidatePath('/settings/accounts')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// setShariahAccountsActive — Toggle Syariah Accounts
// ─────────────────────────────────────────────────────────────
export async function setShariahAccountsActive(orgId: string, active: boolean) {
  const supabase = await createClient()

  // Common syariah codes from migration 1006
  const syariahCodes = ['1404', '2600', '2601', '2602', '3100', '3110', '3120', '6100', '6110', '6120', '6200', '6210', '6220', '6230']

  const { error } = await (supabase as any)
    .from('accounts')
    .update({ is_active: active })
    .eq('org_id', orgId)
    .filter('code', 'in', `(${syariahCodes.join(',')})`)

  if (error) {
    (console as any).error('Toggle Syariah Error:', error)
    return { error: 'Gagal mengubah status akun Syariah.' }
  }

  revalidatePath('/settings/accounts')
  return { success: true }
}
