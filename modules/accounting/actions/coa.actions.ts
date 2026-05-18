'use server'

/**
 * coa.actions.ts
 * Aturan Hierarki Pengendalian Rekening:
 *   - PARENT (Holding/Induk) : Dapat membuat/edit/hapus rekening CoA langsung
 *   - CHILD  (Anak Perusahaan):
 *       • Mode INHERITED → wajib ajukan request ke Parent
 *       • Mode LOCAL     → dapat kelola CoA sendiri
 *   - BRANCH (Cabang)        : WAJIB ajukan request ke Parent melalui Child
 * Lihat: coa-request.actions.ts untuk alur pengajuan request
 */

import { revalidatePath } from 'next/cache'
import type {
  Account,
  AccountType,
  NormalBalance,
  AccountBalance,
  CoAManagementMode as DbCoAManagementMode,
} from '@/types/database.types'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { isInternalAuthProvider } from '@/lib/auth/provider'
import { setShariahAccountsActive as syncShariahAccountsActive } from './shariah.actions'

type MirrorableAccount = Pick<
  Account,
  'id' | 'code' | 'name' | 'type' | 'normal_balance' | 'parent_id' | 'description' | 'is_system' | 'is_active'
>

type StandardCoATemplate = {
  code: string
  name: string
  type: AccountType
  normal_balance: NormalBalance
  parent_code?: string | null
}

export type CoAManagementMode = DbCoAManagementMode

type CoAManagementContext = {
  parentOrgId: string | null
  mode: CoAManagementMode
  isParentOrg: boolean
  inheritsParentCoA: boolean
}

const CORE_PSAK_CODES = ['1000', '2000', '3000', '4000', '5000', '6000'] as const

type SeedInitialCoAOptions = {
  revalidate?: boolean
}

function normalizeCoAManagementMode(value: unknown): CoAManagementMode {
  return String(value || '').trim().toUpperCase() === 'LOCAL' ? 'LOCAL' : 'INHERITED'
}

function isMissingCoAManagementModeColumnError(error: unknown) {
  const rawMessage = String((error as any)?.message || '').trim().toLowerCase()
  return rawMessage.includes('coa_management_mode') && rawMessage.includes('column')
}

async function getCoAManagementContextFromDb(db: any, orgId: string): Promise<CoAManagementContext> {
  const trimmedOrgId = String(orgId || '').trim()
  if (!trimmedOrgId) {
    return {
      parentOrgId: null,
      mode: 'INHERITED',
      isParentOrg: true,
      inheritsParentCoA: false,
    }
  }

  let parentOrgId: string | null = null
  let mode: CoAManagementMode = 'INHERITED'

  const { data, error } = await db
    .from('organizations')
    .select('parent_org_id, coa_management_mode')
    .eq('id', trimmedOrgId)
    .maybeSingle()

  if (error && isMissingCoAManagementModeColumnError(error)) {
    const { data: fallbackData } = await db
      .from('organizations')
      .select('parent_org_id')
      .eq('id', trimmedOrgId)
      .maybeSingle()

    parentOrgId = String(fallbackData?.parent_org_id || '').trim() || null
  } else {
    parentOrgId = String(data?.parent_org_id || '').trim() || null
    mode = normalizeCoAManagementMode(data?.coa_management_mode)
  }

  const isParentOrg = !parentOrgId
  return {
    parentOrgId,
    mode,
    isParentOrg,
    inheritsParentCoA: Boolean(parentOrgId) && mode !== 'LOCAL',
  }
}

