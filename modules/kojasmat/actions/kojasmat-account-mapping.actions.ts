'use server'

// Kojasmat — server actions untuk Pengaturan Akun (pemetaan COA per peran jurnal)

import { revalidatePath } from 'next/cache'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { isOrgAdminOrManajemen } from './kojasmat.actions'
import {
  saveKojasmatAccountMapping,
  type KojasmatAccountRole,
} from '../lib/kojasmat-account-mapping.server'

export async function saveKojasmatAccountMappingAction(
  orgId: string,
  input: Partial<Record<KojasmatAccountRole, string | null>>,
): Promise<{ success: boolean; error?: string }> {
  const session = await getInternalAuthSession()
  if (!session) return { success: false, error: 'Tidak terautentikasi' }

  if (!(await isOrgAdminOrManajemen(session.user.id, orgId))) {
    return { success: false, error: 'Hanya owner/admin/manager yang dapat mengubah pemetaan akun.' }
  }

  try {
    await saveKojasmatAccountMapping(orgId, input)
    revalidatePath('/kojasmat')
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal menyimpan pemetaan akun.',
    }
  }
}
