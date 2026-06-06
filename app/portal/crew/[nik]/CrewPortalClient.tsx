'use client'

import { useState } from 'react'
import {
  Car, Users, CreditCard, Calendar, Phone,
  ShieldCheck, AlertTriangle, Clock, CheckCircle2,
  Droplets, MapPin, ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BusCrew, BusSchedule } from '@/modules/po-bus/lib/po-bus-types'

function formatDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}
function formatDateTime(s: string) {
  return new Date(s).toLocaleString('id-ID', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
}
function getDaysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}
function getLicenseStatus(expiry: string | null): 'ok' | 'warning' | 'danger' {
  const d = getDaysUntil(expiry)
  if (d === null) return 'ok'
  if (d < 0) return 'danger'
  if (d < 30) return 'danger'
  if (d < 90) return 'warning'
  return 'ok'
}

const ROLE_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; gradient: string }> = {
  DRIVER:    { label: 'Driver', icon: Car, gradient: 'from-blue-600 to-blue-700' },
  CO_DRIVER: { label: 'Co-Driver', icon: Car, gradient: 'from-indigo-600 to-indigo-700' },
  KERNET:    { label: 'Kernet', icon: Users, gradient: 'from-emerald-600 to-emerald-700' },
  KONDEKTUR: { label: 'Kondektur', icon: CreditCard, gradient: 'from-amber-600 to-amber-700' },
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  TERJADWAL: { label: 'Terjadwal', bg: 'bg-blue-100', text: 'text-blue-700' },
  BERANGKAT: { label: 'Berangkat', bg: 'bg-amber-100', text: 'text-amber-700' },
  TIBA:      { label: 'Tiba', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  BATAL:     { label: 'Batal', bg: 'bg-red-100', text: 'text-red-600' },
}

type Tab = 'JADWAL' | 'PROFIL'

interface Props {
  crew: BusCrew
  schedules: BusSchedule[]
}

export function CrewPortalClient({ crew, schedules }: Props) {
  const [tab, setTab] = useState<Tab>('JADWAL')

  const roleCfg = ROLE_CONFIG[crew.role] ?? ROLE_CONFIG.DRIVER
  const RoleIcon = roleCfg.icon
  const licenseStatus = getLicenseStatus(crew.license_expiry)
  const licenseDays = getDaysUntil(crew.license_expiry)

  const upcoming = schedules.filter(s => s.status === 'TERJADWAL' || s.status === 'BERANGKAT')
  const completed = schedules.filter(s => s.status === 'TIBA')
  const cancelled = schedules.filter(s => s.status === 'BATAL')

  return (
    <div className={cn('min-h-screen bg-gradient-to-b', roleCfg.gradient)}>
      {/* ── Header ── */}
      <div className="px-4 pt-10 pb-6 md:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
              <span className="text-2xl font-bold text-white">{crew.name.slice(0, 2).toUpperCase()}</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{crew.name}</h1>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-white/70 mt-0.5">
                <RoleIcon className="w-3.5 h-3.5" />
                {roleCfg.label}
              </span>
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: 'Total Jadwal', val: schedules.length },
              { label: 'Selesai', val: completed.length },
              { label: 'Akan Datang', val: upcoming.length },
            ].map(item => (
              <div key={item.label} className="bg-white/10 rounded-2xl p-4 text-center">
                <p className="text-2xl font-bold text-white">{item.val}</p>
                <p className="text-xs text-white/50 mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>

          {/* SIM status */}
          {(crew.role === 'DRIVER' || crew.role === 'CO_DRIVER') && crew.license_number && (
            <div className={cn(
              'rounded-2xl border p-4',
              licenseStatus === 'danger' ? 'bg-red-500/20 border-red-400/30' :
              licenseStatus === 'warning' ? 'bg-amber-500/20 border-amber-400/30' :
              'bg-white/10 border-white/20',
            )}>
              <div className="flex items-start gap-3">
                {licenseStatus === 'ok'
                  ? <ShieldCheck className="w-5 h-5 text-white/80 shrink-0 mt-0.5" />
                  : <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />}
                <div>
                  <p className="text-sm font-semibold text-white">SIM: {crew.license_number}</p>
                  {crew.license_expiry && (
                    <p className={cn('text-xs mt-0.5',
                      licenseStatus === 'danger' ? 'text-red-300' :
                      licenseStatus === 'warning' ? 'text-amber-300' :
                      'text-white/60',
                    )}>
                      {licenseDays !== null && licenseDays < 0
                        ? `Sudah expired ${Math.abs(licenseDays)} hari lalu — segera perpanjang!`
                        : licenseDays !== null
                        ? `Berlaku ${licenseDays} hari lagi · Exp: ${formatDate(crew.license_expiry)}`
                        : `Berlaku hingga ${formatDate(crew.license_expiry)}`}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="bg-slate-50 min-h-screen rounded-t-3xl">
        <div className="max-w-2xl mx-auto px-4 md:px-8 py-6 space-y-5">

          {/* Tabs */}
          <div className="flex gap-1.5">
            {(['JADWAL', 'PROFIL'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer',
                  tab === t
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50',
                )}
              >
                {t === 'JADWAL' ? `Jadwal (${schedules.length})` : 'Profil'}
              </button>
            ))}
          </div>

          {/* JADWAL */}
          {tab === 'JADWAL' && (
            <div className="space-y-3">
              {/* Upcoming first */}
              {upcoming.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Akan Datang</p>
                  {upcoming.map(s => (
                    <ScheduleCard key={s.id} schedule={s} highlight />
                  ))}
                </div>
              )}

              {/* Past */}
              {schedules.filter(s => s.status === 'TIBA' || s.status === 'BATAL').length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 mt-4">Riwayat</p>
                  {schedules.filter(s => s.status === 'TIBA' || s.status === 'BATAL').map(s => (
                    <ScheduleCard key={s.id} schedule={s} />
                  ))}
                </div>
              )}

              {schedules.length === 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
                  <Calendar className="w-8 h-8 text-slate-200 mx-auto mb-3" />
                  <p className="text-sm text-slate-400">Belum ada jadwal tercatat.</p>
                </div>
              )}
            </div>
          )}

          {/* PROFIL */}
          {tab === 'PROFIL' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
              <p className="text-sm font-semibold text-slate-700">Data Pribadi</p>
              {[
                { icon: CreditCard, label: 'NIK', val: crew.nik },
                { icon: Phone, label: 'Telepon', val: crew.phone },
                { icon: Droplets, label: 'Gol. Darah', val: crew.blood_type },
                { icon: Calendar, label: 'Tgl. Bergabung', val: crew.join_date ? formatDate(crew.join_date) : null },
                { icon: ShieldCheck, label: 'No. SIM', val: crew.license_number },
                { icon: Clock, label: 'SIM Exp', val: crew.license_expiry ? formatDate(crew.license_expiry) : null },
              ].filter(item => item.val).map(item => (
                <div key={item.label} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                    <item.icon className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{item.label}</p>
                    <p className="text-sm font-medium text-slate-700">{item.val as string}</p>
                  </div>
                </div>
              ))}
              {crew.notes && (
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-400 mb-1">Catatan</p>
                  <p className="text-sm text-slate-600">{crew.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ScheduleCard({ schedule: s, highlight = false }: { schedule: BusSchedule; highlight?: boolean }) {
  const statusCfg = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.TERJADWAL
  return (
    <div className={cn(
      'bg-white rounded-2xl border p-4 mb-2 shadow-sm',
      highlight ? 'border-blue-200 ring-1 ring-blue-100' : 'border-slate-100',
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            {s.route && (
              <span className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                {s.route.origin}
                <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                {s.route.destination}
              </span>
            )}
            <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', statusCfg.bg, statusCfg.text)}>
              {statusCfg.label}
            </span>
          </div>
          <p className="text-xs text-slate-400">{new Date(s.departure_time).toLocaleString('id-ID', {
            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}</p>
          {s.bus && (
            <p className="text-[11px] text-slate-400 mt-1 font-mono">{s.bus.plate_number} · {s.bus.model}</p>
          )}
        </div>
      </div>
    </div>
  )
}
