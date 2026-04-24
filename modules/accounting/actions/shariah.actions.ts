'use server'

import { createClient } from '@/lib/supabase/server'
import {
  LEGACY_SHARIAH_EQUITY_CODE,
  SHARIAH_COA_ACTIVATION_CODES,
  SHARIAH_COA_DEACTIVATION_CODES,
  SHARIAH_COA_SEEDS,
  SHARIAH_COA_ENABLEMENT_CODES,
  SHARIAH_SETUP_REQUIRED_ACCOUNTS,
} from '@/modules/accounting/lib/shariah-coa'
import { revalidatePath } from 'next/cache'

export type ShariahSetupStatus = 'INACTIVE' | 'READY' | 'INCOMPLETE'

export type ShariahSetupCheck = {
  code: string
  name: string
  module: 'SYIRKAH' | 'SALES' | 'PURCHASING'
  status: 'READY' | 'INACTIVE' | 'MISSING'
}

export type ShariahSetupSummary = {
  isShariahEnabled: boolean
  orgLevelShariahEnabled: boolean
  activeShariahAccountCount: number
  status: ShariahSetupStatus
  checks: ShariahSetupCheck[]
  issues: ShariahSetupCheck[]
  readyCount: number
  missingCount: number
  inactiveCount: number
  requiredCount: number
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function mergeOrganizationSettings(currentSettings: unknown, patch: Record<string, unknown>) {
  return {
    ...(isPlainObject(currentSettings) ? currentSettings : {}),
    ...patch,
  }
}

function readOrgShariahFlagFromSettings(settings: unknown): boolean {
  if (!isPlainObject(settings)) return false
  return settings.is_shariah_enabled === true
}

function evaluateShariahSetup(accounts: Array<{ code?: string | null; name?: string | null; is_active?: boolean | null }>) {
  const rowsByCode = new Map<string, Array<{ code?: string | null; name?: string | null; is_active?: boolean | null }>>()

  for (const account of accounts) {
    const code = String(account?.code || '').trim()
    if (!code) continue
    const currentRows = rowsByCode.get(code) || []
    currentRows.push(account)
    rowsByCode.set(code, currentRows)
  }

  const checks: ShariahSetupCheck[] = SHARIAH_SETUP_REQUIRED_ACCOUNTS.map((requiredAccount) => {
    const matchedRows = rowsByCode.get(requiredAccount.code) || []
    const activeMatch = matchedRows.find((row) => row?.is_active === true) || null
    const anyMatch = matchedRows[0] || null

    const status: ShariahSetupCheck['status'] =
      activeMatch
        ? 'READY'
        : anyMatch
          ? 'INACTIVE'
          : 'MISSING'

    return {
      code: requiredAccount.code,
      name: String(activeMatch?.name || anyMatch?.name || requiredAccount.name),
      module: requiredAccount.module,
      status,
    }
  })

  const missing = checks.filter((check) => check.status === 'MISSING')
  const inactive = checks.filter((check) => check.status === 'INACTIVE')

  return {
    checks,
    issues: [...missing, ...inactive],
    readyCount: checks.filter((check) => check.status === 'READY').length,
    missingCount: missing.length,
    inactiveCount: inactive.length,
    requiredCount: checks.length,
  }
}

export async function getShariahSetupSummary(orgId: string, providedSupabase?: any): Promise<ShariahSetupSummary> {
  const supabase = providedSupabase || await createClient()

  const [{ data: org }, { count: shariahCount }, { data: shariahSetupAccounts }] = await Promise.all([
    (supabase as any)
      .from('organizations')
      .select('settings')
      .eq('id', orgId)
      .maybeSingle(),
    (supabase as any)
      .from('accounts')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .in('code', SHARIAH_COA_ENABLEMENT_CODES)
      .eq('is_active', true),
    (supabase as any)
      .from('accounts')
      .select('code, name, is_active')
      .eq('org_id', orgId)
      .in('code', SHARIAH_SETUP_REQUIRED_ACCOUNTS.map((account) => account.code)),
  ])

  const orgLevelShariahEnabled = readOrgShariahFlagFromSettings(org?.settings)
  const activeShariahAccountCount = shariahCount || 0
  const hasActiveShariahAccounts = activeShariahAccountCount > 0
  const evaluation = evaluateShariahSetup(
    (shariahSetupAccounts as Array<{ code?: string | null; name?: string | null; is_active?: boolean | null }>) || []
  )

  let status: ShariahSetupStatus = 'INACTIVE'
  if (orgLevelShariahEnabled || hasActiveShariahAccounts) {
    status = evaluation.issues.length === 0 ? 'READY' : 'INCOMPLETE'
  }

  return {
    isShariahEnabled: orgLevelShariahEnabled || hasActiveShariahAccounts,
    orgLevelShariahEnabled,
    activeShariahAccountCount,
    status,
    ...evaluation,
  }
}

async function setOrganizationShariahFlag(supabase: any, orgId: string, active: boolean) {
  const { data: org, error: orgError } = await (supabase as any)
    .from('organizations')
    .select('settings')
    .eq('id', orgId)
    .maybeSingle()

  if (orgError) {
    throw new Error(`Failed to read organization settings: ${orgError.message}`)
  }

  const { error: updateError } = await (supabase as any)
    .from('organizations')
    .update({
      settings: mergeOrganizationSettings(org?.settings, { is_shariah_enabled: active }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', orgId)

  if (updateError) {
    throw new Error(`Failed to update organization shariah flag: ${updateError.message}`)
  }
}

export async function injectShariahPack(orgId: string) {
  const supabase = await createClient()

  // --- Helper: upsert one account, return its ID ---
  const upsert = async (
    code: string,
    name: string,
    type: string,
    normal_balance: string,
    parent_id: string | null
  ) => {
    const { data, error } = await (supabase as any)
      .from('accounts')
      .upsert(
        {
          org_id: orgId,
          code,
          name,
          type,
          normal_balance,
          parent_id: parent_id || null,
          is_system: false,
          is_active: true,
        },
        { onConflict: 'org_id,code', ignoreDuplicates: false }
      )
      .select('id')
      .single()
    if (error) throw new Error(`Failed to upsert ${code}: ${error.message}`)
    return data.id as string
  }

  try {
    const lookupCodes = Array.from(
      new Set(
        SHARIAH_COA_SEEDS.flatMap((account) => [
          account.code,
          account.parentCode,
          ...(account.fallbackParentCodes || []),
        ])
      )
    )

    const { data: existingAccounts } = await (supabase as any)
      .from('accounts')
      .select('id, code')
      .eq('org_id', orgId)
      .in('code', lookupCodes)

    const accountIdByCode: Record<string, string> = {}
    for (const account of (existingAccounts || []) as Array<{ id: string; code: string }>) {
      accountIdByCode[account.code] = account.id
    }

    // Cleanup akun induk ekuitas syariah lama (3100) saja.
    // Jangan hapus fisik karena akun bisa sudah direferensikan payroll/modul lain.
    // CoAS baru cukup menonaktifkan legacy 3100 dan mempertahankan 3110/3120.
    const { data: legacyEquityParent } = await (supabase as any)
      .from('accounts')
      .select('id, code')
      .eq('org_id', orgId)
      .eq('code', LEGACY_SHARIAH_EQUITY_CODE)

    for (const acc of (legacyEquityParent || []) as Array<{ id: string; code: string }>) {
      await (supabase as any)
        .from('accounts')
        .update({ is_active: false })
        .eq('org_id', orgId)
        .eq('id', acc.id)
    }

    for (const account of SHARIAH_COA_SEEDS) {
      const parentId = [account.parentCode, ...(account.fallbackParentCodes || [])]
        .map((code) => accountIdByCode[code])
        .find((value): value is string => Boolean(value)) || null

      const upsertedId = await upsert(
        account.code,
        account.name,
        account.type,
        account.normalBalance,
        parentId
      )
      accountIdByCode[account.code] = upsertedId
    }

    await setOrganizationShariahFlag(supabase, orgId, true)

    revalidatePath('/settings/accounts')
    revalidatePath('/accounting/zakat')
    return { success: true }
  } catch (err: any) {
    return { error: 'Gagal menyuntikkan Akun Syariah: ' + err.message }
  }
}

export async function setShariahAccountsActive(orgId: string, active: boolean) {
  const supabase = await createClient()
  try {
    const syariahCodes = active ? SHARIAH_COA_ACTIVATION_CODES : SHARIAH_COA_DEACTIVATION_CODES

    const { error } = await (supabase as any)
      .from('accounts')
      .update({ is_active: active })
      .eq('org_id', orgId)
      .in('code', syariahCodes)

    if (error) {
      throw new Error(error.message)
    }

    await setOrganizationShariahFlag(supabase, orgId, active)

    revalidatePath('/settings/accounts')
    revalidatePath('/accounting/zakat')
    return { success: true }
  } catch (error: any) {
    ;(console as any).error('Toggle Syariah Error:', error)
    return { error: 'Gagal mengubah status akun Syariah.' }
  }
}
