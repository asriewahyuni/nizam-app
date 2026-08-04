'use client'

/**
 * Client component for course participant management:
 * stats cards, search/filter, table, ban/unban, reset progress,
 * override completion date, bulk add via member search, export, send reminder.
 */
import React, { useState, useTransition, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Users, Search, Filter, ArrowUpDown, ChevronLeft, ChevronRight,
  FileSpreadsheet, UserPlus, ShieldOff, Shield, RotateCcw, Calendar,
  CheckCircle2, Clock, AlertTriangle, TrendingUp, Activity, Award,
  Mail, X, Loader2, ChevronDown, BookOpen, MoreVertical,
} from 'lucide-react'
import {
  CourseParticipant, CourseParticipantStats, OrgMemberOption,
  banParticipant, unbanParticipant, resetParticipantProgress,
  overrideCompletionDate, bulkAddParticipants, searchOrgMembersForCourse,
  sendCourseReminder,
} from '@/modules/edu/actions/lms-members.actions'

// ── Types ────────────────────────────────────────────────────────────────────

interface InitialData {
  participants: CourseParticipant[]
  stats: CourseParticipantStats
  totalCount: number
  totalPages: number
  batchOptions: { id: string; name: string }[]
}

interface InitialFilters {
  search: string
  status: 'ALL' | 'ACTIVE' | 'COMPLETED' | 'BANNED'
  batchId: string
  sortBy: string
  page: number
}

interface Props {
  courseSlug: string
  courseTitle: string
  initialData: InitialData
  initialFilters: InitialFilters
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: string | null | undefined) {
  if (!v) return '—'
  const d = new Date(v)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value))
  const color = pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-indigo-500' : 'bg-amber-400'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold tabular-nums text-slate-600">{pct}%</span>
    </div>
  )
}

