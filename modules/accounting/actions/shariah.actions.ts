'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function injectShariahPack(orgId: string) {
  const supabase = await createClient()

  // --- Helper: upsert one account, return its ID ---
  const upsert = async (code: string, name: string, type: string, normal_balance: string, parent_id: string | null) => {
    const { data, error } = await (supabase as any)
      .from('accounts')
      .upsert(
        { org_id: orgId, code, name, type, normal_balance, parent_id: parent_id || null, is_system: false },
        { onConflict: 'org_id,code', ignoreDuplicates: false }
      )
      .select('id')
      .single()
    if (error) throw new Error(`Failed to upsert ${code}: ${error.message}`)
    return data.id as string
  }

  try {
    // Get root parent IDs
    const { data: roots } = await (supabase as any)
      .from('accounts')
      .select('id, code')
      .eq('org_id', orgId)
      .in('code', ['1000', '2000', '3000', '6000'])

    const rootMap: Record<string, string> = {}
    for (const r of (roots || [])) rootMap[r.code] = r.id

    // 1. EQUITY SYARIAH
    const ekuitasSyariahId = await upsert('3100', 'Ekuitas Syariah', 'EQUITY', 'CREDIT', rootMap['3000'] ?? null)
    await upsert('3110', 'Modal Syirkah Mudharabah', 'EQUITY', 'CREDIT', ekuitasSyariahId)
    await upsert('3120', 'Modal Syirkah Inan', 'EQUITY', 'CREDIT', ekuitasSyariahId)

    // 2. LIABILITIES (QARD)
    const kewajSyariahId = await upsert('2600', 'Kewajiban Syariah', 'LIABILITY', 'CREDIT', rootMap['2000'] ?? null)
    await upsert('2601', 'Hutang Qard (Kebajikan)', 'LIABILITY', 'CREDIT', kewajSyariahId)
    await upsert('2602', 'Hutang Salam', 'LIABILITY', 'CREDIT', kewajSyariahId)

    // 2b. SALAM RECEIVABLE (ASSET)
    await upsert('1404', 'Piutang Salam Vendor', 'ASSET', 'DEBIT', rootMap['1000'] ?? null)

    // 3. IJARAH (EXPENSES)
    const ijarahId = await upsert('6100', 'Beban Ijarah & Ujrah', 'EXPENSE', 'DEBIT', rootMap['6000'] ?? null)
    await upsert('6110', 'Beban Ujrah Gaji', 'EXPENSE', 'DEBIT', ijarahId)
    await upsert('6120', 'Beban Ujrah Sewa & Lainnya', 'EXPENSE', 'DEBIT', ijarahId)

    // 4. ZAKAT & CUKAI (EXPENSES)
    const zakatId = await upsert('6200', 'Beban Zakat & Sosial', 'EXPENSE', 'DEBIT', rootMap['6000'] ?? null)
    await upsert('6210', 'Zakat Maal Pemilik', 'EXPENSE', 'DEBIT', zakatId)
    await upsert('6220', 'Zakat Tijarah (Perdagangan)', 'EXPENSE', 'DEBIT', zakatId)
    await upsert('6230', "Cukai Mu'ahidah", 'EXPENSE', 'DEBIT', zakatId)

    revalidatePath('/settings/accounts')
    revalidatePath('/accounting/zakat')
    return { success: true }
  } catch (err: any) {
    return { error: 'Gagal menyuntikkan Akun Syariah: ' + err.message }
  }
}

export async function setShariahAccountsActive(orgId: string, active: boolean) {
  const supabase = await createClient()

  // Syariah codes from injectShariahPack
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
  revalidatePath('/accounting/zakat')
  return { success: true }
}
