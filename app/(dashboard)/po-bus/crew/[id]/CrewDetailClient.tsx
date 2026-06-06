'use client'

import { useState } from 'react'
import {
  User, Phone, CreditCard, Calendar,
  Car, Users, Clock, CheckCircle2,
  AlertTriangle, ShieldCheck, Share2, Droplets,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatCard, SectionCard, SectionHeader } from '@/components/ui/NizamUI'
import { CrewShortcutModal } from '../../CrewShortcutModal'
import type { BusCrew, BusSchedule } from '@/modules/po-bus/lib/po-bus-types'

function formatDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}
function formatDateTime(s: string) {
  return new Date(s).toLocaleString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
function getDaysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}
function getLicenseStatus(expiry: string | null): 'ok' | 'warning' | 'danger' {
  const days = getDaysUntil(expiry)
  if (days === null) return 'ok'
  if (days < 0) return 'danger'
  if (days < 30) return 'danger'
  if (days < 90) return 'warning'
  return 'ok'
}

const ROLE_CONFIG = {
  DRIVER:    { label: 'Driver', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: Car },
  CO_DRIVER: { label: 'Co-Driver', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', icon: Car },
  KERNET:    { label: 'Kernet', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: Users },
  KONDEKTUR: { label: 'Kondektur', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: CreditCard },
}

const SCHEDULE_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  TERJADWAL: { label: 'Terjadwal', bg: 'bg-blue-50', text: 'text-blue-700' },
  BERANGKAT: { label: 'Berangkat', bg: 'bg-amber-50', text: 'text-amber-700' },
  TIBA:      { label: 'Tiba', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  BATAL:     { label: 'Batal', bg: 'bg-red-50', text: 'text-red-600' },
}

type Tab = 'PROFIL' | 'JADWAL'

interface Props {
  crew: BusCrew
  schedules: BusSchedule[]
  orgId: string
}

export function CrewDetailClient({ crew, schedules }: Props) {
  const [tab, setTab] = useState<Tab>('PROFIL')
  const [showShortcut, setShowShortcut] = useState(false)

  const roleCfg = ROLE_CONFIG[crew.role] ?? ROLE_CONFIG.DRIVER
  const RoleIcon = roleCfg.icon
  const licenseStatus = getLicenseStatus(crew.license_expiry)
  const licensedays = getDaysUntil(crew.license_expiry)

  const completedSchedules = schedules.filter(s => s.status === 'TIBA')
  const upcomingSchedules = schedules.filter(s => s.status === 'TERJADWAL' || s.status === 'BERANGKAT')

  const TABS: { id: Tab; label: string; badge?: number }[] = [
    { id: 'PROFIL', label: 'Profil & SIM' },
    { id: 'JADWAL', label: 'Riwayat Jadwal', badge: schedules.length },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-start gap-5">
          <div className={cn('w-16 h-16 rounded-2xl flex items-center justify-center shrink-0', roleCfg.bg)}>
            <span className={cn('text-2xl font-bold', roleCfg.text)}>{crew.name.slice(0, 2).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-xl font-bold text-slate-800">{crew.name}</h1>
              <span className={cn('text-xs font-semibold px-2.5 py-0.5 rounded-full border flex items-center gap-1', roleCfg.bg, roleCfg.text, roleCfg.border)}>
                <RoleIcon className="w-3 h-3" />{roleCfg.label}
              </span>
              {!crew.is_active && <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500">Nonaktif</span>}
            </div>
            {crew.nik && <p className="text-sm font-mono text-slate-400 mb-2">NIK: {crew.nik}</p>}
            <div className="flex flex-wrap gap-4 text-sm text-slate-500">
              {crew.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{crew.phone}</span>}
              {crew.blood_type && <span className="flex items-center gap-1"><Droplets className="w-3.5 h-3.5" />Gol. Darah: {crew.blood_type}</span>}
              {crew.join_date && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />Bergabung {formatDate(crew.join_date)}</span>}
            </div>
          </div>
        </div>

        {/* SIM Status banner */}
        {(crew.role === 'DRIVER' || crew.role === 'CO_DRIVER') && (
          <div className={cn(
            'mt-4 flex items-center gap-3 rounded-xl px-4 py-3',
            licenseStatus === 'danger' ? 'bg-red-50 border border-red-100' :
            licenseStatus === 'warning' ? 'bg-amber-50 border border-amber-100' :
            'bg-emerald-50 border border-emerald-100',
          )}>
            {licenseStatus === 'ok'
              ? <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              : <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
            <div className="flex-1">
              <p className={cn('text-sm font-semibold',
                licenseStatus === 'danger' ? 'text-red-700' :
                licenseStatus === 'warning' ? 'text-amber-700' :
                'text-emerald-700',
              )}>
                {crew.license_number ? `SIM: ${crew.license_number}` : 'SIM tidak tercatat'}
              </p>
              {crew.license_expiry && (
                <p className={cn('text-xs',
                  licenseStatus === 'danger' ? 'text-red-500' :
                  licenseStatus === 'warning' ? 'text-amber-500' :
                  'text-emerald-500',
                )}>
                  {licensedays !== null && licensedays < 0
                    ? `Expired ${Math.abs(licensedays)} hari lalu`
                    : licensedays !== null
                    ? `Berlaku ${licensedays} hari lagi · Exp: ${formatDate(crew.license_expiry)}`
                    : `Berlaku hingga ${formatDate(crew.license_expiry)}`}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Jadwal" value={schedules.length} icon={Calendar} color="blue" />
        <StatCard label="Perjalanan Selesai" value={completedSchedules.length} icon={CheckCircle2} color="emerald" />
        <StatCard label="Akan Datang" value={upcomingSchedules.length} icon={Clock} color="amber" />
      </div>

      {/* Shortcut / Portal */}
      <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
        <Share2 className="w-4 h-4 text-slate-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-700">Shortcut & Portal Kru</p>
          <p className="text-xs text-slate-400 font-mono truncate">
            {crew.nik ? `/c/${crew.nik}` : 'NIK belum diisi'}
          </p>
        </div>
        <button
          onClick={() => setShowShortcut(true)}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600 transition-all duration-150 cursor-pointer shrink-0"
        >
          <Share2 className="w-3.5 h-3.5" />
          QR / Shortcut
        </button>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer whitespace-nowrap',
              tab === t.id
                ? 'bg-slate-800 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50',
            )}
          >
            {t.label}
            {t.badge !== undefined && (
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-semibold',
                tab === t.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500',
              )}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'PROFIL' && (
        <SectionCard>
          <SectionHeader title="Data Pribadi" icon={User} />
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            {[
              ['NIK', crew.nik],
              ['Telepon', crew.phone],
              ['Golongan Darah', crew.blood_type],
              ['Tanggal Bergabung', crew.join_date ? formatDate(crew.join_date) : null],
              ['No. SIM', crew.license_number],
              ['Berlaku Hingga', crew.license_expiry ? formatDate(crew.license_expiry) : null],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k as string} className="flex gap-2">
                <span className="text-slate-400 w-36 shrink-0">{k as string}</span>
                <span className="text-slate-700 font-medium">{v as string}</span>
              </div>
            ))}
            {crew.notes && (
              <div className="md:col-span-2 flex gap-2">
                <span className="text-slate-400 w-36 shrink-0">Catatan</span>
                <span className="text-slate-600">{crew.notes}</span>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {tab === 'JADWAL' && (
        <SectionCard>
          <SectionHeader title="Riwayat Jadwal" icon={Calendar} subtitle={`${schedules.length} perjalanan tercatat`} />
          {schedules.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Belum ada jadwal tercatat untuk kru ini.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {schedules.map(s => {
                const statusCfg = SCHEDULE_STATUS_CONFIG[s.status] ?? SCHEDULE_STATUS_CONFIG.TERJADWAL
                const isDriver = true // both driver and helper show here
                return (
                  <div key={s.id} className="flex items-center gap-4 p-3 bg-white border border-slate-100 rounded-xl hover:border-slate-200 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-slate-800 text-sm">
                          {s.route?.origin ?? '—'} → {s.route?.destination ?? '—'}
                        </p>
                        {s.bus && (
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{s.bus.plate_number}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{formatDateTime(s.departure_time)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {s.ticket_count !== undefined && (
                        <span className="text-xs text-slate-400">{s.ticket_count} tiket</span>
                      )}
                      <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', statusCfg.bg, statusCfg.text)}>
                        {statusCfg.label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>
      )}
      {showShortcut && (
        <CrewShortcutModal crew={crew} onClose={() => setShowShortcut(false)} />
      )}
    </div>
  )
}
