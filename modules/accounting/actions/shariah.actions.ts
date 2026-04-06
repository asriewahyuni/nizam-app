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
    const roots = await prisma.accounts.findMany({
      where: {
        org_id: orgId,
        code: { in: ['2000', '3000', '6000'] },
      },
      select: {
        id: true,
        code: true,
      },
    })

    const rootMap = roots.reduce<Record<string, string>>((map, root) => {
      map[root.code] = root.id
      return map
    }, {})

    const ekuitasSyariahId = await upsertAccount(orgId, '3100', 'Ekuitas Syariah', 'EQUITY', 'CREDIT', rootMap['3000'] || null)
    await upsertAccount(orgId, '3110', 'Modal Syirkah Mudharabah', 'EQUITY', 'CREDIT', ekuitasSyariahId)
    await upsertAccount(orgId, '3120', 'Modal Syirkah Inan', 'EQUITY', 'CREDIT', ekuitasSyariahId)

    const kewajibanSyariahId = await upsertAccount(orgId, '2600', 'Kewajiban Syariah', 'LIABILITY', 'CREDIT', rootMap['2000'] || null)
    await upsertAccount(orgId, '2601', 'Hutang Qard (Kebajikan)', 'LIABILITY', 'CREDIT', kewajibanSyariahId)

    const ijarahId = await upsertAccount(orgId, '6100', 'Beban Ijarah & Ujrah', 'EXPENSE', 'DEBIT', rootMap['6000'] || null)
    await upsertAccount(orgId, '6110', 'Beban Ujrah Gaji', 'EXPENSE', 'DEBIT', ijarahId)
    await upsertAccount(orgId, '6120', 'Beban Ujrah Sewa & Lainnya', 'EXPENSE', 'DEBIT', ijarahId)

    const zakatId = await upsertAccount(orgId, '6200', 'Beban Zakat & Sosial', 'EXPENSE', 'DEBIT', rootMap['6000'] || null)
    await upsertAccount(orgId, '6210', 'Zakat Maal Pemilik', 'EXPENSE', 'DEBIT', zakatId)
    await upsertAccount(orgId, '6220', 'Zakat Tijarah (Perdagangan)', 'EXPENSE', 'DEBIT', zakatId)
    await upsertAccount(orgId, '6230', "Cukai Mu'ahidah", 'EXPENSE', 'DEBIT', zakatId)
  } catch (error) {
    return { error: error instanceof Error ? `Gagal menyuntikkan Akun Syariah: ${error.message}` : 'Gagal menyuntikkan Akun Syariah.' }
  }

  revalidatePath('/settings/accounts')
  revalidatePath('/accounting/zakat')
  return { success: true }
}

export async function setShariahAccountsActive(orgId: string, active: boolean) {
  const membership = await ensureAccountingAccess(orgId)
  if (!membership) return { error: 'Unauthorized' }

  const syariahCodes = ['2600', '2601', '3100', '3110', '3120', '6100', '6110', '6120', '6200', '6210', '6220', '6230']

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
