'use server'

// Klinik Pratama — server actions untuk Pengaturan Akun (pemetaan COA per peran jurnal)

import { revalidatePath } from 'next/cache'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { isKlinikOrgAdmin } from './klinik.actions'
import {
  saveKlinikAccountMapping,
  type KlinikAccountRole,
} from '../lib/klinik-account-mapping.server'

export async function saveKlinikAccountMappingAction(
  orgId: string,
  branchId: string | null,
  input: Partial<Record<KlinikAccountRole, string | null>>,
): Promise<{ success: boolean; error?: string }> {
  const session = await getInternalAuthSession()
  if (!session) return { success: false, error: 'Tidak terautentikasi' }

  if (!(await isKlinikOrgAdmin(session.user.id, orgId))) {
    return { success: false, error: 'Hanya owner/admin/manager yang dapat mengubah pemetaan akun.' }
  }

  try {
    await saveKlinikAccountMapping(orgId, branchId, input)
    revalidatePath('/klinik')
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal menyimpan pemetaan akun.',
    }
  }
}
