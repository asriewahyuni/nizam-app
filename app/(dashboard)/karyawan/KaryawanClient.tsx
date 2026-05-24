'use client'

import React, { startTransition, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home, Fingerprint, CalendarDays, ReceiptText, Wallet,
  CheckCircle2, XCircle, LogIn, LogOut,
  ChevronDown, ChevronUp, Trash2,
  Image as ImageIcon, MapPin, Moon,
  Sun, Cloud, CloudRain, CloudDrizzle, CloudLightning, Thermometer,
  Navigation, AlertTriangle, LocateFixed,
} from 'lucide-react'
import {
  clockMyAttendance,
  cancelMyLeaveRequest,
  submitMyLeaveRequest,
  submitMyExpenseClaim,
  deleteMyExpenseClaim,
} from '@/modules/hris/actions/self-service.actions'
import { uploadReceipt } from '@/modules/accounting/actions/reimburse.actions'
import { formatRupiah } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = 'beranda' | 'presensi' | 'cuti' | 'reimburse' | 'gaji'

type PrayerEntry = { name: string; key: string; time: string }

type WeatherData = {
  temp: number
  feelsLike: number
  label: string
  Icon: React.ElementType
}

type GpsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; lat: number; lng: number }
  | { status: 'error'; msg: string }

interface Props {
  orgId: string
  orgName?: string
  employee: any
  userName: string
  initialAttendance: any[]
  initialLeaveRequests: any[]
  initialExpenseClaims: any[]
  initialPayslips: any[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const JAKARTA = { lat: -6.2088, lng: 106.8456 }

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
  })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function statusBadge(status: string) {
  const s = String(status || '').toUpperCase()
  if (['PRESENT', 'HADIR'].includes(s)) return 'bg-emerald-100 text-emerald-700'
  if (['LATE', 'TERLAMBAT'].includes(s)) return 'bg-amber-100 text-amber-700'
  if (['ABSENT', 'ALFA'].includes(s))   return 'bg-rose-100 text-rose-700'
  if (s === 'LEAVE')   return 'bg-blue-100 text-blue-700'
  if (s === 'SICK')    return 'bg-purple-100 text-purple-700'
  if (s === 'HALFDAY') return 'bg-orange-100 text-orange-700'
  return 'bg-slate-100 text-slate-600'
}

function approvalBadge(status: string) {
  const s = String(status || '').toUpperCase()
  if (s === 'APPROVED')  return 'bg-emerald-100 text-emerald-700'
  if (s === 'REJECTED')  return 'bg-rose-100 text-rose-700'
  if (s === 'CANCELLED') return 'bg-slate-100 text-slate-500'
  return 'bg-amber-100 text-amber-700'
}

function getGreeting(date: Date): string {
  const h = date.getHours()
  if (h >= 4  && h < 11) return 'Selamat Pagi'
  if (h >= 11 && h < 15) return 'Selamat Siang'
  if (h >= 15 && h < 18) return 'Selamat Sore'
  return 'Selamat Malam'
}

