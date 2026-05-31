import { redirect } from 'next/navigation'
import { unstable_noStore as noStore } from 'next/cache'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getModuleInstanceStatus } from '@/modules/marketplace/actions/marketplace.actions'
import { CheckCircle2, Settings, Zap } from 'lucide-react'
import { SimpleSettingsForm, CompleteOnboardingButton, type SettingsField } from '@/components/shared/ModuleOnboardingActions'

const MODULE_KEY = 'Job Order'
const SETTINGS_FIELDS: SettingsField[] = [
  { name: 'job_categories', label: 'Kategori Jasa', type: 'text', placeholder: 'cth: Desain, Konsultasi, Instalasi, Perbaikan', defaultValue: 'Konsultasi, Desain' },
  { name: 'billing_method', label: 'Metode Billing', type: 'select', options: [{ value: 'HOURLY', label: 'Per Jam' }, { value: 'FIXED', label: 'Flat/Fixed' }, { value: 'BOTH', label: 'Keduanya' }], defaultValue: 'HOURLY' },
]

function StepRow({ number, icon, title, description, done, children }: { number: number; icon: React.ReactNode; title: string; description: string; done: boolean; children?: React.ReactNode }) {
  return (
    <div className={`flex gap-4 rounded-xl border p-5 transition-colors ${done ? 'border-emerald-100 bg-emerald-50/30' : 'border-slate-100 bg-slate-50'}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${done ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
        {done ? <CheckCircle2 className="h-5 w-5" /> : icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="text-xs font-semibold tracking-tight text-slate-400">Step {number}</div>
          {done && <span className="text-[9px] font-semibold tracking-tight text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">Selesai</span>}
        </div>
        <h3 className="text-base font-semibold text-slate-900 mt-1">{title}</h3>
        <p className="text-sm text-slate-500 mt-1 leading-relaxed">{description}</p>
        {!done && children && <div className="mt-4">{children}</div>}
      </div>
    </div>
  )
}

export default async function JobOrderOnboardingPage() {
  noStore()
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')
  const instance = await getModuleInstanceStatus(orgData.org.id, MODULE_KEY)
  if (instance?.status === 'READY') return redirect('/services')
  const currentSettings = instance?.settings ?? ({} as Record<string, string>)
  const hasSettings = Object.keys(currentSettings).length > 0
  const stepsDone = { activate: true, settings: hasSettings }
  const allDone = stepsDone.settings

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-4">
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 p-8 text-white shadow-md">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl opacity-10 -mr-20 -mt-20" />
        <div className="relative">
          <div className="w-16 h-16 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center text-3xl mb-5">📋</div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-violet-200 mb-2">Modul Baru</div>
          <h1 className="text-2xl font-semibold tracking-tight">Selamat datang di Job Order (Jasa)</h1>
          <p className="mt-2 text-sm text-violet-100 leading-relaxed">Perintah kerja jasa, tracking progress, billing per jam atau fixed — atur cara bisnis jasa Anda.</p>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-5">Langkah Pengaturan</div>
        <div className="space-y-4">
          <StepRow number={1} icon={<Zap className="h-5 w-5" />} title="Modul Diaktifkan" description="Job Order sudah terdaftar untuk organisasi Anda." done={stepsDone.activate} />
          <StepRow number={2} icon={<Settings className="h-5 w-5" />} title="Pengaturan Jasa" description="Tentukan kategori jasa dan metode billing." done={stepsDone.settings}>
            {!stepsDone.settings && <SimpleSettingsForm moduleKey={MODULE_KEY} fields={SETTINGS_FIELDS} defaultValues={currentSettings} buttonLabel="Simpan Pengaturan Jasa" successMessage="Pengaturan jasa berhasil disimpan!" />}
          </StepRow>
        </div>
      </div>
      {allDone && <CompleteOnboardingButton moduleKey={MODULE_KEY} redirectTo="/services" label="Mulai Kelola Jasa" />}
    </div>
  )
}