const STANDARD_PSAK_COA_TEMPLATE: StandardCoATemplate[] = [
  { code: '1000', name: 'Aset', type: 'ASSET', normal_balance: 'DEBIT' },
  { code: '1100', name: 'Aset Lancar', type: 'ASSET', normal_balance: 'DEBIT', parent_code: '1000' },
  { code: '1101', name: 'Kas Besar', type: 'ASSET', normal_balance: 'DEBIT', parent_code: '1000' },
  { code: '1102', name: 'Kas Kecil (Petty Cash)', type: 'ASSET', normal_balance: 'DEBIT', parent_code: '1000' },
  { code: '1103', name: 'Bank - Rekening Operasional', type: 'ASSET', normal_balance: 'DEBIT', parent_code: '1000' },
  { code: '1104', name: 'Bank - Rekening Payroll', type: 'ASSET', normal_balance: 'DEBIT', parent_code: '1000' },
  { code: '1105', name: 'Bank - Rekening Lainnya', type: 'ASSET', normal_balance: 'DEBIT', parent_code: '1000' },
  { code: '1201', name: 'Piutang Usaha', type: 'ASSET', normal_balance: 'DEBIT', parent_code: '1000' },
  { code: '1202', name: 'Piutang Karyawan', type: 'ASSET', normal_balance: 'DEBIT', parent_code: '1000' },
  { code: '1203', name: 'Cadangan Kerugian Piutang', type: 'ASSET', normal_balance: 'CREDIT', parent_code: '1000' },
  { code: '1301', name: 'Persediaan Barang Dagangan', type: 'ASSET', normal_balance: 'DEBIT', parent_code: '1000' },
  { code: '1302', name: 'Persediaan Barang Dalam Proses', type: 'ASSET', normal_balance: 'DEBIT', parent_code: '1000' },
  { code: '1303', name: 'Persediaan Bahan Baku', type: 'ASSET', normal_balance: 'DEBIT', parent_code: '1000' },
  { code: '1304', name: 'Persediaan Barang Jadi', type: 'ASSET', normal_balance: 'DEBIT', parent_code: '1000' },
  { code: '1401', name: 'PPN Masukan (Pajak Dibayar)', type: 'ASSET', normal_balance: 'DEBIT', parent_code: '1000' },
  { code: '1402', name: 'Biaya Dibayar Dimuka', type: 'ASSET', normal_balance: 'DEBIT', parent_code: '1000' },
  { code: '1403', name: 'Uang Muka Pembelian', type: 'ASSET', normal_balance: 'DEBIT', parent_code: '1000' },
  { code: '1500', name: 'Aset Tetap', type: 'ASSET', normal_balance: 'DEBIT', parent_code: '1000' },
  { code: '1501', name: 'Tanah', type: 'ASSET', normal_balance: 'DEBIT', parent_code: '1000' },
  { code: '1502', name: 'Bangunan', type: 'ASSET', normal_balance: 'DEBIT', parent_code: '1000' },
  { code: '1503', name: 'Akumulasi Penyusutan Bangunan', type: 'ASSET', normal_balance: 'CREDIT', parent_code: '1000' },
  { code: '1504', name: 'Kendaraan', type: 'ASSET', normal_balance: 'DEBIT', parent_code: '1000' },
  { code: '1505', name: 'Akumulasi Penyusutan Kendaraan', type: 'ASSET', normal_balance: 'CREDIT', parent_code: '1000' },
  { code: '1506', name: 'Peralatan & Mesin', type: 'ASSET', normal_balance: 'DEBIT', parent_code: '1000' },
  { code: '1507', name: 'Akumulasi Penyusutan Peralatan', type: 'ASSET', normal_balance: 'CREDIT', parent_code: '1000' },
  { code: '1600', name: 'Investasi Jangka Panjang', type: 'ASSET', normal_balance: 'DEBIT', parent_code: '1000' },
  { code: '1601', name: 'Investasi pada Entitas Anak / Unit', type: 'ASSET', normal_balance: 'DEBIT', parent_code: '1600' },
  { code: '2000', name: 'Liabilitas', type: 'LIABILITY', normal_balance: 'CREDIT' },
  { code: '2101', name: 'Hutang Usaha', type: 'LIABILITY', normal_balance: 'CREDIT', parent_code: '2000' },
  { code: '2102', name: 'Hutang Bank Jangka Pendek', type: 'LIABILITY', normal_balance: 'CREDIT', parent_code: '2000' },
  { code: '2201', name: 'PPN Keluaran (Pajak Dipungut)', type: 'LIABILITY', normal_balance: 'CREDIT', parent_code: '2000' },
  { code: '2202', name: 'Hutang PPh 21', type: 'LIABILITY', normal_balance: 'CREDIT', parent_code: '2000' },
  { code: '2203', name: 'Hutang PPh 23', type: 'LIABILITY', normal_balance: 'CREDIT', parent_code: '2000' },
  { code: '2204', name: 'Hutang PPh Badan', type: 'LIABILITY', normal_balance: 'CREDIT', parent_code: '2000' },
  { code: '2301', name: 'Pendapatan Diterima di Muka', type: 'LIABILITY', normal_balance: 'CREDIT', parent_code: '2000' },
  { code: '2302', name: 'Uang Muka Penjualan', type: 'LIABILITY', normal_balance: 'CREDIT', parent_code: '2000' },
  { code: '2401', name: 'Hutang Gaji', type: 'LIABILITY', normal_balance: 'CREDIT', parent_code: '2000' },
  { code: '2501', name: 'Hutang Bank Jangka Panjang', type: 'LIABILITY', normal_balance: 'CREDIT', parent_code: '2000' },
  { code: '3000', name: 'Ekuitas', type: 'EQUITY', normal_balance: 'CREDIT' },
  { code: '3001', name: 'Modal Disetor', type: 'EQUITY', normal_balance: 'CREDIT', parent_code: '3000' },
  { code: '3002', name: 'Laba Ditahan', type: 'EQUITY', normal_balance: 'CREDIT', parent_code: '3000' },
  { code: '3003', name: 'Laba Periode Berjalan', type: 'EQUITY', normal_balance: 'CREDIT', parent_code: '3000' },
  { code: '3004', name: 'Prive / Dividen', type: 'EQUITY', normal_balance: 'DEBIT', parent_code: '3000' },
  { code: '4000', name: 'Pendapatan', type: 'REVENUE', normal_balance: 'CREDIT' },
  { code: '4001', name: 'Pendapatan Usaha', type: 'REVENUE', normal_balance: 'CREDIT', parent_code: '4000' },
  { code: '4002', name: 'Diskon Penjualan (Contra)', type: 'REVENUE', normal_balance: 'DEBIT', parent_code: '4000' },
  { code: '4003', name: 'Retur Penjualan', type: 'REVENUE', normal_balance: 'DEBIT', parent_code: '4000' },
  { code: '4101', name: 'Pendapatan Bunga', type: 'REVENUE', normal_balance: 'CREDIT', parent_code: '4000' },
  { code: '4102', name: 'Pendapatan Lain-lain', type: 'REVENUE', normal_balance: 'CREDIT', parent_code: '4000' },
  { code: '5000', name: 'Beban Pokok Penjualan', type: 'EXPENSE', normal_balance: 'DEBIT' },
  { code: '5001', name: 'HPP / Cost of Goods Sold', type: 'EXPENSE', normal_balance: 'DEBIT', parent_code: '5000' },
  { code: '5002', name: 'Biaya Pengiriman Masuk (Freight In)', type: 'EXPENSE', normal_balance: 'DEBIT', parent_code: '5000' },
  { code: '5003', name: 'Retur Pembelian (Contra)', type: 'EXPENSE', normal_balance: 'CREDIT', parent_code: '5000' },
  { code: '6000', name: 'Beban Operasional', type: 'EXPENSE', normal_balance: 'DEBIT' },
  { code: '6001', name: 'Gaji & Tunjangan', type: 'EXPENSE', normal_balance: 'DEBIT', parent_code: '6000' },
  { code: '6002', name: 'Sewa Tempat', type: 'EXPENSE', normal_balance: 'DEBIT', parent_code: '6000' },
  { code: '6003', name: 'Utilitas (Listrik, Air, Internet)', type: 'EXPENSE', normal_balance: 'DEBIT', parent_code: '6000' },
  { code: '6004', name: 'Perlengkapan Kantor', type: 'EXPENSE', normal_balance: 'DEBIT', parent_code: '6000' },
  { code: '6005', name: 'Biaya Pemasaran & Iklan', type: 'EXPENSE', normal_balance: 'DEBIT', parent_code: '6000' },
  { code: '6006', name: 'Biaya Transportasi', type: 'EXPENSE', normal_balance: 'DEBIT', parent_code: '6000' },
  { code: '6007', name: 'Biaya Perbaikan & Pemeliharaan', type: 'EXPENSE', normal_balance: 'DEBIT', parent_code: '6000' },
  { code: '6008', name: 'Biaya Asuransi', type: 'EXPENSE', normal_balance: 'DEBIT', parent_code: '6000' },
  { code: '6009', name: 'Biaya Penyusutan', type: 'EXPENSE', normal_balance: 'DEBIT', parent_code: '6000' },
  { code: '6010', name: 'Biaya Profesional & Konsultan', type: 'EXPENSE', normal_balance: 'DEBIT', parent_code: '6000' },
  { code: '6099', name: 'Beban Lain-lain', type: 'EXPENSE', normal_balance: 'DEBIT', parent_code: '6000' },
  { code: '6101', name: 'Biaya Bunga Pinjaman', type: 'EXPENSE', normal_balance: 'DEBIT', parent_code: '6000' },
]

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