function StatusChip({ p }: { p: CourseParticipant }) {
  if (p.bannedAt)
    return <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-[10px] font-bold text-red-700 ring-1 ring-inset ring-red-200"><ShieldOff className="h-3 w-3" />Banned</span>
  if (p.completedAt)
    return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200"><CheckCircle2 className="h-3 w-3" />Selesai</span>
  return <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700 ring-1 ring-inset ring-indigo-200"><Clock className="h-3 w-3" />Aktif</span>
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string
}) {
  return (
    <div className={`rounded-2xl border ${color} bg-white p-5 shadow-sm`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
        </div>
        <div className="rounded-xl bg-slate-50 p-2.5">{icon}</div>
      </div>
    </div>
  )
}

// ── Row Action Menu ───────────────────────────────────────────────────────────

function RowActionMenu({
  participant,
  onBan, onUnban, onReset, onOverride, onRemind,
}: {
  participant: CourseParticipant
  onBan: (p: CourseParticipant) => void
  onUnban: (p: CourseParticipant) => void
  onReset: (p: CourseParticipant) => void
  onOverride: (p: CourseParticipant) => void
  onRemind: (p: CourseParticipant) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(v => !v)}
        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 min-w-[176px] rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg ring-1 ring-slate-900/5">
            {participant.bannedAt ? (
              <button onClick={() => { setOpen(false); onUnban(participant) }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer">
                <Shield className="h-3.5 w-3.5" /> Unban Peserta
              </button>
            ) : (
              <button onClick={() => { setOpen(false); onBan(participant) }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 transition-colors cursor-pointer">
                <ShieldOff className="h-3.5 w-3.5" /> Ban Peserta
              </button>
            )}
            <button onClick={() => { setOpen(false); onReset(participant) }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer">
              <RotateCcw className="h-3.5 w-3.5" /> Reset Progress
            </button>
            <button onClick={() => { setOpen(false); onOverride(participant) }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer">
              <Calendar className="h-3.5 w-3.5" /> Override Tgl Selesai
            </button>
            <div className="my-1 border-t border-slate-100" />
            <button onClick={() => { setOpen(false); onRemind(participant) }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 transition-colors cursor-pointer">
              <Mail className="h-3.5 w-3.5" /> Kirim Pengingat
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Ban Confirm Modal ─────────────────────────────────────────────────────────

function BanModal({ p, onConfirm, onClose, isPending }: {
  p: CourseParticipant; onConfirm: (reason: string) => void; onClose: () => void; isPending: boolean
}) {
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-4">
          <ShieldOff className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-center text-lg font-bold text-slate-900 mb-1">Ban Peserta?</h3>
        <p className="text-center text-sm text-slate-500 mb-4">
          <strong>{p.name}</strong> tidak bisa mengakses kursus ini. Progress tetap tersimpan.
        </p>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Alasan (opsional)</label>
        <input
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="mis. melanggar ketentuan..."
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-red-400 focus:outline-none mb-4"
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer">Batal</button>
          <button onClick={() => onConfirm(reason)} disabled={isPending}
            className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors cursor-pointer">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Ya, Ban'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Override Completion Modal ─────────────────────────────────────────────────

function OverrideModal({ p, onConfirm, onClose, isPending }: {
  p: CourseParticipant; onConfirm: (date: string) => void; onClose: () => void; isPending: boolean
}) {
  const [date, setDate] = useState(p.completedAt ? p.completedAt.slice(0, 10) : new Date().toISOString().slice(0, 10))
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-1">Override Tanggal Selesai</h3>
        <p className="text-sm text-slate-500 mb-4">Set tanggal selesai manual untuk <strong>{p.name}</strong>. Status akan berubah menjadi COMPLETED.</p>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Tanggal Selesai</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none mb-4" />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer">Batal</button>
          <button onClick={() => onConfirm(date)} disabled={isPending || !date}
            className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors cursor-pointer">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Bulk Add Modal ────────────────────────────────────────────────────────────

function BulkAddModal({ courseSlug, onClose, onSuccess }: {
  courseSlug: string; onClose: () => void; onSuccess: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<OrgMemberOption[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [searching, setSearching] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<string | null>(null)

  const handleSearch = useCallback(async (q: string) => {
    setQuery(q)
    if (!q.trim()) { setResults([]); return }
    setSearching(true)
    const res = await searchOrgMembersForCourse(courseSlug, q)
    setResults(res.members)
    setSearching(false)
  }, [courseSlug])

  const toggleSelect = (userId: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId); else next.add(userId)
      return next
    })
  }

  const handleAdd = () => {
    startTransition(async () => {
      const res = await bulkAddParticipants(courseSlug, Array.from(selected))
      if (res.error) { setFeedback('❌ ' + res.error); return }
      setFeedback(`✓ ${res.added} peserta ditambahkan${res.skipped ? `, ${res.skipped} sudah terdaftar` : ''}`)
      setTimeout(() => { onSuccess(); onClose() }, 1500)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 flex items-center gap-2"><UserPlus className="h-4 w-4 text-indigo-500" />Tambah Peserta</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Cari nama atau email anggota..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
            />
            {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />}
          </div>
        </div>
        <div className="overflow-y-auto flex-1 min-h-[160px]">
          {results.length === 0 && query.trim() && !searching && (
            <p className="p-6 text-center text-sm text-slate-400">Tidak ada anggota ditemukan</p>
          )}
          {results.length === 0 && !query.trim() && (
            <p className="p-6 text-center text-sm text-slate-400">Ketik nama atau email untuk mencari anggota</p>
          )}
          {results.map(m => (
            <label key={m.userId} className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-slate-50 ${m.alreadyEnrolled ? 'opacity-40' : ''}`}>
              <input
                type="checkbox"
                disabled={m.alreadyEnrolled}
                checked={selected.has(m.userId)}
                onChange={() => toggleSelect(m.userId)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 accent-indigo-600"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{m.name}</p>
                <p className="text-xs text-slate-500 truncate">{m.email}</p>
              </div>
              {m.alreadyEnrolled && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Terdaftar</span>
              )}
            </label>
          ))}
        </div>
        {feedback && (
          <div className="px-4 py-2 text-xs font-semibold text-center text-slate-600 bg-slate-50">{feedback}</div>
        )}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-100">
          <span className="text-xs text-slate-500">{selected.size} dipilih</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer">Batal</button>
            <button onClick={handleAdd} disabled={selected.size === 0 || isPending}
              className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-2">
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Tambahkan ({selected.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Client Component ─────────────────────────────────────────────────────

export function CourseParticipantsClient({ courseSlug, courseTitle, initialData, initialFilters }: Props) {
  const router = useRouter()
  const sp = useSearchParams()

  const [isPending, startTransition] = useTransition()
  const [actionTarget, setActionTarget] = useState<CourseParticipant | null>(null)
  const [modal, setModal] = useState<'ban' | 'override' | 'bulk' | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ── URL-driven navigation ──
  const pushFilter = (key: string, value: string) => {
    const params = new URLSearchParams(sp.toString())
    params.set(key, value)
    if (key !== 'page') params.set('page', '1')
    router.push(`?${params.toString()}`)
  }

  // ── Actions ──
  const handleBanConfirm = (reason: string) => {
    if (!actionTarget) return
    startTransition(async () => {
      const res = await banParticipant(actionTarget.enrollmentId, reason)
      setModal(null); setActionTarget(null)
      if (res.error) showToast('❌ ' + res.error, 'err')
      else { showToast('✓ Peserta berhasil di-ban'); router.refresh() }
    })
  }

  const handleUnban = (p: CourseParticipant) => {
    startTransition(async () => {
      const res = await unbanParticipant(p.enrollmentId)
      if (res.error) showToast('❌ ' + res.error, 'err')
      else { showToast('✓ Peserta berhasil di-unban'); router.refresh() }
    })
  }

  const handleReset = (p: CourseParticipant) => {
    if (!confirm(`Reset progress ${p.name}? Semua lesson progress akan dihapus.`)) return
    startTransition(async () => {
      const res = await resetParticipantProgress(p.enrollmentId)
      if (res.error) showToast('❌ ' + res.error, 'err')
      else { showToast('✓ Progress berhasil di-reset'); router.refresh() }
    })
  }

  const handleOverrideConfirm = (date: string) => {
    if (!actionTarget) return
    startTransition(async () => {
      const res = await overrideCompletionDate(actionTarget.enrollmentId, date)
      setModal(null); setActionTarget(null)
      if (res.error) showToast('❌ ' + res.error, 'err')
      else { showToast('✓ Tanggal selesai berhasil diupdate'); router.refresh() }
    })
  }

  const handleRemind = (p: CourseParticipant) => {
    startTransition(async () => {
      const res = await sendCourseReminder([p.enrollmentId])
      if (res.error) showToast('❌ ' + res.error, 'err')
      else showToast(`✓ Pengingat terkirim ke ${p.name}`)
    })
  }

  const { participants, stats, totalCount, totalPages, batchOptions } = initialData
  const { search, status, batchId, sortBy, page } = initialFilters

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 rounded-2xl px-5 py-3 text-sm font-semibold shadow-lg text-white transition-all ${toast.type === 'ok' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
            <Link href="/lms/admin" className="hover:text-indigo-600 transition-colors cursor-pointer">Catalog</Link>
            <ChevronRight className="h-3 w-3" />
            <Link href={`/lms/admin/course/${courseSlug}`} className="hover:text-indigo-600 transition-colors cursor-pointer">{courseTitle}</Link>
            <ChevronRight className="h-3 w-3" />
            Peserta
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Peserta Kursus</h1>
          <p className="mt-1 text-sm text-slate-500">{courseTitle}</p>
        </div>
        <div className="flex gap-2">
          <a
            href={`/api/lms/export?type=participants&courseSlug=${courseSlug}&status=${status}`}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-all cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Export XLSX
          </a>
          <button
            onClick={() => setModal('bulk')}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 transition-all cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            Tambah Peserta
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
        <StatCard icon={<Users className="h-5 w-5 text-slate-500" />} label="Total" value={stats.total} color="border-slate-200" />
        <StatCard icon={<Activity className="h-5 w-5 text-indigo-500" />} label="Aktif" value={stats.active} color="border-indigo-200" />
        <StatCard icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />} label="Selesai" value={stats.completed} color="border-emerald-200" />
        <StatCard icon={<ShieldOff className="h-5 w-5 text-red-500" />} label="Dibanned" value={stats.banned} color="border-red-200" />
        <StatCard icon={<TrendingUp className="h-5 w-5 text-amber-500" />} label="Rata Progress" value={`${stats.avgProgress}%`} color="border-amber-200" />
        <StatCard icon={<Award className="h-5 w-5 text-purple-500" />} label="Rata Skor" value={stats.avgScore || '—'} color="border-purple-200" />
        <StatCard icon={<Activity className="h-5 w-5 text-teal-500" />} label="Aktif 7 Hari" value={stats.activeThisWeek} sub="peserta" color="border-teal-200" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama atau email..."
            defaultValue={search}
            onKeyDown={e => { if (e.key === 'Enter') pushFilter('search', (e.target as HTMLInputElement).value) }}
            onBlur={e => pushFilter('search', e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-10 pr-4 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <select
            value={status}
            onChange={e => pushFilter('status', e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs font-semibold text-slate-700 focus:border-indigo-500 focus:outline-none cursor-pointer"
          >
            <option value="ALL">Semua Status</option>
            <option value="ACTIVE">Aktif</option>
            <option value="COMPLETED">Selesai</option>
            <option value="BANNED">Banned</option>
          </select>
        </div>

        {/* Batch Filter */}
        {batchOptions.length > 0 && (
          <div className="flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={batchId}
              onChange={e => pushFilter('batchId', e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs font-semibold text-slate-700 focus:border-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Semua Batch</option>
              {batchOptions.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}

        {/* Sort */}
        <div className="flex items-center gap-1.5">
          <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
          <select
            value={sortBy}
            onChange={e => pushFilter('sortBy', e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs font-semibold text-slate-700 focus:border-indigo-500 focus:outline-none cursor-pointer"
          >
            <option value="started_desc">Terbaru Daftar</option>
            <option value="started_asc">Terlama Daftar</option>
            <option value="progress_desc">Progress Tertinggi</option>
            <option value="progress_asc">Progress Terendah</option>
            <option value="name_asc">Nama (A–Z)</option>
            <option value="score_desc">Skor Tertinggi</option>
          </select>
        </div>

        <span className="ml-auto text-xs font-semibold text-slate-400">{totalCount} peserta</span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Peserta</th>
                <th className="px-4 py-3.5">Batch</th>
                <th className="px-4 py-3.5">Progress</th>
                <th className="px-4 py-3.5 text-center">Materi</th>
                <th className="px-4 py-3.5 text-center">Skor</th>
                <th className="px-4 py-3.5">Mulai</th>
                <th className="px-4 py-3.5">Terakhir Aktif</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {participants.map(p => (
                <tr key={p.enrollmentId} className={`group transition-colors hover:bg-slate-50/70 ${p.bannedAt ? 'opacity-60' : ''}`}>
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-slate-800 text-xs">{p.name}</div>
                    <div className="text-[11px] text-slate-400">{p.email}</div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs text-slate-500">{p.batchName || '—'}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <ProgressBar value={p.progressPercent} />
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className="text-xs font-semibold text-slate-700 tabular-nums">{p.completedLessons}/{p.totalLessons}</span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className="text-xs font-semibold text-slate-700 tabular-nums">
                      {p.finalScore !== null ? p.finalScore : '—'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5">
                    <span className="text-xs text-slate-500">{fmt(p.startedAt)}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5">
                    <span className="text-xs text-slate-500">{fmt(p.lastActivityAt)}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-center">
                    <StatusChip p={p} />
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right">
                    <RowActionMenu
                      participant={p}
                      onBan={pp => { setActionTarget(pp); setModal('ban') }}
                      onUnban={handleUnban}
                      onReset={handleReset}
                      onOverride={pp => { setActionTarget(pp); setModal('override') }}
                      onRemind={handleRemind}
                    />
                  </td>
                </tr>
              ))}
              {participants.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-14 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50">
                      <Users className="h-5 w-5 text-indigo-400" />
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-600">Tidak ada peserta ditemukan</p>
                    <p className="mt-1 text-xs text-slate-400">Coba ubah filter atau tambah peserta baru</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Halaman {page} dari {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => pushFilter('page', String(page - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </button>
            <button
              onClick={() => pushFilter('page', String(page + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {modal === 'ban' && actionTarget && (
        <BanModal
          p={actionTarget}
          onConfirm={handleBanConfirm}
          onClose={() => { setModal(null); setActionTarget(null) }}
          isPending={isPending}
        />
      )}
      {modal === 'override' && actionTarget && (
        <OverrideModal
          p={actionTarget}
          onConfirm={handleOverrideConfirm}
          onClose={() => { setModal(null); setActionTarget(null) }}
          isPending={isPending}
        />
      )}
      {modal === 'bulk' && (
        <BulkAddModal
          courseSlug={courseSlug}
          onClose={() => setModal(null)}
          onSuccess={() => router.refresh()}
        />
      )}
    </div>
  )
}
