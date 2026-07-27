import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { redirect } from 'next/navigation'
import {
  getTenantEmailSettings,
  saveTenantEmailSettings,
  type TenantEmailConfig,
} from '@/modules/notifications/email-settings.server'
import { LmsEmailSettingsForm } from './LmsEmailSettingsForm'

export const metadata = {
  title: 'Pengaturan Email & SMTP — Nizam LMS Admin',
}

async function handleSaveAction(orgId: string, config: TenantEmailConfig) {
  'use server'
  try {
    await saveTenantEmailSettings(orgId, config)
    return { success: true }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Gagal menyimpan pengaturan email.',
    }
  }
}

export default async function LmsAdminEmailSettingsPage() {
  const orgData = await getActiveOrg()
  if (!orgData?.org?.id) return redirect('/onboarding')

  const initialConfig = await getTenantEmailSettings(orgData.org.id)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
          /lms/admin/settings · Email &amp; SMTP
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Pengaturan Notifikasi Email &amp; SMTP</h1>
        <p className="mt-1 text-slate-500">
          Konfigurasi server SMTP custom atau Mailketing API, serta atur notifikasi email otomatis untuk pendaftaran dan bukti pembayaran.
        </p>
      </div>

      <LmsEmailSettingsForm
        orgId={orgData.org.id}
        initialConfig={initialConfig}
        onSaveAction={handleSaveAction}
      />
    </div>
  )
}
