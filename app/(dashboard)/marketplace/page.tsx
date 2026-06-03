import { redirect } from 'next/navigation'
import { unstable_noStore as noStore } from 'next/cache'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import {
  getOrgModuleInstances,
  getOperationalModulePricing,
} from '@/modules/marketplace/actions/marketplace.actions'
import {
  CORE_MODULES,
  OPERATIONAL_MODULES,
  ADDON_MODULES,
  type ModuleDefinition,
} from '@/modules/marketplace/lib/module-registry'
import { CheckCircle2, Lock, ArrowRight, Sparkles, ShieldCheck, Zap, Circle } from 'lucide-react'
import { DeactivateModuleButton } from './DeactivateModuleButton'
import { ActivateModuleButton } from './ActivateModuleButton'
import { ActivateCoreModuleButton } from './ActivateCoreModuleButton'
import { formatRupiah } from '@/lib/utils'

function moduleNameMatches(enabled: string, key: string): boolean {
  const n = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]/g, '')
  return n(enabled) === n(key)
}

function formatRp(n: number) {
  return formatRupiah(n)
}

type ModuleState = 'active_ready' | 'active_pending' | 'inactive' | 'locked' | 'available'

export default async function MarketplacePage() {
  noStore()

  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')
  if (!['owner', 'admin'].includes(orgData.role)) return redirect('/dashboard?error=akses-ditolak')

  const [instances, pricing] = await Promise.all([
    getOrgModuleInstances(orgData.org.id),
    getOperationalModulePricing(),
  ])

  const enabledModules: string[] = orgData.enabledModules ?? []
  const instanceMap = new Map((instances as any[]).map(i => [i.module_key, i]))

  function getModuleState(mod: ModuleDefinition): ModuleState {
    const instance = instanceMap.get(mod.key) as any
    if (instance?.status === 'DISABLED') return 'inactive'
    const isEnabled = enabledModules.some(m => moduleNameMatches(m, mod.key))
    if (!isEnabled) return 'available'
    if (!instance || instance.status !== 'READY') return 'active_pending'
    return 'active_ready'
  }

  const readyCount  = OPERATIONAL_MODULES.filter(m => getModuleState(m) === 'active_ready').length
  const pendingCount = OPERATIONAL_MODULES.filter(m => getModuleState(m) === 'active_pending').length
  const hasPricing  = Object.keys(pricing).length > 0

  return (
    <div className="space-y-10">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 p-8 text-white shadow-md">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500 rounded-full blur-3xl opacity-10 -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500 rounded-full blur-3xl opacity-10 -ml-20 -mb-20" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide mb-4">
            <Sparkles className="h-3 w-3" /> Modul Marketplace
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Pilih Operasional Bisnis Anda</h1>
          <p className="mt-2 text-slate-300 text-sm font-medium max-w-xl">
            Modul inti sudah aktif. Pilih modul operasional untuk mendefinisikan model bisnis Anda.
          </p>
          <div className="mt-6 flex gap-3 flex-wrap text-xs font-bold">
            <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-4 py-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>{CORE_MODULES.length} Modul Inti Aktif</span>
            </div>
            {readyCount > 0 && (
              <div className="flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 rounded-xl px-4 py-2">
                <CheckCircle2 className="h-4 w-4 text-blue-300" />
                <span>{readyCount} Operasional Aktif</span>
              </div>
            )}
            {pendingCount > 0 && (
              <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-400/30 rounded-xl px-4 py-2">
                <Zap className="h-4 w-4 text-amber-300" />
                <span>{pendingCount} Perlu Diselesaikan</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── MODUL INTI ── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
              <ShieldCheck className="h-3 w-3 text-emerald-600" />
            </div>
            <span className="text-sm font-semibold text-slate-900">Modul Inti</span>
          </div>
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-xs text-slate-400 font-medium">Selalu aktif — sudah termasuk dalam paket</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {CORE_MODULES.map(mod => {
            const isEnabled = enabledModules.some(m => moduleNameMatches(m, mod.key))
            const unmetRequirements = (mod.requires || []).filter(
              req => !enabledModules.some(m => moduleNameMatches(m, req))
            )
            return <CoreModuleCard key={mod.key} mod={mod} enabled={isEnabled} unmetRequirements={unmetRequirements} />
          })}
        </div>
      </section>

      {/* ── MODUL OPERASIONAL ── */}
      <section>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
              <Zap className="h-3 w-3 text-blue-600" />
            </div>
            <span className="text-sm font-semibold text-slate-900">Modul Operasional</span>
          </div>
          <div className="flex-1 h-px bg-slate-200" />
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Aktifkan sesuai model bisnis. Setiap modul membawa Chart of Accounts dan alur kerja spesifik.
          {hasPricing ? ' Harga ditambahkan ke tagihan langganan Anda.' : ' Hubungi tim kami untuk harga.'}
        </p>

        {/* ── Alur Aktivasi ── */}
        <div className="mb-6 flex items-center gap-1 flex-wrap">
          {[
            { step: 1, label: 'Aktifkan' },
            { step: 2, label: 'Pembayaran' },
            { step: 3, label: 'Onboarding' },
            { step: 4, label: 'Setup' },
            { step: 5, label: 'Aktif' },
            { step: 6, label: 'Masuk Menu' },
          ].map((item, idx, arr) => (
            <div key={item.step} className="flex items-center gap-1">
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
                <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center text-[8px] font-semibold text-white flex-shrink-0">
                  {item.step}
                </div>
                <span className="text-[10px] font-bold text-slate-500">{item.label}</span>
              </div>
              {idx < arr.length - 1 && (
                <Zap className="h-3 w-3 text-slate-300 flex-shrink-0" />
              )}
            </div>
          ))}
        </div>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {OPERATIONAL_MODULES.map(mod => {
            const state = getModuleState(mod)
            const price = pricing[mod.key]
            const instance = instanceMap.get(mod.key) as any
            const readyAt = instance?.ready_at ?? null
            const unmetRequirements = (mod.requires || []).filter(
              req => !enabledModules.some(m => moduleNameMatches(m, req))
            )
            return (
              <OperationalModuleCard
                key={mod.key}
                mod={mod}
                state={state}
                price={price}
                readyAt={readyAt}
                unmetRequirements={unmetRequirements}
              />
            )
          })}
        </div>
      </section>

      {/* ── ADD-ON MODULES ── */}
      <section>
        <div className="flex items-center gap-3 mb-2 mt-8">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-pink-100 flex items-center justify-center">
              <Sparkles className="h-3 w-3 text-pink-600" />
            </div>
            <span className="text-sm font-semibold text-slate-900">Add-On Khusus</span>
          </div>
          <div className="flex-1 h-px bg-slate-200" />
        </div>
        <p className="text-xs text-slate-500 mb-6">
          Modul tambahan yang bisa diaktifkan bersamaan dengan model bisnis apa pun.
        </p>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {ADDON_MODULES.map(mod => {
            const state = getModuleState(mod)
            const price = pricing[mod.key]
            const instance = instanceMap.get(mod.key) as any
            const readyAt = instance?.ready_at ?? null
            const unmetRequirements = (mod.requires || []).filter(
              req => !enabledModules.some(m => moduleNameMatches(m, req))
            )
            return (
              <OperationalModuleCard
                key={mod.key}
                mod={mod}
                state={state}
                price={price}
                readyAt={readyAt}
                unmetRequirements={unmetRequirements}
              />
            )
          })}
        </div>
      </section>
    </div>
  )
}