function parseMinutes(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function getNextPrayerKey(prayers: PrayerEntry[], now: Date): string | null {
  const cur = now.getHours() * 60 + now.getMinutes()
  for (const p of prayers) {
    if (parseMinutes(p.time) > cur) return p.key
  }
  return null
}

function getWeatherInfo(code: number): { label: string; Icon: React.ElementType } {
  if (code === 0)  return { label: 'Cerah',    Icon: Sun }
  if (code <= 3)   return { label: 'Berawan',  Icon: Cloud }
  if (code <= 48)  return { label: 'Berkabut', Icon: Cloud }
  if (code <= 55)  return { label: 'Gerimis',  Icon: CloudDrizzle }
  if (code <= 82)  return { label: 'Hujan',    Icon: CloudRain }
  if (code >= 95)  return { label: 'Badai',    Icon: CloudLightning }
  return { label: 'Berawan', Icon: Cloud }
}

async function fetchPrayerTimes(lat: number, lng: number): Promise<PrayerEntry[]> {
  const r = await fetch(
    `https://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${lng}&method=11`
  )
  const data = await r.json()
  const t = data?.data?.timings
  if (!t) return []
  return [
    { name: 'Subuh',   key: 'Fajr',    time: t.Fajr },
    { name: 'Dzuhur',  key: 'Dhuhr',   time: t.Dhuhr },
    { name: 'Ashar',   key: 'Asr',     time: t.Asr },
    { name: 'Maghrib', key: 'Maghrib', time: t.Maghrib },
    { name: 'Isya',    key: 'Isha',    time: t.Isha },
  ]
}

async function fetchWeatherData(lat: number, lng: number): Promise<WeatherData | null> {
  const r = await fetch(
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,apparent_temperature,weather_code` +
    `&timezone=Asia%2FJakarta`
  )
  const data = await r.json()
  const c = data?.current
  if (!c) return null
  const { label, Icon } = getWeatherInfo(c.weather_code ?? 0)
  return {
    temp: Math.round(c.temperature_2m),
    feelsLike: Math.round(c.apparent_temperature),
    label,
    Icon,
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function KaryawanClient({
  orgId, orgName,
  employee, userName,
  initialAttendance, initialLeaveRequests, initialExpenseClaims, initialPayslips,
}: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('beranda')
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  // ── Live clock ──
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // ── GPS state ──
  const [gps, setGps] = useState<GpsState>({ status: 'idle' })

  // ── Prayer + Weather (shared fetch after GPS resolves) ──
  const [prayers, setPrayers] = useState<PrayerEntry[]>([])
  const [prayerLoading, setPrayerLoading] = useState(true)
  const [weather, setWeather] = useState<WeatherData | null>(null)

  const loadLocationData = useCallback(async (lat: number, lng: number) => {
    setPrayerLoading(true)
    try {
      const [prayerData, weatherData] = await Promise.all([
        fetchPrayerTimes(lat, lng),
        fetchWeatherData(lat, lng),
      ])
      setPrayers(prayerData)
      setWeather(weatherData)
    } catch {}
    finally { setPrayerLoading(false) }
  }, [])

  // Request GPS on mount → use actual coords or fall back to Jakarta
  useEffect(() => {
    if (!navigator?.geolocation) {
      setGps({ status: 'error', msg: 'GPS tidak didukung perangkat ini.' })
      loadLocationData(JAKARTA.lat, JAKARTA.lng)
      return
    }
    setGps({ status: 'loading' })
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setGps({ status: 'ok', lat, lng })
        loadLocationData(lat, lng)
      },
      () => {
        setGps({ status: 'error', msg: 'Izin GPS ditolak. Wajib untuk absensi.' })
        loadLocationData(JAKARTA.lat, JAKARTA.lng)
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 }
    )
  }, [loadLocationData])

  // ── Presensi state ──
  const [attendance, setAttendance] = useState(initialAttendance)
  const [attNotes, setAttNotes] = useState('')
  const [clockLoading, setClockLoading] = useState(false)

  // ── Cuti state ──
  const [leaves, setLeaves]         = useState(initialLeaveRequests)
  const [leaveType, setLeaveType]   = useState('Annual Leave')
  const [leaveStart, setLeaveStart] = useState(new Date().toISOString().split('T')[0])
  const [leaveEnd, setLeaveEnd]     = useState(new Date().toISOString().split('T')[0])
  const [leaveReason, setLeaveReason] = useState('')
  const [leaveLoading, setLeaveLoading] = useState(false)

  // ── Reimburse state ──
  const [claims, setClaims]             = useState(initialExpenseClaims)
  const [claimDate, setClaimDate]       = useState(new Date().toISOString().split('T')[0])
  const [claimCategory, setClaimCategory] = useState('Transport')
  const [claimAmount, setClaimAmount]   = useState('')
  const [claimDesc, setClaimDesc]       = useState('')
  const [claimReceiptUrl, setClaimReceiptUrl] = useState('')
  const [claimReceiptPreview, setClaimReceiptPreview] = useState<string | null>(null)
  const [claimLoading, setClaimLoading]   = useState(false)
  const [receiptUploading, setReceiptUploading] = useState(false)
  const receiptInputRef = useRef<HTMLInputElement>(null)

  // ── Gaji state ──
  const [payslips]         = useState(initialPayslips)
  const [expandedSlip, setExpandedSlip] = useState<string | null>(null)

  useEffect(() => { setAttendance(initialAttendance) }, [initialAttendance])
  useEffect(() => { setLeaves(initialLeaveRequests) },  [initialLeaveRequests])
  useEffect(() => { setClaims(initialExpenseClaims) },  [initialExpenseClaims])

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const refresh = () => startTransition(() => router.refresh())

  const today   = new Date().toISOString().split('T')[0]
  const todayAtt = attendance.find((r: any) => r.record_date === today) ?? null

  // ── Clock handler — GPS wajib ──
  const handleClock = async (type: 'IN' | 'OUT') => {
    if (gps.status === 'loading') {
      showToast('GPS sedang diproses, harap tunggu…', false); return
    }
    if (gps.status !== 'ok') {
      showToast('GPS diperlukan untuk absensi. Izinkan akses lokasi.', false); return
    }
    setClockLoading(true)
    const res = await clockMyAttendance(orgId, {
      type,
      notes: attNotes,
      latitude: gps.lat,
      longitude: gps.lng,
    })
    setClockLoading(false)
    if (res.error) { showToast(res.error, false); return }
    setAttNotes('')
    showToast(type === 'IN' ? 'Clock in berhasil!' : 'Clock out berhasil!', true)
    refresh()
  }

  // ── Leave handlers ──
  const handleLeave = async () => {
    const fd = new FormData()
    fd.set('leave_type', leaveType); fd.set('start_date', leaveStart)
    fd.set('end_date', leaveEnd); fd.set('reason', leaveReason)
    setLeaveLoading(true)
    const res = await submitMyLeaveRequest(orgId, fd)
    setLeaveLoading(false)
    if (res.error) { showToast(res.error, false); return }
    setLeaveReason(''); showToast('Pengajuan cuti terkirim!', true); refresh()
  }

  const handleCancelLeave = async (id: string) => {
    setLeaveLoading(true)
    const res = await cancelMyLeaveRequest(orgId, id)
    setLeaveLoading(false)
    if (res.error) { showToast(res.error, false); return }
    showToast('Cuti dibatalkan.', true); refresh()
  }

  // ── Reimburse handlers ──
  const handleUploadReceipt = async (file: File) => {
    setClaimReceiptPreview(URL.createObjectURL(file))
    setReceiptUploading(true)
    const fd = new FormData(); fd.set('file', file)
    const res = await uploadReceipt(fd)
    setReceiptUploading(false)
    if (!res.success || !res.url) { showToast(res.error || 'Gagal upload nota.', false); return }
    setClaimReceiptUrl(res.url); showToast('Nota terupload.', true)
  }

  const handleClaim = async () => {
    const fd = new FormData()
    fd.set('claim_date', claimDate); fd.set('category', claimCategory)
    fd.set('amount', claimAmount); fd.set('description', claimDesc)
    if (claimReceiptUrl) fd.set('receipt_url', claimReceiptUrl)
    setClaimLoading(true)
    const res = await submitMyExpenseClaim(orgId, fd)
    setClaimLoading(false)
    if (res.error) { showToast(res.error, false); return }
    setClaimAmount(''); setClaimDesc(''); setClaimReceiptUrl(''); setClaimReceiptPreview(null)
    showToast('Klaim terkirim!', true); refresh()
  }

  const handleDeleteClaim = async (id: string) => {
    setClaimLoading(true)
    const res = await deleteMyExpenseClaim(orgId, id)
    setClaimLoading(false)
    if (res.error) { showToast(res.error, false); return }
    showToast('Klaim dihapus.', true); refresh()
  }

  // ─── Derived UI values ────────────────────────────────────────────────────

  const name      = employee ? `${employee.first_name} ${employee.last_name || ''}`.trim() : userName
  const firstName = name.split(' ')[0] || name
  const initials  = name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase() || 'K'

  const greeting       = getGreeting(now)
  const nextPrayerKey  = getNextPrayerKey(prayers, now)

  const clockStr = now.toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZone: 'Asia/Jakarta', hour12: false,
  })
  const dateStr = now.toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'Asia/Jakarta',
  })

  // GPS badge info
  const GpsBadge = () => {
    if (gps.status === 'loading') return (
      <div className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-400/30 px-2.5 py-1 rounded-full">
        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        <span className="text-[10px] font-black text-amber-200 uppercase tracking-wider">Cari GPS…</span>
      </div>
    )
    if (gps.status === 'ok') return (
      <div className="flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-400/30 px-2.5 py-1 rounded-full">
        <LocateFixed size={10} className="text-emerald-300" />
        <span className="text-[10px] font-black text-emerald-200 uppercase tracking-wider">GPS Aktif</span>
      </div>
    )
    return (
      <div className="flex items-center gap-1.5 bg-rose-500/20 border border-rose-400/30 px-2.5 py-1 rounded-full">
        <AlertTriangle size={10} className="text-rose-300" />
        <span className="text-[10px] font-black text-rose-200 uppercase tracking-wider">GPS Off</span>
      </div>
    )
  }

  const TABS: { id: Tab; label: string; icon: typeof Home }[] = [
    { id: 'beranda',   label: 'Beranda',   icon: Home },
    { id: 'presensi',  label: 'Presensi',  icon: Fingerprint },
    { id: 'cuti',      label: 'Cuti',      icon: CalendarDays },
    { id: 'reimburse', label: 'Reimburse', icon: ReceiptText },
    { id: 'gaji',      label: 'Gaji',      icon: Wallet },
  ]

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-md mx-auto relative min-h-screen flex flex-col bg-slate-50">

        <div className="flex-1 overflow-y-auto pb-24">
          <AnimatePresence mode="wait">

            {/* ═══════════════════════════════════════════════════════════
                BERANDA
            ═══════════════════════════════════════════════════════════ */}
            {tab === 'beranda' && (
              <motion.div key="beranda" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

                {/* ── COVER — Jam, cuaca, greeting ── */}
                <div className="relative">
                  <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 relative overflow-hidden px-5 pt-4 pb-14">
                    {/* Dekorasi */}
                    <div className="absolute -top-10 -right-10 w-52 h-52 bg-white/5 rounded-full pointer-events-none" />
                    <div className="absolute -bottom-16 -left-8 w-44 h-44 bg-white/5 rounded-full pointer-events-none" />

                    {/* Row 1: Org + GPS + Weather */}
                    <div className="flex items-center justify-between mb-4 relative z-10 gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        {orgName && (
                          <div className="flex items-center gap-1">
                            <MapPin size={10} className="text-white/60" />
                            <span className="text-[11px] font-black text-white/70 uppercase tracking-wider">{orgName}</span>
                          </div>
                        )}
                        <GpsBadge />
                      </div>

                      {/* Weather badge */}
                      {weather ? (
                        <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 px-3 py-1.5 rounded-2xl">
                          <weather.Icon size={13} className="text-white" />
                          <span className="text-[13px] font-black text-white tabular-nums">{weather.temp}°C</span>
                          <span className="text-[10px] font-bold text-white/70">{weather.label}</span>
                        </div>
                      ) : (
                        <div className="w-24 h-7 bg-white/10 rounded-2xl animate-pulse" />
                      )}
                    </div>

                    {/* Row 2: Jam besar + Tanggal + Greeting */}
                    <div className="relative z-10">
                      <p className="text-[44px] leading-none font-black text-white tracking-tight font-mono tabular-nums">
                        {clockStr}
                      </p>
                      <p className="text-[11px] text-white/60 font-bold mt-1 tracking-wider capitalize">{dateStr}</p>
                      <p className="text-[14px] font-black text-white/90 mt-3">
                        {greeting}, {firstName} 👋
                      </p>
                      {weather && (
                        <p className="text-[11px] text-white/55 font-medium mt-0.5">
                          Terasa seperti {weather.feelsLike}°C di luar
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Avatar — kanan, overlapping cover */}
                  <div className="absolute right-5 bottom-0 translate-y-1/2">
                    <div className="w-20 h-20 rounded-full ring-4 ring-slate-50 bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-2xl shadow-xl overflow-hidden">
                      {employee?.avatar_url
                        ? <img src={employee.avatar_url} alt={name} className="w-full h-full object-cover" />
                        : initials}
                    </div>
                  </div>
                </div>

                {/* ── Profile info ── */}
                <div className="px-5 pt-5 pb-4 bg-white border-b border-slate-100">
                  <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <h1 className="text-xl font-black text-slate-900 leading-tight truncate">{name}</h1>
                      <p className="text-sm text-slate-500 font-medium mt-0.5 truncate">
                        {employee?.job_title || 'Karyawan'}
                        {employee?.branch?.name && <span className="text-slate-400"> · {employee.branch.name}</span>}
                      </p>
                      {employee?.nik && (
                        <p className="text-[11px] text-slate-400 font-bold mt-1 uppercase tracking-wider">
                          NIK: {employee.nik}
                        </p>
                      )}
                    </div>
                    {/* Avatar spacer kanan */}
                    <div className="w-16 shrink-0" />
                  </div>
                </div>

                <div className="px-4 pt-4 space-y-4">

                  {/* ═══ PRESENSI CARD — Navigasi ke tab Presensi ═══ */}
                  <button
                    type="button"
                    onClick={() => setTab('presensi')}
                    className="w-full text-left bg-white rounded-3xl border border-slate-100 shadow-md overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
                  >
                    {/* Header status */}
                    <div className={`px-5 py-3 flex items-center justify-between ${
                      todayAtt?.check_in && todayAtt?.check_out
                        ? 'bg-emerald-50 border-b border-emerald-100'
                        : todayAtt?.check_in
                        ? 'bg-sky-50 border-b border-sky-100'
                        : 'bg-slate-50 border-b border-slate-100'
                    }`}>
                      <div className="flex items-center gap-2">
                        <Fingerprint size={15} className={
                          todayAtt?.check_in && todayAtt?.check_out ? 'text-emerald-600'
                          : todayAtt?.check_in ? 'text-sky-600' : 'text-slate-400'
                        } />
                        <span className="text-[11px] font-black uppercase tracking-widest text-slate-700">Presensi Hari Ini</span>
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${todayAtt ? statusBadge(todayAtt.status) : 'bg-slate-100 text-slate-500'}`}>
                        {todayAtt?.status || 'Belum Absen'}
                      </span>
                    </div>

                    {/* Waktu masuk / keluar */}
                    <div className="grid grid-cols-2 divide-x divide-slate-100">
                      {[
                        { label: 'Masuk',  value: todayAtt?.check_in  ? fmt(todayAtt.check_in)  : '--:--', color: 'text-emerald-600' },
                        { label: 'Keluar', value: todayAtt?.check_out ? fmt(todayAtt.check_out) : '--:--', color: 'text-sky-600' },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="py-4 text-center">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
                          <p className={`text-2xl font-black tabular-nums ${value === '--:--' ? 'text-slate-300' : color}`}>{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* CTA navigasi */}
                    <div className={`px-5 py-3.5 flex items-center justify-center gap-2 ${
                      todayAtt?.check_in && todayAtt?.check_out
                        ? 'bg-emerald-500'
                        : todayAtt?.check_in
                        ? 'bg-sky-500'
                        : 'bg-gradient-to-r from-blue-600 to-indigo-600'
                    }`}>
                      {todayAtt?.check_in && todayAtt?.check_out ? (
                        <>
                          <CheckCircle2 size={16} className="text-white" strokeWidth={2.5} />
                          <span className="text-[12px] font-black uppercase tracking-widest text-white">Absensi Selesai</span>
                        </>
                      ) : todayAtt?.check_in ? (
                        <>
                          <LogOut size={16} className="text-white" strokeWidth={2.5} />
                          <span className="text-[12px] font-black uppercase tracking-widest text-white">Absen Keluar →</span>
                        </>
                      ) : (
                        <>
                          <Fingerprint size={16} className="text-white" strokeWidth={2.5} />
                          <span className="text-[12px] font-black uppercase tracking-widest text-white">Absen Sekarang →</span>
                        </>
                      )}
                    </div>
                  </button>

                  {/* ── Jadwal Sholat ── */}
                  <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-slate-50">
                      <div className="flex items-center gap-2">
                        <Moon size={15} className="text-indigo-500" />
                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-700">Jadwal Sholat</p>
                      </div>
                      <p className="text-[10px] font-bold text-slate-400">
                        {gps.status === 'ok'
                          ? `${gps.lat.toFixed(2)}°, ${gps.lng.toFixed(2)}°`
                          : 'Jakarta · WIB'}
                      </p>
                    </div>

                    {prayerLoading ? (
                      <div className="px-5 py-5 space-y-3">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <div className="h-3 w-16 bg-slate-100 rounded-full animate-pulse" />
                            <div className="h-3 w-10 bg-slate-100 rounded-full animate-pulse" />
                          </div>
                        ))}
                      </div>
                    ) : prayers.length === 0 ? (
                      <p className="px-5 py-5 text-center text-xs text-slate-400 font-bold">
                        Jadwal tidak tersedia
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-50">
                        {prayers.map((p, i) => {
                          const isNext = p.key === nextPrayerKey
                          const nextIdx = prayers.findIndex(x => x.key === nextPrayerKey)
                          const isPast = nextIdx >= 0 ? i < nextIdx : true
                          return (
                            <div key={p.key} className={`px-5 py-3 flex items-center justify-between ${isNext ? 'bg-indigo-50' : ''}`}>
                              <div className="flex items-center gap-3">
                                {isNext
                                  ? <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.7)] animate-pulse" />
                                  : isPast
                                  ? <div className="w-2 h-2 rounded-full bg-slate-300" />
                                  : <div className="w-2 h-2 rounded-full border-2 border-slate-200" />
                                }
                                <span className={`text-sm font-bold ${isNext ? 'text-indigo-700' : isPast ? 'text-slate-400' : 'text-slate-700'}`}>
                                  {p.name}
                                </span>
                                {isNext && (
                                  <span className="text-[9px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                                    Berikutnya
                                  </span>
                                )}
                              </div>
                              <span className={`text-sm font-black tabular-nums ${isNext ? 'text-indigo-700' : isPast ? 'text-slate-400' : 'text-slate-700'}`}>
                                {p.time}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* ── Quick links ── */}
                  <div className="grid grid-cols-3 gap-3 pb-2">
                    {[
                      { label: 'Pengajuan Cuti',  tab: 'cuti'      as Tab, Icon: CalendarDays, color: 'text-blue-600 bg-blue-50' },
                      { label: 'Reimburse',        tab: 'reimburse' as Tab, Icon: ReceiptText,  color: 'text-emerald-600 bg-emerald-50' },
                      { label: 'Slip Gaji',        tab: 'gaji'      as Tab, Icon: Wallet,       color: 'text-violet-600 bg-violet-50' },
                    ].map(({ label, tab: t, Icon, color }) => (
                      <button key={t} type="button" onClick={() => setTab(t)}
                        className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col items-center gap-2 cursor-pointer hover:bg-slate-50 active:scale-95 transition-all">
                        <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
                          <Icon size={18} />
                        </div>
                        <span className="text-[10px] font-black text-slate-700 text-center leading-tight">{label}</span>
                      </button>
                    ))}
                  </div>

                </div>
              </motion.div>
            )}

            {/* ═══ PRESENSI tab ═══ */}
            {tab === 'presensi' && (
              <motion.div key="presensi" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4 px-4 pt-5">

                <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Hari Ini</p>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { label: 'Status', value: todayAtt?.status || '—' },
                      { label: 'Masuk',  value: todayAtt?.check_in  ? fmt(todayAtt.check_in)  : '--:--' },
                      { label: 'Keluar', value: todayAtt?.check_out ? fmt(todayAtt.check_out) : '--:--' },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-2xl bg-slate-50 border border-slate-100 px-3 py-3 text-center">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
                        <p className="text-sm font-black text-slate-900 leading-tight">{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* GPS status */}
                  {gps.status === 'error' && (
                    <div className="flex items-center gap-2 bg-rose-50 border border-rose-100 rounded-2xl px-4 py-2.5 mb-3">
                      <AlertTriangle size={14} className="text-rose-500 shrink-0" />
                      <p className="text-[11px] font-bold text-rose-600">{gps.msg}</p>
                    </div>
                  )}
                  {gps.status === 'ok' && (
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-2 mb-3">
                      <LocateFixed size={13} className="text-emerald-500 shrink-0" />
                      <p className="text-[11px] font-bold text-emerald-600">
                        GPS · {gps.lat.toFixed(4)}, {gps.lng.toFixed(4)}
                      </p>
                    </div>
                  )}

                  <textarea
                    value={attNotes}
                    onChange={e => setAttNotes(e.target.value)}
                    placeholder="Catatan (opsional)…"
                    rows={2}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 resize-none mb-3"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button"
                      disabled={clockLoading || !!todayAtt?.check_in || gps.status !== 'ok'}
                      onClick={() => handleClock('IN')}
                      className="flex flex-col items-center justify-center gap-1.5 py-5 rounded-2xl bg-emerald-500 text-white font-black text-sm disabled:opacity-40 active:scale-95 transition-all cursor-pointer hover:bg-emerald-600 shadow-lg shadow-emerald-200"
                    >
                      {clockLoading ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <LogIn size={22} strokeWidth={2.5} />}
                      <span className="text-[12px] font-black uppercase tracking-widest">Clock In</span>
                    </button>
                    <button type="button"
                      disabled={clockLoading || !todayAtt?.check_in || !!todayAtt?.check_out || gps.status !== 'ok'}
                      onClick={() => handleClock('OUT')}
                      className="flex flex-col items-center justify-center gap-1.5 py-5 rounded-2xl bg-sky-500 text-white font-black text-sm disabled:opacity-40 active:scale-95 transition-all cursor-pointer hover:bg-sky-600 shadow-lg shadow-sky-200"
                    >
                      {clockLoading ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <LogOut size={22} strokeWidth={2.5} />}
                      <span className="text-[12px] font-black uppercase tracking-widest">Clock Out</span>
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Riwayat 14 Hari</p>
                  {attendance.length === 0
                    ? <p className="text-sm text-slate-400 text-center py-4">Belum ada riwayat.</p>
                    : <div className="space-y-2">
                      {attendance.map((r: any) => (
                        <div key={r.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                          <div>
                            <p className="text-xs font-bold text-slate-700">{fmtDate(r.record_date)}</p>
                            <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                              {r.check_in ? fmt(r.check_in) : '--:--'} → {r.check_out ? fmt(r.check_out) : '--:--'}
                            </p>
                            {r.location_gps && (
                              <p className="text-[9px] text-slate-300 font-bold mt-0.5 flex items-center gap-1">
                                <Navigation size={9} /> {r.location_gps}
                              </p>
                            )}
                          </div>
                          <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg ${statusBadge(r.status)}`}>{r.status}</span>
                        </div>
                      ))}
                    </div>
                  }
                </div>

              </motion.div>
            )}

            {/* ═══ CUTI ═══ */}
            {tab === 'cuti' && (
              <motion.div key="cuti" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4 px-4 pt-5">
                <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ajukan Cuti</p>
                  <select value={leaveType} onChange={e => setLeaveType(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:border-blue-400 cursor-pointer">
                    {['Annual Leave','Sick Leave','Emergency Leave','Unpaid Leave','Maternity Leave'].map(t => <option key={t}>{t}</option>)}
                  </select>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 ml-1">Mulai</label>
                      <input type="date" value={leaveStart} onChange={e => setLeaveStart(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:border-blue-400" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 ml-1">Selesai</label>
                      <input type="date" value={leaveEnd} onChange={e => setLeaveEnd(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:border-blue-400" />
                    </div>
                  </div>
                  <textarea value={leaveReason} onChange={e => setLeaveReason(e.target.value)} placeholder="Alasan pengajuan cuti…" rows={3} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 resize-none" />
                  <button type="button" disabled={leaveLoading || !leaveReason.trim()} onClick={handleLeave}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-blue-600 text-white font-black text-sm disabled:opacity-40 active:scale-95 transition-all cursor-pointer hover:bg-blue-700">
                    {leaveLoading ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <CalendarDays size={16} />}
                    Kirim Pengajuan
                  </button>
                </div>
                <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Riwayat Cuti</p>
                  {leaves.length === 0
                    ? <p className="text-sm text-slate-400 text-center py-4">Belum ada pengajuan.</p>
                    : <div className="space-y-2">{leaves.map((l: any) => (
                      <div key={l.id} className="py-3 border-b border-slate-50 last:border-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-black text-slate-800">{l.leave_type}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{fmtDate(l.start_date)} – {fmtDate(l.end_date)}</p>
                            {l.reason && <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{l.reason}</p>}
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg ${approvalBadge(l.status)}`}>{l.status}</span>
                            {l.status === 'PENDING' && (
                              <button type="button" onClick={() => handleCancelLeave(l.id)} className="text-[9px] font-black text-slate-400 hover:text-rose-500 cursor-pointer transition-colors">Batalkan</button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}</div>
                  }
                </div>
              </motion.div>
            )}

            {/* ═══ REIMBURSE ═══ */}
            {tab === 'reimburse' && (
              <motion.div key="reimburse" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4 px-4 pt-5">
                <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Klaim Reimburse</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 ml-1">Tanggal</label>
                      <input type="date" value={claimDate} onChange={e => setClaimDate(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:border-blue-400" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 ml-1">Kategori</label>
                      <select value={claimCategory} onChange={e => setClaimCategory(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:border-blue-400 cursor-pointer">
                        {['Transport','Meal','Accommodation','Medical','Communication','Others'].map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <input type="number" value={claimAmount} onChange={e => setClaimAmount(e.target.value)} placeholder="Jumlah (Rp)" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:border-blue-400 placeholder:font-normal" />
                  <textarea value={claimDesc} onChange={e => setClaimDesc(e.target.value)} placeholder="Deskripsi pengeluaran…" rows={2} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 resize-none" />
                  <input ref={receiptInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadReceipt(f) }} />
                  <button type="button" onClick={() => receiptInputRef.current?.click()}
                    className="w-full py-3 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center gap-2 text-sm font-bold text-slate-500 hover:border-blue-400 hover:text-blue-500 transition-colors cursor-pointer">
                    {receiptUploading ? <div className="w-4 h-4 border-2 border-slate-400/40 border-t-slate-400 rounded-full animate-spin" /> : <ImageIcon size={16} />}
                    {claimReceiptUrl ? 'Ganti Nota' : receiptUploading ? 'Mengupload…' : 'Upload Nota'}
                  </button>
                  {claimReceiptPreview && <img src={claimReceiptPreview} alt="nota" className="w-full h-28 object-cover rounded-2xl border border-slate-100" />}
                  <button type="button" disabled={claimLoading || !claimAmount || !claimDesc} onClick={handleClaim}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-emerald-600 text-white font-black text-sm disabled:opacity-40 active:scale-95 transition-all cursor-pointer hover:bg-emerald-700">
                    {claimLoading ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <ReceiptText size={16} />}
                    Kirim Klaim
                  </button>
                </div>
                <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Riwayat Klaim</p>
                  {claims.length === 0
                    ? <p className="text-sm text-slate-400 text-center py-4">Belum ada klaim.</p>
                    : <div className="space-y-2">{claims.map((c: any) => (
                      <div key={c.id} className="py-3 border-b border-slate-50 last:border-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-black text-slate-800">{c.category} — {formatRupiah(c.amount)}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{fmtDate(c.claim_date)}</p>
                            {c.description && <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{c.description}</p>}
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg ${approvalBadge(c.status)}`}>{c.status}</span>
                            {['PENDING','REJECTED'].includes(c.status) && (
                              <button type="button" onClick={() => handleDeleteClaim(c.id)} className="text-rose-400 hover:text-rose-600 cursor-pointer transition-colors">
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}</div>
                  }
                </div>
              </motion.div>
            )}

            {/* ═══ GAJI ═══ */}
            {tab === 'gaji' && (
              <motion.div key="gaji" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4 px-4 pt-5">
                {payslips.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-slate-100 p-10 text-center shadow-sm">
                    <Wallet size={32} className="text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-bold text-slate-500">Belum ada slip gaji.</p>
                  </div>
                ) : (
                  payslips.map((slip: any) => {
                    const run   = slip.run
                    const lines: any[] = slip.lines || []
                    const earnings   = lines.filter((l: any) => l.type === 'EARNING')
                    const deductions = lines.filter((l: any) => l.type === 'DEDUCTION')
                    const isOpen = expandedSlip === slip.id
                    const period = run?.period_start
                      ? new Date(run.period_start).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
                      : fmtDate(slip.created_at)
                    return (
                      <div key={slip.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                        <button type="button" onClick={() => setExpandedSlip(isOpen ? null : slip.id)}
                          className="w-full flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors">
                          <div className="text-left">
                            <p className="text-sm font-black text-slate-900">{period}</p>
                            <p className="text-xs font-bold text-slate-400 mt-0.5">Take Home: {formatRupiah(slip.net_salary)}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${slip.payment_status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{slip.payment_status}</span>
                            {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                          </div>
                        </button>
                        {isOpen && (
                          <div className="border-t border-slate-100 px-5 py-4 space-y-4">
                            <div className="grid grid-cols-2 gap-3 text-center">
                              {[
                                { label: 'Gaji Pokok', value: formatRupiah(slip.basic_salary),     color: 'text-slate-900' },
                                { label: 'Bruto',       value: formatRupiah(slip.gross_salary),     color: 'text-blue-700' },
                                { label: 'Potongan',    value: formatRupiah(slip.total_deductions), color: 'text-rose-600' },
                                { label: 'Take Home',   value: formatRupiah(slip.net_salary),       color: 'text-emerald-600' },
                              ].map(({ label, value, color }) => (
                                <div key={label} className="bg-slate-50 rounded-2xl p-3">
                                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
                                  <p className={`text-sm font-black ${color}`}>{value}</p>
                                </div>
                              ))}
                            </div>
                            {earnings.length > 0 && (
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1.5">Pendapatan</p>
                                {earnings.map((l: any) => (
                                  <div key={l.id} className="flex justify-between py-1.5 border-b border-slate-50 last:border-0">
                                    <p className="text-xs font-semibold text-slate-700">{l.component_name}</p>
                                    <p className="text-xs font-black text-emerald-600">+{formatRupiah(l.amount)}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                            {deductions.length > 0 && (
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-rose-600 mb-1.5">Potongan</p>
                                {deductions.map((l: any) => (
                                  <div key={l.id} className="flex justify-between py-1.5 border-b border-slate-50 last:border-0">
                                    <p className="text-xs font-semibold text-slate-700">{l.component_name}</p>
                                    <p className="text-xs font-black text-rose-600">-{formatRupiah(l.amount)}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="flex justify-between items-center pt-2 border-t-2 border-slate-200">
                              <p className="text-sm font-black text-slate-900">Take Home Pay</p>
                              <p className="text-base font-black text-emerald-600">{formatRupiah(slip.net_salary)}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* ── Bottom Tab Navigation ── */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 safe-area-pb">
          <div className="max-w-md mx-auto grid grid-cols-5">
            {TABS.map(({ id, label, icon: Icon }) => {
              const active = tab === id
              return (
                <button key={id} type="button" onClick={() => setTab(id)}
                  className={`relative flex flex-col items-center justify-center gap-0.5 py-3 transition-all cursor-pointer ${active ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
                  <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                  <span className={`text-[9px] font-black uppercase tracking-wide ${active ? 'text-blue-600' : ''}`}>{label}</span>
                  {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-600 rounded-full" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Toast ── */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-5 py-3 rounded-2xl shadow-xl text-white text-sm font-black max-w-xs w-auto ${toast.ok ? 'bg-emerald-600' : 'bg-rose-600'}`}
            >
              {toast.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
              {toast.msg}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  )
}
