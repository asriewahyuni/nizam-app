'use server'

import { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { ensureAccountingAccess } from '@/modules/accounting/lib/reporting.server'

async function upsertAccount(orgId: string, code: string, name: string, type: Prisma.accountsUncheckedCreateInput['type'], normalBalance: Prisma.accountsUncheckedCreateInput['normal_balance'], parentId: string | null) {
  const existing = await prisma.accounts.findFirst({
    where: {
      org_id: orgId,
      code,
    },
    select: { id: true },
  })

  if (existing?.id) {
    await prisma.accounts.update({
      where: { id: existing.id },
      data: {
        name,
        type,
        normal_balance: normalBalance,
        parent_id: parentId,
        is_system: false,
      },
    })
    return existing.id
  }

  const created = await prisma.accounts.create({
    data: {
      org_id: orgId,
      code,
      name,
      type,
      normal_balance: normalBalance,
      parent_id: parentId,
      is_system: false,
    },
    select: { id: true },
  })

  return created.id
}

export async function injectShariahPack(orgId: string) {
  const membership = await ensureAccountingAccess(orgId)
  if (!membership) return { error: 'Unauthorized' }

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

  revalidatePath('/settings/accounts')
  revalidatePath('/accounting/zakat')
  return { success: true }
}

export async function setShariahAccountsActive(orgId: string, active: boolean) {
  const membership = await ensureAccountingAccess(orgId)
  if (!membership) return { error: 'Unauthorized' }

  // Syariah codes from injectShariahPack
  const syariahCodes = ['1404', '2600', '2601', '2602', '3100', '3110', '3120', '6100', '6110', '6120', '6200', '6210', '6220', '6230']

  try {
    await prisma.accounts.updateMany({
      where: {
        org_id: orgId,
        code: { in: syariahCodes },
      },
      data: { is_active: active },
    })
  } catch {
    return { error: 'Gagal mengubah status akun Syariah.' }
  }

  revalidatePath('/settings/accounts')
  revalidatePath('/accounting/zakat')
  return { success: true }
}
