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

    // Cleanup akun induk ekuitas syariah lama (3100) saja.
    // Coba hapus dulu, fallback ke nonaktif jika sudah terhubung transaksi/relasi.
    const { data: legacyEquityParent } = await (supabase as any)
      .from('accounts')
      .select('id, code')
      .eq('org_id', orgId)
      .eq('code', '3100')

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

    // 0. EQUITY SYIRKAH (tanpa akun 3100)
    await upsert('3110', 'Modal Syirkah Mudharabah', 'EQUITY', 'CREDIT', rootMap['3000'] ?? null)
    await upsert('3120', 'Modal Syirkah Inan', 'EQUITY', 'CREDIT', rootMap['3000'] ?? null)

    // 1. LIABILITIES (QARD)
    const kewajSyariahId = await upsert('2600', 'Kewajiban Syariah', 'LIABILITY', 'CREDIT', rootMap['2000'] ?? null)
    await upsert('2601', 'Hutang Qard (Kebajikan)', 'LIABILITY', 'CREDIT', kewajSyariahId)
    await upsert('2602', 'Hutang Salam', 'LIABILITY', 'CREDIT', kewajSyariahId)

    // 1b. SALAM RECEIVABLE (ASSET)
    await upsert('1404', 'Piutang Salam Vendor', 'ASSET', 'DEBIT', rootMap['1000'] ?? null)

    // 2. IJARAH (EXPENSES)
    const ijarahId = await upsert('6100', 'Beban Ijarah & Ujrah', 'EXPENSE', 'DEBIT', rootMap['6000'] ?? null)
    await upsert('6110', 'Beban Ujrah Gaji', 'EXPENSE', 'DEBIT', ijarahId)
    await upsert('6120', 'Beban Ujrah Sewa & Lainnya', 'EXPENSE', 'DEBIT', ijarahId)

    // 3. ZAKAT & CUKAI (EXPENSES)
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

  // Hanya 3100 yang tidak lagi dipakai pada CoAS.
  // 3110 & 3120 tetap dipertahankan sebagai akun Syirkah.
  const activationCodes = ['1404', '2600', '2601', '2602', '3110', '3120', '6100', '6110', '6120', '6200', '6210', '6220', '6230']
  const deactivationCodes = [...activationCodes, '3100']
  const syariahCodes = active ? activationCodes : deactivationCodes

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