async function backfillStandardPsaKCoA(orgId: string) {
  const admin = await createAdminClient()
  const { data: existingRows, error: existingError } = await (admin as any)
    .from('accounts')
    .select('id, code, parent_id')
    .eq('org_id', orgId)

  if (existingError) {
    return { success: false, error: existingError.message || 'Gagal membaca akun existing.' }
  }

  const rowByCode = new Map<string, { id: string; code: string; parent_id: string | null }>()
  for (const row of (existingRows || []) as any[]) {
    const code = String(row?.code || '').trim()
    const id = String(row?.id || '').trim()
    if (!code || !id) continue
    rowByCode.set(code, {
      id,
      code,
      parent_id: row?.parent_id ? String(row.parent_id) : null,
    })
  }

  let insertedCount = 0
  let updatedCount = 0
  for (const template of STANDARD_PSAK_COA_TEMPLATE) {
    const existing = rowByCode.get(template.code)
    const parentId = template.parent_code ? rowByCode.get(template.parent_code)?.id || null : null
    const payload = {
      code: template.code,
      name: template.name,
      type: template.type,
      normal_balance: template.normal_balance,
      parent_id: parentId ?? existing?.parent_id ?? null,
      description: null as string | null,
      is_system: true,
      is_active: true,
    }

    if (existing?.id) {
      const { error: updateError } = await (admin as any)
        .from('accounts')
        .update(payload)
        .eq('org_id', orgId)
        .eq('id', existing.id)

      if (updateError) {
        return { success: false, error: updateError.message || `Gagal update akun ${template.code}.` }
      }
      updatedCount += 1
      continue
    }

    const { data: insertedRow, error: insertError } = await (admin as any)
      .from('accounts')
      .insert({
        org_id: orgId,
        ...payload,
      })
      .select('id, code, parent_id')
      .single()

    if (insertError || !insertedRow?.id) {
      return { success: false, error: insertError?.message || `Gagal membuat akun ${template.code}.` }
    }

    rowByCode.set(String(insertedRow.code), {
      id: String(insertedRow.id),
      code: String(insertedRow.code),
      parent_id: insertedRow.parent_id ? String(insertedRow.parent_id) : null,
    })
    insertedCount += 1
  }

  return { success: true, insertedCount, updatedCount }
}

