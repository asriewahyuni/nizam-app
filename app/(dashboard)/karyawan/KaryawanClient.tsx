'use client'

import { startTransition, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Fingerprint, CalendarDays, ReceiptText, Wallet,
  CheckCircle2, XCircle, Clock, LogIn, LogOut,
  AlertCircle, ChevronDown, ChevronUp, Trash2, X,
  Image as ImageIcon,
} from 'lucide-react'
import {
  clockMyAttendance,
  cancelMyLeaveRequest,
  submitMyLeaveRequest,
  submitMyExpenseClaim,
  deleteMyExpenseClaim,
} from '@/modules/hris/actions/self-service.actions'
import { uploadReceipt } from '@/modules/accounting/actions/reimburse.actions'
import { formatRupiah, formatDate } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = 'presensi' | 'cuti' | 'reimburse' | 'gaji'

interface Props {
  orgId: string
  employee: any
  userName: string
  initialAttendance: any[]
  initialLeaveRequests: any[]
  initialExpenseClaims: any[]
  initialPayslips: any[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  if (['ABSENT', 'ALFA'].includes(s)) return 'bg-rose-100 text-rose-700'
  if (s === 'LEAVE') return 'bg-blue-100 text-blue-700'
  if (s === 'SICK') return 'bg-purple-100 text-purple-700'
  if (s === 'HALFDAY') return 'bg-orange-100 text-orange-700'
  return 'bg-slate-100 text-slate-600'
}

function approvalBadge(status: string) {
  const s = String(status || '').toUpperCase()
  if (s === 'APPROVED') return 'bg-emerald-100 text-emerald-700'
  if (s === 'REJECTED') return 'bg-rose-100 text-rose-700'
  if (s === 'CANCELLED') return 'bg-slate-100 text-slate-500'
  return 'bg-amber-100 text-amber-700'
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function KaryawanClient({
  orgId, employee, userName,
  initialAttendance, initialLeaveRequests, initialExpenseClaims, initialPayslips,
}: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('presensi')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  // ── Presensi state ──
  const [attendance, setAttendance] = useState(initialAttendance)
  const [attNotes, setAttNotes] = useState('')
  const [clockLoading, setClockLoading] = useState(false)

  // ── Cuti state ──
  const [leaves, setLeaves] = useState(initialLeaveRequests)
  const [leaveType, setLeaveType] = useState('Annual Leave')
  const [leaveStart, setLeaveStart] = useState(new Date().toISOString().split('T')[0])
  const [leaveEnd, setLeaveEnd] = useState(new Date().toISOString().split('T')[0])
  const [leaveReason, setLeaveReason] = useState('')
  const [leaveLoading, setLeaveLoading] = useState(false)

  // ── Reimburse state ──
  const [claims, setClaims] = useState(initialExpenseClaims)
  const [claimDate, setClaimDate] = useState(new Date().toISOString().split('T')[0])
  const [claimCategory, setClaimCategory] = useState('Transport')
  const [claimAmount, setClaimAmount] = useState('')
  const [claimDesc, setClaimDesc] = useState('')
  const [claimReceiptUrl, setClaimReceiptUrl] = useState('')
  const [claimReceiptPreview, setClaimReceiptPreview] = useState<string | null>(null)
  const [claimLoading, setClaimLoading] = useState(false)
  const [receiptUploading, setReceiptUploading] = useState(false)
  const receiptInputRef = useRef<HTMLInputElement>(null)

  // ── Gaji state ──
  const [payslips] = useState(initialPayslips)
  const [expandedSlip, setExpandedSlip] = useState<string | null>(null)

  useEffect(() => { setAttendance(initialAttendance) }, [initialAttendance])
  useEffect(() => { setLeaves(initialLeaveRequests) }, [initialLeaveRequests])
  useEffect(() => { setClaims(initialExpenseClaims) }, [initialExpenseClaims])

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const refresh = () => startTransition(() => router.refresh())

  const today = new Date().toISOString().split('T')[0]
  const todayAtt = attendance.find((r: any) => r.record_date === today) ?? null

  // ── Clock handlers ──
  const handleClock = async (type: 'IN' | 'OUT') => {
    setClockLoading(true)
    const res = await clockMyAttendance(orgId, { type, notes: attNotes })
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

  // ─── UI ──────────────────────────────────────────────────────────────────

  const name = employee
    ? `${employee.first_name} ${employee.last_name || ''}`.trim()
    : userName

  const initials = name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase() || 'K'

  const TABS: { id: Tab; label: string; icon: typeof Fingerprint }[] = [
    { id: 'presensi',  label: 'Presensi',  icon: Fingerprint },
    { id: 'cuti',      label: 'Cuti',      icon: CalendarDays },
    { id: 'reimburse', label: 'Reimburse', icon: ReceiptText },
    { id: 'gaji',      label: 'Gaji',      icon: Wallet },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Max-width mobile frame ── */}
      <div className="max-w-md mx-auto relative min-h-screen flex flex-col">

        {/* ── Identity strip ── */}
        <div className="bg-white border-b border-slate-100 px-5 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-base shrink-0">
              {employee?.avatar_url
                ? <img src={employee.avatar_url} alt={name} className="w-full h-full object-cover rounded-2xl" />
                : initials}
            </div>
            <div className="min-w-0">
              <p className="font-black text-slate-900 text-base leading-tight truncate">{name}</p>
              <p className="text-[11px] font-bold text-slate-400 truncate">
                {employee?.job_title || 'Karyawan'}{employee?.branch?.name ? ` · ${employee.branch.name}` : ''}
              </p>
            </div>
            <div className="ml-auto shrink-0">
              <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-xl ${todayAtt ? statusBadge(todayAtt.status) : 'bg-slate-100 text-slate-500'}`}>
                {todayAtt?.status || 'Belum masuk'}
              </span>
            </div>
          </div>
        </div>

        {/* ── Tab content ── */}
        <div className="flex-1 overflow-y-auto pb-24 px-4 pt-5 space-y-4">
          <AnimatePresence mode="wait">
            {/* ═══ PRESENSI ═══ */}
            {tab === 'presensi' && (
              <motion.div key="presensi" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">

                {/* Today card */}
                <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Hari Ini</p>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { label: 'Status', value: todayAtt?.status || '—' },
                      { label: 'Masuk', value: todayAtt?.check_in ? fmt(todayAtt.check_in) : '--:--' },
                      { label: 'Keluar', value: todayAtt?.check_out ? fmt(todayAtt.check_out) : '--:--' },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-2xl bg-slate-50 border border-slate-100 px-3 py-3 text-center">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
                        <p className="text-sm font-black text-slate-900 leading-tight">{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Notes */}
                  <textarea
                    value={attNotes}
                    onChange={(e) => setAttNotes(e.target.value)}
                    rows={2}
                    placeholder="Catatan (opsional)..."
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700 placeholder:text-slate-400 outline-none focus:border-blue-300 focus:bg-white transition-all resize-none"
                  />

                  {/* Buttons */}
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <button
                      type="button"
                      onClick={() => handleClock('IN')}
                      disabled={clockLoading || Boolean(todayAtt)}
                      className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-emerald-500 text-white font-black text-sm uppercase tracking-wider disabled:opacity-40 active:scale-95 transition-all cursor-pointer shadow-lg shadow-emerald-200"
                    >
                      {clockLoading ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <LogIn size={17} />}
                      Clock In
                    </button>
                    <button
                      type="button"
                      onClick={() => handleClock('OUT')}
                      disabled={clockLoading || !todayAtt || Boolean(todayAtt?.check_out)}
                      className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-sky-500 text-white font-black text-sm uppercase tracking-wider disabled:opacity-40 active:scale-95 transition-all cursor-pointer shadow-lg shadow-sky-200"
                    >
                      {clockLoading ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <LogOut size={17} />}
                      Clock Out
                    </button>
                  </div>
                </div>

                {/* History */}
                <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Riwayat 14 Hari</p>
                  {attendance.length === 0
                    ? <p className="text-sm text-slate-400 font-medium text-center py-4">Belum ada riwayat.</p>
                    : <div className="space-y-2">
                        {attendance.map((r: any) => (
                          <div key={r.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-slate-50 last:border-0">
                            <div>
                              <p className="text-sm font-black text-slate-800">{formatDate(r.record_date)}</p>
                              <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                                {r.check_in ? fmt(r.check_in) : '--:--'} → {r.check_out ? fmt(r.check_out) : '--:--'}
                              </p>
                            </div>
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg ${statusBadge(r.status)}`}>
                              {r.status}
                            </span>
                          </div>
                        ))}
                      </div>
                  }
                </div>
              </motion.div>
            )}

            {/* ═══ CUTI ═══ */}
            {tab === 'cuti' && (
              <motion.div key="cuti" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">

                {/* Form */}
                <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ajukan Cuti</p>

                  <div className="space-y-1">
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">Jenis Cuti</label>
                    <select
                      value={leaveType} onChange={(e) => setLeaveType(e.target.value)}
                      className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-800 outline-none focus:border-blue-300 focus:bg-white transition-all"
                    >
                      {['Annual Leave', 'Sick Leave', 'Personal Leave', 'Maternity Leave', 'Paternity Leave', 'Other'].map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Tanggal Mulai', val: leaveStart, set: setLeaveStart },
                      { label: 'Tanggal Selesai', val: leaveEnd, set: setLeaveEnd },
                    ].map(({ label, val, set }) => (
                      <div key={label} className="space-y-1">
                        <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</label>
                        <input type="date" value={val} onChange={(e) => set(e.target.value)}
                          className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-800 outline-none focus:border-blue-300 focus:bg-white transition-all" />
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">Alasan</label>
                    <textarea
                      value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} rows={3}
                      placeholder="Tuliskan alasan cuti..."
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700 placeholder:text-slate-400 outline-none focus:border-blue-300 focus:bg-white transition-all resize-none"
                    />
                  </div>

                  <button
                    type="button" onClick={handleLeave}
                    disabled={leaveLoading || !leaveReason.trim()}
                    className="w-full py-4 rounded-2xl bg-blue-600 text-white font-black text-sm uppercase tracking-widest disabled:opacity-40 active:scale-95 transition-all cursor-pointer shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                  >
                    {leaveLoading ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <CalendarDays size={16} />}
                    Ajukan Cuti
                  </button>
                </div>

                {/* History */}
                <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Riwayat Pengajuan</p>
                  {leaves.length === 0
                    ? <p className="text-sm text-slate-400 font-medium text-center py-4">Belum ada pengajuan cuti.</p>
                    : <div className="space-y-2.5">
                        {leaves.map((req: any) => (
                          <div key={req.id} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-black text-slate-900">{req.leave_type}</p>
                                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                                  {fmtDate(req.start_date)} — {fmtDate(req.end_date)} · {req.days_taken} hari
                                </p>
                              </div>
                              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg shrink-0 ${approvalBadge(req.status)}`}>
                                {req.status}
                              </span>
                            </div>
                            {req.status === 'PENDING' && (
                              <button
                                type="button" onClick={() => handleCancelLeave(req.id)}
                                disabled={leaveLoading}
                                className="mt-3 w-full py-2 rounded-xl border border-rose-200 text-rose-600 text-xs font-black uppercase tracking-wider hover:bg-rose-50 transition-all cursor-pointer"
                              >
                                Batalkan
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                  }
                </div>
              </motion.div>
            )}

            {/* ═══ REIMBURSE ═══ */}
            {tab === 'reimburse' && (
              <motion.div key="reimburse" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">

                <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ajukan Klaim Biaya</p>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">Tanggal</label>
                      <input type="date" value={claimDate} onChange={(e) => setClaimDate(e.target.value)}
                        className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-800 outline-none focus:border-amber-300 focus:bg-white transition-all" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">Kategori</label>
                      <select value={claimCategory} onChange={(e) => setClaimCategory(e.target.value)}
                        className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-800 outline-none focus:border-amber-300 focus:bg-white transition-all">
                        {['Transport', 'Meal', 'Medical', 'Supplies', 'Travel', 'Other'].map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">Nominal (Rp)</label>
                    <input type="number" min="0" value={claimAmount} onChange={(e) => setClaimAmount(e.target.value)}
                      placeholder="150000"
                      className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-800 outline-none focus:border-amber-300 focus:bg-white transition-all" />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">Deskripsi</label>
                    <textarea value={claimDesc} onChange={(e) => setClaimDesc(e.target.value)} rows={2}
                      placeholder="Keterangan singkat..."
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700 placeholder:text-slate-400 outline-none focus:border-amber-300 focus:bg-white transition-all resize-none" />
                  </div>

                  {/* Receipt upload */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">Foto Nota</label>
                    <input ref={receiptInputRef} type="file" accept="image/*" className="hidden"
                      onChange={async (e) => { const f = e.target.files?.[0]; if (f) await handleUploadReceipt(f) }} />
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => receiptInputRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-black text-slate-600 hover:bg-white transition-all cursor-pointer">
                        <ImageIcon size={15} />
                        {receiptUploading ? 'Uploading...' : claimReceiptUrl ? 'Ganti Nota' : 'Upload Nota'}
                      </button>
                      {claimReceiptPreview && (
                        <div className="w-14 h-14 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                          <img src={claimReceiptPreview} alt="Nota" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                  </div>

                  <button type="button" onClick={handleClaim}
                    disabled={claimLoading || !claimAmount || !claimDesc.trim()}
                    className="w-full py-4 rounded-2xl bg-amber-500 text-white font-black text-sm uppercase tracking-widest disabled:opacity-40 active:scale-95 transition-all cursor-pointer shadow-lg shadow-amber-200 flex items-center justify-center gap-2">
                    {claimLoading ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <ReceiptText size={16} />}
                    Kirim Klaim
                  </button>
                </div>

                {/* History */}
                <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Riwayat Klaim</p>
                  {claims.length === 0
                    ? <p className="text-sm text-slate-400 font-medium text-center py-4">Belum ada klaim.</p>
                    : <div className="space-y-2.5">
                        {claims.map((c: any) => (
                          <div key={c.id} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-black text-slate-900 truncate">{c.category} · {fmtDate(c.claim_date)}</p>
                                <p className="text-base font-black text-amber-600 mt-0.5">{formatRupiah(c.amount)}</p>
                                <p className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">{c.description}</p>
                              </div>
                              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg shrink-0 ${approvalBadge(c.status)}`}>
                                {c.status}
                              </span>
                            </div>
                            {['PENDING', 'REJECTED'].includes(String(c.status || '').toUpperCase()) && (
                              <button type="button" onClick={() => handleDeleteClaim(c.id)}
                                disabled={claimLoading}
                                className="mt-3 w-full py-2 rounded-xl border border-rose-200 text-rose-600 text-xs font-black uppercase tracking-wider hover:bg-rose-50 transition-all cursor-pointer flex items-center justify-center gap-1">
                                <Trash2 size={12} /> Hapus
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                  }
                </div>
              </motion.div>
            )}

            {/* ═══ GAJI ═══ */}
            {tab === 'gaji' && (
              <motion.div key="gaji" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Slip Gaji</p>

                {payslips.length === 0
                  ? (
                    <div className="bg-white rounded-3xl border border-slate-100 p-8 text-center shadow-sm">
                      <Wallet size={32} className="text-slate-300 mx-auto mb-3" />
                      <p className="text-sm font-black text-slate-400 uppercase tracking-wider">Belum ada slip gaji</p>
                      <p className="text-xs text-slate-400 font-medium mt-1">Slip muncul setelah payroll diproses admin.</p>
                    </div>
                  ) : payslips.map((slip: any) => {
                    const isOpen = expandedSlip === slip.id
                    const run = slip.run
                    const period = run
                      ? `${fmtDate(run.period_start)} – ${fmtDate(run.period_end)}`
                      : fmtDate(slip.created_at)
                    const earnings = (slip.lines || []).filter((l: any) => l.type === 'EARNING')
                    const deductions = (slip.lines || []).filter((l: any) => l.type === 'DEDUCTION')

                    return (
                      <div key={slip.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                        <button type="button" onClick={() => setExpandedSlip(isOpen ? null : slip.id)}
                          className="w-full px-5 py-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 transition-all">
                          <div className="text-left">
                            <p className="text-sm font-black text-slate-900">{period}</p>
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                              Take home: <span className="font-black text-emerald-600">{formatRupiah(slip.net_salary)}</span>
                              <span className={`ml-2 text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${slip.payment_status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                {slip.payment_status}
                              </span>
                            </p>
                          </div>
                          {isOpen ? <ChevronUp size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
                        </button>

                        {isOpen && (
                          <div className="px-5 pb-5 space-y-3 border-t border-slate-50">
                            {/* Summary row */}
                            <div className="grid grid-cols-3 gap-2 pt-3">
                              {[
                                { label: 'Gaji Pokok', val: slip.basic_salary, color: 'text-slate-900' },
                                { label: 'Tunjangan', val: slip.gross_salary - slip.basic_salary, color: 'text-blue-600' },
                                { label: 'Potongan', val: slip.total_deductions, color: 'text-rose-600' },
                              ].map(({ label, val, color }) => (
                                <div key={label} className="rounded-2xl bg-slate-50 border border-slate-100 p-3 text-center">
                                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
                                  <p className={`text-xs font-black ${color}`}>{formatRupiah(val || 0)}</p>
                                </div>
                              ))}
                            </div>

                            {/* Line items */}
                            {earnings.length > 0 && (
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1.5">Penghasilan</p>
                                {earnings.map((l: any) => (
                                  <div key={l.id} className="flex justify-between py-1.5 border-b border-slate-50 last:border-0">
                                    <p className="text-xs font-semibold text-slate-700">{l.component_name}</p>
                                    <p className="text-xs font-black text-slate-900">{formatRupiah(l.amount)}</p>
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

                            {/* Take home */}
                            <div className="flex justify-between items-center pt-2 border-t-2 border-slate-200">
                              <p className="text-sm font-black text-slate-900">Take Home Pay</p>
                              <p className="text-base font-black text-emerald-600">{formatRupiah(slip.net_salary)}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })
                }
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Bottom Tab Navigation ── */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 safe-area-pb">
          <div className="max-w-md mx-auto grid grid-cols-4">
            {TABS.map(({ id, label, icon: Icon }) => {
              const active = tab === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`flex flex-col items-center justify-center gap-1 py-3 transition-all cursor-pointer ${active ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                  <span className={`text-[10px] font-black uppercase tracking-wider ${active ? 'text-blue-600' : ''}`}>
                    {label}
                  </span>
                  {active && <span className="absolute bottom-0 w-8 h-0.5 bg-blue-600 rounded-full" />}
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
