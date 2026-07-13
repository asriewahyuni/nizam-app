import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { redirect } from 'next/navigation'
import LmsSettingsForm from './LmsSettingsForm'

export const metadata = {
  title: 'Pengaturan LMS — Nizam LMS Admin',
}

export default async function LmsSettingsPage() {
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const lmsBranding = (orgData.org.settings as any)?.lms_branding || {}
  
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
          /lms/admin · Settings
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Pengaturan LMS</h1>
        <p className="mt-1 text-slate-500">
          Kustomisasi tampilan dan informasi khusus untuk halaman modul pembelajaran (LMS).
        </p>
      </div>
      
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-bold">Branding LMS</h2>
        <LmsSettingsForm defaultName={lmsBranding.name} defaultLogo={lmsBranding.logo_url} />
      </div>
    </div>
  )
}
