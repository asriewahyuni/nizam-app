'use client'

import React, { startTransition, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home, Fingerprint, CalendarDays, ReceiptText, Wallet,
  CheckCircle2, XCircle, LogIn, LogOut,
  ChevronDown, ChevronUp, Trash2,
  Image as ImageIcon, MapPin, Moon, Sun,
  Cloud, CloudRain, CloudDrizzle, CloudLightning,
  Navigation, AlertTriangle, LocateFixed,
  Settings, User, Lock, Eye, EyeOff, X, Camera,
} from 'lucide-react'
import {
  clockMyAttendance,
  cancelMyLeaveRequest,
  submitMyLeaveRequest,
  submitMyExpenseClaim,
  deleteMyExpenseClaim,
  updateMyEmployeeProfile,
} from '@/modules/hris/actions/self-service.actions'
import { uploadReceipt } from '@/modules/accounting/actions/reimburse.actions'
import { updateMyPassword, signOut } from '@/modules/auth/actions/auth.actions'
import { formatRupiah } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = 'beranda' | 'presensi' | 'cuti' | 'reimburse' | 'gaji'
type Sheet = null | 'settings' | 'edit-profile' | 'change-password'

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

// ─── Time-based Sky Theme ────────────────────────────────────────────────────

type TimeSlot = 'subuh' | 'pagi' | 'siang' | 'sore' | 'magrib' | 'malam'

function getTimeSlot(h: number): TimeSlot {
  if (h >= 4  && h < 6)  return 'subuh'
  if (h >= 6  && h < 10) return 'pagi'
  if (h >= 10 && h < 15) return 'siang'
  if (h >= 15 && h < 18) return 'sore'
  if (h >= 18 && h < 20) return 'magrib'
  return 'malam'
}

const SKY_THEMES: Record<TimeSlot, {
  sky: string       // CSS gradient (inline style)
  silhouette: string
  windows: boolean  // lit windows on buildings
  stars: boolean
  celestial: { type: 'sun' | 'moon'; cx: number; cy: number } | null
}> = {
  subuh: {
    sky: 'linear-gradient(to bottom, #05050f 0%, #150830 40%, #3d1060 65%, #8b2500 85%, #d04000 100%)',
    silhouette: '#0a0a18', windows: true, stars: true,
    celestial: { type: 'moon', cx: 78, cy: 22 },
  },
  pagi: {
    sky: 'linear-gradient(to bottom, #5ba3d9 0%, #f5a94a 45%, #f76e2a 70%, #ffc750 100%)',
    silhouette: '#18182e', windows: false, stars: false,
    celestial: { type: 'sun', cx: 14, cy: 38 },
  },
  siang: {
    sky: 'linear-gradient(to bottom, #1060c0 0%, #3490e0 35%, #6ab8f0 65%, #b8dff8 88%, #ddf0ff 100%)',
    silhouette: '#1e2a38', windows: false, stars: false,
    celestial: { type: 'sun', cx: 55, cy: 14 },
  },
  sore: {
    sky: 'linear-gradient(to bottom, #0e3a82 0%, #2060b0 30%, #e07a20 65%, #d04800 85%, #a83000 100%)',
    silhouette: '#12192e', windows: false, stars: false,
    celestial: { type: 'sun', cx: 86, cy: 45 },
  },
  magrib: {
    sky: 'linear-gradient(to bottom, #10003a 0%, #5a0070 22%, #c01860 48%, #f04810 72%, #f08020 100%)',
    silhouette: '#080814', windows: true, stars: true,
    celestial: { type: 'sun', cx: 90, cy: 60 },
  },
  malam: {
    sky: 'linear-gradient(to bottom, #010108 0%, #040418 35%, #06082a 65%, #080c20 100%)',
    silhouette: '#06060f', windows: true, stars: true,
    celestial: { type: 'moon', cx: 72, cy: 20 },
  },
}

// Hardcoded stars (cx/cy in % of viewBox 0-100)
const STARS = [
  [5,6],[12,3],[19,9],[27,4],[34,12],[41,5],[49,8],[57,3],[63,11],[71,6],[79,9],[87,4],[93,14],[97,7],
  [8,18],[16,22],[24,16],[33,20],[44,17],[52,23],[60,18],[68,22],[76,16],[84,19],[91,24],
  [3,28],[14,31],[30,26],[48,29],[65,27],[82,30],[95,28],
].map(([cx, cy], i) => ({ cx, cy, r: i % 5 === 0 ? 1.3 : i % 3 === 0 ? 1.0 : 0.7, op: 0.55 + (i % 4) * 0.12 }))

// Window positions on buildings (for night)
const WINDOWS = [
  [38,52],[38,62],[44,52],[44,62],[44,70],[124,40],[124,50],[127,30],[127,40],[127,50],
  [170,32],[170,42],[174,20],[174,32],[174,42],[178,32],[178,42],
  [249,35],[249,45],[253,22],[253,35],[253,45],[257,35],[257,45],
  [80,62],[87,50],[87,62],[288,65],[296,55],[303,65],[362,68],
].map(([x, y]) => ({ x, y }))

// ─── Input style helper ───────────────────────────────────────────────────────
const inputCls = 'w-full rounded-2xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 placeholder:font-normal placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500'

// ─── Main Component ───────────────────────────────────────────────────────────

