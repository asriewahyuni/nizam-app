'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import {
  PiggyBank, Briefcase, Bell, LogOut, TrendingUp,
  CheckCircle, ArrowUpCircle, ArrowDownCircle,
  Star, GraduationCap, FileText, Send, Upload, XCircle,
  ChevronDown, ChevronUp, AlertCircle, Home,
} from 'lucide-react'
import {
  createProyek, updateStatusPenawaran, createPembiayaan,
  type KojasmatAnggota, type KojasmatProyek, type KojasmatSimpanan,
  type KojasmatPenawaran, type KojasmatPembiayaan,
} from '@/modules/kojasmat/actions/kojasmat.actions'
import {
  kirimLaporanProyek, simpanDokumen,
  type KojasmatLaporanProyek, type KojasmatDokumen,
} from '@/modules/kojasmat/actions/kojasmat-membership.actions'

// ─── TYPES ────────────────────────────────────────────────────────────────────

type Props = {
  anggota: KojasmatAnggota
  simpanan: KojasmatSimpanan[]
  proyekDiajukan: KojasmatProyek[]
  pembiayaan: KojasmatPembiayaan[]
  penawaran: KojasmatPenawaran[]
  laporan: KojasmatLaporanProyek[]
  orgNama: string
}

type ActiveTab = 'beranda' | 'simpanan' | 'proyek' | 'penawaran' | 'laporan'

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

