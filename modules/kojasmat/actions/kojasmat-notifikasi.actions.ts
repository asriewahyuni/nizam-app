'use server'

// Kojasmat — server actions untuk Pengaturan Notifikasi WhatsApp (Dripsender).
// API key & toggle disimpan generik per-org lewat modules/notifications/whatsapp-settings.server,
// dipakai bersama modul lain (LMS) — hanya UI-nya yang khusus Kojasmat.

import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { isOrgAdminOrManajemen } from './kojasmat.actions'
import {
  getTenantWhatsappSettings,
  saveTenantWhatsappSettings,
  sendTenantTestWhatsappAction,
  type TenantWhatsappConfig,
} from '@/modules/notifications/whatsapp-settings.server'

export async function saveKojasmatWhatsappSettingsAction(
  orgId: string,
  config: TenantWhatsappConfig,
): Promise<{ success: boolean; error?: string }> {
  const session = await getInternalAuthSession()
  if (!session) return { success: false, error: 'Tidak terautentikasi' }
  if (!(await isOrgAdminOrManajemen(session.user.id, orgId))) {
    return { success: false, error: 'Hanya owner/admin/manager yang dapat mengubah pengaturan notifikasi.' }
  }

  try {
    await saveTenantWhatsappSettings(orgId, config)
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal menyimpan pengaturan WhatsApp.',
    }
  }
}

export async function sendKojasmatTestWhatsappAction(orgId: string, targetPhone: string) {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi' }
  if (!(await isOrgAdminOrManajemen(session.user.id, orgId))) {
    return { error: 'Hanya owner/admin/manager yang dapat mengirim uji coba.' }
  }
  return sendTenantTestWhatsappAction(orgId, targetPhone)
}

export { getTenantWhatsappSettings }
export type { TenantWhatsappConfig }
