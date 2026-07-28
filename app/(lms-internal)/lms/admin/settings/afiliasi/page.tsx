import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { redirect } from 'next/navigation'
import {
  getAffiliateSettings,
  saveAffiliateSettings,
  type AffiliateSettings,
} from '@/modules/ecommerce/lib/affiliate-settings.server'
import { LmsAffiliateSettingsForm } from './LmsAffiliateSettingsForm'

export const metadata = {
  title: 'Pengaturan Afiliasi — Nizam LMS Admin',
}

async function handleSaveAction(orgId: string, config: AffiliateSettings) {
  'use server'
  try {
    await saveAffiliateSettings(orgId, config)
    return { success: true }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Gagal menyimpan pengaturan afiliasi.',
    }
  }
}

export default async function LmsAdminAffiliateSettingsPage() {
  const orgData = await getActiveOrg()
  if (!orgData?.org?.id) return redirect('/onboarding')

  const initialConfig = await getAffiliateSettings(orgData.org.id)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
          /lms/admin/settings · Afiliasi
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Pengaturan Kupon Afiliasi</h1>
        <p className="mt-1 text-slate-500">
          Atur besaran diskon default untuk kupon personal yang otomatis dibuatkan sistem setiap kali member mengaktifkan profil afiliasi.
        </p>
      </div>

      <LmsAffiliateSettingsForm
        orgId={orgData.org.id}
        initialConfig={initialConfig}
        onSaveAction={handleSaveAction}
      />
    </div>
  )
}
