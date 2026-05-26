import { redirect } from 'next/navigation'
import { unstable_noStore as noStore } from 'next/cache'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getModuleInstanceStatus, completeModuleOnboarding } from '@/modules/marketplace/actions/marketplace.actions'
import { getModuleByKey } from '@/modules/marketplace/lib/module-registry'
import { CheckCircle2, BookOpen, Settings, Zap, ArrowRight, GraduationCap } from 'lucide-react'
import { InstallCoaButton, SettingsForm } from './OnboardingClient'

const MODULE_KEY = 'LMS'

export default async function LmsOnboardingPage() {
  noStore()

  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  // If already READY, go to main LMS dashboard
  const instance = await getModuleInstanceStatus(orgData.org.id, MODULE_KEY)
  if (instance?.status === 'READY') return redirect('/lms')

  const mod = getModuleByKey(MODULE_KEY)!
  const coaInstalled = instance?.coa_installed ?? false
  const currentSettings = instance?.settings ?? {}

  const stepsDone = {
    activate: !!instance,
    coa: coaInstalled,
    settings: Object.keys(currentSettings).length > 0,
  }

  const allDone = stepsDone.activate && stepsDone.coa && stepsDone.settings

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-4">
      {/* ── Greeting Header ── */}
      <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-white shadow-md">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl opacity-10 -mr-20 -mt-20" />
        <div className="relative">
          <div className="w-16 h-16 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center text-3xl mb-5">
            🎓
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-blue-200 mb-2">
            Modul Baru
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Selamat datang di LMS</h1>
          <p className="mt-2 text-sm text-blue-100 leading-relaxed">
            Platform pelatihan komersial Anda. Mari selesaikan pengaturan awal agar modul ini siap digunakan.
          </p>
        </div>
      </div>

      {/* ── Progress Steps ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-5">
          Langkah Pengaturan
        </div>

        <div className="space-y-4">
          {/* Step 1: Aktivasi */}
          <StepRow
            number={1}
            icon={<Zap className="h-5 w-5" />}
            title="Modul Diaktifkan"
            description="LMS sudah terdaftar untuk organisasi Anda."
            done={stepsDone.activate}
            alwaysDone
          />

          {/* Step 2: Install CoA */}
          <StepRow
            number={2}
            icon={<BookOpen className="h-5 w-5" />}
            title="Install Chart of Accounts (CoA)"
            description="Pasang akun-akun standar: Pendapatan Pelatihan, Piutang Peserta, Beban Instruktur, dan Beban Operasional Training."
            done={stepsDone.coa}
          >
            {!stepsDone.coa && (
              <InstallCoaButton moduleKey={MODULE_KEY} />
            )}
          </StepRow>

          {/* Step 3: Pengaturan Awal */}
          <StepRow
            number={3}
            icon={<Settings className="h-5 w-5" />}
            title="Pengaturan Awal LMS"
            description="Atur nama lembaga pelatihan, kebijakan pendaftaran, dan mata uang default."
            done={stepsDone.settings}
          >
            {!stepsDone.settings && (
              <SettingsForm
                moduleKey={MODULE_KEY}
                currentSettings={currentSettings}
                defaultInstitutionName={orgData.org.name}
              />
            )}
          </StepRow>
        </div>
      </div>

      {/* ── Finish Button ── */}
      {allDone && (
        <form action={async () => { 'use server'; await completeModuleOnboarding(MODULE_KEY); redirect('/lms') }}>
          <button
            type="submit"
            className="w-full rounded-xl bg-emerald-600 p-5 text-lg font-semibold text-white shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center justify-center gap-3"
          >
            <GraduationCap className="h-6 w-6" />
            Mulai Gunakan LMS
          </button>
        </form>
      )}
    </div>
  )
}

function StepRow({
  number,
  icon,
  title,
  description,
  done,
  alwaysDone,
  children,
}: {
  number: number
  icon: React.ReactNode
  title: string
  description: string
  done: boolean
  alwaysDone?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className={`flex gap-4 rounded-xl border p-5 transition-colors ${done ? 'border-emerald-100 bg-emerald-50/30' : 'border-slate-100 bg-slate-50'}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${done ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
        {done ? <CheckCircle2 className="h-5 w-5" /> : icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Step {number}</div>
          {done && <span className="text-[9px] font-semibold uppercase tracking-wide text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">Selesai</span>}
        </div>
        <h3 className="text-base font-semibold text-slate-900 mt-1">{title}</h3>
        <p className="text-sm text-slate-500 mt-1 leading-relaxed">{description}</p>
        {!done && children && <div className="mt-4">{children}</div>}
      </div>
    </div>
  )
}
