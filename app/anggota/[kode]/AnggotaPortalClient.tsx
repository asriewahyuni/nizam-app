'use client'

import { useState, useTransition, useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
  Wallet, Briefcase, Bell, LogOut, TrendingUp,
  CheckCircle, ArrowUpCircle, ArrowDownCircle,
  Star, GraduationCap, FileText, Send, Upload, XCircle,
  ChevronDown, ChevronUp, AlertCircle, Home,
  Heart, Coins, Clock, Users, BadgeCheck, Scale, Banknote, TrendingDown,
} from 'lucide-react'
import {
  createProyek, updateStatusPenawaran, createPembiayaan, toggleMinatProyek, batalkanPembiayaan,
  type KojasmatAnggota, type KojasmatProyek, type KojasmatSimpanan,
  type KojasmatPenawaran, type KojasmatPembiayaan, type KojasmatPelatihanTerjadwal,
} from '@/modules/kojasmat/actions/kojasmat.actions'
import {
  kirimLaporanProyek, simpanDokumen, hapusDokumen, getDokumenByRef,
  type KojasmatLaporanProyek, type KojasmatDokumen,
} from '@/modules/kojasmat/actions/kojasmat-membership.actions'
import {
  getLaporanKeuanganProyek, catatTransaksiProyek, getTransaksiByProyek, getPemodalDenganPotensi,
  type KojasmatLaporanKeuanganProyek, type KojasmatProyekTransaksi, type KojasmatPemodalDenganPotensi,
} from '@/modules/kojasmat/actions/kojasmat-keuangan.actions'

// ─── TYPES ────────────────────────────────────────────────────────────────────

type Props = {
  anggota: KojasmatAnggota
  simpanan: KojasmatSimpanan[]
  proyekDiajukan: KojasmatProyek[]
  pembiayaan: KojasmatPembiayaan[]
  penawaran: KojasmatPenawaran[]
  laporan: KojasmatLaporanProyek[]
  proyekTersedia: KojasmatProyek[]
  pelatihan: KojasmatPelatihanTerjadwal[]
  orgNama: string
}

type ActiveTab = 'beranda' | 'simpanan' | 'proyek' | 'investasi' | 'penawaran' | 'laporan'

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

function fmtShort(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}rb`
  return String(n)
}

function fmtTanggal(d: string) {
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d))
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

function TabBeranda({ anggota, simpanan, proyekDiajukan, pembiayaan, penawaran, pelatihan, orgNama }: Props) {
  const totalSimpanan = simpanan.reduce((s, x) => s + Number(x.saldo), 0)
  const proyekAktif = proyekDiajukan.filter(p => p.status === 'BERJALAN')
  const penawaranBaru = penawaran.filter(p => p.status === 'TERKIRIM').length

  return (
    <div className="space-y-5">
      {/* Hero Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-800 to-emerald-950 p-6 text-white shadow-xl ring-1 ring-amber-400/30">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400" />
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-12 translate-x-12" />
        <div className="absolute bottom-0 left-0 w-28 h-28 bg-white/5 rounded-full translate-y-8 -translate-x-8" />
        <div className="relative">
          <p className="text-emerald-200 text-xs uppercase tracking-widest mb-1">{orgNama}</p>
          <p className="text-emerald-300 text-sm mb-4">{anggota.kode_anggota}</p>
          <p className="text-emerald-200 text-xs mb-0.5">Total Simpanan</p>
          <p className="text-4xl font-bold tracking-tight text-amber-300">{fmt(totalSimpanan)}</p>

          <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/10 pt-4">
            {[
              { label: 'Pokok',    jenis: 'POKOK',    color: 'text-blue-300' },
              { label: 'Wajib',    jenis: 'WAJIB',    color: 'text-emerald-300' },
              { label: 'Sukarela', jenis: 'SUKARELA', color: 'text-purple-300' },
            ].map(({ label, jenis, color }) => {
              const s = simpanan.find(x => x.jenis === jenis)
              return (
                <div key={jenis} className="text-center">
                  <p className="text-xs text-emerald-300/70">{label}</p>
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

      {/* Jadwal Pelatihan */}
      {pelatihan.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Jadwal Pelatihan</p>
          {pelatihan.map(p => {
            const sisaKuota = p.kuota - (p.peserta_count ?? 0)
            const kuotaPenuh = sisaKuota <= 0
            return (
              <div key={p.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-amber-50 p-2 shrink-0">
                      <GraduationCap className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{p.judul}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{fmtTanggal(p.tanggal)}</p>
                      {(p.instruktur || p.lokasi) && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {[p.instruktur, p.lokasi].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>
                  {p.is_terdaftar
                    ? <Badge text="Terdaftar" cls="bg-emerald-100 text-emerald-700" />
                    : kuotaPenuh
                      ? <Badge text="Kuota Penuh" cls="bg-gray-100 text-gray-500" />
                      : null}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Users className="h-3.5 w-3.5" />
                    {p.peserta_count ?? 0}/{p.kuota} peserta
                  </span>
                  {!p.is_terdaftar && !kuotaPenuh && (
                    <a
                      href={`/kojasmat/daftar/${p.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full bg-amber-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-amber-600 transition-colors cursor-pointer"
                    >
                      Daftar Sekarang
                    </a>
                  )}
                </div>
              </div>
            )
          })}
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
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-800 to-emerald-950 p-5 text-white ring-1 ring-amber-400/30">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400" />
        <p className="text-emerald-200 text-xs mb-1">Total Simpanan</p>
        <p className="text-3xl font-bold text-amber-300">{fmt(total)}</p>
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

async function uploadDokumenProyek(file: File, orgId: string): Promise<{ key: string; name: string; size: number; mime: string } | { error: string }> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('org_id', orgId)
  fd.append('ref_type', 'PROYEK')
  try {
    const res = await fetch('/api/kojasmat/upload', { method: 'POST', body: fd })
    const data = await res.json()
    if (!res.ok) return { error: data.error ?? 'Upload gagal' }
    return data
  } catch {
    return { error: 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.' }
  }
}