function fmtShort(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}rb`
  return String(n)
}

const AKAD_LABEL: Record<string, string> = {
  MURABAHAH: 'Murabahah',
  MUDHARABAH: 'Mudharabah',
  INAN: 'Musyarakah Inan',
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  DRAFT:      { label: 'Draft',       color: 'bg-gray-100 text-gray-600' },
  REVIEW_DPS: { label: 'Review DPS',  color: 'bg-yellow-100 text-yellow-700' },
  DISETUJUI:  { label: 'Disetujui',   color: 'bg-blue-100 text-blue-700' },
  DITOLAK:    { label: 'Ditolak',     color: 'bg-red-100 text-red-700' },
  OPEN:       { label: 'Buka Dana',   color: 'bg-cyan-100 text-cyan-700' },
  TERPENUHI:  { label: 'Terpenuhi',   color: 'bg-indigo-100 text-indigo-700' },
  BERJALAN:   { label: 'Berjalan',    color: 'bg-emerald-100 text-emerald-700' },
  SELESAI:    { label: 'Selesai',     color: 'bg-emerald-200 text-emerald-800' },
  DITUTUP:    { label: 'Ditutup',     color: 'bg-gray-200 text-gray-500' },
}

function Badge({ text, cls }: { text: string; cls: string }) {
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', cls)}>{text}</span>
}

// ─── SHEET (bottom drawer modal) ──────────────────────────────────────────────

function Sheet({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg mx-auto rounded-t-3xl bg-white shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 transition-colors cursor-pointer">
            <XCircle className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}

// ─── TAB: BERANDA ─────────────────────────────────────────────────────────────

function TabBeranda({ anggota, simpanan, proyekDiajukan, pembiayaan, penawaran, orgNama }: Props) {
  const totalSimpanan = simpanan.reduce((s, x) => s + Number(x.saldo), 0)
  const proyekAktif = proyekDiajukan.filter(p => p.status === 'BERJALAN')
  const penawaranBaru = penawaran.filter(p => p.status === 'TERKIRIM').length

  return (
    <div className="space-y-5">
      {/* Hero Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 p-6 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-12 translate-x-12" />
        <div className="absolute bottom-0 left-0 w-28 h-28 bg-white/5 rounded-full translate-y-8 -translate-x-8" />
        <div className="relative">
          <p className="text-slate-400 text-xs uppercase tracking-widest mb-1">{orgNama}</p>
          <p className="text-slate-300 text-sm mb-4">{anggota.kode_anggota}</p>
          <p className="text-slate-300 text-xs mb-0.5">Total Simpanan</p>
          <p className="text-4xl font-bold tracking-tight">{fmt(totalSimpanan)}</p>

          <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/10 pt-4">
            {[
              { label: 'Pokok',    jenis: 'POKOK',    color: 'text-blue-300' },
              { label: 'Wajib',    jenis: 'WAJIB',    color: 'text-emerald-300' },
              { label: 'Sukarela', jenis: 'SUKARELA', color: 'text-purple-300' },
            ].map(({ label, jenis, color }) => {
              const s = simpanan.find(x => x.jenis === jenis)
              return (
                <div key={jenis} className="text-center">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className={cn('mt-0.5 text-sm font-semibold', color)}>{fmtShort(Number(s?.saldo ?? 0))}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Status badge */}
      <div className={cn(
        'flex items-center gap-3 rounded-2xl border p-4',
        anggota.is_verified
          ? 'border-emerald-100 bg-emerald-50'
          : 'border-amber-100 bg-amber-50'
      )}>
        {anggota.is_verified
          ? <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
          : <GraduationCap className="h-5 w-5 text-amber-600 shrink-0" />}
        <div>
          <p className={cn('font-semibold text-sm', anggota.is_verified ? 'text-emerald-800' : 'text-amber-800')}>
            {anggota.is_verified ? 'Anggota Terverifikasi' : 'Belum Terverifikasi'}
          </p>
          <p className={cn('text-xs mt-0.5', anggota.is_verified ? 'text-emerald-600' : 'text-amber-600')}>
            {anggota.is_verified
              ? 'Anda dapat mengajukan proyek dan membiayai proyek anggota lain'
              : 'Ikuti pelatihan koperasi untuk mendapatkan verifikasi'}
          </p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 text-center shadow-sm">
          <Briefcase className="h-5 w-5 text-blue-500 mx-auto mb-1" />
          <p className="text-xl font-bold text-gray-900">{proyekDiajukan.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">Proyek</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 text-center shadow-sm">
          <TrendingUp className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
          <p className="text-xl font-bold text-gray-900">{pembiayaan.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">Dibiayai</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 text-center shadow-sm relative">
          <Bell className="h-5 w-5 text-amber-500 mx-auto mb-1" />
          <p className="text-xl font-bold text-gray-900">{penawaranBaru}</p>
          <p className="text-xs text-gray-400 mt-0.5">Penawaran</p>
          {penawaranBaru > 0 && (
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          )}
        </div>
      </div>

      {/* Proyek berjalan */}
      {proyekAktif.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Proyek Aktif</p>
          {proyekAktif.map(p => (
            <div key={p.id} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-emerald-900 text-sm">{p.nama_proyek}</p>
                  <p className="text-xs text-emerald-600 mt-0.5">{p.durasi_bulan} bulan · {p.kode_proyek}</p>
                </div>
                <Badge text="Berjalan" cls="bg-emerald-200 text-emerald-800" />
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-xs text-emerald-600 mb-1">
                  <span>Modal terkumpul</span>
                  <span>{Math.round(Number(p.modal_terkumpul) / Number(p.kebutuhan_modal) * 100)}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-emerald-200">
                  <div className="h-1.5 rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${Math.min(100, Number(p.modal_terkumpul) / Number(p.kebutuhan_modal) * 100)}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── TAB: SIMPANAN ────────────────────────────────────────────────────────────

function TabSimpanan({ simpanan }: { simpanan: KojasmatSimpanan[] }) {
  const jenisInfo = {
    POKOK:    { label: 'Simpanan Pokok',    desc: 'Dibayarkan sekali saat bergabung', color: 'from-blue-500 to-blue-600', bg: 'bg-blue-50 border-blue-100' },
    WAJIB:    { label: 'Simpanan Wajib',    desc: 'Rutin setiap bulan', color: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
    SUKARELA: { label: 'Simpanan Sukarela', desc: 'Tabungan bebas', color: 'from-purple-500 to-purple-600', bg: 'bg-purple-50 border-purple-100' },
  }

  const total = simpanan.reduce((s, x) => s + Number(x.saldo), 0)

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 p-5 text-white">
        <p className="text-slate-400 text-xs mb-1">Total Simpanan</p>
        <p className="text-3xl font-bold">{fmt(total)}</p>
      </div>

      <div className="space-y-3">
        {(['POKOK', 'WAJIB', 'SUKARELA'] as const).map(jenis => {
          const s = simpanan.find(x => x.jenis === jenis)
          const info = jenisInfo[jenis]
          const pct = total > 0 ? (Number(s?.saldo ?? 0) / total * 100) : 0
          return (
            <div key={jenis} className={cn('rounded-2xl border p-5', info.bg)}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold text-gray-900">{info.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{info.desc}</p>
                </div>
                <p className="text-xl font-bold text-gray-900">{fmt(Number(s?.saldo ?? 0))}</p>
              </div>
              <div className="h-1.5 w-full rounded-full bg-black/10">
                <div className={cn('h-1.5 rounded-full bg-gradient-to-r transition-all', info.color)}
                  style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-gray-400 text-center">
        Untuk setoran atau penarikan, hubungi pengurus koperasi.
      </p>
    </div>
  )
}

// ─── TAB: PROYEK ──────────────────────────────────────────────────────────────

async function uploadDokumenProyek(file: File, orgId: string): Promise<{ key: string; name: string } | null> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('org_id', orgId)
  fd.append('ref_type', 'PROYEK')
  const res = await fetch('/api/kojasmat/upload', { method: 'POST', body: fd })
  if (!res.ok) return null
  return res.json() as Promise<{ key: string; name: string }>
}

function TabProyek({ anggota, proyekDiajukan, pembiayaan }: {
  anggota: KojasmatAnggota; proyekDiajukan: KojasmatProyek[]; pembiayaan: KojasmatPembiayaan[]
}) {
  const [pending, startTransition] = useTransition()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [uploadingDok, setUploadingDok] = useState(false)
  const [uploadedDoks, setUploadedDoks] = useState<{ key: string; name: string; jenis: string }[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [form, setForm] = useState({
    nama_proyek: '', deskripsi: '', jenis_akad: 'MUDHARABAH',
    kebutuhan_modal: '', durasi_bulan: '6', agunan: '', nisbah_pengaju: 30,
  })

  const nisbah_pemodal = 100 - form.nisbah_pengaju

  async function handleDokUpload(jenis: string, file: File) {
    setUploadingDok(true)
    const result = await uploadDokumenProyek(file, anggota.org_id)
    setUploadingDok(false)
    if (result) setUploadedDoks(prev => [...prev.filter(d => d.jenis !== jenis), { ...result, jenis }])
  }

  function resetSheet() {
    setSheetOpen(false)
    setForm({ nama_proyek: '', deskripsi: '', jenis_akad: 'MUDHARABAH', kebutuhan_modal: '', durasi_bulan: '6', agunan: '', nisbah_pengaju: 30 })
    setUploadedDoks([])
  }

  function handleCreate() {
    startTransition(async () => {
      const res = await createProyek({
        org_id: anggota.org_id,
        pengaju_id: anggota.id,
        nama_proyek: form.nama_proyek,
        deskripsi: form.deskripsi || undefined,
        jenis_akad: form.jenis_akad as 'MURABAHAH' | 'MUDHARABAH' | 'INAN',
        kebutuhan_modal: Number(form.kebutuhan_modal),
        durasi_bulan: Number(form.durasi_bulan),
        agunan: form.agunan || undefined,
        nisbah_pengaju: form.nisbah_pengaju,
        nisbah_pemodal: nisbah_pemodal,
      })
      if (res.data && 'id' in res.data && uploadedDoks.length > 0) {
        const proyekId = (res.data as { id: string }).id
        for (const dok of uploadedDoks) {
          await simpanDokumen({
            org_id: anggota.org_id,
            referensi_type: 'PROYEK',
            referensi_id: proyekId,
            jenis_dokumen: dok.jenis as KojasmatDokumen['jenis_dokumen'],
            nama_file: dok.name,
            file_key: dok.key,
          })
        }
      }
      resetSheet()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-gray-900">Proyek Saya</p>
        {anggota.is_verified && (
          <button onClick={() => setSheetOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors cursor-pointer">
            + Ajukan Proyek
          </button>
        )}
      </div>

      {proyekDiajukan.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-12 text-center">
          <Briefcase className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">
            {anggota.is_verified ? 'Belum ada proyek diajukan' : 'Verifikasi keanggotaan untuk mengajukan proyek'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {proyekDiajukan.map(p => {
            const st = STATUS_LABEL[p.status] ?? { label: p.status, color: 'bg-gray-100 text-gray-600' }
            const isExpanded = expanded === p.id
            const pct = Number(p.kebutuhan_modal) > 0
              ? Math.round(Number(p.modal_terkumpul) / Number(p.kebutuhan_modal) * 100)
              : 0
            return (
              <div key={p.id} className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                <button className="w-full text-left p-4 cursor-pointer" onClick={() => setExpanded(isExpanded ? null : p.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge text={st.label} cls={st.color} />
                        <Badge text={AKAD_LABEL[p.jenis_akad] ?? p.jenis_akad} cls="bg-gray-100 text-gray-500" />
                      </div>
                      <p className="font-semibold text-gray-900 text-sm truncate">{p.nama_proyek}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{p.kode_proyek} · {p.durasi_bulan} bulan</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-gray-900 text-sm">{fmt(Number(p.kebutuhan_modal))}</p>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400 ml-auto mt-1" /> : <ChevronDown className="h-4 w-4 text-gray-400 ml-auto mt-1" />}
                    </div>
                  </div>
                  {Number(p.modal_terkumpul) > 0 && (
                    <div className="mt-3">
                      <div className="h-1.5 w-full rounded-full bg-gray-100">
                        <div className="h-1.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Terkumpul {fmt(Number(p.modal_terkumpul))} ({pct}%)</p>
                    </div>
                  )}
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-gray-50 p-3">
                        <p className="text-gray-400 mb-0.5">Nisbah Pengaju</p>
                        <p className="font-bold text-gray-800">{p.nisbah_pengaju ?? 30}%</p>
                      </div>
                      <div className="rounded-xl bg-gray-50 p-3">
                        <p className="text-gray-400 mb-0.5">Nisbah Pemodal</p>
                        <p className="font-bold text-gray-800">{p.nisbah_pemodal ?? 70}%</p>
                      </div>
                    </div>
                    {p.agunan && (
                      <p className="text-xs text-gray-500">Agunan: {p.agunan}</p>
                    )}
                    {p.deskripsi && (
                      <p className="text-xs text-gray-600 leading-relaxed">{p.deskripsi}</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {pembiayaan.length > 0 && (
        <div className="space-y-3 pt-2">
          <p className="font-semibold text-gray-900">Proyek yang Saya Biayai</p>
          {pembiayaan.map((pm: KojasmatPembiayaan & {
            nama_proyek?: string; jenis_akad?: string; proyek_status?: string
          }) => (
            <div key={pm.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{pm.nama_proyek ?? '—'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Porsi: {Number(pm.porsi_pct).toFixed(1)}%</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900 text-sm">{fmt(Number(pm.jumlah))}</p>
                  {pm.proyek_status && (
                    <Badge text={STATUS_LABEL[pm.proyek_status]?.label ?? pm.proyek_status}
                      cls={STATUS_LABEL[pm.proyek_status]?.color ?? 'bg-gray-100 text-gray-600'} />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sheet Ajukan Proyek */}
      <Sheet open={sheetOpen} onClose={resetSheet} title="Ajukan Proyek Baru">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Nama Proyek *</label>
            <input className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
              placeholder="Contoh: Usaha Konveksi Seragam"
              value={form.nama_proyek} onChange={e => setForm(f => ({ ...f, nama_proyek: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Jenis Akad *</label>
            <select className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-slate-500"
              value={form.jenis_akad} onChange={e => setForm(f => ({ ...f, jenis_akad: e.target.value }))}>
              <option value="MUDHARABAH">Mudharabah — Modal penuh dari pemodal</option>
              <option value="MURABAHAH">Murabahah — Pembelian cicil</option>
              <option value="INAN">Musyarakah Inan — Modal bersama</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Modal (Rp) *</label>
              <input type="number" className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-slate-500"
                placeholder="5000000"
                value={form.kebutuhan_modal} onChange={e => setForm(f => ({ ...f, kebutuhan_modal: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Durasi (bulan)</label>
              <input type="number" className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-slate-500"
                value={form.durasi_bulan} onChange={e => setForm(f => ({ ...f, durasi_bulan: e.target.value }))} />
            </div>
          </div>

          {/* Nisbah Syirkah */}
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-900 mb-3">Pembagian Keuntungan (Nisbah)</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-gray-600">Pengaju (Anda)</span>
                <span className="text-emerald-700 font-bold text-sm">{form.nisbah_pengaju}%</span>
              </div>
              <input type="range" min={10} max={90} step={5}
                className="w-full accent-slate-800 cursor-pointer"
                value={form.nisbah_pengaju}
                onChange={e => setForm(f => ({ ...f, nisbah_pengaju: Number(e.target.value) }))} />
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-gray-600">Pemodal</span>
                <span className="text-blue-700 font-bold text-sm">{nisbah_pemodal}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-blue-200 overflow-hidden">
                <div className="h-2 bg-gradient-to-r from-slate-700 to-slate-900 rounded-full transition-all"
                  style={{ width: `${form.nisbah_pengaju}%` }} />
              </div>
              <p className="text-xs text-blue-600">Koperasi menerima ujrah nominal tetap — tidak masuk nisbah.</p>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Agunan / Jaminan</label>
            <input className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-slate-500"
              placeholder="Contoh: BPKB Motor"
              value={form.agunan} onChange={e => setForm(f => ({ ...f, agunan: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Deskripsi Usaha</label>
            <textarea rows={3} className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-slate-500 resize-none"
              placeholder="Jelaskan usaha Anda secara singkat..."
              value={form.deskripsi} onChange={e => setForm(f => ({ ...f, deskripsi: e.target.value }))} />
          </div>

          {/* Dokumen Proyek */}
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Dokumen Pendukung <span className="text-gray-400 font-normal">(opsional)</span></p>
            <div className="space-y-2">
              {(['PROYEKSI_KEUANGAN', 'ANALISA_BISNIS', 'PENAWARAN_SYIRKAH'] as const).map(jenis => {
                const labels: Record<string, string> = {
                  PROYEKSI_KEUANGAN: 'Proyeksi Keuangan',
                  ANALISA_BISNIS: 'Analisa Bisnis',
                  PENAWARAN_SYIRKAH: 'Penawaran Syirkah',
                }
                const uploaded = uploadedDoks.find(d => d.jenis === jenis)
                return (
                  <div key={jenis} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                    <span className="flex-1 text-sm text-gray-600">{labels[jenis]}</span>
                    {uploaded ? (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span className="text-xs text-emerald-600 max-w-[80px] truncate">{uploaded.name}</span>
                        <button onClick={() => setUploadedDoks(p => p.filter(d => d.jenis !== jenis))}
                          className="text-gray-400 hover:text-red-500 cursor-pointer">
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer">
                        <Upload className="h-3.5 w-3.5" /> Upload
                        <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
                          onChange={e => { if (e.target.files?.[0]) handleDokUpload(jenis, e.target.files[0]) }} />
                      </label>
                    )}
                  </div>
                )
              })}
            </div>
            {uploadingDok && <p className="text-xs text-gray-400 mt-1">Mengunggah...</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={resetSheet}
              className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
              Batal
            </button>
            <button onClick={handleCreate}
              disabled={!form.nama_proyek || !form.kebutuhan_modal || pending || uploadingDok}
              className="flex-1 rounded-2xl bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer">
              {pending ? 'Mengajukan...' : 'Ajukan'}
            </button>
          </div>
        </div>
      </Sheet>
    </div>
  )
}

// ─── TAB: PENAWARAN ───────────────────────────────────────────────────────────

function TabPenawaran({ anggota, penawaran }: {
  anggota: KojasmatAnggota; penawaran: KojasmatPenawaran[]
}) {
  const [pending, startTransition] = useTransition()
  const [sheetBiayai, setSheetBiayai] = useState<KojasmatPenawaran | null>(null)
  const [jumlah, setJumlah] = useState('')

  function handleTandai(id: string, status: string) {
    startTransition(async () => { await updateStatusPenawaran(id, status) })
  }

  function handleBiayai() {
    if (!sheetBiayai) return
    startTransition(async () => {
      await createPembiayaan({
        org_id: anggota.org_id,
        proyek_id: sheetBiayai.proyek_id,
        pemodal_id: anggota.id,
        jumlah: Number(jumlah),
      })
      await updateStatusPenawaran(sheetBiayai.id, 'BERMINAT')
      setSheetBiayai(null)
      setJumlah('')
    })
  }

  return (
    <div className="space-y-4">
      <p className="font-semibold text-gray-900">Penawaran Proyek</p>

      {penawaran.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-12 text-center">
          <Bell className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Belum ada penawaran untuk Anda</p>
        </div>
      )}

      <div className="space-y-3">
        {penawaran.map(p => {
          const sisa = Number(p.kebutuhan_modal ?? 0) - Number(p.modal_terkumpul ?? 0)
          const isBaru = p.status === 'TERKIRIM'
          return (
            <div key={p.id} className={cn(
              'rounded-2xl border bg-white shadow-sm overflow-hidden',
              isBaru ? 'border-emerald-200' : 'border-gray-100'
            )}>
              {isBaru && (
                <div className="bg-emerald-500 px-4 py-1.5 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  <span className="text-xs font-semibold text-white">Penawaran Baru</span>
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 text-sm">{p.nama_proyek ?? '—'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {AKAD_LABEL[p.jenis_akad ?? ''] ?? p.jenis_akad} · {p.durasi_bulan ?? '?'} bulan
                    </p>
                  </div>
                  <p className="font-bold text-gray-900 text-sm shrink-0">{fmt(Number(p.kebutuhan_modal ?? 0))}</p>
                </div>

                <div className="mt-3 flex gap-3 text-xs text-gray-500">
                  <span>Ujrah koperasi: <strong>{fmt(Number(p.ujrah_nominal ?? 0))}</strong></span>
                  <span>Sisa: <strong className="text-emerald-600">{fmt(sisa)}</strong></span>
                </div>

                {(p.status === 'TERKIRIM' || p.status === 'DIBACA') && p.proyek_status === 'OPEN' && (
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => { setSheetBiayai(p); setJumlah('') }}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors cursor-pointer">
                      <ArrowUpCircle className="h-3.5 w-3.5" /> Biayai
                    </button>
                    <button onClick={() => handleTandai(p.id, 'DIABAIKAN')} disabled={pending}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2.5 text-xs text-gray-500 hover:bg-gray-50 transition-colors cursor-pointer">
                      <ArrowDownCircle className="h-3.5 w-3.5" /> Lewat
                    </button>
                  </div>
                )}
                {p.status === 'BERMINAT' && (
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                    <CheckCircle className="h-3.5 w-3.5" /> Sudah berpartisipasi
                  </div>
                )}
                {p.status === 'DIABAIKAN' && (
                  <p className="mt-2 text-xs text-gray-400">Dilewatkan</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <Sheet open={!!sheetBiayai} onClose={() => setSheetBiayai(null)} title="Biayai Proyek">
        {sheetBiayai && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="font-semibold text-gray-900">{sheetBiayai.nama_proyek}</p>
              <p className="text-sm text-gray-500 mt-1">
                Sisa kebutuhan: <strong>{fmt(Number(sheetBiayai.kebutuhan_modal ?? 0) - Number(sheetBiayai.modal_terkumpul ?? 0))}</strong>
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Ujrah koperasi: {fmt(Number(sheetBiayai.ujrah_nominal ?? 0))} (nominal tetap)
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Jumlah Pembiayaan (Rp) *</label>
              <input type="number"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-slate-500 text-lg font-semibold"
                placeholder="1000000"
                value={jumlah} onChange={e => setJumlah(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setSheetBiayai(null)}
                className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm font-medium text-gray-600 cursor-pointer">
                Batal
              </button>
              <button onClick={handleBiayai} disabled={!jumlah || pending}
                className="flex-1 rounded-2xl bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer">
                {pending ? 'Memproses...' : 'Konfirmasi'}
              </button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  )
}

// ─── TAB: LAPORAN ─────────────────────────────────────────────────────────────

function TabLaporan({ anggota, proyekDiajukan, laporan }: {
  anggota: KojasmatAnggota; proyekDiajukan: KojasmatProyek[]; laporan: KojasmatLaporanProyek[]
}) {
  const [pending, startTransition] = useTransition()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    proyek_id: '', periode_mulai: '', periode_akhir: '',
    omzet_periode: '', ringkasan: '', kendala: '', rencana_kedepan: '',
  })

  const proyekBerjalan = proyekDiajukan.filter(p => p.status === 'BERJALAN')

  const statusConfig: Record<string, { label: string; color: string }> = {
    DIKIRIM:    { label: 'Dikirim',    color: 'bg-blue-100 text-blue-700' },
    DITINJAU:   { label: 'Ditinjau',   color: 'bg-amber-100 text-amber-700' },
    DIVERIFIKASI: { label: 'Verified', color: 'bg-emerald-100 text-emerald-700' },
  }

  function resetSheet() {
    setForm({ proyek_id: '', periode_mulai: '', periode_akhir: '', omzet_periode: '', ringkasan: '', kendala: '', rencana_kedepan: '' })
    setError(null)
    setSheetOpen(false)
  }

  function handleKirim() {
    startTransition(async () => {
      const res = await kirimLaporanProyek({
        org_id: anggota.org_id,
        proyek_id: form.proyek_id,
        pengaju_id: anggota.id,
        periode_mulai: form.periode_mulai,
        periode_akhir: form.periode_akhir,
        omzet_periode: Number(form.omzet_periode),
        ringkasan: form.ringkasan,
        kendala: form.kendala || undefined,
        rencana_kedepan: form.rencana_kedepan || undefined,
      })
      if ('error' in res && res.error) { setError(res.error); return }
      resetSheet()
    })
  }

  return (
    <div className="space-y-4">
      {proyekBerjalan.length > 0 && (
        <button onClick={() => { setSheetOpen(true); setError(null) }}
          className="w-full flex items-center justify-center gap-2 rounded-2xl bg-slate-900 py-4 text-sm font-semibold text-white hover:bg-slate-800 transition-colors cursor-pointer">
          <Send className="h-4 w-4" /> Kirim Laporan Mingguan
        </button>
      )}

      {proyekBerjalan.length === 0 && laporan.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-12 text-center">
          <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Laporan mingguan hanya tersedia untuk proyek berstatus Berjalan</p>
        </div>
      )}

      {laporan.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Riwayat Laporan</p>
          {laporan.map(l => {
            const sc = statusConfig[l.status] ?? { label: l.status, color: 'bg-gray-100 text-gray-600' }
            return (
              <div key={l.id} className={cn('rounded-2xl border bg-white shadow-sm p-4',
                l.is_terlambat ? 'border-red-200' : 'border-gray-100')}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 text-sm">{l.proyek_nama ?? '—'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {String(l.periode_mulai).split('T')[0]} — {String(l.periode_akhir).split('T')[0]}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge text={sc.label} cls={sc.color} />
                    {l.is_terlambat && <Badge text="Terlambat" cls="bg-red-100 text-red-600" />}
                  </div>
                </div>
                <p className="text-sm font-semibold text-emerald-700">{fmt(Number(l.omzet_periode))}</p>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{l.ringkasan}</p>
                {l.catatan_pengurus && (
                  <div className="mt-2 rounded-xl bg-amber-50 px-3 py-2 flex items-start gap-2">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700">{l.catatan_pengurus}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Sheet open={sheetOpen} onClose={resetSheet} title="Laporan Mingguan">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Proyek *</label>
            <select className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-slate-500"
              value={form.proyek_id} onChange={e => setForm(f => ({ ...f, proyek_id: e.target.value }))}>
              <option value="">— pilih proyek —</option>
              {proyekBerjalan.map(p => <option key={p.id} value={p.id}>{p.nama_proyek}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Mulai *</label>
              <input type="date" className="w-full rounded-2xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-slate-500"
                value={form.periode_mulai} onChange={e => setForm(f => ({ ...f, periode_mulai: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Akhir *</label>
              <input type="date" className="w-full rounded-2xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-slate-500"
                value={form.periode_akhir} onChange={e => setForm(f => ({ ...f, periode_akhir: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Omzet Minggu Ini (Rp) *</label>
            <input type="number" className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-slate-500 text-lg font-semibold"
              placeholder="0"
              value={form.omzet_periode} onChange={e => setForm(f => ({ ...f, omzet_periode: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Ringkasan Kegiatan *</label>
            <textarea rows={4} className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-slate-500 resize-none"
              placeholder="Ceritakan kegiatan usaha minggu ini..."
              value={form.ringkasan} onChange={e => setForm(f => ({ ...f, ringkasan: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Kendala <span className="text-gray-400">(opsional)</span></label>
            <textarea rows={2} className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-slate-500 resize-none"
              placeholder="Masalah yang dihadapi..."
              value={form.kendala} onChange={e => setForm(f => ({ ...f, kendala: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Rencana Ke Depan <span className="text-gray-400">(opsional)</span></label>
            <textarea rows={2} className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-slate-500 resize-none"
              placeholder="Target minggu depan..."
              value={form.rencana_kedepan} onChange={e => setForm(f => ({ ...f, rencana_kedepan: e.target.value }))} />
          </div>
          {error && (
            <div className="rounded-2xl bg-red-50 border border-red-100 px-4 py-3 flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={resetSheet}
              className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm font-medium text-gray-600 cursor-pointer">
              Batal
            </button>
            <button onClick={handleKirim}
              disabled={!form.proyek_id || !form.periode_mulai || !form.periode_akhir || !form.ringkasan || pending}
              className="flex-1 rounded-2xl bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer">
              {pending ? 'Mengirim...' : 'Kirim Laporan'}
            </button>
          </div>
        </div>
      </Sheet>
    </div>
  )
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────

export default function AnggotaPortalClient(props: Props) {
  const { anggota, simpanan, proyekDiajukan, pembiayaan, penawaran, laporan, orgNama } = props
  const [activeTab, setActiveTab] = useState<ActiveTab>('beranda')

  const proyekBerjalan = proyekDiajukan.filter(p => p.status === 'BERJALAN')
  const penawaranBaru = penawaran.filter(p => p.status === 'TERKIRIM').length

  const tabs: { key: ActiveTab; label: string; icon: React.ElementType; badge?: number }[] = [
    { key: 'beranda',   label: 'Beranda',   icon: Home },
    { key: 'simpanan',  label: 'Simpanan',  icon: PiggyBank },
    { key: 'proyek',    label: 'Proyek',    icon: Briefcase },
    { key: 'penawaran', label: 'Penawaran', icon: Bell, badge: penawaranBaru || undefined },
    ...(proyekBerjalan.length > 0 ? [{ key: 'laporan' as ActiveTab, label: 'Laporan', icon: FileText }] : []),
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-sm border-b border-gray-100 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest">{orgNama}</p>
            <h1 className="font-bold text-gray-900 text-base leading-tight">{anggota.nama}</h1>
          </div>
          <div className="flex items-center gap-2">
            {anggota.is_verified && (
              <span className="hidden sm:flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                <CheckCircle className="h-3 w-3" /> Terverifikasi
              </span>
            )}
            <span className="font-mono text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">
              {anggota.kode_anggota}
            </span>
            <a href="/logout"
              className="rounded-full p-2 text-gray-400 hover:bg-gray-100 transition-colors cursor-pointer">
              <LogOut className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-lg px-4 py-5 pb-28">
        {activeTab === 'beranda'   && <TabBeranda {...props} />}
        {activeTab === 'simpanan'  && <TabSimpanan simpanan={simpanan} />}
        {activeTab === 'proyek'    && <TabProyek anggota={anggota} proyekDiajukan={proyekDiajukan} pembiayaan={pembiayaan} />}
        {activeTab === 'penawaran' && <TabPenawaran anggota={anggota} penawaran={penawaran} />}
        {activeTab === 'laporan'   && <TabLaporan anggota={anggota} proyekDiajukan={proyekDiajukan} laporan={laporan} />}
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/90 backdrop-blur-sm border-t border-gray-100 safe-area-pb">
        <div className="mx-auto flex max-w-lg px-2">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={cn('relative flex flex-1 flex-col items-center gap-1 py-3 transition-colors cursor-pointer',
                activeTab === t.key ? 'text-slate-900' : 'text-gray-400 hover:text-gray-600')}>
              <div className={cn('relative p-1.5 rounded-xl transition-colors', activeTab === t.key && 'bg-slate-100')}>
                <t.icon className="h-5 w-5" />
                {t.badge !== undefined && t.badge > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                    {t.badge}
                  </span>
                )}
              </div>
              <span className={cn('text-[10px] font-medium', activeTab === t.key ? 'text-slate-900' : 'text-gray-400')}>
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