async function getInheritedDescendantOrganizationIds(admin: any, parentOrgId: string): Promise<string[]> {
  let data: any[] = []
  const { data: orgRows, error } = await admin
    .from('organizations')
    .select('id, parent_org_id, coa_management_mode')

  if (error && isMissingCoAManagementModeColumnError(error)) {
    const { data: fallbackRows, error: fallbackError } = await admin
      .from('organizations')
      .select('id, parent_org_id')

    if (fallbackError || !Array.isArray(fallbackRows)) return []
    data = fallbackRows
  } else {
    if (error || !Array.isArray(orgRows)) return []
    data = orgRows
  }

  const childrenByParent = new Map<string, Array<{ id: string; mode: CoAManagementMode }>>()
  for (const row of data) {
    const id = String(row?.id || '').trim()
    const parentId = String(row?.parent_org_id || '').trim()
    if (!id || !parentId) continue

    const bucket = childrenByParent.get(parentId) || []
    bucket.push({
      id,
      mode: normalizeCoAManagementMode(row?.coa_management_mode),
    })
    childrenByParent.set(parentId, bucket)
  }

  const descendants: string[] = []
  const queue = [...(childrenByParent.get(parentOrgId) || [])]
  const visited = new Set<string>()

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current?.id || visited.has(current.id)) continue
    visited.add(current.id)

    if (current.mode === 'LOCAL') {
      continue
    }

    descendants.push(current.id)

    const directChildren = childrenByParent.get(current.id) || []
    for (const child of directChildren) {
      if (!visited.has(child.id)) queue.push(child)
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
  const descendants = await getInheritedDescendantOrganizationIds(admin as any, parentOrgId)
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
  const childContext = await getCoAManagementContextFromDb(admin as any, childOrgId)

  if (!childContext.inheritsParentCoA) {
    return {
      success: true,
      syncedCount: 0,
      skipped: true,
      reason: childContext.isParentOrg
        ? 'Organisasi target adalah organisasi induk.'
        : 'Entitas anak menggunakan mode CoA lokal.',
    }
  }

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
  const descendants = await getInheritedDescendantOrganizationIds(admin as any, parentOrgId)
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
// langsung (Parent / Child LOCAL), atau harus lewat sistem request.
// ─────────────────────────────────────────────────────────────
export async function checkCanManageCoA(orgId: string): Promise<{
  canManageDirect: boolean
  isParentOrg: boolean
  managementMode: CoAManagementMode
}> {
  const supabase = await createClient()
  const orgContext = await getCoAManagementContextFromDb(supabase as any, orgId)
  const isParentOrgByTree = orgContext.isParentOrg
  const isLocalCoAOrg = !orgContext.isParentOrg && orgContext.mode === 'LOCAL'

  if (isInternalAuthProvider()) {
    return {
      canManageDirect: isParentOrgByTree || isLocalCoAOrg,
      isParentOrg: isParentOrgByTree,
      managementMode: orgContext.mode,
    }
  }

  const rpc = (supabase as any)?.rpc

  if (typeof rpc !== 'function') {
    return {
      canManageDirect: isParentOrgByTree || isLocalCoAOrg,
      isParentOrg: isParentOrgByTree,
      managementMode: orgContext.mode,
    }
  }

  const [manageResult, parentResult] = await Promise.all([
    (supabase as any).rpc('can_manage_finance_master', { p_org_id: orgId }),
    (supabase as any).rpc('is_main_organization', { p_org_id: orgId }),
  ])

  const hasManageBoolean = typeof manageResult?.data === 'boolean'
  const hasParentBoolean = typeof parentResult?.data === 'boolean'

  if (hasManageBoolean && hasParentBoolean) {
    return {
      canManageDirect: manageResult.data === true,
      isParentOrg: parentResult.data === true,
      managementMode: orgContext.mode,
    }
  }

  const fallbackIsParentOrg = isParentOrgByTree

  // Internal auth memakai service role; fallback parent check lebih stabil bila RPC governance belum sinkron.
  const fallbackCanManageDirect = isInternalAuthProvider()
    ? (fallbackIsParentOrg || isLocalCoAOrg)
    : (hasManageBoolean ? manageResult.data === true : (fallbackIsParentOrg || isLocalCoAOrg))

  ;(console as any).warn('checkCanManageCoA using fallback:', {
    orgId,
    isInternal: isInternalAuthProvider(),
    fallbackIsParentOrg,
    managementMode: orgContext.mode,
    manageRpcError: manageResult?.error || null,
    parentRpcError: parentResult?.error || null,
  })

  return {
    canManageDirect: fallbackCanManageDirect,
    isParentOrg: fallbackIsParentOrg,
    managementMode: orgContext.mode,
  }
}

// ─────────────────────────────────────────────────────────────
// createAccount — Add a custom account to CoA
// HANYA untuk org yang boleh manage CoA langsung
// (Holding/Parent atau Child mode LOCAL).
// ─────────────────────────────────────────────────────────────
export async function createAccount(orgId: string, formData: FormData) {
  const supabase = await createClient()
  const orgContext = await getCoAManagementContextFromDb(supabase as any, orgId)

  // ── Validasi Hierarki: hanya org direct-manage yang boleh buat akun langsung ──
  const { data: canManage, error: permError } = await (supabase as any)
    .rpc('can_manage_finance_master', { p_org_id: orgId })

  if (permError || !canManage) {
    const requiresMainUnitContext = orgContext.isParentOrg || orgContext.mode === 'LOCAL'
    return {
      error: requiresMainUnitContext
        ? 'Pindah ke konteks Unit Utama organisasi aktif terlebih dahulu untuk membuat rekening CoA secara langsung.'
        : 'Organisasi ini masih memakai CoA terpusat. Silakan ajukan melalui menu "Pengajuan Rekening CoA".',
      requiresRequest: !requiresMainUnitContext,
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
      : 'Akun berhasil disimpan, tetapi sinkronisasi ke sebagian entitas turunan belum sempurna.',
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

  // Guard: parent akun tidak bisa dihapus selama masih punya turunan.
  const { count: childCount } = await (supabase as any)
    .from('accounts')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('parent_id', accountId)

  if ((childCount ?? 0) > 0) {
    return { error: 'Akun ini masih memiliki sub-akun. Hapus/pindahkan sub-akun terlebih dahulu.' }
  }

  // Check for existing journal lines
  const { count } = await (supabase as any)
    .from('journal_lines')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', accountId)

  if ((count ?? 0) > 0) {
    return { error: 'Akun ini sudah memiliki transaksi. Nonaktifkan saja, jangan hapus.' }
  }

  // Check for payroll component mappings
  const { count: payrollComponentCount } = await (supabase as any)
    .from('payroll_components')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('account_id', accountId)

  if ((payrollComponentCount ?? 0) > 0) {
    return { error: 'Akun ini masih dipakai pada komponen payroll. Ganti mapping payroll atau nonaktifkan akun ini.' }
  }

  // Check for persisted payslip lines
  const { count: payslipLineCount } = await (supabase as any)
    .from('payslip_lines')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', accountId)

  if ((payslipLineCount ?? 0) > 0) {
    return { error: 'Akun ini sudah dipakai pada slip gaji/payroll. Nonaktifkan saja, jangan hapus.' }
  }

  const { error } = await (supabase as any)
    .from('accounts')
    .delete()
    .eq('id', accountId)
    .eq('org_id', orgId)

  if (error) {
    const rawMessage = String((error as any)?.message || '').trim()
    const normalizedMessage = rawMessage.toLowerCase()
    const errorCode = String((error as any)?.code || '')

    if (errorCode === '23503') {
      if (normalizedMessage.includes('payslip_lines_account_id_fkey')) {
        return {
          error: 'Akun ini sudah dipakai pada slip gaji/payroll. Nonaktifkan saja, jangan hapus.',
        }
      }

      if (normalizedMessage.includes('payroll_components_account_id_fkey')) {
        return {
          error: 'Akun ini masih dipakai pada komponen payroll. Ganti mapping payroll atau nonaktifkan akun ini.',
        }
      }

      return {
        error:
          'Akun masih dipakai pada data lain (mis. bank account, produk, payroll, aset, budget, atau transaksi terkait). Lepaskan relasinya terlebih dahulu.',
      }
    }

    if (normalizedMessage.includes('organisasi utama pada konteks unit utama')) {
      return { error: 'Akun hanya bisa dihapus dari Organisasi Utama dengan konteks Unit Utama.' }
    }

    return { error: rawMessage ? `Gagal menghapus akun: ${rawMessage}` : 'Gagal menghapus akun.' }
  }

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
// resetCoA — Delete all non-system accounts & reset to fresh state
// ─────────────────────────────────────────────────────────────
export async function resetCoA(orgId: string) {
  const supabase = await createClient()
  const trimmedOrgId = String(orgId || '').trim()
  if (!trimmedOrgId) return { error: 'Organisasi tidak valid.' }

  // Safeguard: Check if there are any journal entries (prevent accidental wipe of live data)
  const { count: journalCount } = await (supabase as any)
    .from('journal_lines')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', trimmedOrgId)

  if ((journalCount ?? 0) > 0) {
    return { 
      error: 'Tidak bisa reset CoA: ada transaksi yang sudah dibuat. Silakan hapus transaksi terlebih dahulu atau hubungi admin.' 
    }
  }

  // Get all non-system accounts
  const { data: allAccounts } = await (supabase as any)
    .from('accounts')
    .select('id, is_system')
    .eq('org_id', trimmedOrgId)

  const nonSystemIds = (allAccounts || [])
    .filter((acc: any) => !acc.is_system)
    .map((acc: any) => acc.id)

  if (nonSystemIds.length === 0) {
    return { success: true, deletedCount: 0 }
  }

  // Delete all non-system accounts in batches
  const batchSize = 50
  for (let i = 0; i < nonSystemIds.length; i += batchSize) {
    const batch = nonSystemIds.slice(i, i + batchSize)
    const { error } = await (supabase as any)
      .from('accounts')
      .delete()
      .in('id', batch)
      .eq('org_id', trimmedOrgId)

    if (error) {
      return { error: `Gagal menghapus akun: ${error.message}` }
    }
  }

  revalidatePath('/settings/accounts')
  return { success: true, deletedCount: nonSystemIds.length }
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
export async function seedInitialCoA(orgId: string, options?: SeedInitialCoAOptions) {
  const supabase = await createClient()
  const trimmedOrgId = String(orgId || '').trim()
  if (!trimmedOrgId) return { error: 'Organisasi tidak valid.' }
  const shouldRevalidate = options?.revalidate !== false

  const orgContext = await getCoAManagementContextFromDb(supabase as any, trimmedOrgId)

  // Child mode INHERITED: CoA mengikuti parent (bukan seed PSAK mandiri).
  if (orgContext.inheritsParentCoA && orgContext.parentOrgId) {
    const syncResult = await syncParentCoAToChildOrg(orgContext.parentOrgId, trimmedOrgId)
    if (!syncResult.success) {
      return { error: syncResult.error || 'Gagal sinkron CoA dari parent.' }
    }
    if ((syncResult.syncedCount ?? 0) <= 0) {
      return { error: 'CoA parent belum aktif. Aktifkan CoA di organisasi induk terlebih dahulu.' }
    }
    if (shouldRevalidate) {
      revalidatePath('/settings/accounts')
    }
    return { success: true, mode: 'sync_parent', syncedCount: syncResult.syncedCount }
  }

  const { data: existingRows, error: existingError } = await (supabase as any)
    .from('accounts')
    .select('code')
    .eq('org_id', trimmedOrgId)

  if (existingError) {
    return { error: existingError.message || 'Gagal membaca akun CoA.' }
  }

  const existingCodes = new Set(
    ((existingRows || []) as Array<{ code?: string | null }>)
      .map((row) => String(row?.code || '').trim())
      .filter(Boolean)
  )
  const hasCorePsaK = CORE_PSAK_CODES.every((code) => existingCodes.has(code))
  if (hasCorePsaK) {
    return { error: 'CoA standar PSAK sudah aktif untuk organisasi ini.' }
  }

  // Parent/main org: org benar-benar baru (belum ada akun sama sekali) -> pakai RPC legacy.
  if (existingCodes.size === 0) {
    const { error } = await (supabase as any).rpc('seed_default_coa', { p_org_id: trimmedOrgId })
    if (!error) {
      if (shouldRevalidate) {
        revalidatePath('/settings/accounts')
      }
      return { success: true, mode: 'seed_psak' }
    }

    const message = String(error.message || '')
    const recoverable =
      error.code === '23505' ||
      /duplicate key|already exists|unique/i.test(message)

    if (!recoverable) {
      ;(console as any).error('Seed CoA Error:', error)
      return { error: 'Gagal menyiapkan akun standar. Silakan hubungi dukungan.' }
    }
  }

  // Org dengan akun parsial (contoh hanya 1302/1303/1304) -> lengkapi template PSAK.
  const backfillResult = await backfillStandardPsaKCoA(trimmedOrgId)
  if (!backfillResult.success) {
    return { error: backfillResult.error || 'Gagal melengkapi CoA standar PSAK.' }
  }

  if (shouldRevalidate) {
    revalidatePath('/settings/accounts')
  }
  return {
    success: true,
    mode: 'backfill_psak',
    insertedCount: backfillResult.insertedCount,
    updatedCount: backfillResult.updatedCount,
  }
}

// ─────────────────────────────────────────────────────────────
// setShariahAccountsActive — Toggle Syariah Accounts
// ─────────────────────────────────────────────────────────────
export async function setShariahAccountsActive(orgId: string, active: boolean) {
  return syncShariahAccountsActive(orgId, active)
}

// ─────────────────────────────────────────────────────────────
// uploadCoAFromExcel — Upload & Apply CoA from Excel File
// ─────────────────────────────────────────────────────────────
export async function uploadCoAFromExcel(
  orgId: string,
  fileBuffer: Buffer,
  fileName: string,
  mappingToParentCode?: Record<string, string>
) {
  const trimmedOrgId = String(orgId || '').trim()
  if (!trimmedOrgId) {
    return { success: false, error: 'Organization ID tidak valid' }
  }

  try {
    const supabase = await createClient()

    // Validate org exists and check management mode
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('id, parent_org_id, coa_management_mode')
      .eq('id', trimmedOrgId)
      .single()

    if (orgError || !orgData) {
      return { success: false, error: 'Organisasi tidak ditemukan' }
    }

    // Only child org with LOCAL mode or parent org can upload custom CoA
    if (orgData.parent_org_id && orgData.coa_management_mode === 'INHERITED') {
      return {
        success: false,
        error: 'Organisasi anak dengan mode INHERITED tidak bisa mengupload CoA. Hubungi organisasi induk untuk perubahan CoA.'
      }
    }

    // Parse Excel
    const ExcelJS = (await import('exceljs')).default
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(fileBuffer)
    const worksheet = workbook.getWorksheet(1)

    if (!worksheet) {
      return { success: false, error: 'File Excel tidak valid atau kosong' }
    }

    // Extract headers from first row
    const headerRow = worksheet.getRow(1)
    const headers: Record<string, number> = {}
    const requiredFields = ['code', 'name', 'type', 'normal_balance']

    headerRow.eachCell((cell, colNumber) => {
      const header = String(cell.value || '').trim().toLowerCase()
      headers[header] = colNumber
    })

    // Validate required fields exist
    for (const field of requiredFields) {
      if (!(field in headers)) {
        return {
          success: false,
          error: `Kolom "${field}" tidak ditemukan di Excel. Kolom wajib: code, name, type, normal_balance, parent_code (opsional)`
        }
      }
    }

    // Parse accounts from Excel
    const accounts: Array<{
      code: string
      name: string
      type: AccountType
      normal_balance: NormalBalance
      parent_code?: string
      description?: string
    }> = []

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return // Skip header

      const code = String(row.getCell(headers.code).value || '').trim()
      const name = String(row.getCell(headers.name).value || '').trim()
      const typeRaw = String(row.getCell(headers.type).value || '').trim().toUpperCase()
      const normalBalance = String(row.getCell(headers.normal_balance).value || '').trim().toUpperCase()
      
      // Parse parent_code: convert integer to string, empty string to undefined
      let parentCode: string | undefined = undefined
      if (headers['parent_code']) {
        const parentRaw = row.getCell(headers['parent_code']).value
        if (parentRaw !== null && parentRaw !== undefined && String(parentRaw).trim()) {
          parentCode = String(parentRaw).trim()
        }
      }
      
      const description = headers['description'] ? String(row.getCell(headers['description']).value || '').trim() : undefined

      if (!code || !name) return // Skip empty rows

      // Normalize type: support Bahasa Indonesia & English
      const typeMap: Record<string, AccountType> = {
        'ASSET': 'ASSET',
        'ASET': 'ASSET',
        'LIABILITY': 'LIABILITY',
        'KEWAJIBAN': 'LIABILITY',
        'LIABILITAS': 'LIABILITY',
        'UTANG': 'LIABILITY',
        'EQUITY': 'EQUITY',
        'EKUITAS': 'EQUITY',
        'MODAL': 'EQUITY',
        'REVENUE': 'REVENUE',
        'PENDAPATAN': 'REVENUE',
        'PENJUALAN': 'REVENUE',
        'INCOME': 'REVENUE',
        'EXPENSE': 'EXPENSE',
        'BEBAN': 'EXPENSE',
        'BIAYA': 'EXPENSE',
        'HPP': 'EXPENSE',
        'HARGA POKOK PENJUALAN': 'EXPENSE',
      }
      const type = typeMap[typeRaw]
      if (!type) return // Skip invalid type

      // Validate normal balance
      if (!['DEBIT', 'CREDIT'].includes(normalBalance)) {
        return
      }

      accounts.push({
        code,
        name,
        type,
        normal_balance: normalBalance as NormalBalance,
        parent_code: parentCode,
        description
      })
    })

    if (accounts.length === 0) {
      return { success: false, error: 'Tidak ada data akun yang valid di file Excel' }
    }

    // ── Validasi struktur akun ──
    const validationErrors: string[] = []
    const seenCodes = new Set<string>()
    const validParentCodes = new Set(accounts.map(a => a.code))

    for (let i = 0; i < accounts.length; i++) {
      const acc = accounts[i]
      const rowNum = i + 2 // +2 karena row 1 header, array 0-indexed

      // 1. Cek duplikasi kode akun
      if (seenCodes.has(acc.code)) {
        validationErrors.push(`Baris ${rowNum}: Kode akun "${acc.code}" sudah pernah muncul di atas. Setiap kode harus unik.`)
      }
      seenCodes.add(acc.code)

      // 2. Validasi format kode akun (minimal harus ada karakter)
      if (!acc.code || acc.code.length === 0) {
        validationErrors.push(`Baris ${rowNum}: Kode akun tidak boleh kosong.`)
        continue // skip weitere validasi untuk row ini
      }

      // 3. Validasi nama akun
      if (!acc.name || acc.name.length === 0) {
        validationErrors.push(`Baris ${rowNum}: Nama akun tidak boleh kosong.`)
      }

      // 4. Cek parent_code jika ada
      if (acc.parent_code) {
        // Parent code harus ada di dalam list akun yang diupload
        if (!validParentCodes.has(acc.parent_code)) {
          validationErrors.push(`Baris ${rowNum}: Parent code "${acc.parent_code}" tidak ditemukan di file. Pastikan parent akun sudah ada di atas.`)
        }
      }
    }

    // Jika ada error validasi, kembalikan dengan detail
    if (validationErrors.length > 0) {
      const errorSummary = validationErrors.slice(0, 20).join('\n')
      const moreErrors = validationErrors.length > 20 ? `\n... dan ${validationErrors.length - 20} error lainnya.` : ''
      const fullError = `${errorSummary}${moreErrors}`
      
      // Categorize errors untuk helpful message
      const hasParentError = validationErrors.some(e => e.includes('Parent') || e.includes('parent'))
      const hasDuplicateError = validationErrors.some(e => e.includes('sudah pernah'))
      
      let hints = '✏️ Untuk memperbaiki:\n'
      if (hasDuplicateError) hints += '- Pastikan setiap KODE AKUN unik (cek baris yang ditunjukkan)\n'
      if (hasParentError) hints += '- Parent code hanya boleh "1", "2", "1.1", "2.1" dll (sesuai dengan kode akun yang ada)\n- Jangan gunakan angka seperti 1, 2, 3 tanpa format kode\n'
      hints += '- Kode dan nama akun TIDAK boleh kosong\n'
      hints += '- Untuk aset: parent biasanya "1", untuk liabilitas: "2", dst.'
      
      return {
        success: false,
        error: `❌ Validasi CoA gagal. Ditemukan ${validationErrors.length} masalah:\n\n${fullError}\n\n${hints}`
      }
    }

    // Build parent code to ID mapping
    const codeToParentId: Record<string, string> = {}
    const { data: existingAccounts } = await supabase
      .from('accounts')
      .select('id, code')
      .eq('org_id', trimmedOrgId)
      .order('code', { ascending: true })

    for (const acc of existingAccounts || []) {
      codeToParentId[String(acc.code).trim()] = acc.id
    }

    // Insert/update accounts
    // First pass: create all accounts with parent_id = null to avoid parent-not-found errors
    let insertedCount = 0
    let updatedCount = 0
    const createdAccounts: Record<string, string> = {} // code -> id mapping for new accounts

    for (const account of accounts) {
      // In first pass, try to find parent in existing OR just-created accounts
      let parentId: string | null = null
      if (account.parent_code) {
        // Check existing accounts first
        parentId = codeToParentId[account.parent_code] || null
        // If parent is another new account being created, use its ID once available
        // For now, we'll set it to null and fix it in second pass if needed
      }

      // Check if account with this code already exists
      const existing = existingAccounts?.find(a => String(a.code).trim() === account.code)

      if (existing) {
        // Update existing account
        const { error: updateError } = await supabase
          .from('accounts')
          .update({
            name: account.name,
            type: account.type,
            normal_balance: account.normal_balance,
            parent_id: parentId,
            description: account.description || null
          })
          .eq('id', existing.id)

        if (!updateError) {
          updatedCount++
          codeToParentId[account.code] = existing.id
        }
      } else {
        // Insert new account
        const { data: insertedData, error: insertError } = await supabase
          .from('accounts')
          .insert({
            org_id: trimmedOrgId,
            code: account.code,
            name: account.name,
            type: account.type,
            normal_balance: account.normal_balance,
            parent_id: parentId,
            description: account.description || null,
            is_system: false,
            is_active: true
          })
          .select('id')
          .single()

        if (!insertError && insertedData) {
          insertedCount++
          codeToParentId[account.code] = insertedData.id
          createdAccounts[account.code] = insertedData.id
        }
      }
    }

    // Second pass: update parent_id for accounts that reference other newly created accounts
    for (const account of accounts) {
      if (account.parent_code && createdAccounts[account.parent_code]) {
        const parentId = createdAccounts[account.parent_code]
        const newAcc = createdAccounts[account.code]
        
        if (newAcc && newAcc !== parentId) {
          await supabase
            .from('accounts')
            .update({ parent_id: parentId })
            .eq('id', newAcc)
        }
      }
    }

    revalidatePath('/accounting/coa')
    revalidatePath('/settings/accounts')

    return {
      success: true,
      insertedCount,
      updatedCount,
      totalProcessed: accounts.length,
      message: `Berhasil mengupload CoA: ${insertedCount} akun baru, ${updatedCount} akun diperbarui`
    }
  } catch (error: any) {
    console.error('Error uploading CoA:', error)
    return {
      success: false,
      error: error.message || 'Terjadi kesalahan saat mengupload file CoA'
    }
  }
}