// ── Core Module Card ─────────────────────────────────────────────────────────
function CoreModuleCard({ mod, enabled, unmetRequirements = [] }: {
  mod: ModuleDefinition
  enabled: boolean
  unmetRequirements?: string[]
}) {
  const hasUnmet = unmetRequirements.length > 0
  return (
    <div className={`flex flex-col gap-3 rounded-xl border px-5 py-4 transition-all ${
      enabled
        ? 'border-emerald-100 bg-emerald-50/40'
        : hasUnmet
          ? 'border-slate-200 bg-slate-50/60'
          : 'border-slate-200 bg-white hover:shadow-md hover:border-blue-200'
    }`}>
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-xl ${mod.color} flex items-center justify-center text-lg flex-shrink-0 shadow-sm ${
          (enabled || !hasUnmet) ? '' : 'opacity-40 grayscale'
        }`}>
          {mod.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-slate-900 truncate">{mod.name}</div>
          <div className="text-xs text-slate-500 truncate">{mod.tagline}</div>
        </div>

        {enabled ? (
          <span className="flex-shrink-0 inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-full whitespace-nowrap">
            <CheckCircle2 className="h-2.5 w-2.5" /> Aktif
          </span>
        ) : (
          <ActivateCoreModuleButton moduleKey={mod.key} disabled={hasUnmet} />
        )}
      </div>

      {!enabled && hasUnmet && (
        <div className="text-[10px] font-bold text-rose-500 bg-rose-50 border border-rose-100 rounded-lg px-3 py-1.5">
          Aktifkan terlebih dahulu: {unmetRequirements.join(', ')}
        </div>
      )}
    </div>
  )
}

// ── Operational Module Card ──────────────────────────────────────────────────
function OperationalModuleCard({
  mod,
  state,
  price,
  readyAt,
  unmetRequirements = [],
}: {
  mod: ModuleDefinition
  state: ModuleState
  price?: number
  readyAt?: string | null
  unmetRequirements?: string[]
}) {
  const isLocked   = state === 'locked'
  const isReady    = state === 'active_ready'
  const isPending  = state === 'active_pending'
  const isInactive = state === 'inactive'
  const isAvailable = !isLocked && !isReady && !isPending && !isInactive

  return (
    <div className={`relative flex flex-col rounded-xl border p-6 transition-all
      ${isReady    ? 'border-blue-200 bg-white shadow-md ring-1 ring-blue-50 hover:shadow-lg' : ''}
      ${isPending  ? 'border-amber-200 bg-amber-50/30 shadow-sm' : ''}
      ${isInactive ? 'border-slate-200 bg-slate-50/60' : ''}
      ${isLocked   ? 'border-slate-100 bg-slate-50 opacity-50' : ''}
      ${isAvailable ? 'border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-blue-200' : ''}
    `}>

      {/* ── Status pill ── */}
      <div className="absolute top-4 right-4">
        {isReady    && <StatusPill color="blue"   icon={<CheckCircle2 className="h-2.5 w-2.5" />} label="Aktif" />}
        {isPending  && <StatusPill color="amber"  icon="⚙️" label="Perlu Setup" />}
        {isInactive && <StatusPill color="slate"  icon={<Circle className="h-2.5 w-2.5" />} label="Nonaktif" />}
        {isLocked   && <StatusPill color="slate"  icon={<Lock className="h-2.5 w-2.5" />} label="Terkunci" />}
        {isAvailable && <StatusPill color="indigo" icon={<Zap className="h-2.5 w-2.5" />} label="Tersedia" />}
      </div>

      {/* ── Icon + Name ── */}
      <div className="flex items-start gap-4">
        <div className={`w-14 h-14 rounded-xl ${mod.color} flex items-center justify-center text-2xl shadow-lg flex-shrink-0
          ${(isInactive || isLocked) ? 'opacity-40 grayscale' : ''}`}>
          {mod.icon}
        </div>
        <div className="pr-20">
          <h3 className="text-base font-semibold text-slate-900 leading-tight">{mod.name}</h3>
          <p className="text-xs font-semibold text-slate-400 mt-0.5">{mod.tagline}</p>
        </div>
      </div>

      <p className={`mt-4 text-xs leading-relaxed flex-1 ${isInactive || isLocked ? 'text-slate-400' : 'text-slate-500'}`}>
        {mod.description}
      </p>

      {/* Tags */}
      {mod.tags && !isLocked && !isInactive && (
        <div className="mt-3 flex gap-1.5 flex-wrap">
          {mod.tags.map(tag => (
            <span key={tag} className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Setup steps (only for pending) */}
      {isPending && mod.onboardingSteps.length > 0 && (
        <div className="mt-3 flex gap-2 flex-wrap">
          {mod.onboardingSteps.map(step => (
            <span key={step.id} className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded-lg">
              {step.id === 'coa' ? '📒 Install CoA' : '⚙️ Pengaturan Awal'}
            </span>
          ))}
        </div>
      )}

      {/* ── Harga (jika sudah diset di SaaS) ── */}
      {price !== undefined && !isReady && !isPending && (
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-baseline gap-1.5">
          <span className="text-lg font-semibold text-slate-900">{formatRp(price)}</span>
          <span className="text-xs text-slate-400 font-medium">/ bulan</span>
        </div>
      )}

      {/* ── Banner Modul Aktif ── */}
      {isReady && (
        <div className="mt-4 pt-4 border-t border-blue-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-semibold text-emerald-700">Modul Aktif</span>
            </div>
            {readyAt && (
              <span className="text-[10px] text-slate-400 font-medium">
                Sejak {new Date(readyAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
          {price !== undefined && (
            <p className="text-[10px] text-blue-500 font-bold mt-1">
              {formatRp(price)} / bulan · Aktif dalam paket Anda
            </p>
          )}
        </div>
      )}

      {/* ── CTA ── */}
      <div className="mt-5 flex items-center justify-between gap-2">
        <div className="flex-1">
          {isLocked && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
              <Lock className="h-3.5 w-3.5" /> Tidak tersedia di paket ini
            </div>
          )}
          {isInactive && (
            <div className="flex flex-col gap-2">
              {unmetRequirements.length > 0 && (
                <div className="text-[10px] font-bold text-rose-500 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
                  Syarat: Aktifkan {unmetRequirements.join(', ')} terlebih dahulu.
                </div>
              )}
              <ActivateModuleButton
                moduleKey={mod.key}
                moduleName={mod.name}
                moduleIcon={mod.icon}
                moduleColor={mod.color}
                price={price}
                disabled={unmetRequirements.length > 0}
              />
            </div>
          )}
          {isAvailable && (
            <div className="flex flex-col gap-2">
              {unmetRequirements.length > 0 && (
                <div className="text-[10px] font-bold text-rose-500 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
                  Syarat: Aktifkan {unmetRequirements.join(', ')} terlebih dahulu.
                </div>
              )}
              <ActivateModuleButton 
                moduleKey={mod.key}
                moduleName={mod.name}
                moduleIcon={mod.icon}
                moduleColor={mod.color}
                price={price}
                disabled={unmetRequirements.length > 0} 
              />
            </div>
          )}
          {isPending && (
            <a href={`/marketplace/setup/${mod.key}`} className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-amber-100 hover:bg-amber-600 transition-all">
              Selesaikan Setup <ArrowRight className="h-4 w-4" />
            </a>
          )}
          {isReady && (
            <a href={mod.href} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all">
              Buka Modul <ArrowRight className="h-4 w-4" />
            </a>
          )}
        </div>

        {/* Deactivate button — only for active/pending */}
        {(isReady || isPending) && (
          <DeactivateModuleButton moduleKey={mod.key} moduleName={mod.name} />
        )}
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function StatusPill({
  color,
  icon,
  label,
}: {
  color: 'blue' | 'amber' | 'slate' | 'indigo' | 'emerald'
  icon: React.ReactNode
  label: string
}) {
  const colors = {
    blue:    'bg-blue-50   text-blue-700   border-blue-200',
    amber:   'bg-amber-50  text-amber-700  border-amber-200',
    slate:   'bg-slate-100 text-slate-500  border-slate-200',
    indigo:  'bg-indigo-50 text-indigo-700 border-indigo-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  }
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide border px-2 py-1 rounded-full ${colors[color]}`}>
      {icon} {label}
    </span>
  )
}
