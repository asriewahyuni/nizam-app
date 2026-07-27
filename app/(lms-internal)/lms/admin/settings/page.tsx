import Link from 'next/link'
import { Mail, MessageCircle, ArrowRight } from 'lucide-react'
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
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="mb-8">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
          /lms/admin · Settings
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Pengaturan LMS</h1>
        <p className="mt-1 text-slate-500">
          Kustomisasi tampilan, informasi, dan notifikasi email untuk modul pembelajaran (LMS).
        </p>
      </div>

      <Link
        href="/lms/admin/settings/email"
        className="group flex items-center justify-between p-5 rounded-2xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md transition cursor-pointer"
      >
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition">
            <Mail size={20} />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 text-sm">Notifikasi Email &amp; Provider SMTP / Mailketing</h2>
            <p className="text-xs text-slate-500">Atur server SMTP custom, Mailketing API, dan 5 trigger notifikasi otomatis.</p>
          </div>
        </div>
        <ArrowRight size={18} className="text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition" />
      </Link>

      <Link
        href="/lms/admin/settings/whatsapp"
        className="group flex items-center justify-between p-5 rounded-2xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md transition cursor-pointer"
      >
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition">
            <MessageCircle size={20} />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 text-sm">Notifikasi WhatsApp &amp; Dripsender</h2>
            <p className="text-xs text-slate-500">Atur API key Dripsender dan uji coba pengiriman notifikasi WhatsApp otomatis.</p>
          </div>
        </div>
        <ArrowRight size={18} className="text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition" />
      </Link>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-bold">Branding LMS</h2>
        <LmsSettingsForm defaultName={lmsBranding.name} defaultLogo={lmsBranding.logo_url} />
      </div>
    </div>
  )
}