async function getFileUrl(key: string): Promise<string | null> {
  const res = await fetch(`/api/kojasmat/file?key=${encodeURIComponent(key)}`)
  if (!res.ok) return null
  return (await res.json()).url ?? null
}

const DOK_LABELS: Record<string, string> = {
  KELAYAKAN_USAHA: 'Kelayakan Usaha', PROPOSAL: 'Proposal',
  PENAWARAN_HARGA: 'Penawaran Harga', PROYEKSI_KEUANGAN: 'Proyeksi Keuangan',
  ANALISA_BISNIS: 'Analisa Bisnis', PENAWARAN_SYIRKAH: 'Penawaran Syirkah',
  AKAD: 'Akad', LAINNYA: 'Dokumen Lain',
}

function ProyekDokumenSection({ proyekId, orgId }: { proyekId: string; orgId: string }) {
  const [docs, setDocs] = useState<KojasmatDokumen[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [jenisBaru, setJenisBaru] = useState<KojasmatDokumen['jenis_dokumen']>('KELAYAKAN_USAHA')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    getDokumenByRef('PROYEK', proyekId).then(d => {
      if (!cancelled) { setDocs(d); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [proyekId])

  async function handleUpload(file: File) {
    setUploading(true)
    setUploadError(null)
    const res = await uploadDokumenProyek(file, orgId)
    if ('error' in res) { setUploadError(res.error); setUploading(false); return }
    startTransition(async () => {
      const saved = await simpanDokumen({
        org_id: orgId, referensi_type: 'PROYEK', referensi_id: proyekId,
        jenis_dokumen: jenisBaru, nama_file: res.name,
        file_key: res.key, file_size: res.size, mime_type: res.mime,
      })
      if (saved.data) {
        setDocs(prev => [...prev, saved.data!])
      } else {
        setUploadError(saved.error ?? 'Gagal menyimpan dokumen')
      }
      setUploading(false)
    })
  }

  async function handleDelete(dok: KojasmatDokumen) {
    setDeleting(dok.id)
    startTransition(async () => {
      await hapusDokumen(dok.id)
      setDocs(prev => prev.filter(d => d.id !== dok.id))
      setDeleting(null)
    })
  }

  async function handleView(key: string) {
    const url = await getFileUrl(key)
    if (url) window.open(url, '_blank')
  }

  if (loading) return <div className="h-10 animate-pulse rounded-xl bg-gray-100 mt-3" />

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Dokumen Pendukung</p>

      {docs.length === 0 && (
        <p className="text-xs text-gray-400">Belum ada dokumen</p>
      )}

      {docs.map(dok => (
        <div key={dok.id} className="flex items-center gap-2 rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2.5">
          <FileText className="h-4 w-4 shrink-0 text-gray-400" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-700">{DOK_LABELS[dok.jenis_dokumen] ?? dok.jenis_dokumen}</p>
            <p className="text-xs text-gray-400 truncate">{dok.nama_file}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => handleView(dok.file_key)}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer">
              Lihat
            </button>
            <button onClick={() => handleDelete(dok)} disabled={deleting === dok.id}
              className="rounded-lg border border-red-100 bg-white px-2 py-1 text-xs text-red-500 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50">
              {deleting === dok.id ? '...' : 'Hapus'}
            </button>
          </div>
        </div>
      ))}

      {/* Upload baru */}
      <div className="flex items-center gap-2 rounded-2xl border border-dashed border-gray-200 px-3 py-2.5">
        <select
          value={jenisBaru}
          onChange={e => setJenisBaru(e.target.value as KojasmatDokumen['jenis_dokumen'])}
          className="flex-1 rounded-xl border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-emerald-400 bg-white">
          {Object.entries(DOK_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <label className={cn(
          'flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs transition-colors shrink-0',
          uploading ? 'border-gray-200 text-gray-400 cursor-not-allowed' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 cursor-pointer'
        )}>
          {uploading ? 'Mengunggah...' : <><Upload className="h-3.5 w-3.5" /> Upload</>}
          {!uploading && (
            <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
              onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); e.target.value = '' }} />
          )}
        </label>
      </div>
      {uploadError && (
        <p className="flex items-center gap-1 text-xs text-rose-600">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {uploadError}
        </p>
      )}
    </div>
  )
}