export function KaryawanClient({
  orgId, orgName,
  employee, userName,
  initialAttendance, initialLeaveRequests, initialExpenseClaims, initialPayslips,
}: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('beranda')
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  // ── Dark mode (apply to html element — Tailwind class strategy) ──
  const [darkMode, setDarkMode] = useState(false)
  useEffect(() => {
    const saved = localStorage.getItem('karyawan-dark-mode')
    const isDark = saved === 'true'
    setDarkMode(isDark)
    if (isDark) document.documentElement.classList.add('dark')
    else        document.documentElement.classList.remove('dark')
    return () => document.documentElement.classList.remove('dark')
  }, [])
  const toggleDarkMode = () => {
    const next = !darkMode
    setDarkMode(next)
    localStorage.setItem('karyawan-dark-mode', String(next))
    if (next) document.documentElement.classList.add('dark')
    else      document.documentElement.classList.remove('dark')
  }

  // ── Sheet state ──
  const [sheet, setSheet] = useState<Sheet>(null)

  // ── Edit profile ──
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName,  setEditLastName]  = useState('')
  const [editAvatarUrl, setEditAvatarUrl] = useState<string | null>(null)
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null)
  const [editLoading,    setEditLoading]   = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  // ── Change password ──
  const [newPwd,     setNewPwd]     = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showNewPwd, setShowNewPwd] = useState(false)
  const [showConPwd, setShowConPwd] = useState(false)
  const [pwdLoading, setPwdLoading] = useState(false)

  // ── Logout ──
  const [logoutLoading, setLogoutLoading] = useState(false)

  // ── Live clock ──
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // ── GPS state ──
  const [gps, setGps] = useState<GpsState>({ status: 'idle' })

  // ── Prayer + Weather ──
  const [prayers, setPrayers]       = useState<PrayerEntry[]>([])
  const [prayerLoading, setPrayerLoading] = useState(true)
  const [weather, setWeather]       = useState<WeatherData | null>(null)

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

  // ── Presensi ──
  const [attendance, setAttendance] = useState(initialAttendance)
  const [attNotes, setAttNotes]     = useState('')
  const [clockLoading, setClockLoading] = useState(false)

  // ── Cuti ──
  const [leaves, setLeaves]           = useState(initialLeaveRequests)
  const [leaveType, setLeaveType]     = useState('Annual Leave')
  const [leaveStart, setLeaveStart]   = useState(new Date().toISOString().split('T')[0])
  const [leaveEnd, setLeaveEnd]       = useState(new Date().toISOString().split('T')[0])
  const [leaveReason, setLeaveReason] = useState('')
  const [leaveLoading, setLeaveLoading] = useState(false)

  // ── Reimburse ──
  const [claims, setClaims]             = useState(initialExpenseClaims)
  const [claimDate, setClaimDate]       = useState(new Date().toISOString().split('T')[0])
  const [claimCategory, setClaimCategory] = useState('Transport')
  const [claimAmount, setClaimAmount]   = useState('')
  const [claimDesc, setClaimDesc]       = useState('')
  const [claimReceiptUrl, setClaimReceiptUrl] = useState('')
  const [claimReceiptPreview, setClaimReceiptPreview] = useState<string | null>(null)
  const [claimLoading, setClaimLoading] = useState(false)
  const [receiptUploading, setReceiptUploading] = useState(false)
  const receiptInputRef = useRef<HTMLInputElement>(null)

  // ── Gaji ──
  const [payslips]         = useState(initialPayslips)
  const [expandedSlip, setExpandedSlip] = useState<string | null>(null)

  useEffect(() => { setAttendance(initialAttendance) }, [initialAttendance])
  useEffect(() => { setLeaves(initialLeaveRequests) },  [initialLeaveRequests])
  useEffect(() => { setClaims(initialExpenseClaims) },  [initialExpenseClaims])

  // Sync edit fields when employee data loads
  useEffect(() => {
    if (employee) {
      setEditFirstName(employee.first_name || '')
      setEditLastName(employee.last_name  || '')
      setEditAvatarUrl(employee.avatar_url || null)
    }
  }, [employee])

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const refresh = () => startTransition(() => router.refresh())

  const today   = new Date().toISOString().split('T')[0]
  const todayAtt = attendance.find((r: any) => r.record_date === today) ?? null

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleClock = async (type: 'IN' | 'OUT') => {
    if (gps.status === 'loading') { showToast('GPS sedang diproses, harap tunggu…', false); return }
    if (gps.status !== 'ok')     { showToast('GPS diperlukan untuk absensi. Izinkan akses lokasi.', false); return }
    setClockLoading(true)
    const res = await clockMyAttendance(orgId, {
      type, notes: attNotes,
      latitude: gps.lat, longitude: gps.lng,
    })
    setClockLoading(false)
    if (res.error) { showToast(res.error, false); return }
    setAttNotes('')
    showToast(type === 'IN' ? 'Clock in berhasil!' : 'Clock out berhasil!', true)
    refresh()
  }

  const handleLeave = async () => {
    const fd = new FormData()
    fd.set('leave_type', leaveType); fd.set('start_date', leaveStart)
    fd.set('end_date', leaveEnd);   fd.set('reason', leaveReason)
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
    fd.set('amount', claimAmount);   fd.set('description', claimDesc)
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

  const handleUploadAvatar = async (file: File) => {
    setEditAvatarPreview(URL.createObjectURL(file))
    setAvatarUploading(true)
    const fd = new FormData(); fd.set('file', file)
    const res = await uploadReceipt(fd)
    setAvatarUploading(false)
    if (!res.success || !res.url) { showToast(res.error || 'Gagal upload foto.', false); return }
    setEditAvatarUrl(res.url)
  }

  const handleUpdateProfile = async () => {
    setEditLoading(true)
    const res = await updateMyEmployeeProfile(orgId, {
      firstName: editFirstName,
      lastName:  editLastName,
      avatarUrl: editAvatarUrl,
    })
    setEditLoading(false)
    if (res.error) { showToast(res.error, false); return }
    showToast('Profil diperbarui!', true)
    setSheet(null)
    refresh()
  }

  const handleChangePassword = async () => {
    if (newPwd.length < 8)          { showToast('Password minimal 8 karakter.', false); return }
    if (newPwd !== confirmPwd)       { showToast('Konfirmasi password tidak cocok.', false); return }
    setPwdLoading(true)
    const res = await updateMyPassword(newPwd)
    setPwdLoading(false)
    if (res.error) { showToast(res.error, false); return }
    showToast('Password berhasil diubah!', true)
    setNewPwd(''); setConfirmPwd('')
    setSheet(null)
  }

  const handleLogout = async () => {
    setLogoutLoading(true)
    await signOut()
    setLogoutLoading(false)
  }

  // ─── Derived UI values ────────────────────────────────────────────────────

  const name      = employee ? `${employee.first_name} ${employee.last_name || ''}`.trim() : userName
  const firstName = name.split(' ')[0] || name
  const initials  = name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase() || 'K'

  const greeting      = getGreeting(now)
  const nextPrayerKey = getNextPrayerKey(prayers, now)

  const clockStr = now.toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZone: 'Asia/Jakarta', hour12: false,
  })
  const dateStr = now.toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'Asia/Jakarta',
  })

  // Time-based sky
  const timeSlot  = getTimeSlot(now.getHours())
  const skyTheme  = SKY_THEMES[timeSlot]

  // Current avatar for display (might be updated during edit)
  const currentAvatarUrl = employee?.avatar_url

  // GPS badge component
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

  // Tab definitions (Presensi handled separately as FAB)
  const SIDE_TABS: { id: Tab; label: string; icon: typeof Home }[] = [
    { id: 'beranda',   label: 'Beranda',   icon: Home },
    { id: 'cuti',      label: 'Cuti',      icon: CalendarDays },
    { id: 'reimburse', label: 'Reimburse', icon: ReceiptText },
    { id: 'gaji',      label: 'Gaji',      icon: Wallet },
  ]

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <div className="max-w-md mx-auto relative min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900">

          <div className="flex-1 overflow-y-auto pb-24">
            <AnimatePresence mode="wait">

              {/* ═══════════════════════════════════════════════════════════
                  BERANDA
              ═══════════════════════════════════════════════════════════ */}
              {tab === 'beranda' && (
                <motion.div key="beranda" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

                  {/* ── COVER — Dynamic Sky ── */}
                  <div className="relative">
                    <div
                      className="relative overflow-hidden px-5 pt-4 pb-16"
                      style={{ background: skyTheme.sky, minHeight: 220 }}
                    >
                      {/* ── Stars (subuh / magrib / malam) ── */}
                      {skyTheme.stars && (
                        <svg
                          viewBox="0 0 100 35"
                          preserveAspectRatio="none"
                          className="absolute inset-0 w-full h-full pointer-events-none z-0"
                          style={{ top: 0, height: '60%' }}
                        >
                          {STARS.map((s, i) => (
                            <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="white" opacity={s.op} />
                          ))}
                        </svg>
                      )}

                      {/* ── Celestial body: Sun or Moon ── */}
                      {skyTheme.celestial && (
                        <div
                          className="absolute pointer-events-none z-0"
                          style={{ left: `${skyTheme.celestial.cx}%`, top: `${skyTheme.celestial.cy}%`, transform: 'translate(-50%, -50%)' }}
                        >
                          {skyTheme.celestial.type === 'sun' ? (
                            /* Sun */
                            <div className="relative flex items-center justify-center">
                              <div className="absolute w-14 h-14 rounded-full bg-yellow-200/20 animate-pulse" />
                              <div className="absolute w-10 h-10 rounded-full bg-yellow-100/30" />
                              <div className="w-7 h-7 rounded-full bg-yellow-100 shadow-[0_0_24px_8px_rgba(255,220,100,0.6)]" />
                            </div>
                          ) : (
                            /* Moon — crescent via clip */
                            <div className="relative w-7 h-7">
                              <div className="w-7 h-7 rounded-full bg-slate-100 shadow-[0_0_16px_4px_rgba(200,210,255,0.5)]" />
                              <div className="absolute top-0 right-0 w-5 h-7 rounded-full" style={{ background: skyTheme.sky.split(',')[0].replace('linear-gradient(to bottom, ', '') }} />
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── City Silhouette ── */}
                      <svg
                        viewBox="0 0 400 100"
                        preserveAspectRatio="none"
                        className="absolute bottom-0 left-0 right-0 w-full pointer-events-none z-10"
                        style={{ height: 100 }}
                      >
                        {/* Buildings */}
                        <path
                          d="M0,100 V75 H8 V65 H15 V75 H25 V50 H33 V38 H38 V28 H42 V38 H47 V50 H58 V75 H70 V58 H78 V45 H85 V58 H95 V75 H108 V60 H115 V48 H120 V35 H123 V22 H126 V35 H129 V48 H134 V60 H142 V75 H155 V52 H162 V40 H167 V24 H171 V14 H175 V24 H179 V40 H184 V52 H192 V75 H205 V60 H212 V48 H219 V60 H225 V75 H237 V55 H245 V42 H250 V30 H254 V20 H258 V30 H262 V42 H267 V55 H275 V75 H288 V62 H296 V50 H303 V62 H309 V75 H322 V65 H329 V55 H336 V65 H342 V75 H355 V70 H362 V62 H369 V70 H375 V75 H388 V80 H400 V100 Z"
                          fill={skyTheme.silhouette}
                        />
                        {/* Lit windows (malam/subuh/magrib) */}
                        {skyTheme.windows && WINDOWS.map((w, i) => (
                          <rect key={i} x={w.x} y={w.y} width={2.5} height={3.5} fill="#ffd580" opacity={0.7 + (i % 3) * 0.1} rx={0.4} />
                        ))}
                        {/* Antenna on tallest building */}
                        <line x1="175" y1="14" x2="175" y2="8" stroke={skyTheme.silhouette} strokeWidth="1.5" />
                        <circle cx="175" cy="7.5" r="1.2" fill={timeSlot === 'malam' || timeSlot === 'subuh' ? '#ff4444' : skyTheme.silhouette} />
                      </svg>

                      {/* ── Text overlay gradient for readability ── */}
                      <div className="absolute inset-0 pointer-events-none z-10"
                        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 55%)' }} />

                      {/* ── Row 1: Org + GPS + Weather + Settings ── */}
                      <div className="flex items-center justify-between mb-4 relative z-20 gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          {orgName && (
                            <div className="flex items-center gap-1">
                              <MapPin size={10} className="text-white/60" />
                              <span className="text-[11px] font-black text-white/70 uppercase tracking-wider">{orgName}</span>
                            </div>
                          )}
                          <GpsBadge />
                        </div>
                        <div className="flex items-center gap-2">
                          {weather ? (
                            <div className="flex items-center gap-1.5 bg-black/25 backdrop-blur-sm border border-white/15 px-3 py-1.5 rounded-2xl">
                              <weather.Icon size={13} className="text-white" />
                              <span className="text-[13px] font-black text-white tabular-nums">{weather.temp}°C</span>
                              <span className="text-[10px] font-bold text-white/70">{weather.label}</span>
                            </div>
                          ) : (
                            <div className="w-24 h-7 bg-white/10 rounded-2xl animate-pulse" />
                          )}
                          <button type="button" onClick={() => setSheet('settings')}
                            className="w-8 h-8 rounded-full bg-black/25 border border-white/15 flex items-center justify-center cursor-pointer hover:bg-black/40 active:scale-95 transition-all">
                            <Settings size={14} className="text-white" />
                          </button>
                        </div>
                      </div>

                      {/* ── Row 2: Jam besar + Tanggal + Greeting ── */}
                      <div className="relative z-20">
                        <p suppressHydrationWarning className="text-[44px] leading-none font-black text-white tracking-tight font-mono tabular-nums drop-shadow-lg">
                          {clockStr}
                        </p>
                        <p suppressHydrationWarning className="text-[11px] text-white/65 font-bold mt-1 tracking-wider capitalize">{dateStr}</p>
                        <p suppressHydrationWarning className="text-[14px] font-black text-white mt-3 drop-shadow">
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
                    <div className="absolute right-5 bottom-0 translate-y-1/2 z-30">
                      <div className="w-20 h-20 rounded-full ring-4 ring-slate-50 dark:ring-slate-900 bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-2xl shadow-xl overflow-hidden">
                        {currentAvatarUrl
                          ? <img src={currentAvatarUrl} alt={name} className="w-full h-full object-cover" />
                          : initials}
                      </div>
                    </div>
                  </div>

                  {/* ── Profile info ── */}
                  <div className="px-5 pt-5 pb-4 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                    <div className="flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <h1 className="text-xl font-black text-slate-900 dark:text-white leading-tight truncate">{name}</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5 truncate">
                          {employee?.job_title || 'Karyawan'}
                          {employee?.branch?.name && <span className="text-slate-400 dark:text-slate-500"> · {employee.branch.name}</span>}
                        </p>
                        {employee?.nik && (
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-bold mt-1 uppercase tracking-wider">
                            NIK: {employee.nik}
                          </p>
                        )}
                      </div>
                      <div className="w-16 shrink-0" />
                    </div>
                  </div>

                  <div className="px-4 pt-4 space-y-4">

                    {/* ═══ PRESENSI CARD — Navigasi ke tab Presensi ═══ */}
                    <button
                      type="button"
                      onClick={() => setTab('presensi')}
                      className="w-full text-left bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-md overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
                    >
                      <div className={`px-5 py-3 flex items-center justify-between ${
                        todayAtt?.check_in && todayAtt?.check_out
                          ? 'bg-emerald-50 dark:bg-emerald-900/30 border-b border-emerald-100 dark:border-emerald-800'
                          : todayAtt?.check_in
                          ? 'bg-sky-50 dark:bg-sky-900/30 border-b border-sky-100 dark:border-sky-800'
                          : 'bg-slate-50 dark:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700'
                      }`}>
                        <div className="flex items-center gap-2">
                          <Fingerprint size={15} className={
                            todayAtt?.check_in && todayAtt?.check_out ? 'text-emerald-600'
                            : todayAtt?.check_in ? 'text-sky-600' : 'text-slate-400'
                          } />
                          <span className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Presensi Hari Ini</span>
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${todayAtt ? statusBadge(todayAtt.status) : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
                          {todayAtt?.status || 'Belum Absen'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-700">
                        {[
                          { label: 'Masuk',  value: todayAtt?.check_in  ? fmt(todayAtt.check_in)  : '--:--', color: 'text-emerald-600' },
                          { label: 'Keluar', value: todayAtt?.check_out ? fmt(todayAtt.check_out) : '--:--', color: 'text-sky-600' },
                        ].map(({ label, value, color }) => (
                          <div key={label} className="py-4 text-center">
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
                            <p className={`text-2xl font-black tabular-nums ${value === '--:--' ? 'text-slate-300 dark:text-slate-600' : color}`}>{value}</p>
                          </div>
                        ))}
                      </div>

                      <div className={`px-5 py-3.5 flex items-center justify-center gap-2 ${
                        todayAtt?.check_in && todayAtt?.check_out ? 'bg-emerald-500'
                        : todayAtt?.check_in ? 'bg-sky-500'
                        : 'bg-gradient-to-r from-blue-600 to-indigo-600'
                      }`}>
                        {todayAtt?.check_in && todayAtt?.check_out ? (
                          <><CheckCircle2 size={16} className="text-white" strokeWidth={2.5} /><span className="text-[12px] font-black uppercase tracking-widest text-white">Absensi Selesai</span></>
                        ) : todayAtt?.check_in ? (
                          <><LogOut size={16} className="text-white" strokeWidth={2.5} /><span className="text-[12px] font-black uppercase tracking-widest text-white">Absen Keluar →</span></>
                        ) : (
                          <><Fingerprint size={16} className="text-white" strokeWidth={2.5} /><span className="text-[12px] font-black uppercase tracking-widest text-white">Absen Sekarang →</span></>
                        )}
                      </div>
                    </button>

                    {/* ── Jadwal Sholat ── */}
                    <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
                      <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-slate-50 dark:border-slate-700">
                        <div className="flex items-center gap-2">
                          <Moon size={15} className="text-indigo-500" />
                          <p className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Jadwal Sholat</p>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                          {gps.status === 'ok' ? `${gps.lat.toFixed(2)}°, ${gps.lng.toFixed(2)}°` : 'Jakarta · WIB'}
                        </p>
                      </div>

                      {prayerLoading ? (
                        <div className="px-5 py-5 space-y-3">
                          {[...Array(5)].map((_, i) => (
                            <div key={i} className="flex items-center justify-between">
                              <div className="h-3 w-16 bg-slate-100 dark:bg-slate-700 rounded-full animate-pulse" />
                              <div className="h-3 w-10 bg-slate-100 dark:bg-slate-700 rounded-full animate-pulse" />
                            </div>
                          ))}
                        </div>
                      ) : prayers.length === 0 ? (
                        <p className="px-5 py-5 text-center text-xs text-slate-400 font-bold">Jadwal tidak tersedia</p>
                      ) : (
                        <div className="divide-y divide-slate-50 dark:divide-slate-700">
                          {prayers.map((p, i) => {
                            const isNext = p.key === nextPrayerKey
                            const nextIdx = prayers.findIndex(x => x.key === nextPrayerKey)
                            const isPast  = nextIdx >= 0 ? i < nextIdx : true
                            return (
                              <div key={p.key} className={`px-5 py-3 flex items-center justify-between ${isNext ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''}`}>
                                <div className="flex items-center gap-3">
                                  {isNext
                                    ? <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.7)] animate-pulse" />
                                    : isPast
                                    ? <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                                    : <div className="w-2 h-2 rounded-full border-2 border-slate-200 dark:border-slate-600" />
                                  }
                                  <span className={`text-sm font-bold ${isNext ? 'text-indigo-700 dark:text-indigo-300' : isPast ? 'text-slate-400 dark:text-slate-600' : 'text-slate-700 dark:text-slate-300'}`}>
                                    {p.name}
                                  </span>
                                  {isNext && (
                                    <span className="text-[9px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                                      Berikutnya
                                    </span>
                                  )}
                                </div>
                                <span className={`text-sm font-black tabular-nums ${isNext ? 'text-indigo-700 dark:text-indigo-300' : isPast ? 'text-slate-400 dark:text-slate-600' : 'text-slate-700 dark:text-slate-300'}`}>
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
                        { label: 'Pengajuan Cuti', tab: 'cuti'      as Tab, Icon: CalendarDays, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/40' },
                        { label: 'Reimburse',      tab: 'reimburse' as Tab, Icon: ReceiptText,  color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/40' },
                        { label: 'Slip Gaji',      tab: 'gaji'      as Tab, Icon: Wallet,       color: 'text-violet-600 bg-violet-50 dark:bg-violet-900/40' },
                      ].map(({ label, tab: t, Icon, color }) => (
                        <button key={t} type="button" onClick={() => setTab(t)}
                          className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-4 flex flex-col items-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 transition-all">
                          <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
                            <Icon size={18} />
                          </div>
                          <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 text-center leading-tight">{label}</span>
                        </button>
                      ))}
                    </div>

                  </div>
                </motion.div>
              )}

              {/* ═══ PRESENSI tab ═══ */}
              {tab === 'presensi' && (
                <motion.div key="presensi" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4 px-4 pt-5">

                  <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">Hari Ini</p>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      {[
                        { label: 'Status', value: todayAtt?.status || '—' },
                        { label: 'Masuk',  value: todayAtt?.check_in  ? fmt(todayAtt.check_in)  : '--:--' },
                        { label: 'Keluar', value: todayAtt?.check_out ? fmt(todayAtt.check_out) : '--:--' },
                      ].map(({ label, value }) => (
                        <div key={label} className="rounded-2xl bg-slate-50 dark:bg-slate-700 border border-slate-100 dark:border-slate-600 px-3 py-3 text-center">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">{label}</p>
                          <p className="text-sm font-black text-slate-900 dark:text-white leading-tight">{value}</p>
                        </div>
                      ))}
                    </div>

                    {gps.status === 'error' && (
                      <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-900/30 border border-rose-100 dark:border-rose-800 rounded-2xl px-4 py-2.5 mb-3">
                        <AlertTriangle size={14} className="text-rose-500 shrink-0" />
                        <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400">{gps.msg}</p>
                      </div>
                    )}
                    {gps.status === 'ok' && (
                      <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800 rounded-2xl px-4 py-2 mb-3">
                        <LocateFixed size={13} className="text-emerald-500 shrink-0" />
                        <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          GPS · {gps.lat.toFixed(4)}, {gps.lng.toFixed(4)}
                        </p>
                      </div>
                    )}

                    <textarea
                      value={attNotes}
                      onChange={e => setAttNotes(e.target.value)}
                      placeholder="Catatan (opsional)…"
                      rows={2}
                      className={`${inputCls} resize-none mb-3`}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <button type="button"
                        disabled={clockLoading || !!todayAtt?.check_in || gps.status !== 'ok'}
                        onClick={() => handleClock('IN')}
                        className="flex flex-col items-center justify-center gap-1.5 py-5 rounded-2xl bg-emerald-500 text-white font-black text-sm disabled:opacity-40 active:scale-95 transition-all cursor-pointer hover:bg-emerald-600 shadow-lg shadow-emerald-200 dark:shadow-none"
                      >
                        {clockLoading ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <LogIn size={22} strokeWidth={2.5} />}
                        <span className="text-[12px] font-black uppercase tracking-widest">Clock In</span>
                      </button>
                      <button type="button"
                        disabled={clockLoading || !todayAtt?.check_in || !!todayAtt?.check_out || gps.status !== 'ok'}
                        onClick={() => handleClock('OUT')}
                        className="flex flex-col items-center justify-center gap-1.5 py-5 rounded-2xl bg-sky-500 text-white font-black text-sm disabled:opacity-40 active:scale-95 transition-all cursor-pointer hover:bg-sky-600 shadow-lg shadow-sky-200 dark:shadow-none"
                      >
                        {clockLoading ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <LogOut size={22} strokeWidth={2.5} />}
                        <span className="text-[12px] font-black uppercase tracking-widest">Clock Out</span>
                      </button>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">Riwayat 14 Hari</p>
                    {attendance.length === 0
                      ? <p className="text-sm text-slate-400 text-center py-4">Belum ada riwayat.</p>
                      : <div className="space-y-2">
                        {attendance.map((r: any) => (
                          <div key={r.id} className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-slate-700 last:border-0">
                            <div>
                              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{fmtDate(r.record_date)}</p>
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
                  <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Ajukan Cuti</p>
                    <select value={leaveType} onChange={e => setLeaveType(e.target.value)} className={inputCls}>
                      {['Annual Leave','Sick Leave','Emergency Leave','Unpaid Leave','Maternity Leave'].map(t => <option key={t}>{t}</option>)}
                    </select>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 block mb-1.5 ml-1">Mulai</label>
                        <input type="date" value={leaveStart} onChange={e => setLeaveStart(e.target.value)} className={inputCls} />
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 block mb-1.5 ml-1">Selesai</label>
                        <input type="date" value={leaveEnd} onChange={e => setLeaveEnd(e.target.value)} className={inputCls} />
                      </div>
                    </div>
                    <textarea value={leaveReason} onChange={e => setLeaveReason(e.target.value)} placeholder="Alasan pengajuan cuti…" rows={3} className={`${inputCls} resize-none`} />
                    <button type="button" disabled={leaveLoading || !leaveReason.trim()} onClick={handleLeave}
                      className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-blue-600 text-white font-black text-sm disabled:opacity-40 active:scale-95 transition-all cursor-pointer hover:bg-blue-700">
                      {leaveLoading ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <CalendarDays size={16} />}
                      Kirim Pengajuan
                    </button>
                  </div>
                  <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">Riwayat Cuti</p>
                    {leaves.length === 0
                      ? <p className="text-sm text-slate-400 text-center py-4">Belum ada pengajuan.</p>
                      : <div className="space-y-2">{leaves.map((l: any) => (
                        <div key={l.id} className="py-3 border-b border-slate-50 dark:border-slate-700 last:border-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs font-black text-slate-800 dark:text-slate-200">{l.leave_type}</p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{fmtDate(l.start_date)} – {fmtDate(l.end_date)}</p>
                              {l.reason && <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-1">{l.reason}</p>}
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
                  <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Klaim Reimburse</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 block mb-1.5 ml-1">Tanggal</label>
                        <input type="date" value={claimDate} onChange={e => setClaimDate(e.target.value)} className={inputCls} />
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 block mb-1.5 ml-1">Kategori</label>
                        <select value={claimCategory} onChange={e => setClaimCategory(e.target.value)} className={inputCls}>
                          {['Transport','Meal','Accommodation','Medical','Communication','Others'].map(c => <option key={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>
                    <input type="number" value={claimAmount} onChange={e => setClaimAmount(e.target.value)} placeholder="Jumlah (Rp)" className={inputCls} />
                    <textarea value={claimDesc} onChange={e => setClaimDesc(e.target.value)} placeholder="Deskripsi pengeluaran…" rows={2} className={`${inputCls} resize-none`} />
                    <input ref={receiptInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadReceipt(f) }} />
                    <button type="button" onClick={() => receiptInputRef.current?.click()}
                      className="w-full py-3 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-600 flex items-center justify-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors cursor-pointer">
                      {receiptUploading ? <div className="w-4 h-4 border-2 border-slate-400/40 border-t-slate-400 rounded-full animate-spin" /> : <ImageIcon size={16} />}
                      {claimReceiptUrl ? 'Ganti Nota' : receiptUploading ? 'Mengupload…' : 'Upload Nota'}
                    </button>
                    {claimReceiptPreview && <img src={claimReceiptPreview} alt="nota" className="w-full h-28 object-cover rounded-2xl border border-slate-100 dark:border-slate-700" />}
                    <button type="button" disabled={claimLoading || !claimAmount || !claimDesc} onClick={handleClaim}
                      className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-emerald-600 text-white font-black text-sm disabled:opacity-40 active:scale-95 transition-all cursor-pointer hover:bg-emerald-700">
                      {claimLoading ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <ReceiptText size={16} />}
                      Kirim Klaim
                    </button>
                  </div>
                  <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">Riwayat Klaim</p>
                    {claims.length === 0
                      ? <p className="text-sm text-slate-400 text-center py-4">Belum ada klaim.</p>
                      : <div className="space-y-2">{claims.map((c: any) => (
                        <div key={c.id} className="py-3 border-b border-slate-50 dark:border-slate-700 last:border-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs font-black text-slate-800 dark:text-slate-200">{c.category} — {formatRupiah(c.amount)}</p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{fmtDate(c.claim_date)}</p>
                              {c.description && <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-1">{c.description}</p>}
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
                    <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-10 text-center shadow-sm">
                      <Wallet size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                      <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Belum ada slip gaji.</p>
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
                        <div key={slip.id} className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
                          <button type="button" onClick={() => setExpandedSlip(isOpen ? null : slip.id)}
                            className="w-full flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                            <div className="text-left">
                              <p className="text-sm font-black text-slate-900 dark:text-white">{period}</p>
                              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-0.5">Take Home: {formatRupiah(slip.net_salary)}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${slip.payment_status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{slip.payment_status}</span>
                              {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                            </div>
                          </button>
                          {isOpen && (
                            <div className="border-t border-slate-100 dark:border-slate-700 px-5 py-4 space-y-4">
                              <div className="grid grid-cols-2 gap-3 text-center">
                                {[
                                  { label: 'Gaji Pokok', value: formatRupiah(slip.basic_salary),     color: 'text-slate-900 dark:text-white' },
                                  { label: 'Bruto',       value: formatRupiah(slip.gross_salary),     color: 'text-blue-700 dark:text-blue-400' },
                                  { label: 'Potongan',    value: formatRupiah(slip.total_deductions), color: 'text-rose-600' },
                                  { label: 'Take Home',   value: formatRupiah(slip.net_salary),       color: 'text-emerald-600' },
                                ].map(({ label, value, color }) => (
                                  <div key={label} className="bg-slate-50 dark:bg-slate-700 rounded-2xl p-3">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">{label}</p>
                                    <p className={`text-sm font-black ${color}`}>{value}</p>
                                  </div>
                                ))}
                              </div>
                              {earnings.length > 0 && (
                                <div>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1.5">Pendapatan</p>
                                  {earnings.map((l: any) => (
                                    <div key={l.id} className="flex justify-between py-1.5 border-b border-slate-50 dark:border-slate-700 last:border-0">
                                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{l.component_name}</p>
                                      <p className="text-xs font-black text-emerald-600">+{formatRupiah(l.amount)}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {deductions.length > 0 && (
                                <div>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-rose-600 mb-1.5">Potongan</p>
                                  {deductions.map((l: any) => (
                                    <div key={l.id} className="flex justify-between py-1.5 border-b border-slate-50 dark:border-slate-700 last:border-0">
                                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{l.component_name}</p>
                                      <p className="text-xs font-black text-rose-600">-{formatRupiah(l.amount)}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="flex justify-between items-center pt-2 border-t-2 border-slate-200 dark:border-slate-600">
                                <p className="text-sm font-black text-slate-900 dark:text-white">Take Home Pay</p>
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
          <div className="fixed bottom-0 left-0 right-0 z-50 safe-area-pb">
            <div className="relative bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
              <div className="max-w-md mx-auto relative">

                {/* FAB Presensi */}
                <div className="absolute left-1/2 -translate-x-1/2 -top-8 flex flex-col items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => setTab('presensi')}
                    className={`w-[58px] h-[58px] rounded-full flex items-center justify-center shadow-xl transition-all cursor-pointer active:scale-95 ${
                      tab === 'presensi'
                        ? 'bg-blue-600 shadow-blue-400/50 scale-[1.07]'
                        : 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-indigo-300/50 hover:scale-105'
                    }`}
                  >
                    <Fingerprint size={26} className="text-white" strokeWidth={tab === 'presensi' ? 2.5 : 2} />
                  </button>
                </div>

                <div className="flex h-16">
                  {SIDE_TABS.slice(0, 2).map(({ id, label, icon: Icon }) => {
                    const active = tab === id
                    return (
                      <button key={id} type="button" onClick={() => setTab(id)}
                        className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${active ? 'text-blue-600' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400'}`}>
                        <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                        <span className="text-[9px] font-black uppercase tracking-wide">{label}</span>
                        {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-600 rounded-full" />}
                      </button>
                    )
                  })}

                  <div className="flex-1 flex flex-col items-center justify-end pb-1.5">
                    <span className={`text-[9px] font-black uppercase tracking-wide ${tab === 'presensi' ? 'text-blue-600' : 'text-slate-400 dark:text-slate-500'}`}>
                      Presensi
                    </span>
                  </div>

                  {SIDE_TABS.slice(2).map(({ id, label, icon: Icon }) => {
                    const active = tab === id
                    return (
                      <button key={id} type="button" onClick={() => setTab(id)}
                        className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${active ? 'text-blue-600' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400'}`}>
                        <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                        <span className="text-[9px] font-black uppercase tracking-wide">{label}</span>
                        {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-600 rounded-full" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════
              SHEETS — Settings / Edit Profil / Ganti Password
          ══════════════════════════════════════════════════════ */}
          <AnimatePresence>
            {sheet && (
              <>
                {/* Backdrop */}
                <motion.div
                  key="backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm"
                  onClick={() => setSheet(null)}
                />

                {/* ── Settings Sheet ── */}
                {sheet === 'settings' && (
                  <motion.div
                    key="sheet-settings"
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                    className="fixed bottom-0 left-0 right-0 z-[210] max-w-md mx-auto"
                  >
                    <div className="bg-white dark:bg-slate-800 rounded-t-3xl shadow-2xl pb-safe">
                      {/* Handle */}
                      <div className="flex justify-center pt-3 pb-1">
                        <div className="w-10 h-1 bg-slate-200 dark:bg-slate-600 rounded-full" />
                      </div>

                      <div className="px-5 pb-8 pt-2">
                        <div className="flex items-center justify-between mb-5">
                          <h2 className="text-lg font-black text-slate-900 dark:text-white">Pengaturan</h2>
                          <button type="button" onClick={() => setSheet(null)} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                            <X size={16} className="text-slate-600 dark:text-slate-300" />
                          </button>
                        </div>

                        <div className="space-y-2">
                          {/* Dark mode toggle */}
                          <div className="flex items-center justify-between px-4 py-3.5 rounded-2xl bg-slate-50 dark:bg-slate-700">
                            <div className="flex items-center gap-3">
                              {darkMode
                                ? <Moon size={18} className="text-indigo-500" />
                                : <Sun  size={18} className="text-amber-500" />
                              }
                              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                {darkMode ? 'Mode Gelap' : 'Mode Terang'}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={toggleDarkMode}
                              className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${darkMode ? 'bg-indigo-600' : 'bg-slate-300'}`}
                            >
                              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${darkMode ? 'translate-x-6' : ''}`} />
                            </button>
                          </div>

                          {/* Edit Profil */}
                          <button type="button" onClick={() => setSheet('edit-profile')}
                            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors cursor-pointer">
                            <User size={18} className="text-blue-500" />
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Edit Profil</span>
                            <ChevronDown size={16} className="text-slate-400 ml-auto -rotate-90" />
                          </button>

                          {/* Ganti Password */}
                          <button type="button" onClick={() => setSheet('change-password')}
                            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors cursor-pointer">
                            <Lock size={18} className="text-emerald-500" />
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Ganti Password</span>
                            <ChevronDown size={16} className="text-slate-400 ml-auto -rotate-90" />
                          </button>

                          {/* Logout */}
                          <button type="button" onClick={handleLogout} disabled={logoutLoading}
                            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-rose-50 dark:bg-rose-900/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors cursor-pointer disabled:opacity-60">
                            {logoutLoading
                              ? <div className="w-[18px] h-[18px] border-2 border-rose-400/40 border-t-rose-500 rounded-full animate-spin" />
                              : <LogOut size={18} className="text-rose-500" />
                            }
                            <span className="text-sm font-bold text-rose-600 dark:text-rose-400">Keluar</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ── Edit Profil Sheet ── */}
                {sheet === 'edit-profile' && (
                  <motion.div
                    key="sheet-edit"
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                    className="fixed bottom-0 left-0 right-0 z-[210] max-w-md mx-auto"
                  >
                    <div className="bg-white dark:bg-slate-800 rounded-t-3xl shadow-2xl pb-safe">
                      <div className="flex justify-center pt-3 pb-1">
                        <div className="w-10 h-1 bg-slate-200 dark:bg-slate-600 rounded-full" />
                      </div>

                      <div className="px-5 pb-8 pt-2">
                        <div className="flex items-center gap-3 mb-5">
                          <button type="button" onClick={() => setSheet('settings')} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                            <ChevronDown size={16} className="text-slate-600 dark:text-slate-300 rotate-90" />
                          </button>
                          <h2 className="text-lg font-black text-slate-900 dark:text-white">Edit Profil</h2>
                        </div>

                        {/* Avatar picker */}
                        <div className="flex flex-col items-center mb-6">
                          <div className="relative">
                            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-2xl overflow-hidden ring-4 ring-slate-100 dark:ring-slate-700">
                              {(editAvatarPreview || editAvatarUrl)
                                ? <img src={editAvatarPreview || editAvatarUrl!} alt="avatar" className="w-full h-full object-cover" />
                                : initials
                              }
                            </div>
                            <button type="button" onClick={() => avatarInputRef.current?.click()}
                              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shadow-lg cursor-pointer hover:bg-blue-700 transition-colors active:scale-95">
                              {avatarUploading
                                ? <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                : <Camera size={14} className="text-white" />
                              }
                            </button>
                          </div>
                          <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadAvatar(f) }} />
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2">Tap kamera untuk ganti foto</p>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 block mb-1.5 ml-1">Nama Depan</label>
                            <input value={editFirstName} onChange={e => setEditFirstName(e.target.value)} placeholder="Nama depan" className={inputCls} />
                          </div>
                          <div>
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 block mb-1.5 ml-1">Nama Belakang</label>
                            <input value={editLastName} onChange={e => setEditLastName(e.target.value)} placeholder="Nama belakang (opsional)" className={inputCls} />
                          </div>
                          <button type="button" disabled={editLoading || !editFirstName.trim()} onClick={handleUpdateProfile}
                            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-blue-600 text-white font-black text-sm disabled:opacity-40 active:scale-95 transition-all cursor-pointer hover:bg-blue-700 mt-2">
                            {editLoading ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <User size={16} />}
                            Simpan Profil
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ── Ganti Password Sheet ── */}
                {sheet === 'change-password' && (
                  <motion.div
                    key="sheet-pwd"
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                    className="fixed bottom-0 left-0 right-0 z-[210] max-w-md mx-auto"
                  >
                    <div className="bg-white dark:bg-slate-800 rounded-t-3xl shadow-2xl pb-safe">
                      <div className="flex justify-center pt-3 pb-1">
                        <div className="w-10 h-1 bg-slate-200 dark:bg-slate-600 rounded-full" />
                      </div>

                      <div className="px-5 pb-8 pt-2">
                        <div className="flex items-center gap-3 mb-5">
                          <button type="button" onClick={() => setSheet('settings')} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                            <ChevronDown size={16} className="text-slate-600 dark:text-slate-300 rotate-90" />
                          </button>
                          <h2 className="text-lg font-black text-slate-900 dark:text-white">Ganti Password</h2>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 block mb-1.5 ml-1">Password Baru</label>
                            <div className="relative">
                              <input
                                type={showNewPwd ? 'text' : 'password'}
                                value={newPwd}
                                onChange={e => setNewPwd(e.target.value)}
                                placeholder="Minimal 8 karakter"
                                className={inputCls}
                              />
                              <button type="button" onClick={() => setShowNewPwd(v => !v)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-300">
                                {showNewPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 block mb-1.5 ml-1">Konfirmasi Password</label>
                            <div className="relative">
                              <input
                                type={showConPwd ? 'text' : 'password'}
                                value={confirmPwd}
                                onChange={e => setConfirmPwd(e.target.value)}
                                placeholder="Ulangi password baru"
                                className={inputCls}
                              />
                              <button type="button" onClick={() => setShowConPwd(v => !v)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-300">
                                {showConPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                            </div>
                          </div>
                          {newPwd && confirmPwd && newPwd !== confirmPwd && (
                            <p className="text-[11px] text-rose-500 font-bold ml-1">Password tidak cocok</p>
                          )}
                          <button type="button"
                            disabled={pwdLoading || newPwd.length < 8 || newPwd !== confirmPwd}
                            onClick={handleChangePassword}
                            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-emerald-600 text-white font-black text-sm disabled:opacity-40 active:scale-95 transition-all cursor-pointer hover:bg-emerald-700 mt-2">
                            {pwdLoading ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Lock size={16} />}
                            Simpan Password
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </>
            )}
          </AnimatePresence>

          {/* ── Toast ── */}
          <AnimatePresence>
            {toast && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-2 px-5 py-3 rounded-2xl shadow-xl text-white text-sm font-black max-w-xs w-auto ${toast.ok ? 'bg-emerald-600' : 'bg-rose-600'}`}
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
