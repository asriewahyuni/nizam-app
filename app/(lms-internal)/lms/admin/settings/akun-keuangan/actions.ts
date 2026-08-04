'use server'

import { revalidatePath } from 'next/cache'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import {
  saveCommerceBranchAccountSettings,
  type SaveCommerceBranchAccountSettingsInput,
} from '@/modules/ecommerce/lib/commerce-account-settings.server'

export async function saveCommerceAccountMappingAction(
  input: SaveCommerceBranchAccountSettingsInput,
): Promise<{ success: boolean; error?: string }> {
  const orgData = await getActiveOrg()
  if (!orgData?.org?.id) return { success: false, error: 'Organisasi tidak ditemukan.' }

  const role = String(orgData.role || '').toLowerCase()
  if (!['owner', 'admin', 'manager'].includes(role)) {
    return { success: false, error: 'Hanya owner/admin/manager yang dapat mengubah pemetaan akun.' }
  }

  try {
    await saveCommerceBranchAccountSettings(orgData.org.id, input)
    revalidatePath('/lms/admin/settings/akun-keuangan')
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal menyimpan pemetaan akun.',
    }
  }
}