function LaporanKeuanganCards({ laporan, personalLabel, personalAmount, personalNote }: {
  laporan: KojasmatLaporanKeuanganProyek
  personalLabel: string
  personalAmount: number
  personalNote: string
}) {
  const { labaRugi, neraca, cashflow, analisis } = laporan

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-gray-50 p-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-2">
          <Scale className="h-3.5 w-3.5 text-blue-500" /> Laba / Rugi
        </p>
        <div className="space-y-1 text-xs text-gray-600">
          <div className="flex justify-between"><span>Total Pendapatan</span><span>{fmt(labaRugi.totalPendapatan)}</span></div>
          <div className="flex justify-between"><span>Total Beban</span><span>({fmt(labaRugi.totalBeban)})</span></div>
          <div className={cn('flex justify-between font-bold pt-1 border-t border-gray-200',
            labaRugi.labaBersih >= 0 ? 'text-emerald-700' : 'text-red-600')}>
            <span>Laba Bersih</span><span>{fmt(labaRugi.labaBersih)}</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-gray-50 p-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-2">
          <Wallet className="h-3.5 w-3.5 text-emerald-500" /> Neraca Sederhana
        </p>
        <div className="space-y-1 text-xs text-gray-600">
          <div className="flex justify-between"><span>Kas Proyek (Aset)</span><span>{fmt(neraca.kas)}</span></div>
          <div className="flex justify-between"><span>Modal Pemodal</span><span>{fmt(neraca.modalPemodal)}</span></div>
          <div className="flex justify-between"><span>Laba Ditahan</span><span>{fmt(neraca.labaDitahan)}</span></div>
        </div>
      </div>

      <div className="rounded-xl bg-gray-50 p-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-2">
          <TrendingDown className="h-3.5 w-3.5 text-purple-500 rotate-180" /> Cashflow
        </p>
        <div className="space-y-1 text-xs text-gray-600">
          <div className="flex justify-between"><span>Kas Masuk Operasional</span><span>{fmt(cashflow.kasMasukOperasional)}</span></div>
          <div className="flex justify-between"><span>Kas Keluar Operasional</span><span>({fmt(cashflow.kasKeluarOperasional)})</span></div>
          <div className="flex justify-between font-semibold text-gray-800 pt-1 border-t border-gray-200">
            <span>Saldo Kas Akhir</span><span>{fmt(cashflow.saldoKasAkhir)}</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-emerald-50 to-amber-50 p-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-900 mb-2">
          <Banknote className="h-3.5 w-3.5 text-amber-600" /> Sharing Profit &amp; Potensi Bagi Hasil Saya
        </p>
        <p className="text-xs text-emerald-800">{personalLabel}</p>
        <p className="mt-1 text-base font-bold text-amber-700">{fmt(personalAmount)}</p>
        <p className="text-xs text-emerald-600">{personalNote}</p>
      </div>

      {analisis.length > 0 && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
          <p className="text-xs font-semibold text-blue-900 mb-1.5">Analisis</p>
          <ul className="space-y-1 list-disc list-inside text-xs text-blue-800">
            {analisis.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

function LaporanInvestorPanel({ proyekId, porsiPct }: { proyekId: string; porsiPct: number }) {
  const [laporan, setLaporan] = useState<KojasmatLaporanKeuanganProyek | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getLaporanKeuanganProyek(proyekId).then(l => {
      if (!cancelled) { setLaporan(l); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [proyekId])

  if (loading) return <div className="py-6 text-center text-xs text-gray-400">Memuat laporan keuangan...</div>
  if (!laporan) return null

  const potensiSayaRp = laporan.bagiHasil.potensiBagiHasilPemodal * porsiPct / 100

  return (
    <LaporanKeuanganCards
      laporan={laporan}
      personalLabel={`Nisbah Pemodal ${laporan.bagiHasil.nisbahPemodal}% × Porsi Saya ${porsiPct.toFixed(1)}%`}
      personalAmount={potensiSayaRp}
      personalNote="Estimasi potensi bagi hasil berdasarkan laba bersih saat ini — bukan jaminan hasil aktual."
    />
  )
}

function DaftarPemodalPanel({ proyekId }: { proyekId: string }) {
  const [list, setList] = useState<KojasmatPemodalDenganPotensi[] | null>(null)

  useEffect(() => {
    let cancelled = false
    getPemodalDenganPotensi(proyekId).then(l => { if (!cancelled) setList(l) })
    return () => { cancelled = true }
  }, [proyekId])

  if (list === null) return <div className="py-4 text-center text-xs text-gray-400">Memuat daftar pemodal...</div>
  if (list.length === 0) return <p className="text-xs text-gray-400 py-2">Belum ada pemodal yang mendanai proyek ini.</p>

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Daftar Pemodal</p>
      {list.map(pm => (
        <div key={pm.id} className="rounded-xl border border-gray-100 bg-white p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-900">{pm.pemodal_nama}</p>
            <p className="text-sm font-bold text-gray-900">{fmt(pm.jumlah)}</p>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-gray-400">
            <span>Porsi {pm.porsi_pct.toFixed(1)}% · {pm.kehadiran_akad === 'DIWAKILKAN' ? 'Diwakilkan koperasi' : 'Hadir sendiri'}</span>
            <span className="font-medium text-emerald-600">Potensi {fmt(pm.potensiBagiHasil)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

const KATEGORI_PENDAPATAN = ['Penjualan', 'Jasa', 'Pendapatan Lain'] as const
const KATEGORI_BEBAN = ['Bahan Baku', 'Operasional', 'Gaji/Upah', 'Sewa', 'Transportasi', 'Beban Lain'] as const

function ProyekKeuanganPengelolaPanel({ proyekId, orgId, status }: {
  proyekId: string; orgId: string; status: string
}) {
  const [pending, startTransition] = useTransition()
  const [laporan, setLaporan] = useState<KojasmatLaporanKeuanganProyek | null>(null)
  const [transaksi, setTransaksi] = useState<KojasmatProyekTransaksi[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'laporan' | 'riwayat'>('laporan')
  const [form, setForm] = useState<{
    tanggal: string; jenis: 'PENDAPATAN' | 'BEBAN'; kategori: string; keterangan: string; jumlah: string
  }>({
    tanggal: new Date().toISOString().slice(0, 10),
    jenis: 'PENDAPATAN',
    kategori: KATEGORI_PENDAPATAN[0],
    keterangan: '',
    jumlah: '',
  })

  const bisaInput = status === 'BERJALAN'

  async function reload() {
    setLoading(true)
    const [l, t] = await Promise.all([
      getLaporanKeuanganProyek(proyekId),
      getTransaksiByProyek(proyekId),
    ])
    setLaporan(l)
    setTransaksi(t)
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false
    reload().then(() => { if (cancelled) return })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyekId])

  function handleSubmit() {
    if (!form.jumlah || Number(form.jumlah) <= 0) return
    startTransition(async () => {
      await catatTransaksiProyek({
        org_id: orgId,
        proyek_id: proyekId,
        tanggal: form.tanggal,
        jenis: form.jenis,
        kategori: form.kategori,
        keterangan: form.keterangan || undefined,
        jumlah: Number(form.jumlah),
      })
      setForm(f => ({ ...f, keterangan: '', jumlah: '' }))
      await reload()
    })
  }

  const kategoriOptions = form.jenis === 'PENDAPATAN' ? KATEGORI_PENDAPATAN : KATEGORI_BEBAN

  return (
    <div className="mt-3 space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Keuangan Proyek</p>

      {bisaInput ? (
        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3 space-y-2.5">
          <p className="text-xs font-semibold text-gray-700">Catat Perkembangan Proyek</p>
          <div className="flex rounded-xl border border-gray-200 bg-white p-1">
            {(['PENDAPATAN', 'BEBAN'] as const).map(j => (
              <button key={j}
                onClick={() => setForm(f => ({ ...f, jenis: j, kategori: j === 'PENDAPATAN' ? KATEGORI_PENDAPATAN[0] : KATEGORI_BEBAN[0] }))}
                className={cn('flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors cursor-pointer',
                  form.jenis === j
                    ? (j === 'PENDAPATAN' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')
                    : 'text-gray-500 hover:text-gray-700')}>
                {j === 'PENDAPATAN' ? 'Pendapatan' : 'Beban'}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={form.tanggal} onChange={e => setForm(f => ({ ...f, tanggal: e.target.value }))}
              className="rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-emerald-500 bg-white" />
            <select value={form.kategori} onChange={e => setForm(f => ({ ...f, kategori: e.target.value }))}
              className="rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-emerald-500 bg-white">
              {kategoriOptions.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <input type="number" placeholder="Jumlah (Rp)" value={form.jumlah}
            onChange={e => setForm(f => ({ ...f, jumlah: e.target.value }))}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-emerald-500 bg-white" />
          <input type="text" placeholder="Keterangan (opsional)" value={form.keterangan}
            onChange={e => setForm(f => ({ ...f, keterangan: e.target.value }))}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-emerald-500 bg-white" />
          <button onClick={handleSubmit} disabled={pending || !form.jumlah}
            className="w-full rounded-xl bg-emerald-600 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer">
            {pending ? 'Menyimpan...' : 'Simpan Transaksi'}
          </button>
        </div>
      ) : (
        <p className="text-xs text-gray-400">Pencatatan transaksi hanya dapat dilakukan saat proyek berstatus Berjalan.</p>
      )}

      <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-1">
        {([['laporan', 'Laporan Keuangan'], ['riwayat', 'Riwayat Transaksi']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setView(key)}
            className={cn('flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors cursor-pointer',
              view === key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-6 text-center text-xs text-gray-400">Memuat data keuangan...</div>
      ) : view === 'laporan' ? (
        laporan && (
          <LaporanKeuanganCards
            laporan={laporan}
            personalLabel={`Nisbah Pengaju ${laporan.bagiHasil.nisbahPengaju}%`}
            personalAmount={laporan.bagiHasil.potensiBagiHasilPengaju}
            personalNote="Estimasi potensi bagi hasil berdasarkan laba bersih saat ini — bukan jaminan hasil aktual."
          />
        )
      ) : (
        <div className="space-y-2">
          {transaksi.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">Belum ada transaksi tercatat</p>
          )}
          {transaksi.map(t => (
            <div key={t.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-2.5">
              <div>
                <p className="text-xs font-medium text-gray-800">{t.kategori}</p>
                <p className="text-xs text-gray-400">{String(t.tanggal).split('T')[0]}{t.keterangan ? ` · ${t.keterangan}` : ''}</p>
              </div>
              <p className={cn('text-xs font-semibold', t.jenis === 'PENDAPATAN' ? 'text-emerald-600' : 'text-red-600')}>
                {t.jenis === 'PENDAPATAN' ? '+' : '−'}{fmt(t.jumlah)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TabProyek({ anggota, proyekDiajukan }: {
  anggota: KojasmatAnggota; proyekDiajukan: KojasmatProyek[]
}) {
  const [pending, startTransition] = useTransition()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [uploadingDok, setUploadingDok] = useState(false)
  const [uploadDokError, setUploadDokError] = useState<string | null>(null)
  const [uploadedDoks, setUploadedDoks] = useState<{ key: string; name: string; jenis: string }[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [form, setForm] = useState({
    nama_proyek: '', deskripsi: '', jenis_akad: 'MUDHARABAH',
    kebutuhan_modal: '', durasi_bulan: '6', agunan: '', nisbah_pengaju: 30,
  })

  const nisbah_pemodal = 100 - form.nisbah_pengaju

  async function handleDokUpload(jenis: string, file: File) {
    setUploadingDok(true)
    setUploadDokError(null)
    const result = await uploadDokumenProyek(file, anggota.org_id)
    setUploadingDok(false)
    if ('error' in result) { setUploadDokError(result.error); return }
    setUploadedDoks(prev => [...prev.filter(d => d.jenis !== jenis), { ...result, jenis }])
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
            className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors cursor-pointer">
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
                    <ProyekDokumenSection proyekId={p.id} orgId={anggota.org_id} />
                    {!['DRAFT', 'REVIEW_DPS', 'DITOLAK'].includes(p.status) && (
                      <DaftarPemodalPanel proyekId={p.id} />
                    )}
                    {(p.status === 'BERJALAN' || p.status === 'SELESAI') && (
                      <ProyekKeuanganPengelolaPanel proyekId={p.id} orgId={anggota.org_id} status={p.status} />
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Sheet Ajukan Proyek */}
      <Sheet open={sheetOpen} onClose={resetSheet} title="Ajukan Proyek Baru">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Nama Proyek *</label>
            <input className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder="Contoh: Usaha Konveksi Seragam"
              value={form.nama_proyek} onChange={e => setForm(f => ({ ...f, nama_proyek: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Jenis Akad *</label>
            <select className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500"
              value={form.jenis_akad} onChange={e => setForm(f => ({ ...f, jenis_akad: e.target.value }))}>
              <option value="MUDHARABAH">Mudharabah — Modal penuh dari pemodal</option>
              <option value="MURABAHAH">Murabahah — Pembelian cicil</option>
              <option value="INAN">Musyarakah Inan — Modal bersama</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Modal (Rp) *</label>
              <input type="number" className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                placeholder="5000000"
                value={form.kebutuhan_modal} onChange={e => setForm(f => ({ ...f, kebutuhan_modal: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Durasi (bulan)</label>
              <input type="number" className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                value={form.durasi_bulan} onChange={e => setForm(f => ({ ...f, durasi_bulan: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Min. Investasi per Pemodal (Rp)
              <span className="ml-1 font-normal text-gray-400 text-xs">— kosongkan jika tidak ada batas</span>
            </label>
            <input type="number" min="0" step="50000"
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500"
              placeholder="Contoh: 500000"
              value={(form as { min_investasi?: string }).min_investasi ?? ''}
              onChange={e => setForm(f => ({ ...f, min_investasi: e.target.value }))} />
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
                className="w-full accent-emerald-700 cursor-pointer"
                value={form.nisbah_pengaju}
                onChange={e => setForm(f => ({ ...f, nisbah_pengaju: Number(e.target.value) }))} />
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-gray-600">Pemodal</span>
                <span className="text-blue-700 font-bold text-sm">{nisbah_pemodal}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-blue-200 overflow-hidden">
                <div className="h-2 bg-gradient-to-r from-emerald-600 to-emerald-800 rounded-full transition-all"
                  style={{ width: `${form.nisbah_pengaju}%` }} />
              </div>
              <p className="text-xs text-blue-600">Koperasi menerima ujrah nominal tetap — tidak masuk nisbah.</p>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Agunan / Jaminan</label>
            <input className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500"
              placeholder="Contoh: BPKB Motor"
              value={form.agunan} onChange={e => setForm(f => ({ ...f, agunan: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Deskripsi Usaha</label>
            <textarea rows={3} className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 resize-none"
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
                          onChange={e => { if (e.target.files?.[0]) handleDokUpload(jenis, e.target.files[0]); e.target.value = '' }} />
                      </label>
                    )}
                  </div>
                )
              })}
            </div>
            {uploadingDok && <p className="text-xs text-gray-400 mt-1">Mengunggah...</p>}
            {uploadDokError && (
              <p className="flex items-center gap-1 text-xs text-rose-600 mt-1">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {uploadDokError}
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={resetSheet}
              className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
              Batal
            </button>
            <button onClick={handleCreate}
              disabled={!form.nama_proyek || !form.kebutuhan_modal || pending || uploadingDok}
              className="flex-1 rounded-2xl bg-emerald-700 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 transition-colors cursor-pointer">
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
  const [kehadiranAkad, setKehadiranAkad] = useState<'SENDIRI' | 'DIWAKILKAN'>('SENDIRI')

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
        kehadiran_akad: kehadiranAkad,
      })
      await updateStatusPenawaran(sheetBiayai.id, 'BERMINAT')
      setSheetBiayai(null)
      setJumlah('')
      setKehadiranAkad('SENDIRI')
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
                    <button onClick={() => { setSheetBiayai(p); setJumlah(''); setKehadiranAkad('SENDIRI') }}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-2.5 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors cursor-pointer">
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
            <div className="rounded-2xl bg-emerald-50 p-4">
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
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 text-lg font-semibold"
                placeholder="1000000"
                value={jumlah} onChange={e => setJumlah(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Presentasi & Penandatanganan Akad *
              </label>
              <div className="space-y-2">
                <button type="button" onClick={() => setKehadiranAkad('SENDIRI')}
                  className={cn(
                    'w-full flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-left transition-colors cursor-pointer',
                    kehadiranAkad === 'SENDIRI' ? 'border-emerald-700 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
                  )}>
                  <span className={cn(
                    'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2',
                    kehadiranAkad === 'SENDIRI' ? 'border-emerald-700' : 'border-gray-300'
                  )}>
                    {kehadiranAkad === 'SENDIRI' && <span className="h-2 w-2 rounded-full bg-emerald-700" />}
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-gray-900">Dihadiri Sendiri</span>
                    <span className="block text-xs text-gray-400 mt-0.5">Anda hadir langsung saat presentasi & tanda tangan akad</span>
                  </span>
                </button>
                <button type="button" onClick={() => setKehadiranAkad('DIWAKILKAN')}
                  className={cn(
                    'w-full flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-left transition-colors cursor-pointer',
                    kehadiranAkad === 'DIWAKILKAN' ? 'border-emerald-700 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
                  )}>
                  <span className={cn(
                    'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2',
                    kehadiranAkad === 'DIWAKILKAN' ? 'border-emerald-700' : 'border-gray-300'
                  )}>
                    {kehadiranAkad === 'DIWAKILKAN' && <span className="h-2 w-2 rounded-full bg-emerald-700" />}
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-gray-900">Diwakilkan oleh Koperasi</span>
                    <span className="block text-xs text-gray-400 mt-0.5">
                      Koperasi mewakili Anda hadir & tanda tangan akad — dikenakan ujrah {fmt(Number(sheetBiayai.ujrah_wakalah_akad ?? 0))} (ditentukan koperasi)
                    </span>
                  </span>
                </button>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setSheetBiayai(null)}
                className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm font-medium text-gray-600 cursor-pointer">
                Batal
              </button>
              <button onClick={handleBiayai} disabled={!jumlah || pending}
                className="flex-1 rounded-2xl bg-emerald-700 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 cursor-pointer">
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
          className="w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 py-4 text-sm font-semibold text-white hover:bg-emerald-800 transition-colors cursor-pointer">
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
            <select className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500"
              value={form.proyek_id} onChange={e => setForm(f => ({ ...f, proyek_id: e.target.value }))}>
              <option value="">— pilih proyek —</option>
              {proyekBerjalan.map(p => <option key={p.id} value={p.id}>{p.nama_proyek}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Mulai *</label>
              <input type="date" className="w-full rounded-2xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-emerald-500"
                value={form.periode_mulai} onChange={e => setForm(f => ({ ...f, periode_mulai: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Akhir *</label>
              <input type="date" className="w-full rounded-2xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-emerald-500"
                value={form.periode_akhir} onChange={e => setForm(f => ({ ...f, periode_akhir: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Omzet Minggu Ini (Rp) *</label>
            <input type="number" className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 text-lg font-semibold"
              placeholder="0"
              value={form.omzet_periode} onChange={e => setForm(f => ({ ...f, omzet_periode: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Ringkasan Kegiatan *</label>
            <textarea rows={4} className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 resize-none"
              placeholder="Ceritakan kegiatan usaha minggu ini..."
              value={form.ringkasan} onChange={e => setForm(f => ({ ...f, ringkasan: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Kendala <span className="text-gray-400">(opsional)</span></label>
            <textarea rows={2} className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 resize-none"
              placeholder="Masalah yang dihadapi..."
              value={form.kendala} onChange={e => setForm(f => ({ ...f, kendala: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Rencana Ke Depan <span className="text-gray-400">(opsional)</span></label>
            <textarea rows={2} className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 resize-none"
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
              className="flex-1 rounded-2xl bg-emerald-700 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 cursor-pointer">
              {pending ? 'Mengirim...' : 'Kirim Laporan'}
            </button>
          </div>
        </div>
      </Sheet>
    </div>
  )
}

// ─── TAB INVESTASI ────────────────────────────────────────────────────────────

const AKAD_BADGE: Record<string, string> = {
  MUDHARABAH: 'bg-emerald-100 text-emerald-700',
  MURABAHAH:  'bg-amber-100 text-amber-700',
  INAN:       'bg-blue-100 text-blue-700',
}
const AKAD_LABEL_INV: Record<string, string> = {
  MUDHARABAH: 'Mudharabah',
  MURABAHAH:  'Murabahah',
  INAN:       'Musyarakah Inan',
}

function TabInvestasi({
  anggota, simpanan, proyekTersedia, pembiayaan,
}: { anggota: KojasmatAnggota; simpanan: KojasmatSimpanan[]; proyekTersedia: KojasmatProyek[]; pembiayaan: KojasmatPembiayaan[] }) {
  const [list, setList] = useState(proyekTersedia)
  const [pending, startTransition] = useTransition()
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [sheetBiayai, setSheetBiayai] = useState<KojasmatProyek | null>(null)
  const [jumlah, setJumlah] = useState('')
  const [kehadiranAkad, setKehadiranAkad] = useState<'SENDIRI' | 'DIWAKILKAN'>('SENDIRI')
  const [biayaiError, setBiayaiError] = useState<string | null>(null)
  const [expandedPembiayaan, setExpandedPembiayaan] = useState<string | null>(null)
  const [pembiayaanList, setPembiayaanList] = useState(pembiayaan)
  const [batalkanId, setBatalkanId] = useState<string | null>(null)
  const [batalkanError, setBatalkanError] = useState<{ id: string; message: string } | null>(null)

  const totalSimpanan = simpanan.reduce((s, x) => s + Number(x.saldo), 0)

  function handleBatalkan(pembiayaanId: string) {
    setBatalkanId(pembiayaanId)
    setBatalkanError(null)
    startTransition(async () => {
      const res = await batalkanPembiayaan(pembiayaanId)
      setBatalkanId(null)
      if (res.error) { setBatalkanError({ id: pembiayaanId, message: res.error }); return }
      setPembiayaanList(prev => prev.filter(x => x.id !== pembiayaanId))
    })
  }

  function handleBiayai() {
    if (!sheetBiayai) return
    const jumlahNum = Number(jumlah)
    setBiayaiError(null)
    startTransition(async () => {
      const res = await createPembiayaan({
        org_id: anggota.org_id,
        proyek_id: sheetBiayai.id,
        pemodal_id: anggota.id,
        jumlah: jumlahNum,
        kehadiran_akad: kehadiranAkad,
      })
      if (res.error) {
        setBiayaiError(res.error)
        return
      }
      setList(prev => prev.map(x =>
        x.id === sheetBiayai.id
          ? { ...x, modal_terkumpul: Number(x.modal_terkumpul) + jumlahNum, sudah_dibiayai: true }
          : x
      ))
      setSheetBiayai(null)
      setJumlah('')
      setKehadiranAkad('SENDIRI')
    })
  }

  function handleMinat(p: KojasmatProyek) {
    setTogglingId(p.id)
    startTransition(async () => {
      const res = await toggleMinatProyek({
        org_id: anggota.org_id,
        proyek_id: p.id,
        anggota_id: anggota.id,
      })
      setList(prev => prev.map(x =>
        x.id === p.id
          ? { ...x, is_berminat: res.is_berminat, jumlah_minat: (Number(x.jumlah_minat) || 0) + (res.is_berminat ? 1 : -1) }
          : x
      ).sort((a, b) => Number(b.is_berminat) - Number(a.is_berminat)))
      setTogglingId(null)
    })
  }

  return (
    <div className="space-y-4">
      {/* Kapasitas investasi anggota */}
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
        <p className="text-xs text-emerald-600 font-medium">Total Simpanan Anda</p>
        <p className="text-xl font-bold text-emerald-800 mt-0.5">{fmt(totalSimpanan)}</p>
        <p className="text-xs text-emerald-600 mt-0.5">Dapat digunakan sebagai modal investasi</p>
      </div>

      {pembiayaanList.length > 0 && (
        <div className="space-y-3">
          <p className="font-semibold text-gray-900">Proyek yang Saya Biayai</p>
          {pembiayaanList.map((pm: KojasmatPembiayaan & {
            proyek_id?: string; nama_proyek?: string; jenis_akad?: string; proyek_status?: string
          }) => {
            const isOpen = expandedPembiayaan === pm.id
            const bisaBatalkan = pm.proyek_status === 'OPEN' || pm.proyek_status === 'TERPENUHI'
            return (
              <div key={pm.id} className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                <button
                  className="w-full text-left p-4 cursor-pointer"
                  onClick={() => setExpandedPembiayaan(isOpen ? null : pm.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{pm.nama_proyek ?? '—'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Porsi: {Number(pm.porsi_pct).toFixed(1)}%</p>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{fmt(Number(pm.jumlah))}</p>
                        {pm.proyek_status && (
                          <Badge text={STATUS_LABEL[pm.proyek_status]?.label ?? pm.proyek_status}
                            cls={STATUS_LABEL[pm.proyek_status]?.color ?? 'bg-gray-100 text-gray-600'} />
                        )}
                      </div>
                      {isOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                    </div>
                  </div>
                </button>
                {isOpen && pm.proyek_id && (
                  <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-3">
                    {bisaBatalkan && (
                      <div className="rounded-xl border border-rose-100 bg-rose-50 p-3">
                        <p className="text-xs text-rose-700">
                          Proyek belum berjalan — Anda masih dapat membatalkan pendanaan ini.
                        </p>
                        {batalkanError?.id === pm.id && (
                          <p className="text-xs text-rose-600 mt-1">{batalkanError.message}</p>
                        )}
                        <button
                          onClick={() => handleBatalkan(pm.id)}
                          disabled={pending && batalkanId === pm.id}
                          className="mt-2 w-full rounded-xl border border-rose-300 bg-white py-2 text-xs font-semibold text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {pending && batalkanId === pm.id ? 'Membatalkan...' : 'Batalkan Pendanaan'}
                        </button>
                      </div>
                    )}
                    <LaporanInvestorPanel proyekId={pm.proyek_id} porsiPct={Number(pm.porsi_pct)} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
            <Coins className="h-8 w-8 text-slate-400" />
          </div>
          <p className="font-semibold text-gray-700">Belum ada proyek tersedia</p>
          <p className="mt-1 text-sm text-gray-400">Pantau terus, pengurus koperasi akan membuka peluang investasi baru.</p>
        </div>
      ) : (
        <p className="text-xs text-gray-400">
          {list.length} proyek tersedia · diurutkan berdasarkan relevansi dan ketertarikan Anda
        </p>
      )}

      {list.map(p => {
        const sisa = Number(p.kebutuhan_modal) - Number(p.modal_terkumpul)
        const pct = Number(p.kebutuhan_modal) > 0
          ? Math.min(100, Math.round(Number(p.modal_terkumpul) / Number(p.kebutuhan_modal) * 100))
          : 0
        const terjangkau = totalSimpanan > 0 && sisa <= totalSimpanan
        const minInv = Number(p.min_investasi)
        const bisaInvest = minInv === 0 || totalSimpanan >= minInv

        return (
          <div key={p.id} className={cn(
            'rounded-2xl border bg-white shadow-sm overflow-hidden transition-all',
            p.is_berminat ? 'border-emerald-200' : 'border-gray-100'
          )}>
            {/* Header card */}
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', AKAD_BADGE[p.jenis_akad])}>
                      {AKAD_LABEL_INV[p.jenis_akad]}
                    </span>
                    {terjangkau && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        <BadgeCheck className="h-3 w-3" /> Sesuai simpanan
                      </span>
                    )}
                    {p.sudah_dibiayai && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        <CheckCircle className="h-3 w-3" /> Sudah dibiayai
                      </span>
                    )}
                  </div>
                  <p className="font-semibold text-gray-900 text-sm leading-snug">{p.nama_proyek}</p>
                  <p className="text-xs text-gray-400 mt-0.5">oleh {p.pengaju_nama ?? '—'} · {p.durasi_bulan} bulan</p>
                </div>

                {/* Tombol minat */}
                <button
                  onClick={() => handleMinat(p)}
                  disabled={!!togglingId || pending}
                  className={cn(
                    'flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer disabled:opacity-60 shrink-0',
                    p.is_berminat
                      ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'
                      : 'border-gray-200 bg-white text-gray-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500'
                  )}
                >
                  <Heart className={cn('h-3.5 w-3.5', p.is_berminat && 'fill-rose-500')} />
                  {p.is_berminat ? 'Diminati' : 'Minati'}
                  {Number(p.jumlah_minat) > 0 && (
                    <span className="ml-0.5 text-gray-400">({p.jumlah_minat})</span>
                  )}
                </button>
              </div>

              {p.deskripsi && (
                <p className="mt-2 text-xs text-gray-500 line-clamp-2 leading-relaxed">{p.deskripsi}</p>
              )}

              {/* Progress funding */}
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Modal terkumpul</span>
                  <span className="font-medium">{pct}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-100">
                  <div
                    className={cn('h-2 rounded-full transition-all', pct >= 80 ? 'bg-emerald-500' : pct >= 40 ? 'bg-blue-400' : 'bg-gray-300')}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-gray-400">{fmt(Number(p.modal_terkumpul))}</span>
                  <span className="font-medium text-gray-700">{fmt(Number(p.kebutuhan_modal))}</span>
                </div>
              </div>

              <button
                onClick={() => { setSheetBiayai(p); setJumlah(''); setKehadiranAkad('SENDIRI'); setBiayaiError(null) }}
                className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-2.5 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors cursor-pointer"
              >
                <ArrowUpCircle className="h-3.5 w-3.5" /> Biayai Proyek Ini
              </button>
            </div>

            {/* Footer stats */}
            <div className="border-t border-gray-50 px-4 py-2.5 flex flex-wrap items-center gap-3 text-xs text-gray-500 bg-gray-50/50">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 shrink-0" /> {p.durasi_bulan} bulan
              </span>
              {p.nisbah_pemodal > 0 && (
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5 shrink-0" /> Nisbah pemodal {p.nisbah_pemodal}%
                </span>
              )}
              {Number(p.ujrah_nominal) > 0 && (
                <span className="flex items-center gap-1">
                  <Coins className="h-3.5 w-3.5 shrink-0" /> Ujrah {fmt(Number(p.ujrah_nominal))}
                </span>
              )}
              {minInv > 0 && (
                <span className={cn('flex items-center gap-1', !bisaInvest && 'text-amber-600')}>
                  <Users className="h-3.5 w-3.5 shrink-0" />
                  Min. {fmt(minInv)}
                  {!bisaInvest && ' (di atas simpanan Anda)'}
                </span>
              )}
              {p.agunan && (
                <span className="flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> Ada agunan
                </span>
              )}
            </div>
          </div>
        )
      })}

      <Sheet open={!!sheetBiayai} onClose={() => setSheetBiayai(null)} title="Biayai Proyek">
        {sheetBiayai && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-emerald-50 p-4">
              <p className="font-semibold text-gray-900">{sheetBiayai.nama_proyek}</p>
              <p className="text-sm text-gray-500 mt-1">
                Sisa kebutuhan: <strong>{fmt(Number(sheetBiayai.kebutuhan_modal) - Number(sheetBiayai.modal_terkumpul))}</strong>
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Ujrah koperasi: {fmt(Number(sheetBiayai.ujrah_nominal))} (nominal tetap)
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Jumlah Pembiayaan (Rp) *</label>
              <input type="number"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 text-lg font-semibold"
                placeholder="1000000"
                value={jumlah} onChange={e => setJumlah(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Presentasi & Penandatanganan Akad *
              </label>
              <div className="space-y-2">
                <button type="button" onClick={() => setKehadiranAkad('SENDIRI')}
                  className={cn(
                    'w-full flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-left transition-colors cursor-pointer',
                    kehadiranAkad === 'SENDIRI' ? 'border-emerald-700 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
                  )}>
                  <span className={cn(
                    'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2',
                    kehadiranAkad === 'SENDIRI' ? 'border-emerald-700' : 'border-gray-300'
                  )}>
                    {kehadiranAkad === 'SENDIRI' && <span className="h-2 w-2 rounded-full bg-emerald-700" />}
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-gray-900">Dihadiri Sendiri</span>
                    <span className="block text-xs text-gray-400 mt-0.5">Anda hadir langsung saat presentasi & tanda tangan akad</span>
                  </span>
                </button>
                <button type="button" onClick={() => setKehadiranAkad('DIWAKILKAN')}
                  className={cn(
                    'w-full flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-left transition-colors cursor-pointer',
                    kehadiranAkad === 'DIWAKILKAN' ? 'border-emerald-700 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
                  )}>
                  <span className={cn(
                    'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2',
                    kehadiranAkad === 'DIWAKILKAN' ? 'border-emerald-700' : 'border-gray-300'
                  )}>
                    {kehadiranAkad === 'DIWAKILKAN' && <span className="h-2 w-2 rounded-full bg-emerald-700" />}
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-gray-900">Diwakilkan oleh Koperasi</span>
                    <span className="block text-xs text-gray-400 mt-0.5">
                      Koperasi mewakili Anda hadir & tanda tangan akad — dikenakan ujrah {fmt(Number(sheetBiayai.ujrah_wakalah_akad ?? 0))} (ditentukan koperasi)
                    </span>
                  </span>
                </button>
              </div>
            </div>
            {biayaiError && (
              <p className="text-xs text-rose-600">{biayaiError}</p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setSheetBiayai(null)}
                className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm font-medium text-gray-600 cursor-pointer">
                Batal
              </button>
              <button onClick={handleBiayai} disabled={!jumlah || pending}
                className="flex-1 rounded-2xl bg-emerald-700 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 cursor-pointer">
                {pending ? 'Memproses...' : 'Konfirmasi'}
              </button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  )
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────

export default function AnggotaPortalClient(props: Props) {
  const { anggota, simpanan, proyekDiajukan, pembiayaan, penawaran, laporan, proyekTersedia, orgNama } = props
  const [activeTab, setActiveTab] = useState<ActiveTab>('beranda')

  const proyekBerjalan = proyekDiajukan.filter(p => p.status === 'BERJALAN')
  const penawaranBaru = penawaran.filter(p => p.status === 'TERKIRIM').length

  const tabs: { key: ActiveTab; label: string; icon: React.ElementType; badge?: number }[] = [
    { key: 'beranda',   label: 'Beranda',   icon: Home },
    { key: 'simpanan',  label: 'Simpanan',  icon: Wallet },
    { key: 'proyek',    label: 'Proyek',    icon: Briefcase },
    { key: 'investasi', label: 'Investasi', icon: Coins, badge: proyekTersedia.length || undefined },
    { key: 'penawaran', label: 'Penawaran', icon: Bell, badge: penawaranBaru || undefined },
    ...(proyekBerjalan.length > 0 ? [{ key: 'laporan' as ActiveTab, label: 'Laporan', icon: FileText }] : []),
  ]

  return (
    <div className="min-h-screen bg-emerald-50/40">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-sm border-b border-amber-200/60 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div>
            <p className="text-[10px] text-emerald-600/70 uppercase tracking-widest">{orgNama}</p>
            <h1 className="font-bold text-gray-900 text-base leading-tight">{anggota.nama}</h1>
          </div>
          <div className="flex items-center gap-2">
            {anggota.is_verified && (
              <span className="hidden sm:flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                <CheckCircle className="h-3 w-3" /> Terverifikasi
              </span>
            )}
            <span className="font-mono text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
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
        {activeTab === 'proyek'    && <TabProyek anggota={anggota} proyekDiajukan={proyekDiajukan} />}
        {activeTab === 'investasi' && <TabInvestasi anggota={anggota} simpanan={simpanan} proyekTersedia={proyekTersedia} pembiayaan={pembiayaan} />}
        {activeTab === 'penawaran' && <TabPenawaran anggota={anggota} penawaran={penawaran} />}
        {activeTab === 'laporan'   && <TabLaporan anggota={anggota} proyekDiajukan={proyekDiajukan} laporan={laporan} />}
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/90 backdrop-blur-sm border-t border-amber-200/60 safe-area-pb">
        <div className="mx-auto flex max-w-lg px-2">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={cn('relative flex flex-1 flex-col items-center gap-1 py-3 transition-colors cursor-pointer',
                activeTab === t.key ? 'text-emerald-700' : 'text-gray-400 hover:text-gray-600')}>
              <div className={cn('relative p-1.5 rounded-xl transition-colors', activeTab === t.key && 'bg-emerald-50')}>
                <t.icon className="h-5 w-5" />
                {t.badge !== undefined && t.badge > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                    {t.badge}
                  </span>
                )}
              </div>
              <span className={cn('text-[10px] font-medium', activeTab === t.key ? 'text-emerald-700' : 'text-gray-400')}>
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
