'use server'

import { createClient } from '@/lib/supabase/server'
import {
  LEGACY_SHARIAH_EQUITY_CODE,
  SHARIAH_COA_ACTIVATION_CODES,
  SHARIAH_COA_DEACTIVATION_CODES,
  SHARIAH_COA_SEEDS,
} from '@/modules/accounting/lib/shariah-coa'
import { revalidatePath } from 'next/cache'

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
    // Coba hapus dulu, fallback ke nonaktif jika sudah terhubung transaksi/relasi.
    const { data: legacyEquityParent } = await (supabase as any)
      .from('accounts')
      .select('id, code')
      .eq('org_id', orgId)
      .eq('code', LEGACY_SHARIAH_EQUITY_CODE)

    for (const acc of (legacyEquityParent || []) as Array<{ id: string; code: string }>) {
      const { error: deleteError } = await (supabase as any)
        .from('accounts')
        .delete()
        .eq('org_id', orgId)
        .eq('id', acc.id)

      if (deleteError) {
        await (supabase as any)
          .from('accounts')
          .update({ is_active: false })
          .eq('org_id', orgId)
          .eq('id', acc.id)
      }
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

    revalidatePath('/settings/accounts')
    revalidatePath('/accounting/zakat')
    return { success: true }
  } catch (err: any) {
    return { error: 'Gagal menyuntikkan Akun Syariah: ' + err.message }
  }
}

export async function setShariahAccountsActive(orgId: string, active: boolean) {
  const supabase = await createClient()

  const syariahCodes = active ? SHARIAH_COA_ACTIVATION_CODES : SHARIAH_COA_DEACTIVATION_CODES

  const { error } = await (supabase as any)
    .from('accounts')
    .update({ is_active: active })
    .eq('org_id', orgId)
    .in('code', syariahCodes)

  if (error) {
    (console as any).error('Toggle Syariah Error:', error)
    return { error: 'Gagal mengubah status akun Syariah.' }
  }

  revalidatePath('/settings/accounts')
  revalidatePath('/accounting/zakat')
  return { success: true }
}
