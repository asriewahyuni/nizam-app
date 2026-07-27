import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { redirect } from 'next/navigation'
import {
  getTenantWhatsappSettings,
  saveTenantWhatsappSettings,
  sendTenantTestWhatsappAction,
  type TenantWhatsappConfig,
} from '@/modules/notifications/whatsapp-settings.server'
import { LmsWhatsappSettingsForm } from './LmsWhatsappSettingsForm'

export const metadata = {
  title: 'Pengaturan WhatsApp & Dripsender — Nizam LMS Admin',
}

async function handleSaveAction(orgId: string, config: TenantWhatsappConfig) {
  'use server'
  try {
    await saveTenantWhatsappSettings(orgId, config)
    return { success: true }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Gagal menyimpan pengaturan WhatsApp.',
    }
  }
}

async function handleSendTestWhatsappAction(orgId: string, targetPhone: string) {
  'use server'
  return sendTenantTestWhatsappAction(orgId, targetPhone)
}

export default async function LmsAdminWhatsappSettingsPage() {
  const orgData = await getActiveOrg()
  if (!orgData?.org?.id) return redirect('/onboarding')

  const initialConfig = await getTenantWhatsappSettings(orgData.org.id)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
          /lms/admin/settings · WhatsApp
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Pengaturan Notifikasi WhatsApp</h1>
        <p className="mt-1 text-slate-500">
          Konfigurasi API key Dripsender untuk mengirim notifikasi WhatsApp otomatis (pesanan, pembayaran, komisi afiliasi, dll) ke pembeli.
        </p>
      </div>

      <LmsWhatsappSettingsForm
        orgId={orgData.org.id}
        initialConfig={initialConfig}
        onSaveAction={handleSaveAction}
        onSendTestWhatsappAction={handleSendTestWhatsappAction}
      />
    </div>
  )
}
