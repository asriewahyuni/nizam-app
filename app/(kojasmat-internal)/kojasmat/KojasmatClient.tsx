'use client'

import { useState, useEffect, useTransition, useCallback, useRef, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { BarChart, Bar, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts'
import {
  Users, Briefcase, Wallet, GraduationCap, LayoutDashboard,
  Plus, Search, ChevronRight, ChevronLeft, CheckCircle, XCircle,
  ArrowUpCircle, Shield, Send, RefreshCw, ArrowUpDown, Filter,
  TrendingUp, Banknote, Star, Clock, FileText,
  AlertTriangle, ClipboardList, Eye, Link2, ExternalLink,
  BookOpen, ArrowDownCircle, X, Copy, Check, Pencil, Trash2, Upload, FolderOpen,
  TrendingDown, Scale, Loader2, CalendarClock, FileSignature, History, Lock, MessageCircle,
  Download, FileSpreadsheet, Landmark, Key, ShieldCheck, RotateCcw,
  Home, Bell, Coins, Smartphone,
} from 'lucide-react'
import {
  createAnggota, updateAnggota, deleteAnggota,
  catatSimpananMutasi, getSetoranPendingByOrg, setujuiSetoranSimpanan, tolakSetoranSimpanan,
  setujuiTarikSimpanan, tolakTarikSimpanan,
  getSimpananByAnggota, getMutasiByAnggota,
  type KojasmatSetoranPending,
  createProyek, updateProyek, deleteProyek, updateProyekStatus,
  submitProyekKeDMR, resubmitProyek, submitProyekReview,
  jadwalkanFunding, bukaFunding, tutupFunding,
  jadwalkanAkad, tandatanganiAkad, getAkadByProyek, getProyekHistory,
  kirimPenawaranProyek,
  createPelatihan, daftarPesertaPelatihan, getPesertaPelatihan, luluskanPeserta,
  type KojasmatAnggota, type KojasmatProyek, type KojasmatPelatihan, type KojasmatStats,
  type KojasmatSimpanan, type KojasmatSimpananMutasi,
  type KojasmatAkad, type KojasmatProyekHistory, type KojasmatProyekDiskusi,
  getProyekDiskusi, kirimPesanDiskusi, getSimpananReport, type KojasmatSimpananReport,
} from '@/modules/kojasmat/actions/kojasmat.actions'
import {
  setujuiPendaftaran, tolakPendaftaran, mintaRevisiPendaftaran,
  getDokumenByRef, simpanDokumen, hapusDokumen, beriTindakan, selesaikanTindakan, ulasLaporan,
  type KojasmatPendaftaran, type KojasmatDokumen,
  type KojasmatLaporanProyek, type KojasmatTindakan,
} from '@/modules/kojasmat/actions/kojasmat-membership.actions'
import { seedKojasmatDummyData, resetAndReseedKojasmat } from '@/modules/kojasmat/actions/kojasmat-seeder.actions'
import {
  parseKojasmatBulkImportFile, executeKojasmatBulkImport, rollbackKojasmatBulkImport,
  type KojasmatBulkPreview, type KojasmatBulkImportResult, type KojasmatBulkRollbackResult,
} from '@/modules/kojasmat/actions/kojasmat-bulk-import.actions'
import {
  catatTransaksiProyek, getTransaksiByProyek, getLaporanKeuanganProyek,
  getPemodalDenganPotensi, distribusikanBagiHasil,
  type KojasmatProyekTransaksi, type KojasmatLaporanKeuanganProyek, type KojasmatPemodalDenganPotensi,
} from '@/modules/kojasmat/actions/kojasmat-keuangan.actions'
import {
  simpanBankSoal, hapusBankSoal, updateModuleSettings, getTestMasukByPendaftaran,
  type KojasmatBankSoal, type ApresiasiTier, type KojasmatTestMasukRingkas, type KomitmenSection,
} from '@/modules/kojasmat/actions/kojasmat-test.actions'
import { saveKojasmatAccountMappingAction } from '@/modules/kojasmat/actions/kojasmat-account-mapping.actions'
import {
  KOJASMAT_ACCOUNT_ROLES, KOJASMAT_ACCOUNT_ROLE_LABEL,
  type KojasmatAccountMapping, type KojasmatAccountOption, type KojasmatAccountRole,
} from '@/modules/kojasmat/lib/kojasmat-account-mapping.shared'
import {
  saveKojasmatWhatsappSettingsAction, sendKojasmatTestWhatsappAction,
} from '@/modules/kojasmat/actions/kojasmat-notifikasi.actions'
import type { TenantWhatsappConfig } from '@/modules/notifications/whatsapp-settings.server'
import {
  getAkadIjarahByAnggota, setAkadIjarahOverride, buatAkadIjarahManual, type KojasmatAkadIjarah,
} from '@/modules/kojasmat/actions/kojasmat-ijarah.actions'
import {
  getTestSahabatPendingByOrg, setujuiTestSahabat, tolakTestSahabat, type KojasmatTestSahabatPending,
} from '@/modules/kojasmat/actions/kojasmat-sahabat.actions'
import type { PesanOtomatisKey, PesanOtomatisSettings } from '@/modules/kojasmat/lib/pesan-otomatis.shared'
import { interpolate } from '@/modules/notifications/interpolate.shared'

const KATEGORI_PENDAPATAN = ['Penjualan', 'Jasa', 'Pendapatan Lain'] as const
const KATEGORI_BEBAN = ['Bahan Baku', 'Operasional', 'Gaji/Upah', 'Sewa', 'Transportasi', 'Beban Lain'] as const

// ─── TYPES ────────────────────────────────────────────────────────────────────

type Props = {
  orgId: string
  stats: KojasmatStats
  anggota: KojasmatAnggota[]
  proyek: KojasmatProyek[]
  pelatihan: KojasmatPelatihan[]
  pendaftaran: KojasmatPendaftaran[]
  laporan: KojasmatLaporanProyek[]
  tindakan: KojasmatTindakan[]
  bankSoal: KojasmatBankSoal[]
  moduleSettings: {
    passing_threshold: number
    biaya_admin_pendaftaran: number
    nominal_simpanan_pokok: number
    nominal_simpanan_wajib: number
    bank_account_id: string | null
    apresiasi_tiers: ApresiasiTier[]
    qris_image_key: string | null
    qris_image_name: string | null
    ijarah_platform_fee: number
    ijarah_platform_periode_hari: number
    ijarah_sukarela_opsional_minimal: number
    komitmen_sections: KomitmenSection[]
    admin_whatsapp: string
    pesan_otomatis: PesanOtomatisSettings
  }
  bankAccounts: { id: string; bank_name: string; account_number: string }[]
  qrisPreviewUrl: string | null
  setoranPending: KojasmatSetoranPending[]
  accountMapping: KojasmatAccountMapping
  chartOfAccounts: KojasmatAccountOption[]
  whatsappSettings: TenantWhatsappConfig
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

function fmtWaktu(d: string) {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(new Date(d)) + ' WIB'
}

const METODE_BAYAR_LABEL: Record<string, string> = {
  TRANSFER: 'Transfer Bank',
  QRIS: 'QRIS',
}

const STATUS_PROYEK: Record<string, { label: string; color: string }> = {
  DRAFT:                { label: 'Draft',               color: 'bg-gray-100 text-gray-600' },
  MENUNGGU_DMR:         { label: 'Menunggu DMR',         color: 'bg-yellow-100 text-yellow-700' },
  REVISI_DMR:           { label: 'Revisi DMR',           color: 'bg-orange-100 text-orange-700' },
  DITOLAK_DMR:          { label: 'Ditolak DMR',          color: 'bg-red-100 text-red-700' },
  MENUNGGU_DPS:         { label: 'Menunggu DPS',         color: 'bg-amber-100 text-amber-700' },
  REVISI_DPS:           { label: 'Revisi DPS',           color: 'bg-orange-100 text-orange-700' },
  DITOLAK_DPS:          { label: 'Ditolak DPS',          color: 'bg-red-100 text-red-700' },
  DISETUJUI:            { label: 'Disetujui',            color: 'bg-blue-100 text-blue-700' },
  FUNDING_DIJADWALKAN:  { label: 'Funding Dijadwalkan',  color: 'bg-sky-100 text-sky-700' },
  FUNDING_AKTIF:        { label: 'Funding Aktif',        color: 'bg-cyan-100 text-cyan-700' },
  FUNDING_DITUTUP:      { label: 'Funding Ditutup',      color: 'bg-indigo-100 text-indigo-700' },
  MENUNGGU_AKAD:        { label: 'Menunggu Akad',        color: 'bg-violet-100 text-violet-700' },
  BERJALAN:             { label: 'Berjalan',             color: 'bg-emerald-100 text-emerald-700' },
  SELESAI:              { label: 'Selesai',              color: 'bg-emerald-200 text-emerald-800' },
  BAGI_HASIL:           { label: 'Bagi Hasil',           color: 'bg-purple-100 text-purple-700' },
  DITUTUP:              { label: 'Ditutup',              color: 'bg-gray-200 text-gray-500' },
}

const AKAD_COLOR: Record<string, string> = {
  MURABAHAH:  'bg-amber-100 text-amber-700',
  MUDHARABAH: 'bg-emerald-100 text-emerald-700',
  INAN:       'bg-blue-100 text-blue-700',
}

function Badge({ text, cls }: { text: string; cls: string }) {
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', cls)}>{text}</span>
}

function StatCard({ icon: Icon, label, value, sub }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{label}</p>
        <span className="rounded-xl bg-emerald-50 p-2">
          <Icon className="h-4 w-4 text-emerald-600" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

// ─── MODAL ────────────────────────────────────────────────────────────────────

function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">{title}</h2>
        {children}
      </div>
    </div>
  )
}

// ─── DRAWER ───────────────────────────────────────────────────────────────────

function Drawer({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>
  )
}

// ─── IJARAH PLATFORM OVERRIDE PANEL ────────────────────────────────────────────
// Admin bisa memberi harga custom per anggota atau menonaktifkan tagihan ijarah
// untuk anggota tertentu — terms disimpan per-akad, tidak memengaruhi anggota lain.

function IjarahOverridePanel({ anggotaId, orgId }: { anggotaId: string; orgId: string }) {
  const [pending, startTransition] = useTransition()
  const [loading, setLoading] = useState(true)
  const [akad, setAkad] = useState<KojasmatAkadIjarah | null>(null)
  const [editing, setEditing] = useState(false)
  const [nominalFee, setNominalFee] = useState('')
  const [status, setStatus] = useState<'AKTIF' | 'BERHENTI'>('AKTIF')
  const [catatan, setCatatan] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getAkadIjarahByAnggota(anggotaId).then(a => {
      if (cancelled) return
      setAkad(a)
      if (a) { setNominalFee(String(a.nominal_fee)); setStatus(a.status === 'BERHENTI' ? 'BERHENTI' : 'AKTIF') }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [anggotaId])

  function handleSave() {
    if (!nominalFee || Number(nominalFee) <= 0) { setError('Nominal fee harus lebih dari nol'); return }
    setError(null)
    startTransition(async () => {
      const res = akad
        ? await setAkadIjarahOverride(akad.id, { nominal_fee: Number(nominalFee), status, catatan: catatan || undefined })
        : await buatAkadIjarahManual(orgId, anggotaId, { nominal_fee: Number(nominalFee) })
      if ('error' in res) { setError(res.error); return }
      const refreshed = await getAkadIjarahByAnggota(anggotaId)
      setAkad(refreshed)
      setEditing(false)
      setCatatan('')
    })
  }

  if (loading) {
    return <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-400">Memuat akad ijarah...</div>
  }

  return (
    <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-purple-900">Ijarah Platform</p>
        {akad && (
          <Badge
            text={akad.status === 'BERHENTI' ? 'Nonaktif' : akad.status === 'DIBEKUKAN' ? 'Anggota Dibekukan' : 'Aktif'}
            cls={akad.status === 'AKTIF' ? 'bg-purple-100 text-purple-700' : akad.status === 'DIBEKUKAN' ? 'bg-rose-100 text-rose-700' : 'bg-gray-200 text-gray-600'}
          />
        )}
      </div>

      {!editing ? (
        <>
          {akad ? (
            <div className="mt-2 text-xs text-purple-700 space-y-0.5">
              <p>Tarif: <span className="font-semibold">{fmt(akad.nominal_fee)}</span> / {akad.periode_hari} hari</p>
              <p>Tagihan berikutnya: {new Date(akad.tagihan_berikutnya).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
              {akad.catatan_admin && <p className="text-gray-500">Catatan: {akad.catatan_admin}</p>}
            </div>
          ) : (
            <p className="mt-2 text-xs text-purple-700">Anggota ini belum memiliki akad ijarah.</p>
          )}
          <button onClick={() => setEditing(true)}
            className="mt-3 text-xs font-medium text-purple-700 hover:text-purple-900 cursor-pointer underline underline-offset-2">
            {akad ? 'Ubah tarif / status' : 'Buat akad ijarah'}
          </button>
        </>
      ) : (
        <div className="mt-3 space-y-2">
          <div>
            <label className="text-xs font-medium text-gray-700">Tarif (Rp)</label>
            <input type="text" inputMode="numeric"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-500"
              value={nominalFee} onChange={e => setNominalFee(e.target.value.replace(/\D/g, ''))} />
          </div>
          {akad && (
            <div className="flex gap-2">
              <button type="button" onClick={() => setStatus('AKTIF')}
                className={cn('flex-1 rounded-lg py-1.5 text-xs font-medium cursor-pointer', status === 'AKTIF' ? 'bg-purple-600 text-white' : 'bg-white border border-gray-200 text-gray-600')}>
                Aktif
              </button>
              <button type="button" onClick={() => setStatus('BERHENTI')}
                className={cn('flex-1 rounded-lg py-1.5 text-xs font-medium cursor-pointer', status === 'BERHENTI' ? 'bg-gray-600 text-white' : 'bg-white border border-gray-200 text-gray-600')}>
                Nonaktifkan
              </button>
            </div>
          )}
          <input type="text" placeholder="Catatan (opsional)"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none focus:border-purple-500"
            value={catatan} onChange={e => setCatatan(e.target.value)} />
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => { setEditing(false); setError(null) }}
              className="flex-1 rounded-lg border border-gray-200 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 cursor-pointer">
              Batal
            </button>
            <button onClick={handleSave} disabled={pending}
              className="flex-1 rounded-lg bg-purple-600 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50 cursor-pointer">
              {pending ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── BUKU TABUNGAN PANEL ──────────────────────────────────────────────────────

function BukuTabunganPanel({
  anggota, orgId, onTransaksi,
}: {
  anggota: KojasmatAnggota
  orgId: string
  onTransaksi: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [simpanan, setSimpanan] = useState<KojasmatSimpanan[]>([])
  const [mutasi, setMutasi] = useState<KojasmatSimpananMutasi[]>([])
  const [filterJenis, setFilterJenis] = useState<'SEMUA' | 'POKOK' | 'WAJIB' | 'SUKARELA' | 'PROYEK' | 'HIBAH_NAMETAG' | 'HIBAH_MEMBERCARD' | 'HIBAH_KAJIAN' | 'HIBAH_BOP'>('SEMUA')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      getSimpananByAnggota(anggota.id),
      getMutasiByAnggota(anggota.id),
    ]).then(([s, m]) => {
      if (cancelled) return
      setSimpanan(s)
      setMutasi(m)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [anggota.id])

  const saldo = (jenis: 'POKOK' | 'WAJIB' | 'SUKARELA' | 'PROYEK' | 'HIBAH_NAMETAG' | 'HIBAH_MEMBERCARD' | 'HIBAH_KAJIAN' | 'HIBAH_BOP') =>
    Number(simpanan.find(s => s.jenis === jenis)?.saldo ?? 0)

  const totalSaldo = simpanan.reduce((acc, curr) => acc + Number(curr.saldo), 0)

  const mutasiFilt = filterJenis === 'SEMUA'
    ? mutasi
    : mutasi.filter(m => {
        const s = simpanan.find(x => x.id === m.simpanan_id)
        return s?.jenis === filterJenis
      })

  const JENIS_LABEL: Record<string, string> = {
    POKOK: 'Pokok', WAJIB: 'Wajib', SUKARELA: 'Sukarela',
    PROYEK: 'Proyek', HIBAH_NAMETAG: 'Hibah Name Tag', HIBAH_MEMBERCARD: 'Hibah Member Card',
    HIBAH_KAJIAN: 'Hibah Kajian', HIBAH_BOP: 'Hibah BOP'
  }
  const MUTASI_COLOR: Record<string, string> = {
    SETOR: 'text-emerald-600', BAGI_HASIL: 'text-blue-600',
    TARIK: 'text-red-600', KOREKSI: 'text-amber-600',
    TRANSFER_MASUK: 'text-emerald-600', TRANSFER_KELUAR: 'text-red-600',
    IJARAH: 'text-red-600',
  }
  const MUTASI_LABEL: Record<string, string> = {
    SETOR: 'Setor', TARIK: 'Tarik', BAGI_HASIL: 'Bagi Hasil', KOREKSI: 'Koreksi',
    TRANSFER_MASUK: 'Transfer Masuk', TRANSFER_KELUAR: 'Transfer Keluar',
    IJARAH: 'Ijarah Platform',
  }

  return (
    <div className="space-y-6">
      {/* Info anggota */}
      <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm">
          {anggota.nama.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-semibold text-gray-900">{anggota.nama}</p>
          <p className="text-xs text-gray-400 font-mono">{anggota.kode_anggota}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-gray-400">Total Saldo</p>
          <p className="font-bold text-gray-900">{fmt(totalSaldo)}</p>
        </div>
      </div>

      <IjarahOverridePanel anggotaId={anggota.id} orgId={orgId} />

      {/* 3 saldo cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {['POKOK','WAJIB','SUKARELA','PROYEK'].map(j => (
            <div key={j} className="h-20 animate-pulse rounded-2xl bg-gray-100" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(['POKOK','WAJIB','SUKARELA','PROYEK'] as const).map(jenis => (
            <button
              key={jenis}
              onClick={() => setFilterJenis(f => f === jenis ? 'SEMUA' : jenis)}
              className={cn(
                'rounded-2xl border px-4 py-3 text-left transition-all cursor-pointer',
                filterJenis === jenis
                  ? 'border-emerald-300 bg-emerald-50 shadow-sm'
                  : 'border-gray-100 bg-white hover:border-emerald-200 hover:bg-emerald-50/40'
              )}
            >
              <p className="text-xs font-medium text-gray-500">{JENIS_LABEL[jenis]}</p>
              <p className={cn('mt-1 text-sm font-bold', filterJenis === jenis ? 'text-emerald-700' : 'text-gray-900')}>
                {fmt(saldo(jenis))}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Riwayat mutasi */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">
            Riwayat Transaksi
            {filterJenis !== 'SEMUA' && (
              <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                {JENIS_LABEL[filterJenis]}
              </span>
            )}
          </h3>
          <button
            onClick={onTransaksi}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" /> Transaksi
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1,2,3,4].map(i => <div key={i} className="h-12 animate-pulse rounded-xl bg-gray-100" />)}
          </div>
        ) : mutasiFilt.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
            Belum ada transaksi
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-100">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">Tanggal</th>
                    <th className="px-4 py-2.5 text-left font-medium">Jenis</th>
                    <th className="px-4 py-2.5 text-left font-medium">Keterangan</th>
                    <th className="px-4 py-2.5 text-right font-medium text-emerald-700">Kredit</th>
                    <th className="px-4 py-2.5 text-right font-medium text-red-600">Debit</th>
                    <th className="px-4 py-2.5 text-right font-medium">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {mutasiFilt.map(m => {
                    const isKredit = m.jenis_mutasi === 'SETOR' || m.jenis_mutasi === 'BAGI_HASIL' || m.jenis_mutasi === 'TRANSFER_MASUK'
                    const jenisLabel = simpanan.find(s => s.id === m.simpanan_id)?.jenis
                    return (
                      <tr key={m.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">
                          {new Date(m.tanggal).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {isKredit
                              ? <ArrowDownCircle className="h-3.5 w-3.5 text-emerald-500" />
                              : <ArrowUpCircle className="h-3.5 w-3.5 text-red-500" />
                            }
                            <span className={cn('text-xs font-medium', MUTASI_COLOR[m.jenis_mutasi])}>
                              {MUTASI_LABEL[m.jenis_mutasi] ?? m.jenis_mutasi}
                            </span>
                            {jenisLabel && (
                              <span className="text-xs text-gray-400">({JENIS_LABEL[jenisLabel]})</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 max-w-[160px] truncate">
                          {m.keterangan || '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          {isKredit ? (
                            <span className="font-medium text-emerald-600">{fmt(Number(m.jumlah))}</span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          {!isKredit ? (
                            <span className="font-medium text-red-600">{fmt(Number(m.jumlah))}</span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-gray-900 whitespace-nowrap">
                          {fmt(Number(m.saldo_sesudah))}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── DOKUMEN PROYEK PANEL ─────────────────────────────────────────────────────

const JENIS_DOKUMEN_PROYEK = [
  { value: 'KELAYAKAN_USAHA',  label: 'Kelayakan Usaha'  },
  { value: 'PROPOSAL',         label: 'Proposal'          },
  { value: 'PENAWARAN_HARGA',  label: 'Penawaran Harga'   },
  { value: 'PROYEKSI_KEUANGAN',label: 'Proyeksi Keuangan' },
  { value: 'ANALISA_BISNIS',   label: 'Analisa Bisnis'    },
  { value: 'PENAWARAN_SYIRKAH',label: 'Penawaran Syirkah' },
  { value: 'AKAD',             label: 'Akad'              },
  { value: 'LAINNYA',          label: 'Dokumen Lain'      },
] as const

type JenisDokProyek = typeof JENIS_DOKUMEN_PROYEK[number]['value']

async function uploadFileDokumen(file: File, orgId: string): Promise<{ key: string; name: string; size: number; mime: string } | { error: string }> {
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
  const data = await res.json()
  return data.url ?? null
}

function DokumenProyekPanel({ proyek, orgId }: { proyek: KojasmatProyek; orgId: string }) {
  const [docs, setDocs] = useState<KojasmatDokumen[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getDokumenByRef('PROYEK', proyek.id).then(d => {
      if (!cancelled) { setDocs(d); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [proyek.id])

  async function handleUpload(jenis: JenisDokProyek, file: File) {
    setUploading(jenis)
    setUploadError(null)
    const res = await uploadFileDokumen(file, orgId)
    if ('error' in res) { setUploadError(res.error); setUploading(null); return }
    startTransition(async () => {
      const saved = await simpanDokumen({
        org_id: orgId,
        referensi_type: 'PROYEK',
        referensi_id: proyek.id,
        jenis_dokumen: jenis as KojasmatDokumen['jenis_dokumen'],
        nama_file: res.name,
        file_key: res.key,
        file_size: res.size,
        mime_type: res.mime,
      })
      if (saved.data) {
        setDocs(prev => [...prev.filter(d => d.jenis_dokumen !== jenis), saved.data!])
      } else {
        setUploadError(saved.error ?? 'Gagal menyimpan dokumen')
      }
      setUploading(null)
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

  const docByJenis = (jenis: string) => docs.find(d => d.jenis_dokumen === jenis)

  return (
    <div className="space-y-5">
      {/* Info proyek */}
      <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-gray-400">{proyek.kode_proyek}</span>
          <Badge text={proyek.jenis_akad} cls={AKAD_COLOR[proyek.jenis_akad] ?? 'bg-gray-100 text-gray-600'} />
        </div>
        <p className="font-semibold text-gray-900 mt-0.5">{proyek.nama_proyek}</p>
      </div>

      {/* Daftar dokumen */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-14 animate-pulse rounded-2xl bg-gray-100" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {JENIS_DOKUMEN_PROYEK.map(({ value, label }) => {
            const dok = docByJenis(value)
            const isUploading = uploading === value
            const isDeleting = dok ? deleting === dok.id : false
            return (
              <div key={value} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700">{label}</p>
                  {dok && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">{dok.nama_file}</p>
                  )}
                </div>

                {dok ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    <button
                      onClick={() => handleView(dok.file_key)}
                      className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors cursor-pointer"
                    >
                      Lihat
                    </button>
                    <button
                      onClick={() => handleDelete(dok)}
                      disabled={isDeleting}
                      className="rounded-lg border border-red-100 px-2.5 py-1 text-xs text-red-500 hover:bg-red-50 hover:border-red-200 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isDeleting ? '...' : 'Hapus'}
                    </button>
                  </div>
                ) : (
                  <label className={cn(
                    'flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs transition-colors shrink-0',
                    isUploading
                      ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                      : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:border-gray-300 cursor-pointer'
                  )}>
                    {isUploading
                      ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Mengunggah...</>
                      : <><Upload className="h-3.5 w-3.5" /> Upload</>
                    }
                    {!isUploading && (
                      <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
                        onChange={e => { if (e.target.files?.[0]) handleUpload(value, e.target.files[0]); e.target.value = '' }} />
                    )}
                  </label>
                )}
              </div>
            )
          })}
        </div>
      )}

      {uploadError && (
        <p className="flex items-center gap-1.5 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-600">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {uploadError}
        </p>
      )}

      <p className="text-xs text-gray-400">Format: PDF, JPG, PNG · Maks 10 MB per file</p>
    </div>
  )
}

// ─── MODAL: IMPORT DATA MASSAL ─────────────────────────────────────────────────

function BulkImportModal({ orgId, open, onClose }: { orgId: string; open: boolean; onClose: () => void }) {
  const [pending, startTransition] = useTransition()
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload')
  const [fileName, setFileName] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)
  const [preview, setPreview] = useState<KojasmatBulkPreview | null>(null)
  const [result, setResult] = useState<KojasmatBulkImportResult | null>(null)
  const [credentialsCopied, setCredentialsCopied] = useState(false)

  function reset() {
    setStep('upload'); setFileName(''); setParseError(null); setPreview(null); setResult(null); setCredentialsCopied(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleCopyCredentials() {
    if (!result?.credentials.length) return
    const appUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const text = result.credentials.map(c => (
      `${c.nama}\nKode Anggota: ${c.kode_anggota}\nLogin di: ${appUrl}/anggota/login\nEmail/NIK: ${c.login_identifier}\nPassword: ${c.temp_password}`
    )).join('\n\n')
    await navigator.clipboard.writeText(text)
    setCredentialsCopied(true)
    setTimeout(() => setCredentialsCopied(false), 2500)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setParseError(null)
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = String(reader.result).split(',')[1] || ''
      startTransition(async () => {
        const res = await parseKojasmatBulkImportFile(orgId, base64)
        if (res.error) {
          setParseError(res.error)
          return
        }
        setPreview(res)
        setStep('preview')
      })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function handleExecute() {
    if (!preview) return
    startTransition(async () => {
      const res = await executeKojasmatBulkImport(orgId, preview)
      setResult(res)
      setStep('result')
    })
  }

  const anggotaOk = preview?.anggota.filter(a => a.errors.length === 0).length ?? 0
  const anggotaErr = (preview?.anggota.length ?? 0) - anggotaOk
  const simpananOk = preview?.simpanan.filter(s => s.errors.length === 0).length ?? 0
  const simpananErr = (preview?.simpanan.length ?? 0) - simpananOk
  const proyekOk = preview?.proyek.filter(p => p.errors.length === 0).length ?? 0
  const proyekErr = (preview?.proyek.length ?? 0) - proyekOk
  const totalOk = anggotaOk + simpananOk + proyekOk
  const totalErr = anggotaErr + simpananErr + proyekErr
  const allErrors = [
    ...(preview?.anggota.flatMap(a => a.errors) ?? []),
    ...(preview?.simpanan.flatMap(s => s.errors) ?? []),
    ...(preview?.proyek.flatMap(p => p.errors) ?? []),
  ]

  return (
    <Modal open={open} onClose={handleClose} title="Import Data Massal — Kojasmat">
      <div className="space-y-4">
        {step === 'upload' && (
          <>
            <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800 space-y-2">
              <p className="font-medium">Isi anggota, saldo simpanan awal, dan/atau proyek sekaligus lewat template Excel.</p>
              <p className="text-xs text-blue-600">
                Anggota baru diresolusi berdasarkan NIK, proyek masuk berstatus DRAFT (lanjut review DMR/DPS seperti biasa),
                dan setoran simpanan otomatis tersync ke jurnal akuntansi ERP.
              </p>
            </div>
            <a
              href="/api/kojasmat/bulk-import/template"
              className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors cursor-pointer"
            >
              <Download className="h-4 w-4" /> Download Template
            </a>
            <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 py-8 text-sm text-gray-500 hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors cursor-pointer">
              <Upload className="h-6 w-6 text-gray-400" />
              <span>{pending ? 'Memproses file...' : fileName || 'Klik untuk pilih file template yang sudah diisi (.xlsx)'}</span>
              <input type="file" accept=".xlsx" className="hidden" onChange={handleFile} disabled={pending} />
            </label>
            {parseError && (
              <p className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0" /> {parseError}
              </p>
            )}
          </>
        )}

        {step === 'preview' && preview && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-center">
                <p className="text-lg font-bold text-gray-900">{preview.anggota.length}</p>
                <p className="text-xs text-gray-500">Anggota ({anggotaOk} valid)</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-center">
                <p className="text-lg font-bold text-gray-900">{preview.simpanan.length}</p>
                <p className="text-xs text-gray-500">Simpanan ({simpananOk} valid)</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-center">
                <p className="text-lg font-bold text-gray-900">{preview.proyek.length}</p>
                <p className="text-xs text-gray-500">Proyek ({proyekOk} valid)</p>
              </div>
            </div>

            {totalErr > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 max-h-40 overflow-y-auto space-y-1">
                <p className="text-xs font-medium text-red-700">{totalErr} baris bermasalah (akan dilewati):</p>
                {allErrors.slice(0, 30).map((e, i) => (
                  <p key={i} className="text-xs text-red-600">• {e}</p>
                ))}
                {allErrors.length > 30 && <p className="text-xs text-red-500">... dan {allErrors.length - 30} lainnya</p>}
              </div>
            )}

            {totalOk === 0 ? (
              <p className="text-sm text-gray-500">Tidak ada baris valid untuk diimport.</p>
            ) : (
              <p className="text-sm text-gray-600">{totalOk} baris siap diimport.</p>
            )}

            <div className="flex gap-3">
              <button onClick={reset}
                className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
                Ganti File
              </button>
              <button onClick={handleExecute} disabled={pending || totalOk === 0}
                className="flex-1 rounded-xl bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer">
                {pending ? 'Mengimport...' : `Import ${totalOk} Baris`}
              </button>
            </div>
          </>
        )}

        {step === 'result' && result && (
          <>
            <div className={cn('rounded-xl border p-4 text-sm',
              result.success ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700')}>
              <p className="font-medium">
                {result.anggota_created} anggota, {result.simpanan_created} simpanan, {result.proyek_created} proyek berhasil diimport.
              </p>
              {result.failed > 0 && <p className="text-xs mt-1">{result.failed} baris gagal — lihat rincian di bawah.</p>}
            </div>
            {result.rows.some(r => r.status === 'error') && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 max-h-40 overflow-y-auto space-y-1">
                {result.rows.filter(r => r.status === 'error').slice(0, 30).map((r, i) => (
                  <p key={i} className="text-xs text-red-600">• [{r.entity}] Baris {r.row_no}: {r.error}</p>
                ))}
              </div>
            )}

            {result.credentials.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Kredensial Login Anggota Baru ({result.credentials.length})
                </p>
                <div className="rounded-xl border border-gray-100 overflow-hidden">
                  <div className="max-h-56 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-gray-500 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Kode</th>
                          <th className="px-3 py-2 text-left font-medium">Nama</th>
                          <th className="px-3 py-2 text-left font-medium">Email/NIK</th>
                          <th className="px-3 py-2 text-left font-medium">Password</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {result.credentials.map((c, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 font-mono font-medium text-emerald-700 whitespace-nowrap">{c.kode_anggota}</td>
                            <td className="px-3 py-2 text-gray-800">{c.nama}</td>
                            <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap">{c.login_identifier}</td>
                            <td className="px-3 py-2 font-mono font-bold text-gray-900 whitespace-nowrap">{c.temp_password}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <p className="text-xs text-gray-400">Password ini hanya ditampilkan sekali — salin dan bagikan ke anggota sebelum menutup jendela ini.</p>
                <button onClick={handleCopyCredentials}
                  className={cn(
                    'w-full rounded-xl py-2 text-sm font-semibold transition-colors cursor-pointer',
                    credentialsCopied ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  )}>
                  {credentialsCopied ? '✓ Tersalin!' : 'Salin Semua Kredensial'}
                </button>
              </div>
            )}

            {result.import_batch_id && (result.anggota_created > 0 || result.simpanan_created > 0 || result.proyek_created > 0) && (
              <RollbackSection orgId={orgId} importBatchId={result.import_batch_id} />
            )}

            <button onClick={handleClose}
              className="w-full rounded-xl bg-gray-900 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors cursor-pointer">
              Selesai
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}

// Membatalkan satu batch bulk import (anggota/simpanan/proyek yang baru saja
// dibuat) kalau ternyata ada kesalahan — mis. salah upload file atau NIK
// hasil auto-generate perlu diperbaiki dulu. Anggota/proyek yang sudah punya
// aktivitas lanjutan tidak dihapus otomatis (lihat rollbackKojasmatBulkImport).
function RollbackSection({ orgId, importBatchId }: { orgId: string; importBatchId: string }) {
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [result, setResult] = useState<KojasmatBulkRollbackResult | null>(null)

  function handleRollback() {
    startTransition(async () => {
      const res = await rollbackKojasmatBulkImport(orgId, importBatchId)
      setResult(res)
      setConfirming(false)
    })
  }

  if (result) {
    return (
      <div className={cn('rounded-xl border p-3 text-xs space-y-1',
        result.error ? 'border-red-200 bg-red-50 text-red-700' : 'border-gray-200 bg-gray-50 text-gray-700')}>
        {result.error ? (
          <p>Gagal membatalkan import: {result.error}</p>
        ) : (
          <>
            <p className="font-medium">
              Import dibatalkan: {result.anggota_dihapus} anggota, {result.mutasi_dihapus} setoran, {result.proyek_dihapus} proyek dihapus.
            </p>
            {result.anggota_dilewati.length > 0 && (
              <p>{result.anggota_dilewati.length} anggota tidak dihapus (sudah ada aktivitas lain sejak import) — cek manual di halaman Anggota.</p>
            )}
            {result.proyek_dilewati.length > 0 && (
              <p>{result.proyek_dilewati.length} proyek tidak dihapus (sudah diproses) — cek manual di halaman Proyek.</p>
            )}
            {result.jurnal_gagal_void.length > 0 && (
              <p>{result.jurnal_gagal_void.length} jurnal akuntansi gagal di-void otomatis — void manual lewat menu Jurnal Akuntansi.</p>
            )}
          </>
        )}
      </div>
    )
  }

  if (confirming) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 space-y-2">
        <p>
          Yakin batalkan import ini? Anggota baru &amp; setoran dari import ini akan dihapus, jurnal akuntansi terkait
          akan di-void. Anggota/proyek yang sudah ada aktivitas lanjutan tidak akan dihapus otomatis.
        </p>
        <div className="flex gap-2">
          <button onClick={() => setConfirming(false)}
            className="flex-1 rounded-lg border border-gray-200 bg-white py-1.5 font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
            Batal
          </button>
          <button onClick={handleRollback} disabled={pending}
            className="flex-1 rounded-lg bg-red-600 py-1.5 font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors cursor-pointer">
            {pending ? 'Membatalkan...' : 'Ya, Batalkan Import'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <button onClick={() => setConfirming(true)}
      className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-200 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors cursor-pointer">
      <RotateCcw className="h-4 w-4" /> Batalkan Import Ini
    </button>
  )
}

// ─── TAB: DASHBOARD ───────────────────────────────────────────────────────────

function TabDashboard({ stats, orgId }: { stats: KojasmatStats; orgId: string }) {
  const [pending, startTransition] = useTransition()
  const [seedResult, setSeedResult] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [bulkImportOpen, setBulkImportOpen] = useState(false)

  function handleSeed() {
    startTransition(async () => {
      const res = await seedKojasmatDummyData(orgId)
      if (res.error) {
        setSeedResult(`Gagal: ${res.error}`)
      } else {
        setSeedResult(
          `Berhasil! ${res.data?.anggota} anggota, ${res.data?.proyek} proyek, ` +
          `${res.data?.pembiayaan} pembiayaan, ${res.data?.bagi_hasil} bagi hasil tersync ke ERP.`
        )
      }
      setConfirmOpen(false)
    })
  }

  function handleResetReseed() {
    startTransition(async () => {
      const res = await resetAndReseedKojasmat(orgId)
      if (res.error) {
        setSeedResult(`Gagal reset: ${res.error}`)
      } else {
        setSeedResult(
          `Reset & renew selesai! ${res.data?.anggota} anggota, ${res.data?.proyek} proyek, ` +
          `${res.data?.pembiayaan} pembiayaan, ${res.data?.bagi_hasil} bagi hasil tersync ke ERP.`
        )
      }
      setResetConfirmOpen(false)
    })
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} label="Total Anggota" value={stats.total_anggota} sub={`${stats.anggota_aktif} aktif`} />
        <StatCard icon={Briefcase} label="Total Proyek" value={stats.total_proyek} sub={`${stats.proyek_berjalan} berjalan`} />
        <StatCard icon={Wallet} label="Total Simpanan" value={fmt(Number(stats.total_simpanan))} />
        <StatCard icon={TrendingUp} label="Portofolio Pembiayaan" value={fmt(Number(stats.total_pembiayaan))} />
      </div>

      {(stats.antrian_dmr > 0 || stats.antrian_dps > 0) && (
        <div className="flex items-center gap-3 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
          <Shield className="h-5 w-5 text-yellow-600 shrink-0" />
          <div>
            <p className="font-medium text-yellow-800">
              {stats.antrian_dmr > 0 && `${stats.antrian_dmr} proyek menunggu review DMR`}
              {stats.antrian_dmr > 0 && stats.antrian_dps > 0 && ' · '}
              {stats.antrian_dps > 0 && `${stats.antrian_dps} proyek menunggu review DPS`}
            </p>
            <p className="text-sm text-yellow-600">Buka tab Proyek → Antrian DMR/DPS untuk meninjau</p>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-semibold text-gray-900">Ringkasan Koperasi</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-emerald-50 p-4 text-center">
            <p className="text-2xl font-bold text-emerald-700">{fmt(Number(stats.total_simpanan))}</p>
            <p className="text-sm text-emerald-600 mt-1">Aset Simpanan</p>
          </div>
          <div className="rounded-xl bg-blue-50 p-4 text-center">
            <p className="text-2xl font-bold text-blue-700">{fmt(Number(stats.total_pembiayaan))}</p>
            <p className="text-sm text-blue-600 mt-1">Portofolio Pembiayaan</p>
          </div>
          <div className="rounded-xl bg-amber-50 p-4 text-center">
            <p className="text-2xl font-bold text-amber-700">{stats.anggota_aktif}</p>
            <p className="text-sm text-amber-600 mt-1">Anggota Aktif</p>
          </div>
        </div>
      </div>

      {/* Link Pendaftaran */}
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-emerald-800 text-sm">Link Pendaftaran Anggota</p>
          <p className="text-xs text-emerald-600 mt-0.5">Bagikan link ini kepada calon anggota untuk mendaftar secara mandiri.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={async () => {
              const url = `${window.location.origin}/anggota/daftar?org=${orgId}`
              await navigator.clipboard.writeText(url)
            }}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer">
            <Link2 className="h-3.5 w-3.5" /> Salin Link
          </button>
          <a
            href={`/anggota/daftar?org=${orgId}`}
            target="_blank"
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 transition-colors cursor-pointer">
            Buka Formulir
          </a>
        </div>
      </div>

      {/* Import Data Massal */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50">
            <FileSpreadsheet className="h-4.5 w-4.5 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-gray-800 text-sm">Import Data Massal</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Isi anggota, saldo simpanan awal, dan proyek sekaligus lewat template Excel.
            </p>
          </div>
        </div>
        <button
          onClick={() => setBulkImportOpen(true)}
          className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <Upload className="h-4 w-4" /> Import Data
        </button>
      </div>

      {/* Dummy Data Section */}
      {stats.total_anggota === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="font-medium text-gray-700">Tidak ada data</p>
              <p className="text-sm text-gray-400 mt-0.5">
                Isi dengan data dummy realistis: 5 anggota, 5 proyek, simpanan, pembiayaan, dan bagi hasil — semua tersync ke jurnal ERP.
              </p>
            </div>
            <button
              onClick={() => setConfirmOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <RefreshCw className="h-4 w-4" /> Isi Data Dummy
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-red-200 bg-red-50 p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="font-medium text-red-700 text-sm">Reset &amp; Perbarui Data Dummy</p>
              <p className="text-xs text-red-400 mt-0.5">
                Hapus semua data dummy (anggota, proyek, simpanan, jurnal ERP) lalu isi ulang dari awal.
              </p>
            </div>
            <button
              onClick={() => setResetConfirmOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <RefreshCw className="h-4 w-4" /> Reset &amp; Renew
            </button>
          </div>
        </div>
      )}

      {seedResult && (
        <div className={cn('rounded-xl border p-4 text-sm',
          seedResult.startsWith('Gagal')
            ? 'border-red-200 bg-red-50 text-red-700'
            : 'border-emerald-200 bg-emerald-50 text-emerald-700')}>
          {seedResult}
        </div>
      )}

      {/* Konfirmasi Modal — Seed */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Isi Data Dummy Kojasmat">
        <div className="space-y-4">
          <div className="rounded-xl bg-violet-50 border border-violet-100 p-4 text-sm text-violet-800 space-y-1">
            <p className="font-medium mb-2">Data yang akan dibuat:</p>
            <p>• 5 anggota (4 aktif terverifikasi, 1 calon)</p>
            <p>• Riwayat setoran simpanan Pokok + Wajib + Sukarela</p>
            <p>• 5 proyek: BERJALAN, OPEN, REVIEW DPS, SELESAI, DRAFT</p>
            <p>• Review DPS untuk 3 proyek yang sudah disetujui</p>
            <p>• Pembiayaan sindikat dari 3 anggota ke PY-0001</p>
            <p>• Distribusi bagi hasil PY-0004 ke simpanan anggota</p>
            <p>• 3 penawaran ke tab anggota</p>
            <p>• 2 jadwal pelatihan (1 selesai, 1 mendatang)</p>
            <p className="font-medium mt-2 border-t border-violet-200 pt-2">
              Semua transaksi keuangan dicatat ke jurnal akuntansi ERP.
            </p>
          </div>
          <p className="text-xs text-gray-400">Seeder hanya berjalan jika belum ada anggota di organisasi ini.</p>
          <div className="flex gap-3">
            <button onClick={() => setConfirmOpen(false)}
              className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
              Batal
            </button>
            <button onClick={handleSeed} disabled={pending}
              className="flex-1 rounded-xl bg-violet-600 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 transition-colors cursor-pointer">
              {pending ? 'Sedang mengisi...' : 'Ya, Isi Sekarang'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Konfirmasi Modal — Reset & Renew */}
      <Modal open={resetConfirmOpen} onClose={() => setResetConfirmOpen(false)} title="Reset & Renew Data Dummy">
        <div className="space-y-4">
          <div className="rounded-xl bg-red-50 border border-red-100 p-4 text-sm text-red-800 space-y-1">
            <p className="font-medium mb-2">Yang akan dihapus permanen:</p>
            <p>• Semua anggota, simpanan, dan riwayat mutasi</p>
            <p>• Semua proyek, pembiayaan, DPS review, bagi hasil</p>
            <p>• Semua pendaftaran, dokumen, dan laporan proyek</p>
            <p>• Semua pelatihan dan peserta</p>
            <p>• Akun login anggota (internal auth)</p>
            <p>• Jurnal akuntansi ERP terkait kojasmat</p>
          </div>
          <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-xs text-amber-700">
            Setelah dihapus, data dummy baru langsung diisi ulang dari awal. Tindakan ini tidak bisa dibatalkan.
          </div>
          <div className="flex gap-3">
            <button onClick={() => setResetConfirmOpen(false)}
              className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
              Batal
            </button>
            <button onClick={handleResetReseed} disabled={pending}
              className="flex-1 rounded-xl bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors cursor-pointer">
              {pending ? 'Sedang memproses...' : 'Ya, Reset & Renew'}
            </button>
          </div>
        </div>
      </Modal>

      <BulkImportModal orgId={orgId} open={bulkImportOpen} onClose={() => setBulkImportOpen(false)} />
    </div>
  )
}

// ─── TAB: ANGGOTA ─────────────────────────────────────────────────────────────

type AnggotaForm = {
  nama: string; nik: string; email: string; phone: string
  alamat: string; pekerjaan: string; joined_at: string; notes: string
  is_verified: boolean; status: string
  kontak_darurat_nama: string; kontak_darurat_hubungan: string
  kontak_darurat_phone: string; kontak_darurat_alamat: string
}

const emptyAnggotaForm: AnggotaForm = {
  nama: '', nik: '', email: '', phone: '', alamat: '', pekerjaan: '', joined_at: '', notes: '',
  is_verified: false, status: 'CALON',
  kontak_darurat_nama: '', kontak_darurat_hubungan: '', kontak_darurat_phone: '', kontak_darurat_alamat: '',
}

const HUBUNGAN_DARURAT_OPTIONS = ['Suami/Istri', 'Orang Tua', 'Anak', 'Saudara Kandung', 'Lainnya']

function TabAnggota({ orgId, anggota }: { orgId: string; anggota: KojasmatAnggota[] }) {
  const [pending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [sortOrder, setSortOrder] = useState<'kode' | 'nama' | 'tanggal'>('kode')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [currentPage, setCurrentPage] = useState(1)

  const [modalOpen, setModalOpen] = useState(false)
  const [selected, setSelected] = useState<KojasmatAnggota | null>(null)
  const [form, setForm] = useState<AnggotaForm>(emptyAnggotaForm)
  const [kredensial, setKredensial] = useState<KredensialAnggota | null>(null)
  const [copied, setCopied] = useState(false)
  const [modalDelete, setModalDelete] = useState<KojasmatAnggota | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [dokumenAnggota, setDokumenAnggota] = useState<KojasmatDokumen[]>([])
  const [loadingDokAnggota, setLoadingDokAnggota] = useState(false)
  const [bukuOpen, setBukuOpen] = useState(false)
  const [bukuAnggota, setBukuAnggota] = useState<KojasmatAnggota | null>(null)
  const [transaksiAnggota, setTransaksiAnggota] = useState<KojasmatAnggota | null>(null)
  const [transaksiModalOpen, setTransaksiModalOpen] = useState(false)
  const [mutasiError, setMutasiError] = useState<string | null>(null)
  const [transaksiForm, setTransaksiForm] = useState({
    jenis_simpanan: 'WAJIB', jenis_mutasi: 'SETOR',
    jumlah: '', keterangan: '', tanggal: new Date().toISOString().split('T')[0]
  })

  const filteredData = anggota.filter(a => {
    const matchSearch = a.nama.toLowerCase().includes(search.toLowerCase()) || 
                        a.kode_anggota.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'ALL' || a.status === filterStatus
    return matchSearch && matchStatus
  })

  const sortedData = [...filteredData].sort((a, b) => {
    let cmp = 0
    if (sortOrder === 'kode') cmp = a.kode_anggota.localeCompare(b.kode_anggota)
    else if (sortOrder === 'nama') cmp = a.nama.localeCompare(b.nama)
    else if (sortOrder === 'tanggal') cmp = (a.joined_at ?? '').localeCompare(b.joined_at ?? '')
    return sortDir === 'asc' ? cmp : -cmp
  })

  const itemsPerPage = 10
  const totalPages = Math.ceil(sortedData.length / itemsPerPage) || 1
  const paginatedData = sortedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  useEffect(() => {
    setCurrentPage(1)
  }, [search, filterStatus, sortOrder, sortDir])

  function openEdit(a: KojasmatAnggota) {
    setSelected(a)
    setForm({ nama: a.nama, nik: a.nik ?? '', email: a.email ?? '', phone: a.phone ?? '',
              alamat: a.alamat ?? '', pekerjaan: a.pekerjaan ?? '',
              joined_at: a.joined_at ?? '', notes: a.notes ?? '',
              is_verified: a.is_verified, status: a.status,
              kontak_darurat_nama: a.kontak_darurat_nama ?? '',
              kontak_darurat_hubungan: a.kontak_darurat_hubungan ?? '',
              kontak_darurat_phone: a.kontak_darurat_phone ?? '',
              kontak_darurat_alamat: a.kontak_darurat_alamat ?? '' })
    setModalOpen(true)
    setDokumenAnggota([])
    setLoadingDokAnggota(true)
    getDokumenByRef('ANGGOTA', a.id).then(docs => {
      setDokumenAnggota(docs)
      setLoadingDokAnggota(false)
    })
  }

  function openNew() {
    setSelected(null)
    setForm(emptyAnggotaForm)
    setModalOpen(true)
  }

  async function openSignedUrlAnggota(key: string) {
    const res = await fetch(`/api/kojasmat/file?key=${encodeURIComponent(key)}`)
    const { url } = await res.json() as { url: string }
    window.open(url, '_blank')
  }

  function openBukuTabunganAnggota(a: KojasmatAnggota) {
    setBukuAnggota(a)
    setBukuOpen(true)
  }

  function openTransaksiAnggota(a: KojasmatAnggota) {
    setTransaksiAnggota(a)
    setBukuOpen(false)
    setTransaksiModalOpen(true)
  }

  function handleMutasiAnggota() {
    if (!transaksiAnggota) return
    setMutasiError(null)
    startTransition(async () => {
      const res = await catatSimpananMutasi({
        org_id: orgId,
        anggota_id: transaksiAnggota.id,
        jenis_simpanan: transaksiForm.jenis_simpanan as 'POKOK' | 'WAJIB' | 'SUKARELA' | 'PROYEK' | 'HIBAH_NAMETAG' | 'HIBAH_MEMBERCARD' | 'HIBAH_KAJIAN' | 'HIBAH_BOP',
        jenis_mutasi: transaksiForm.jenis_mutasi as 'SETOR' | 'TARIK' | 'KOREKSI',
        jumlah: Number(transaksiForm.jumlah),
        keterangan: transaksiForm.keterangan || undefined,
        tanggal: transaksiForm.tanggal,
      })
      if (res.error) {
        setMutasiError(res.error)
        return
      }
      setMutasiError(null)
      setTransaksiModalOpen(false)
      setTransaksiForm({ jenis_simpanan: 'WAJIB', jenis_mutasi: 'SETOR', jumlah: '', keterangan: '', tanggal: new Date().toISOString().split('T')[0] })
    })
  }

  function buildAnggotaWaText(k: KredensialAnggota) {
    const appUrl = typeof window !== 'undefined' ? window.location.origin : ''
    return [
      `Halo ${k.nama},`,
      ``,
      `Akun keanggotaan koperasi Anda sudah aktif.`,
      ``,
      `*Kode Anggota:* ${k.kode_anggota}`,
      `*Login di:* ${appUrl}/anggota/login`,
      k.login_identifier ? `*Email/NIK:* ${k.login_identifier}` : null,
      k.temp_password ? `*Password:* ${k.temp_password}` : null,
      ``,
      `Silakan login dan ganti password setelah masuk pertama kali.`,
    ].filter(Boolean).join('\n')
  }

  async function handleCopyWa() {
    if (!kredensial) return
    await navigator.clipboard.writeText(buildAnggotaWaText(kredensial))
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  function handleSave() {
    startTransition(async () => {
      if (selected) {
        await updateAnggota(selected.id, {
          ...selected, ...form,
          status: form.status as KojasmatAnggota['status'],
        })
      } else {
        const res = await createAnggota({ org_id: orgId, ...form })
        if (res.data && res.tempPassword) {
          setKredensial({
            kode_anggota: res.data.kode_anggota,
            nama: res.data.nama,
            login_identifier: res.loginIdentifier ?? null,
            temp_password: res.tempPassword,
          })
        }
      }
      setModalOpen(false)
    })
  }

  function handleDeleteAnggota() {
    if (!modalDelete) return
    setDeleteError(null)
    startTransition(async () => {
      const res = await deleteAnggota(modalDelete.id)
      if (res.error) {
        setDeleteError(res.error)
        return
      }
      setModalDelete(null)
    })
  }

  const statusColor: Record<string, string> = {
    CALON: 'bg-gray-100 text-gray-600',
    AKTIF: 'bg-emerald-100 text-emerald-700',
    TIDAK_AKTIF: 'bg-orange-100 text-orange-700',
    DIBEKUKAN: 'bg-red-100 text-red-700',
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-1 w-full flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder="Cari nama atau kode..."
              value={search} onChange={e => setSearch(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2">
            <div className="relative flex items-center">
              <Filter className="absolute left-3 h-4 w-4 text-gray-400" />
              <select 
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-8 text-sm outline-none focus:border-emerald-500 appearance-none cursor-pointer"
              >
                <option value="ALL">Semua Status</option>
                <option value="CALON">Calon</option>
                <option value="AKTIF">Aktif</option>
                <option value="TIDAK_AKTIF">Tidak Aktif</option>
                <option value="DIBEKUKAN">Dibekukan</option>
              </select>
            </div>

            <div className="flex rounded-xl border border-gray-200 bg-white overflow-hidden">
              <select
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value as any)}
                className="border-none py-2 pl-3 pr-8 text-sm outline-none focus:ring-0 bg-transparent appearance-none cursor-pointer"
              >
                <option value="kode">Urut Kode</option>
                <option value="nama">Urut Nama</option>
                <option value="tanggal">Urut Tanggal</option>
              </select>
              <button 
                onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                className="px-2 border-l border-gray-200 hover:bg-gray-50 text-gray-500 cursor-pointer flex items-center justify-center"
                title={`Urut ${sortDir === 'asc' ? 'Menaik' : 'Menurun'}`}
              >
                <ArrowUpDown className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors cursor-pointer whitespace-nowrap">
          <Plus className="h-4 w-4" /> Anggota Baru
        </button>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Kode</th>
                <th className="px-4 py-3 text-left font-medium">Nama</th>
                <th className="px-4 py-3 text-left font-medium">Phone</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Terverifikasi</th>
                <th className="px-4 py-3 text-left font-medium">Bergabung</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginatedData.length === 0 && (
                <tr><td colSpan={7} className="py-10 text-center text-gray-400">Belum ada anggota</td></tr>
              )}
              {paginatedData.map(a => (
                <tr key={a.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3 font-mono font-medium text-emerald-700">{a.kode_anggota}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{a.nama}</td>
                  <td className="px-4 py-3 text-gray-500">{a.phone ?? '—'}</td>
                  <td className="px-4 py-3"><Badge text={a.status} cls={statusColor[a.status] ?? 'bg-gray-100 text-gray-600'} /></td>
                  <td className="px-4 py-3">
                    <button
                      title={a.is_verified ? 'Klik untuk cabut verifikasi' : 'Klik untuk verifikasi anggota'}
                      onClick={() => startTransition(async () => {
                        await updateAnggota(a.id, { ...a, is_verified: !a.is_verified, status: !a.is_verified ? 'AKTIF' : a.status })
                      })}
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition-colors cursor-pointer',
                        a.is_verified
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-red-50 hover:text-red-600'
                          : 'bg-gray-100 text-gray-400 hover:bg-emerald-50 hover:text-emerald-700'
                      )}>
                      {a.is_verified
                        ? <><CheckCircle className="h-3.5 w-3.5" /> Terverifikasi</>
                        : <><XCircle className="h-3.5 w-3.5" /> Belum</>}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{a.joined_at ? String(a.joined_at).split('T')[0] : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <a href={`/anggota/${a.kode_anggota}?org=${orgId}`} target="_blank"
                        className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-100 transition-colors cursor-pointer whitespace-nowrap">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <button onClick={() => openBukuTabunganAnggota(a)}
                        title="Buku Tabungan"
                        className="rounded-lg p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer">
                        <BookOpen className="h-4 w-4" />
                      </button>
                      <button onClick={() => openEdit(a)}
                        className="rounded-lg p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer">
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      <button onClick={() => { setModalDelete(a); setDeleteError(null) }}
                        title="Hapus anggota"
                        className="rounded-lg p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/50 px-4 py-3">
            <span className="text-sm text-gray-500">
              Menampilkan <span className="font-medium text-gray-900">{paginatedData.length}</span> dari <span className="font-medium text-gray-900">{filteredData.length}</span> data
            </span>
            <div className="flex items-center gap-1">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-200 disabled:opacity-50 cursor-pointer flex items-center justify-center"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 text-sm font-medium text-gray-700 min-w-[3rem] text-center">
                {currentPage} / {totalPages}
              </span>
              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-200 disabled:opacity-50 cursor-pointer flex items-center justify-center"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={selected ? 'Edit Anggota' : 'Daftarkan Anggota Baru'}>
        <div className="space-y-3">
          {([
            { key: 'nama', label: 'Nama Lengkap *', placeholder: 'Nama lengkap anggota' },
            { key: 'nik',  label: 'NIK',            placeholder: '16 digit NIK' },
            { key: 'email',label: 'Email',           placeholder: 'email@domain.com' },
            { key: 'phone',label: 'No. HP',          placeholder: '08xxxxxxxxxx' },
            { key: 'pekerjaan', label: 'Pekerjaan',  placeholder: 'Contoh: Pedagang' },
          ] as const).map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
              <input
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder={placeholder}
                value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              />
            </div>
          ))}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Tanggal Bergabung</label>
            <input type="date"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              value={form.joined_at}
              onChange={e => setForm(f => ({ ...f, joined_at: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Alamat</label>
            <textarea rows={2}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 resize-none"
              placeholder="Alamat lengkap"
              value={form.alamat}
              onChange={e => setForm(f => ({ ...f, alamat: e.target.value }))}
            />
          </div>

          <div className="pt-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Kontak Darurat</p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Nama Kontak Darurat</label>
                <input
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Nama orang yang bisa dihubungi"
                  value={form.kontak_darurat_nama}
                  onChange={e => setForm(f => ({ ...f, kontak_darurat_nama: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Hubungan</label>
                  <select
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                    value={form.kontak_darurat_hubungan}
                    onChange={e => setForm(f => ({ ...f, kontak_darurat_hubungan: e.target.value }))}>
                    <option value="">— pilih —</option>
                    {HUBUNGAN_DARURAT_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">No. Telepon / WA</label>
                  <input
                    type="text" inputMode="numeric" pattern="[0-9]*"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    placeholder="628xxxxxxxxxx"
                    maxLength={15}
                    value={form.kontak_darurat_phone}
                    onChange={e => setForm(f => ({ ...f, kontak_darurat_phone: e.target.value.replace(/\D/g, '').slice(0, 15) }))}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Alamat Kontak Darurat</label>
                <textarea rows={2}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 resize-none"
                  placeholder="Alamat lengkap kontak darurat"
                  value={form.kontak_darurat_alamat}
                  onChange={e => setForm(f => ({ ...f, kontak_darurat_alamat: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {selected && (
            <div className="pt-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Dokumen (KTP, Bukti Pembayaran, dll.)</p>
              {loadingDokAnggota ? (
                <p className="text-sm text-gray-400">Memuat dokumen...</p>
              ) : dokumenAnggota.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Belum ada dokumen dilampirkan</p>
              ) : (
                <div className="space-y-2">
                  {dokumenAnggota.map(d => (
                    <div key={d.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{d.jenis_dokumen}</p>
                        <p className="text-xs text-gray-400">{d.nama_file}</p>
                      </div>
                      <button onClick={() => openSignedUrlAnggota(d.file_key)}
                        className="flex items-center gap-1 rounded-lg bg-white border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer">
                        <Eye className="h-3.5 w-3.5" /> Lihat
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {selected && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Status Keanggotaan</label>
                <select
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="CALON">Calon</option>
                  <option value="AKTIF">Aktif</option>
                  <option value="TIDAK_AKTIF">Tidak Aktif</option>
                  <option value="DIBEKUKAN">Dibekukan</option>
                </select>
              </div>
              <div className="flex flex-col justify-end">
                <label className="flex items-center gap-2.5 cursor-pointer rounded-xl border border-gray-200 px-3 py-2.5">
                  <div className={cn(
                    'relative h-5 w-9 rounded-full transition-colors',
                    form.is_verified ? 'bg-emerald-500' : 'bg-gray-200'
                  )}>
                    <div className={cn(
                      'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                      form.is_verified ? 'translate-x-4' : 'translate-x-0.5'
                    )} />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Terverifikasi</span>
                  <input type="checkbox" className="hidden"
                    checked={form.is_verified}
                    onChange={e => setForm(f => ({ ...f, is_verified: e.target.checked }))} />
                </label>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)}
              className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
              Batal
            </button>
            <button onClick={handleSave} disabled={!form.nama || pending}
              className="flex-1 rounded-xl bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer">
              {pending ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!modalDelete} onClose={() => setModalDelete(null)} title="Hapus Anggota">
        {modalDelete && (
          <div className="space-y-4">
            <div className="rounded-xl border border-red-100 bg-red-50 p-4">
              <p className="font-medium text-red-800">{modalDelete.nama}</p>
              <p className="text-sm text-red-600 mt-1 font-mono">{modalDelete.kode_anggota}</p>
            </div>
            <p className="text-sm text-gray-600">
              Anggota ini akan dihapus permanen beserta akun login dan rekening simpanannya.
              Hanya bisa dihapus kalau belum ada riwayat transaksi (setoran, proyek, pembiayaan,
              penawaran, bagi hasil) — kalau sudah ada, gunakan status Tidak Aktif/Dibekukan.
            </p>
            {deleteError && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {deleteError}
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setModalDelete(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
                Batal
              </button>
              <button onClick={handleDeleteAnggota} disabled={pending}
                className="flex-1 rounded-xl bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors cursor-pointer">
                {pending ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!kredensial} onClose={() => setKredensial(null)} title="Anggota Dibuat — Info Login">
        {kredensial && (
          <div className="space-y-4">
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-center">
              <p className="text-xs text-emerald-600 mb-1">Kode Anggota</p>
              <p className="text-2xl font-bold font-mono text-emerald-700">{kredensial.kode_anggota}</p>
              <p className="text-sm text-emerald-600 mt-0.5">{kredensial.nama}</p>
            </div>

            {kredensial.temp_password ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Kredensial Login</p>
                <div className="rounded-xl border border-gray-100 bg-gray-50 divide-y divide-gray-100">
                  {kredensial.login_identifier && (
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-xs text-gray-400">Email / NIK</span>
                      <span className="font-mono text-sm font-medium text-gray-800">{kredensial.login_identifier}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-xs text-gray-400">Password Sementara</span>
                    <span className="font-mono text-sm font-bold text-gray-900 tracking-widest">{kredensial.temp_password}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-400">Anggota bisa login di halaman <strong>/anggota/login</strong> memakai kode anggota + password di atas.</p>
              </div>
            ) : (
              <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-700">
                Anggota tidak memiliki email/NIK — akun login tidak dibuat. Tambahkan email/NIK untuk membuat akun.
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setKredensial(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
                Tutup
              </button>
              {kredensial.temp_password && (
                <button onClick={handleCopyWa}
                  className={cn(
                    'flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors cursor-pointer',
                    copied
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  )}>
                  {copied ? '✓ Tersalin!' : 'Salin Pesan WA'}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Buku Tabungan Drawer — mutasi transaksi anggota */}
      <Drawer
        open={bukuOpen}
        onClose={() => setBukuOpen(false)}
        title={`Buku Tabungan — ${bukuAnggota?.nama ?? ''}`}
      >
        {bukuAnggota && (
          <BukuTabunganPanel
            key={bukuAnggota.id}
            anggota={bukuAnggota}
            orgId={orgId}
            onTransaksi={() => openTransaksiAnggota(bukuAnggota)}
          />
        )}
      </Drawer>

      {/* Modal Transaksi — dipicu dari tombol "+ Transaksi" di Buku Tabungan */}
      <Modal open={transaksiModalOpen} onClose={() => { setTransaksiModalOpen(false); setMutasiError(null) }}
        title={`Transaksi Simpanan — ${transaksiAnggota?.nama ?? ''}`}>
        <div className="space-y-3">
          {mutasiError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {mutasiError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Jenis Simpanan</label>
              <select className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                value={transaksiForm.jenis_simpanan}
                onChange={e => setTransaksiForm(f => ({ ...f, jenis_simpanan: e.target.value }))}>
                <option value="POKOK">Simpanan Pokok</option>
                <option value="WAJIB">Simpanan Wajib</option>
                <option value="SUKARELA">Simpanan Sukarela</option>
                <option value="HIBAH_NAMETAG">Hibah Name Tag</option>
                <option value="HIBAH_MEMBERCARD">Hibah Member Card</option>
                <option value="HIBAH_KAJIAN">Hibah Kajian</option>
                <option value="HIBAH_BOP">Hibah BOP</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Jenis Mutasi</label>
              <select className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                value={transaksiForm.jenis_mutasi}
                onChange={e => setTransaksiForm(f => ({ ...f, jenis_mutasi: e.target.value }))}>
                <option value="SETOR">Setoran</option>
                <option value="TARIK">Penarikan</option>
                <option value="KOREKSI">Koreksi</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Jumlah (Rp)</label>
              <input type="number"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                placeholder="50000"
                value={transaksiForm.jumlah} onChange={e => setTransaksiForm(f => ({ ...f, jumlah: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Tanggal</label>
              <input type="date"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                value={transaksiForm.tanggal} onChange={e => setTransaksiForm(f => ({ ...f, tanggal: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Keterangan</label>
            <input
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              placeholder="Contoh: Setoran wajib bulan Juni"
              value={transaksiForm.keterangan} onChange={e => setTransaksiForm(f => ({ ...f, keterangan: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setTransaksiModalOpen(false)}
              className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
              Batal
            </button>
            <button onClick={handleMutasiAnggota} disabled={!transaksiForm.jumlah || pending}
              className={cn('flex-1 rounded-xl py-2 text-sm font-medium text-white transition-colors cursor-pointer disabled:opacity-50',
                transaksiForm.jenis_mutasi === 'TARIK' ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-600 hover:bg-emerald-700')}>
              {pending ? 'Memproses...'
                : transaksiForm.jenis_mutasi === 'SETOR' ? 'Catat Setoran'
                : transaksiForm.jenis_mutasi === 'TARIK' ? 'Catat Penarikan'
                : 'Catat Koreksi'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── KEUANGAN PROYEK ──────────────────────────────────────────────────────────

function LaporanKeuanganView({ laporan }: { laporan: KojasmatLaporanKeuanganProyek }) {
  const { labaRugi, neraca, cashflow, bagiHasil, analisis } = laporan
  return (
    <div className="space-y-4">
      {/* Laba/Rugi */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-3">
          <Scale className="h-4 w-4 text-blue-500" /> Laba / Rugi
        </p>
        <div className="space-y-1.5 text-sm">
          {labaRugi.rincianPendapatan.map(r => (
            <div key={r.kategori} className="flex justify-between text-gray-600">
              <span>{r.kategori}</span><span>{fmt(r.jumlah)}</span>
            </div>
          ))}
          <div className="flex justify-between font-medium text-gray-800 pt-1 border-t border-gray-100">
            <span>Total Pendapatan</span><span>{fmt(labaRugi.totalPendapatan)}</span>
          </div>
          {labaRugi.rincianBeban.map(r => (
            <div key={r.kategori} className="flex justify-between text-gray-600 pt-1">
              <span>{r.kategori}</span><span>({fmt(r.jumlah)})</span>
            </div>
          ))}
          <div className="flex justify-between font-medium text-gray-800 pt-1 border-t border-gray-100">
            <span>Total Beban</span><span>({fmt(labaRugi.totalBeban)})</span>
          </div>
          <div className={cn('flex justify-between font-bold pt-2 border-t border-gray-200',
            labaRugi.labaBersih >= 0 ? 'text-emerald-700' : 'text-red-600')}>
            <span>Laba Bersih</span><span>{fmt(labaRugi.labaBersih)}</span>
          </div>
        </div>
      </div>

      {/* Neraca */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-3">
          <Wallet className="h-4 w-4 text-emerald-500" /> Neraca Sederhana
        </p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-gray-400 mb-1">Aset</p>
            <div className="flex justify-between text-gray-600"><span>Kas Proyek</span><span>{fmt(neraca.kas)}</span></div>
            <div className="flex justify-between font-semibold text-gray-800 pt-1 border-t border-gray-100 mt-1"><span>Total Aset</span><span>{fmt(neraca.totalAset)}</span></div>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Kewajiban &amp; Ekuitas</p>
            <div className="flex justify-between text-gray-600"><span>Modal Pemodal</span><span>{fmt(neraca.modalPemodal)}</span></div>
            <div className="flex justify-between text-gray-600"><span>Laba Ditahan</span><span>{fmt(neraca.labaDitahan)}</span></div>
            <div className="flex justify-between font-semibold text-gray-800 pt-1 border-t border-gray-100 mt-1"><span>Total</span><span>{fmt(neraca.totalKewajibanEkuitas)}</span></div>
          </div>
        </div>
      </div>

      {/* Cashflow */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-3">
          <TrendingDown className="h-4 w-4 text-purple-500 rotate-180" /> Laporan Cashflow
        </p>
        <div className="space-y-1.5 text-sm text-gray-600">
          <div className="flex justify-between"><span>Kas Masuk Operasional</span><span>{fmt(cashflow.kasMasukOperasional)}</span></div>
          <div className="flex justify-between"><span>Kas Keluar Operasional</span><span>({fmt(cashflow.kasKeluarOperasional)})</span></div>
          <div className="flex justify-between"><span>Kas Masuk Pendanaan (Modal)</span><span>{fmt(cashflow.kasMasukPendanaan)}</span></div>
          <div className="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-200">
            <span>Saldo Kas Akhir</span><span>{fmt(cashflow.saldoKasAkhir)}</span>
          </div>
        </div>
      </div>

      {/* Sharing Profit */}
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-900 mb-3">
          <Banknote className="h-4 w-4" /> Sharing Profit &amp; Potensi Bagi Hasil
        </p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-white p-3">
            <p className="text-xs text-gray-400">Nisbah Pemodal</p>
            <p className="font-bold text-emerald-700">{bagiHasil.nisbahPemodal}%</p>
            <p className="text-xs text-gray-500 mt-1">Potensi: {fmt(bagiHasil.potensiBagiHasilPemodal)}</p>
          </div>
          <div className="rounded-xl bg-white p-3">
            <p className="text-xs text-gray-400">Nisbah Pengaju</p>
            <p className="font-bold text-blue-700">{bagiHasil.nisbahPengaju}%</p>
            <p className="text-xs text-gray-500 mt-1">Potensi: {fmt(bagiHasil.potensiBagiHasilPengaju)}</p>
          </div>
        </div>
      </div>

      {/* Analisis */}
      {analisis.length > 0 && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-900 mb-2">Analisis</p>
          <ul className="space-y-1.5 list-disc list-inside text-sm text-blue-800">
            {analisis.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

function DaftarPemodalPanel({ proyekId }: { proyekId: string }) {
  const [list, setList] = useState<KojasmatPemodalDenganPotensi[] | null>(null)

  useEffect(() => {
    let cancelled = false
    getPemodalDenganPotensi(proyekId).then(l => { if (!cancelled) setList(l) })
    return () => { cancelled = true }
  }, [proyekId])

  if (list === null) return <div className="py-4 text-center text-sm text-gray-400">Memuat daftar pemodal...</div>

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4">
      <p className="text-sm font-semibold text-gray-800 mb-3">Daftar Pemodal</p>
      {list.length === 0 ? (
        <p className="text-sm text-gray-400">Belum ada pemodal yang mendanai proyek ini.</p>
      ) : (
        <div className="space-y-2">
          {list.map(pm => (
            <div key={pm.id} className="flex items-center justify-between rounded-xl border border-gray-100 p-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{pm.pemodal_nama}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Porsi {pm.porsi_pct.toFixed(1)}% · {pm.kehadiran_akad === 'DIWAKILKAN' ? 'Diwakilkan koperasi' : 'Hadir sendiri'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-gray-900">{fmt(pm.jumlah)}</p>
                <p className="text-xs font-medium text-emerald-600">Potensi {fmt(pm.potensiBagiHasil)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RiwayatProyekPanel({ proyekId }: { proyekId: string }) {
  const [history, setHistory] = useState<KojasmatProyekHistory[] | null>(null)
  const [akad, setAkad] = useState<KojasmatAkad[] | null>(null)

  useEffect(() => {
    let cancelled = false
    getProyekHistory(proyekId).then(l => { if (!cancelled) setHistory(l) })
    getAkadByProyek(proyekId).then(l => { if (!cancelled) setAkad(l) })
    return () => { cancelled = true }
  }, [proyekId])

  const akadAktif = akad?.find(a => a.status !== 'BATAL')

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4">
      <p className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-1.5">
        <History className="h-4 w-4" /> Riwayat Proyek
      </p>
      {akadAktif && (
        <div className="mb-3 rounded-xl border border-violet-100 bg-violet-50 p-3 text-xs text-violet-700">
          <p className="font-medium flex items-center gap-1.5">
            <FileSignature className="h-3.5 w-3.5" /> Akad — {akadAktif.status === 'DITANDATANGANI' ? 'Sudah ditandatangani' : 'Menunggu tanda tangan'}
          </p>
          {akadAktif.jadwal_akad && <p className="mt-1">Jadwal: {String(akadAktif.jadwal_akad).split('T')[0]}</p>}
          {(akadAktif.saksi_nama || akadAktif.saksi_2_nama) && (
            <p>Saksi: {[akadAktif.saksi_nama, akadAktif.saksi_2_nama].filter(Boolean).join(', ')}</p>
          )}
        </div>
      )}
      {history === null ? (
        <p className="text-sm text-gray-400">Memuat riwayat...</p>
      ) : history.length === 0 ? (
        <p className="text-sm text-gray-400">Belum ada riwayat perubahan status.</p>
      ) : (
        <div className="space-y-2">
          {history.map(h => (
            <div key={h.id} className="flex items-start gap-2 text-xs">
              <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300" />
              <div>
                <p className="text-gray-700">
                  <span className="font-medium">{h.aksi.replaceAll('_', ' ')}</span>
                  {h.status_dari && <> — {STATUS_PROYEK[h.status_dari]?.label ?? h.status_dari} → </>}
                  {!h.status_dari && <> — </>}
                  {STATUS_PROYEK[h.status_ke]?.label ?? h.status_ke}
                </p>
                <p className="text-gray-400">{new Date(h.created_at).toLocaleString('id-ID')}{h.actor_role ? ` · ${h.actor_role}` : ''}</p>
                {h.pesan && <p className="text-gray-500 mt-0.5">{h.pesan}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DetailProyekPanel({ proyek }: { proyek: KojasmatProyek }) {
  const st = STATUS_PROYEK[proyek.status] ?? { label: proyek.status, color: 'bg-gray-100 text-gray-600' }
  const pct = Number(proyek.kebutuhan_modal) > 0
    ? Math.min(100, (Number(proyek.modal_terkumpul) / Number(proyek.kebutuhan_modal)) * 100)
    : 0

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Badge text={st.label} cls={st.color} />
          <Badge text={proyek.jenis_akad} cls={AKAD_COLOR[proyek.jenis_akad] ?? 'bg-gray-100 text-gray-600'} />
        </div>
        <h3 className="text-base font-semibold text-gray-900">{proyek.nama_proyek}</h3>
        <p className="text-sm text-gray-500 mt-0.5">
          {proyek.kode_proyek} · Pengaju: {proyek.pengaju_nama ?? '—'} · {fmtDurasiProyek(proyek.durasi_bulan, proyek.durasi_hari)}
        </p>
        {proyek.deskripsi && <p className="text-sm text-gray-600 mt-2 leading-relaxed">{proyek.deskripsi}</p>}
        {proyek.agunan && <p className="text-xs text-gray-500 mt-2">Agunan: {proyek.agunan}</p>}

        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Terkumpul: {fmt(Number(proyek.modal_terkumpul))}</span>
            <span>{pct.toFixed(0)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-100">
            <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>Kebutuhan Modal</span>
            <span className="font-medium text-gray-700">{fmt(Number(proyek.kebutuhan_modal))}</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-400 mb-0.5">Nisbah Pengaju</p>
            <p className="font-bold text-gray-800">{proyek.nisbah_pengaju ?? 30}%</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-400 mb-0.5">Nisbah Pemodal</p>
            <p className="font-bold text-gray-800">{proyek.nisbah_pemodal ?? 70}%</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-400 mb-0.5">Ujrah Wakalah</p>
            <p className="font-bold text-gray-800">{fmt(Number(proyek.ujrah_nominal))}</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-400 mb-0.5">Ujrah Diwakilkan Akad</p>
            <p className="font-bold text-gray-800">{fmt(Number(proyek.ujrah_wakalah_akad ?? 0))}</p>
          </div>
        </div>

        {(proyek.tanggal_mulai || proyek.tanggal_selesai) && (
          <div className="mt-3 flex gap-4 text-xs text-gray-500">
            {proyek.tanggal_mulai && <span>Mulai: {String(proyek.tanggal_mulai).split('T')[0]}</span>}
            {proyek.tanggal_selesai && <span>Selesai: {String(proyek.tanggal_selesai).split('T')[0]}</span>}
          </div>
        )}
        {proyek.notes && <p className="mt-3 text-xs text-gray-400">Catatan: {proyek.notes}</p>}
      </div>

      <DaftarPemodalPanel proyekId={proyek.id} />
      <RiwayatProyekPanel proyekId={proyek.id} />
    </div>
  )
}

function DiskusiPanel({ orgId, proyekId }: { orgId: string; proyekId: string }) {
  const [pesan, setPesan] = useState('')
  const [diskusi, setDiskusi] = useState<KojasmatProyekDiskusi[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  const fetchDiskusi = useCallback(async () => {
    const res = await getProyekDiskusi(proyekId)
    setDiskusi(res)
    setLoading(false)
  }, [proyekId])

  useEffect(() => {
    let interval: NodeJS.Timeout
    fetchDiskusi().then(() => {
      interval = setInterval(fetchDiskusi, 5000)
    })
    return () => clearInterval(interval)
  }, [fetchDiskusi])

  async function handleSend() {
    if (!pesan.trim() || sending) return
    setSending(true)
    const res = await kirimPesanDiskusi({ org_id: orgId, proyek_id: proyekId, pesan })
    if (res.data) {
      setPesan('')
      await fetchDiskusi()
    }
    setSending(false)
  }
}

function KeuanganProyekPanel({ proyek, orgId }: { proyek: KojasmatProyek; orgId: string }) {
  const [pending, startTransition] = useTransition()
  const [transaksi, setTransaksi] = useState<KojasmatProyekTransaksi[]>([])
  const [laporan, setLaporan] = useState<KojasmatLaporanKeuanganProyek | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'laporan' | 'riwayat'>('laporan')
  const [bagiHasilError, setBagiHasilError] = useState<string | null>(null)
  const [form, setForm] = useState<{
    tanggal: string; jenis: 'PENDAPATAN' | 'BEBAN'; kategori: string; keterangan: string; jumlah: string
  }>({
    tanggal: new Date().toISOString().slice(0, 10),
    jenis: 'PENDAPATAN',
    kategori: KATEGORI_PENDAPATAN[0],
    keterangan: '',
    jumlah: '',
  })

  async function reload() {
    setLoading(true)
    const [t, l] = await Promise.all([
      getTransaksiByProyek(proyek.id),
      getLaporanKeuanganProyek(proyek.id),
    ])
    setTransaksi(t)
    setLaporan(l)
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false
    reload().then(() => { if (cancelled) return })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyek.id])

  function handleSubmit() {
    if (!form.jumlah || Number(form.jumlah) <= 0) return
    startTransition(async () => {
      await catatTransaksiProyek({
        org_id: orgId,
        proyek_id: proyek.id,
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

  function handleBagiHasil() {
    setBagiHasilError(null)
    startTransition(async () => {
      const res = await distribusikanBagiHasil(proyek.id)
      if (res.error) { setBagiHasilError(res.error); return }
      await reload()
    })
  }

  const kategoriOptions = form.jenis === 'PENDAPATAN' ? KATEGORI_PENDAPATAN : KATEGORI_BEBAN

  return (
    <div className="space-y-4">
      {/* Form catat transaksi */}
      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-800">Catat Perkembangan Proyek</p>
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
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500" />
          <select value={form.kategori} onChange={e => setForm(f => ({ ...f, kategori: e.target.value }))}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500">
            {kategoriOptions.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <input type="number" placeholder="Jumlah (Rp)" value={form.jumlah}
          onChange={e => setForm(f => ({ ...f, jumlah: e.target.value }))}
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500" />
        <input type="text" placeholder="Keterangan (opsional)" value={form.keterangan}
          onChange={e => setForm(f => ({ ...f, keterangan: e.target.value }))}
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500" />
        <button onClick={handleSubmit} disabled={pending || !form.jumlah}
          className="w-full rounded-xl bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer">
          {pending ? 'Menyimpan...' : 'Simpan Transaksi'}
        </button>
      </div>

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
        <div className="py-8 text-center text-sm text-gray-400">Memuat data keuangan...</div>
      ) : view === 'laporan' ? (
        laporan && (
          <div className="space-y-4">
            <DaftarPemodalPanel proyekId={proyek.id} />
            <LaporanKeuanganView laporan={laporan} />
            {laporan.labaRugi.labaBersih > 0 && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
                <p className="text-sm font-semibold text-emerald-900">
                  Harta proyek sudah melebihi modal — laba bersih {fmt(laporan.labaRugi.labaBersih)} siap dibagikan.
                </p>
                {bagiHasilError && <p className="text-xs text-rose-600">{bagiHasilError}</p>}
                <button onClick={handleBagiHasil} disabled={pending}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer">
                  <Banknote className="h-4 w-4" /> {pending ? 'Memproses...' : 'Bagi Hasil Sekarang'}
                </button>
              </div>
            )}
          </div>
        )
      ) : (
        <div className="space-y-2">
          {transaksi.length === 0 && (
            <div className="rounded-2xl border border-gray-100 bg-white py-10 text-center text-gray-400 text-sm">
              Belum ada transaksi tercatat
            </div>
          )}
          {transaksi.map(t => (
            <div key={t.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-3">
              <div>
                <p className="text-sm font-medium text-gray-800">{t.kategori}</p>
                <p className="text-xs text-gray-400">{String(t.tanggal).split('T')[0]}{t.keterangan ? ` · ${t.keterangan}` : ''}</p>
              </div>
              <p className={cn('text-sm font-semibold', t.jenis === 'PENDAPATAN' ? 'text-emerald-600' : 'text-red-600')}>
                {t.jenis === 'PENDAPATAN' ? '+' : '−'}{fmt(t.jumlah)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── TAB: PROYEK ──────────────────────────────────────────────────────────────

type ProyekForm = {
  pengaju_id: string; nama_proyek: string; deskripsi: string
  jenis_akad: string; kebutuhan_modal: string
  ujrah_nominal: string
  ujrah_wakalah_akad: string
  nisbah_pengaju: number
  durasi_bulan: string; durasi_hari: string; agunan: string; notes: string
}

const emptyProyekForm: ProyekForm = {
  pengaju_id: '', nama_proyek: '', deskripsi: '',
  jenis_akad: 'MUDHARABAH', kebutuhan_modal: '',
  ujrah_nominal: '150000',
  ujrah_wakalah_akad: '50000',
  nisbah_pengaju: 30,
  durasi_bulan: '6', durasi_hari: '0', agunan: '', notes: ''
}

function fmtDurasiProyek(bulan: number, hari?: number | null): string {
  return hari ? `${bulan} bulan ${hari} hari` : `${bulan} bulan`
}

function TabProyek({ orgId, proyek, anggota }: {
  orgId: string; proyek: KojasmatProyek[]; anggota: KojasmatAnggota[]
}) {
  const [pending, startTransition] = useTransition()
  const [subTab, setSubTab] = useState<'semua' | 'dmr' | 'dps'>('semua')
  const [modalNew, setModalNew] = useState(false)
  const [modalEdit, setModalEdit] = useState<KojasmatProyek | null>(null)
  const [modalDelete, setModalDelete] = useState<KojasmatProyek | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [konfirmasiHapusLanjut, setKonfirmasiHapusLanjut] = useState(false)
  const [dokProyek, setDokProyek] = useState<KojasmatProyek | null>(null)
  const [keuanganProyek, setKeuanganProyek] = useState<KojasmatProyek | null>(null)
  const [detailProyek, setDetailProyek] = useState<KojasmatProyek | null>(null)
  const [modalReview, setModalReview] = useState<{ proyek: KojasmatProyek; tahap: 'DMR' | 'DPS' } | null>(null)
  const [modalFunding, setModalFunding] = useState<KojasmatProyek | null>(null)
  const [modalAkad, setModalAkad] = useState<KojasmatProyek | null>(null)
  const [modalPenawaran, setModalPenawaran] = useState<KojasmatProyek | null>(null)
  const [reviewForm, setReviewForm] = useState<{ keputusan: 'DISETUJUI' | 'DITOLAK' | 'REVISI'; catatan: string }>({ keputusan: 'DISETUJUI', catatan: '' })
  const [fundingForm, setFundingForm] = useState<{ funding_mulai: string; funding_selesai: string; funding_instruksi: string; target_modal_awal: string; published_at: string }>({
    funding_mulai: new Date().toISOString().slice(0, 10), funding_selesai: '', funding_instruksi: '', target_modal_awal: '', published_at: ''
  })
  const [akadForm, setAkadForm] = useState<{ jadwal_akad: string; saksi_nama: string; saksi_2_nama: string }>({ jadwal_akad: '', saksi_nama: '', saksi_2_nama: '' })
  const [form, setForm] = useState<ProyekForm>(emptyProyekForm)
  const [editForm, setEditForm] = useState<ProyekForm>(emptyProyekForm)
  const [penawaranIds, setPenawaranIds] = useState<string[]>([])
  const [searchAnggotaNew, setSearchAnggotaNew] = useState('')
  const [showAnggotaDropdown, setShowAnggotaDropdown] = useState(false)

  const antrianDmr = proyek.filter(p => p.status === 'MENUNGGU_DMR')
  const antrianDps = proyek.filter(p => p.status === 'MENUNGGU_DPS')
  const displayProyek = subTab === 'dmr' ? antrianDmr : subTab === 'dps' ? antrianDps : proyek

  function handleCreate() {
    startTransition(async () => {
      await createProyek({
        org_id: orgId,
        pengaju_id: form.pengaju_id,
        nama_proyek: form.nama_proyek,
        deskripsi: form.deskripsi || undefined,
        jenis_akad: form.jenis_akad as 'MURABAHAH' | 'MUDHARABAH' | 'INAN',
        kebutuhan_modal: Number(form.kebutuhan_modal),
        ujrah_nominal: Number(form.ujrah_nominal),
        ujrah_wakalah_akad: Number(form.ujrah_wakalah_akad),
        nisbah_pengaju: form.nisbah_pengaju,
        nisbah_pemodal: 100 - form.nisbah_pengaju,
        durasi_bulan: Number(form.durasi_bulan),
        durasi_hari: Number(form.durasi_hari) || 0,
        agunan: form.agunan || undefined,
        notes: form.notes || undefined,
      })
      setModalNew(false)
      setForm(emptyProyekForm)
    })
  }

  function handleReview() {
    if (!modalReview) return
    startTransition(async () => {
      await submitProyekReview({
        org_id: orgId,
        proyek_id: modalReview.proyek.id,
        tahap: modalReview.tahap,
        keputusan: reviewForm.keputusan,
        catatan: reviewForm.catatan || undefined,
      })
      setModalReview(null)
    })
  }

  function handleResubmit(id: string) {
    startTransition(async () => { await resubmitProyek(id) })
  }

  function handleJadwalkanFunding() {
    if (!modalFunding || !fundingForm.funding_mulai || !fundingForm.funding_selesai) return
    startTransition(async () => {
      await jadwalkanFunding({
        org_id: orgId,
        proyek_id: modalFunding.id,
        funding_mulai: fundingForm.funding_mulai,
        funding_selesai: fundingForm.funding_selesai,
        funding_instruksi: fundingForm.funding_instruksi || undefined,
        target_modal_awal: fundingForm.target_modal_awal ? Number(fundingForm.target_modal_awal) : undefined,
        published_at: fundingForm.published_at ? (new Date(fundingForm.published_at)).toISOString() : undefined,
      })
      setModalFunding(null)
    })
  }

  function handleBukaFunding(id: string) {
    startTransition(async () => { await bukaFunding(id) })
  }

  function handleTutupFunding(id: string) {
    startTransition(async () => { await tutupFunding(id) })
  }

  function handleJadwalkanAkad() {
    if (!modalAkad || !akadForm.jadwal_akad) return
    startTransition(async () => {
      await jadwalkanAkad({
        org_id: orgId,
        proyek_id: modalAkad.id,
        jadwal_akad: akadForm.jadwal_akad,
        saksi_nama: akadForm.saksi_nama || undefined,
        saksi_2_nama: akadForm.saksi_2_nama || undefined,
      })
      setModalAkad(null)
    })
  }

  function handleTandatanganiAkad(p: KojasmatProyek) {
    startTransition(async () => {
      const list = await getAkadByProyek(p.id)
      const aktif = list.find(a => a.status === 'MENUNGGU_TTD')
      if (!aktif) return
      await tandatanganiAkad(aktif.id, p.id)
    })
  }

  function handleKirimPenawaran() {
    if (!modalPenawaran || !penawaranIds.length) return
    startTransition(async () => {
      await kirimPenawaranProyek({ org_id: orgId, proyek_id: modalPenawaran.id, anggota_ids: penawaranIds })
      setModalPenawaran(null)
      setPenawaranIds([])
    })
  }

  function handleStatus(id: string, status: string) {
    startTransition(async () => { await updateProyekStatus(id, status) })
  }

  function openEdit(p: KojasmatProyek) {
    setEditForm({
      pengaju_id: p.pengaju_id,
      nama_proyek: p.nama_proyek,
      deskripsi: p.deskripsi ?? '',
      jenis_akad: p.jenis_akad,
      kebutuhan_modal: String(p.kebutuhan_modal),
      ujrah_nominal: String(p.ujrah_nominal),
      ujrah_wakalah_akad: String(p.ujrah_wakalah_akad ?? 0),
      nisbah_pengaju: p.nisbah_pengaju ?? 30,
      durasi_bulan: String(p.durasi_bulan),
      durasi_hari: String(p.durasi_hari ?? 0),
      agunan: p.agunan ?? '',
      notes: p.notes ?? '',
    })
    setModalEdit(p)
  }

  function handleEdit() {
    if (!modalEdit) return
    startTransition(async () => {
      await updateProyek(modalEdit.id, {
        nama_proyek: editForm.nama_proyek,
        deskripsi: editForm.deskripsi || undefined,
        jenis_akad: editForm.jenis_akad as 'MURABAHAH' | 'MUDHARABAH' | 'INAN',
        kebutuhan_modal: Number(editForm.kebutuhan_modal),
        ujrah_nominal: Number(editForm.ujrah_nominal),
        ujrah_wakalah_akad: Number(editForm.ujrah_wakalah_akad),
        nisbah_pengaju: editForm.nisbah_pengaju,
        nisbah_pemodal: 100 - editForm.nisbah_pengaju,
        durasi_bulan: Number(editForm.durasi_bulan),
        durasi_hari: Number(editForm.durasi_hari) || 0,
        agunan: editForm.agunan || undefined,
        notes: editForm.notes || undefined,
      })
      setModalEdit(null)
    })
  }

  function handleDelete() {
    if (!modalDelete) return
    setDeleteError(null)
    startTransition(async () => {
      const res = await deleteProyek(modalDelete.id)
      if (res.error) {
        setDeleteError(res.error)
        return
      }
      setModalDelete(null)
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-1">
          {([
            ['semua', 'Semua Proyek'],
            ['dmr', `Antrian DMR${antrianDmr.length ? ` (${antrianDmr.length})` : ''}`],
            ['dps', `Antrian DPS${antrianDps.length ? ` (${antrianDps.length})` : ''}`],
          ] as const).map(([key, label]) => (
            <button key={key} onClick={() => setSubTab(key)}
              className={cn('rounded-lg px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer',
                subTab === key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
              {label}
            </button>
          ))}
        </div>
        <button onClick={() => { setModalNew(true); setForm(emptyProyekForm) }}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors cursor-pointer">
          <Plus className="h-4 w-4" /> Proyek Baru
        </button>
      </div>

      <div className="space-y-3">
        {displayProyek.length === 0 && (
          <div className="rounded-2xl border border-gray-100 bg-white py-12 text-center text-gray-400">
            {subTab === 'dmr' ? 'Tidak ada proyek menunggu review DMR'
              : subTab === 'dps' ? 'Tidak ada proyek menunggu review DPS' : 'Belum ada proyek'}
          </div>
        )}
        {displayProyek.map(p => {
          const st = STATUS_PROYEK[p.status] ?? { label: p.status, color: 'bg-gray-100 text-gray-600' }
          const pct = Number(p.kebutuhan_modal) > 0
            ? Math.min(100, (Number(p.modal_terkumpul) / Number(p.kebutuhan_modal)) * 100)
            : 0
          return (
            <div key={p.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-gray-400">{p.kode_proyek}</span>
                    <Badge text={st.label} cls={st.color} />
                    <Badge text={p.jenis_akad} cls={AKAD_COLOR[p.jenis_akad] ?? 'bg-gray-100 text-gray-600'} />
                  </div>
                  <h3 className="font-semibold text-gray-900 truncate">{p.nama_proyek}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Pengaju: {p.pengaju_nama ?? '—'} · {fmtDurasiProyek(p.durasi_bulan, p.durasi_hari)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Nisbah Pengaju {p.nisbah_pengaju ?? 30}% · Pemodal {p.nisbah_pemodal ?? 70}%
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">{fmt(Number(p.kebutuhan_modal))}</p>
                    <p className="text-xs text-gray-400">Kebutuhan modal</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setDetailProyek(p)}
                      className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer"
                    >
                      <Users className="h-3 w-3" /> Detail
                    </button>
                    <button
                      onClick={() => setDokProyek(p)}
                      className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 transition-colors cursor-pointer"
                    >
                      <FolderOpen className="h-3 w-3" /> Dokumen
                    </button>
                    <button
                      onClick={() => setKeuanganProyek(p)}
                      className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 transition-colors cursor-pointer"
                    >
                      <Wallet className="h-3 w-3" /> Keuangan
                    </button>
                    <button
                      onClick={() => openEdit(p)}
                      className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors cursor-pointer"
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                    <button
                      onClick={() => { setModalDelete(p); setDeleteError(null); setKonfirmasiHapusLanjut(false) }}
                      className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:border-red-300 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" /> Hapus
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Terkumpul: {fmt(Number(p.modal_terkumpul))}</span>
                  <span>{pct.toFixed(0)}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-100">
                  <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {p.status === 'DRAFT' && (
                  <button onClick={() => startTransition(() => { submitProyekKeDMR(p.id) })}
                    className="flex items-center gap-1.5 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-1.5 text-xs font-medium text-yellow-700 hover:bg-yellow-100 transition-colors cursor-pointer">
                    <Send className="h-3.5 w-3.5" /> Ajukan ke DMR
                  </button>
                )}
                {p.status === 'MENUNGGU_DMR' && (
                  <button onClick={() => { setModalReview({ proyek: p, tahap: 'DMR' }); setReviewForm({ keputusan: 'DISETUJUI' as const, catatan: '' }) }}
                    className="flex items-center gap-1.5 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-1.5 text-xs font-medium text-yellow-700 hover:bg-yellow-100 transition-colors cursor-pointer">
                    <Shield className="h-3.5 w-3.5" /> Review DMR
                  </button>
                )}
                {(p.status === 'REVISI_DMR' || p.status === 'REVISI_DPS') && (
                  <button onClick={() => handleResubmit(p.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100 transition-colors cursor-pointer">
                    <RefreshCw className="h-3.5 w-3.5" /> Ajukan Ulang
                  </button>
                )}
                {p.status === 'MENUNGGU_DPS' && (
                  <button onClick={() => { setModalReview({ proyek: p, tahap: 'DPS' }); setReviewForm({ keputusan: 'DISETUJUI' as const, catatan: '' }) }}
                    className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors cursor-pointer">
                    <Shield className="h-3.5 w-3.5" /> Review DPS
                  </button>
                )}
                {p.status === 'DISETUJUI' && (
                  <button onClick={() => { setModalFunding(p); setFundingForm({ funding_mulai: new Date().toISOString().slice(0, 10), funding_selesai: '', funding_instruksi: '', target_modal_awal: String(p.kebutuhan_modal), published_at: '' }) }}
                    className="flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100 transition-colors cursor-pointer">
                    <CalendarClock className="h-3.5 w-3.5" /> Jadwalkan Pendanaan
                  </button>
                )}
                {p.status === 'FUNDING_DIJADWALKAN' && (
                  <button onClick={() => handleBukaFunding(p.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-medium text-cyan-700 hover:bg-cyan-100 transition-colors cursor-pointer">
                    <ArrowUpCircle className="h-3.5 w-3.5" /> Buka Pendanaan
                  </button>
                )}
                {p.status === 'FUNDING_AKTIF' && (
                  <>
                    <button onClick={() => { setModalPenawaran(p); setPenawaranIds([]) }}
                      className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer">
                      <Send className="h-3.5 w-3.5" /> Kirim Penawaran
                    </button>
                    <button onClick={() => handleTutupFunding(p.id)}
                      className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer">
                      <Lock className="h-3.5 w-3.5" /> Tutup Pendanaan
                    </button>
                  </>
                )}
                {p.status === 'FUNDING_DITUTUP' && (
                  <button onClick={() => { setModalAkad(p); setAkadForm({ jadwal_akad: '', saksi_nama: '', saksi_2_nama: '' }) }}
                    className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 transition-colors cursor-pointer">
                    <FileSignature className="h-3.5 w-3.5" /> Jadwalkan Akad
                  </button>
                )}
                {p.status === 'MENUNGGU_AKAD' && (
                  <button onClick={() => handleTandatanganiAkad(p)}
                    className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 transition-colors cursor-pointer">
                    <FileSignature className="h-3.5 w-3.5" /> Tandatangani Akad
                  </button>
                )}
                {p.status === 'BERJALAN' && (
                  <button onClick={() => handleStatus(p.id, 'SELESAI')}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer">
                    <CheckCircle className="h-3.5 w-3.5" /> Tandai Selesai
                  </button>
                )}
                {p.status === 'BAGI_HASIL' && (
                  <button onClick={() => handleStatus(p.id, 'DITUTUP')}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer">
                    <XCircle className="h-3.5 w-3.5" /> Tutup Proyek
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Drawer Detail Proyek */}
      <Drawer
        open={!!detailProyek}
        onClose={() => setDetailProyek(null)}
        title={`Detail Proyek — ${detailProyek?.kode_proyek ?? ''}`}
      >
        {detailProyek && <DetailProyekPanel key={detailProyek.id} proyek={detailProyek} />}
      </Drawer>

      {/* Drawer Dokumen Proyek */}
      <Drawer
        open={!!dokProyek}
        onClose={() => setDokProyek(null)}
        title={`Dokumen Proyek — ${dokProyek?.kode_proyek ?? ''}`}
      >
        {dokProyek && <DokumenProyekPanel key={dokProyek.id} proyek={dokProyek} orgId={orgId} />}
      </Drawer>

      {/* Drawer Keuangan Proyek */}
      <Drawer
        open={!!keuanganProyek}
        onClose={() => setKeuanganProyek(null)}
        title={`Keuangan Proyek — ${keuanganProyek?.kode_proyek ?? ''}`}
      >
        {keuanganProyek && <KeuanganProyekPanel key={keuanganProyek.id} proyek={keuanganProyek} orgId={orgId} />}
      </Drawer>

      {/* Modal Edit Proyek */}
      <Modal open={!!modalEdit} onClose={() => setModalEdit(null)} title={`Edit Proyek — ${modalEdit?.kode_proyek ?? ''}`}>
        {modalEdit && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Nama Proyek *</label>
              <input
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                value={editForm.nama_proyek} onChange={e => setEditForm(f => ({ ...f, nama_proyek: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Jenis Akad *</label>
              <select
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                value={editForm.jenis_akad} onChange={e => setEditForm(f => ({ ...f, jenis_akad: e.target.value }))}>
                <option value="MUDHARABAH">Mudharabah</option>
                <option value="MURABAHAH">Murabahah — Jual Beli Cicil</option>
                <option value="INAN">Musyarakah Inan — Modal Bersama</option>
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Kebutuhan Modal (Rp) *</label>
                <input type="number"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  value={editForm.kebutuhan_modal} onChange={e => setEditForm(f => ({ ...f, kebutuhan_modal: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Durasi (bulan)</label>
                <input type="number"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  value={editForm.durasi_bulan} onChange={e => setEditForm(f => ({ ...f, durasi_bulan: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Durasi (hari)</label>
                <input type="number"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  value={editForm.durasi_hari} onChange={e => setEditForm(f => ({ ...f, durasi_hari: e.target.value }))} />
              </div>
            </div>

            {/* Nisbah Bagi Hasil */}
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
              <p className="text-sm font-semibold text-blue-900 mb-3">Pembagian Keuntungan (Nisbah)</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-gray-600">Pengaju</span>
                  <span className="text-emerald-700 font-bold text-sm">{editForm.nisbah_pengaju}%</span>
                </div>
                <input type="range" min={10} max={90} step={5}
                  className="w-full accent-slate-800 cursor-pointer"
                  value={editForm.nisbah_pengaju}
                  onChange={e => setEditForm(f => ({ ...f, nisbah_pengaju: Number(e.target.value) }))} />
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-gray-600">Pemodal</span>
                  <span className="text-blue-700 font-bold text-sm">{100 - editForm.nisbah_pengaju}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-blue-200 overflow-hidden">
                  <div className="h-2 bg-gradient-to-r from-slate-700 to-slate-900 rounded-full transition-all"
                    style={{ width: `${editForm.nisbah_pengaju}%` }} />
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Ujrah Wakalah (Rp)
                <span className="ml-1 font-normal text-gray-400 text-xs">— fee nominal koperasi untuk pendampingan syirkah</span>
              </label>
              <input type="number" min="0" step="1000"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                value={editForm.ujrah_nominal} onChange={e => setEditForm(f => ({ ...f, ujrah_nominal: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Ujrah Diwakilkan Akad (Rp)
                <span className="ml-1 font-normal text-gray-400 text-xs">— jika pemodal pilih diwakilkan koperasi saat akad</span>
              </label>
              <input type="number" min="0" step="1000"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                value={editForm.ujrah_wakalah_akad} onChange={e => setEditForm(f => ({ ...f, ujrah_wakalah_akad: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Agunan / Jaminan</label>
              <input
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                value={editForm.agunan} onChange={e => setEditForm(f => ({ ...f, agunan: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Deskripsi Usaha</label>
              <textarea rows={3}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 resize-none"
                value={editForm.deskripsi} onChange={e => setEditForm(f => ({ ...f, deskripsi: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModalEdit(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
                Batal
              </button>
              <button onClick={handleEdit} disabled={!editForm.nama_proyek || !editForm.kebutuhan_modal || pending}
                className="flex-1 rounded-xl bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer">
                {pending ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Konfirmasi Hapus */}
      <Modal open={!!modalDelete} onClose={() => setModalDelete(null)} title="Hapus Proyek">
        {modalDelete && (() => {
          const bukanDraft = modalDelete.status !== 'DRAFT'
          return (
            <div className="space-y-4">
              <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                <p className="font-medium text-red-800">{modalDelete.nama_proyek}</p>
                <p className="text-sm text-red-600 mt-1">
                  {modalDelete.kode_proyek} · {modalDelete.jenis_akad} · {STATUS_PROYEK[modalDelete.status]?.label ?? modalDelete.status}
                </p>
              </div>
              <p className="text-sm text-gray-600">
                Proyek ini akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
              </p>
              {bukanDraft && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
                  <p className="text-sm font-medium text-amber-800">Proyek ini sudah melewati status Draft</p>
                  <ul className="text-xs text-amber-700 list-disc pl-4 space-y-1">
                    <li>Dana pemodal yang masih terikat di proyek ini akan otomatis dilepas dan dikembalikan ke Simpanan Sukarela masing-masing pemodal.</li>
                    <li>Seluruh riwayat proyek — pembiayaan, akad, transaksi keuangan, dan bagi hasil — akan ikut terhapus permanen dan tidak bisa dipulihkan.</li>
                  </ul>
                  <label className="flex items-start gap-2 text-xs text-amber-800 pt-1 cursor-pointer">
                    <input type="checkbox" className="mt-0.5 cursor-pointer" checked={konfirmasiHapusLanjut}
                      onChange={e => setKonfirmasiHapusLanjut(e.target.checked)} />
                    Saya paham risikonya dan tetap ingin menghapus proyek ini.
                  </label>
                </div>
              )}
              {deleteError && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {deleteError}
                </p>
              )}
              <div className="flex gap-3">
                <button onClick={() => setModalDelete(null)}
                  className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
                  Batal
                </button>
                <button onClick={handleDelete} disabled={pending || (bukanDraft && !konfirmasiHapusLanjut)}
                  className="flex-1 rounded-xl bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors cursor-pointer">
                  {pending ? 'Menghapus...' : 'Ya, Hapus'}
                </button>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* Modal Proyek Baru */}
      <Modal open={modalNew} onClose={() => setModalNew(false)} title="Buat Proyek Baru">
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Pengaju Anggota *</label>
            {!form.pengaju_id ? (
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Cari nama atau kode anggota..."
                  className="w-full rounded-xl border border-gray-200 pl-9 pr-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  value={searchAnggotaNew}
                  onChange={e => { setSearchAnggotaNew(e.target.value); setShowAnggotaDropdown(true) }}
                  onFocus={() => setShowAnggotaDropdown(true)}
                />
                {showAnggotaDropdown && searchAnggotaNew.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-gray-100 bg-white shadow-lg">
                    {anggota.filter(a => a.nama.toLowerCase().includes(searchAnggotaNew.toLowerCase()) || a.kode_anggota.toLowerCase().includes(searchAnggotaNew.toLowerCase())).slice(0, 10).map(a => (
                      <div key={a.id} className="cursor-pointer px-4 py-2 hover:bg-emerald-50 transition-colors"
                        onClick={() => {
                          setForm(f => ({ ...f, pengaju_id: a.id }));
                          setSearchAnggotaNew('');
                          setShowAnggotaDropdown(false);
                        }}>
                        <p className="text-sm font-medium text-gray-900">{a.nama}</p>
                        <p className="text-xs text-gray-500">{a.kode_anggota}</p>
                      </div>
                    ))}
                    {anggota.filter(a => a.nama.toLowerCase().includes(searchAnggotaNew.toLowerCase()) || a.kode_anggota.toLowerCase().includes(searchAnggotaNew.toLowerCase())).length === 0 && (
                      <div className="px-4 py-3 text-sm text-gray-500 text-center">Anggota tidak ditemukan</div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-emerald-900">{anggota.find(a => a.id === form.pengaju_id)?.nama}</p>
                  <p className="text-xs text-emerald-600">{anggota.find(a => a.id === form.pengaju_id)?.kode_anggota}</p>
                </div>
                <button onClick={() => setForm(f => ({ ...f, pengaju_id: '' }))} className="text-emerald-600 hover:text-emerald-800 cursor-pointer">
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>

          {/* Nisbah Bagi Hasil */}
          {(() => {
            const nisbahTerkunci = modalEdit?.status === 'BERJALAN' || modalEdit?.status === 'SELESAI'
            return (
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                <p className="text-sm font-semibold text-blue-900 mb-3">Pembagian Keuntungan (Nisbah)</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-gray-600">Pengaju</span>
                    <span className="text-emerald-700 font-bold text-sm">{editForm.nisbah_pengaju}%</span>
                  </div>
                  <input type="range" min={10} max={90} step={5}
                    disabled={nisbahTerkunci}
                    className="w-full accent-slate-800 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    value={editForm.nisbah_pengaju}
                    onChange={e => setEditForm(f => ({ ...f, nisbah_pengaju: Number(e.target.value) }))} />
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-gray-600">Pemodal</span>
                    <span className="text-blue-700 font-bold text-sm">{100 - editForm.nisbah_pengaju}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-blue-200 overflow-hidden">
                    <div className="h-2 bg-gradient-to-r from-slate-700 to-slate-900 rounded-full transition-all"
                      style={{ width: `${editForm.nisbah_pengaju}%` }} />
                  </div>
                  {nisbahTerkunci ? (
                    <p className="text-xs text-rose-600">Proyek sudah berjalan — nisbah tidak dapat diubah lagi.</p>
                  ) : (
                    <p className="text-xs text-blue-600">Koperasi menerima ujrah nominal tetap — tidak masuk nisbah.</p>
                  )}
                </div>
              </div>
            )
          })()}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Nama Proyek *</label>
            <input
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder="Contoh: Usaha Warung Makan Bu Sari"
              value={form.nama_proyek} onChange={e => setForm(f => ({ ...f, nama_proyek: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Jenis Akad *</label>
            <select
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              value={form.jenis_akad} onChange={e => setForm(f => ({ ...f, jenis_akad: e.target.value }))}>
              <option value="MUDHARABAH">Mudharabah</option>
              <option value="MURABAHAH">Murabahah — Jual Beli Cicil</option>
              <option value="INAN">Musyarakah Inan — Modal Bersama</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Kebutuhan Modal *</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500 text-sm font-medium">Rp</span>
              <input type="text" inputMode="numeric"
                className="w-full rounded-xl border border-gray-200 pl-9 pr-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="5.000.000"
                value={form.kebutuhan_modal ? Number(form.kebutuhan_modal).toLocaleString('id-ID') : ''}
                onChange={e => setForm(f => ({ ...f, kebutuhan_modal: e.target.value.replace(/\D/g, '') }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Durasi (bulan)</label>
              <input type="number"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                value={form.durasi_bulan} onChange={e => setForm(f => ({ ...f, durasi_bulan: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Durasi (hari)</label>
              <input type="number"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                value={form.durasi_hari} onChange={e => setForm(f => ({ ...f, durasi_hari: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Ujrah Wakalah (Nominal Tetap)
              <span className="ml-1 font-normal text-gray-400 text-xs">— fee nominal koperasi untuk pendampingan syirkah, bukan nisbah bagi hasil</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500 text-sm font-medium">Rp</span>
              <input type="text" inputMode="numeric"
                className="w-full rounded-xl border border-gray-200 pl-9 pr-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="150.000"
                value={form.ujrah_nominal ? Number(form.ujrah_nominal).toLocaleString('id-ID') : ''}
                onChange={e => setForm(f => ({ ...f, ujrah_nominal: e.target.value.replace(/\D/g, '') }))} />
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Seluruh keuntungan proyek menjadi hak pemodal. Koperasi hanya menerima ujrah nominal ini sebagai biaya layanan wakalah.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Ujrah Diwakilkan Akad
              <span className="ml-1 font-normal text-gray-400 text-xs">— jika pemodal pilih diwakilkan koperasi saat akad</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500 text-sm font-medium">Rp</span>
              <input type="text" inputMode="numeric"
                className="w-full rounded-xl border border-gray-200 pl-9 pr-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="50.000"
                value={form.ujrah_wakalah_akad ? Number(form.ujrah_wakalah_akad).toLocaleString('id-ID') : ''}
                onChange={e => setForm(f => ({ ...f, ujrah_wakalah_akad: e.target.value.replace(/\D/g, '') }))} />
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Ditentukan koperasi sebagai biaya jasa menghadiri presentasi & menandatangani akad atas nama pemodal yang memilih diwakilkan.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Agunan / Jaminan</label>
            <input
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder="Contoh: BPKB Motor, Sertifikat Tanah"
              value={form.agunan} onChange={e => setForm(f => ({ ...f, agunan: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Deskripsi Usaha</label>
            <textarea rows={3}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 resize-none"
              placeholder="Jelaskan usaha / proyek secara singkat..."
              value={form.deskripsi} onChange={e => setForm(f => ({ ...f, deskripsi: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalNew(false)}
              className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
              Batal
            </button>
            <button onClick={handleCreate} disabled={!form.pengaju_id || !form.nama_proyek || !form.kebutuhan_modal || pending}
              className="flex-1 rounded-xl bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer">
              {pending ? 'Menyimpan...' : 'Buat Proyek'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal DPS Review */}
      <Modal open={!!modalReview} onClose={() => setModalReview(null)} title={modalReview?.tahap === 'DMR' ? 'Review DMR' : 'Review DPS'}>
        {modalReview && (
          <div className="space-y-4">
            <div className="rounded-xl bg-amber-50 p-4">
              <p className="font-medium text-amber-800">{modalReview.proyek.nama_proyek}</p>
              <p className="text-sm text-amber-600 mt-1">
                {modalReview.proyek.jenis_akad} · {fmt(Number(modalReview.proyek.kebutuhan_modal))} · {fmtDurasiProyek(modalReview.proyek.durasi_bulan, modalReview.proyek.durasi_hari)}
              </p>
              <p className="text-sm text-amber-600 mt-1">
                Nisbah Pengaju {modalReview.proyek.nisbah_pengaju ?? 30}% · Nisbah Pemodal {modalReview.proyek.nisbah_pemodal ?? 70}%
              </p>
              {modalReview.proyek.deskripsi && <p className="text-sm text-amber-700 mt-2">{modalReview.proyek.deskripsi}</p>}
              {modalReview.proyek.agunan && <p className="text-xs text-amber-600 mt-1">Agunan: {modalReview.proyek.agunan}</p>}
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Keputusan {modalReview.tahap}</label>
              <div className="flex gap-2">
                {(['DISETUJUI', 'REVISI', 'DITOLAK'] as const).map(k => (
                  <button key={k} onClick={() => setReviewForm(f => ({ ...f, keputusan: k }))}
                    className={cn('flex-1 rounded-xl border py-2 text-xs font-medium transition-colors cursor-pointer',
                      reviewForm.keputusan === k
                        ? k === 'DISETUJUI' ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : k === 'DITOLAK' ? 'border-red-400 bg-red-50 text-red-700'
                          : 'border-yellow-400 bg-yellow-50 text-yellow-700'
                        : 'border-gray-200 text-gray-500 hover:bg-gray-50')}>
                    {k === 'DISETUJUI' ? 'Setujui' : k === 'DITOLAK' ? 'Tolak' : 'Minta Revisi'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Catatan {modalReview.tahap}</label>
              <textarea rows={3}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 resize-none"
                placeholder="Catatan untuk pengaju..."
                value={reviewForm.catatan} onChange={e => setReviewForm(f => ({ ...f, catatan: e.target.value }))} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalReview(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
                Batal
              </button>
              <button onClick={handleReview} disabled={pending}
                className="flex-1 rounded-xl bg-amber-500 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50 transition-colors cursor-pointer">
                {pending ? 'Menyimpan...' : 'Submit Review'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Jadwalkan Pendanaan */}
      <Modal open={!!modalFunding} onClose={() => setModalFunding(null)} title="Jadwalkan Pendanaan">
        {modalFunding && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Atur jadwal pendanaan untuk <strong>{modalFunding.nama_proyek}</strong>.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Mulai</label>
                <input type="date"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  value={fundingForm.funding_mulai} onChange={e => setFundingForm(f => ({ ...f, funding_mulai: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Selesai</label>
                <input type="date"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  value={fundingForm.funding_selesai} onChange={e => setFundingForm(f => ({ ...f, funding_selesai: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Target Modal (Rp)</label>
              <input type="number"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                value={fundingForm.target_modal_awal} onChange={e => setFundingForm(f => ({ ...f, target_modal_awal: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Waktu Rilis ke Publik (Opsional)</label>
              <input type="datetime-local"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                value={fundingForm.published_at} onChange={e => setFundingForm(f => ({ ...f, published_at: e.target.value }))} />
              <p className="text-[10px] text-gray-500 mt-1">Kosongkan jika ingin langsung dirilis saat statusnya menjadi Aktif.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Instruksi Pendanaan</label>
              <textarea rows={3}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 resize-none"
                placeholder="Instruksi untuk pemodal..."
                value={fundingForm.funding_instruksi} onChange={e => setFundingForm(f => ({ ...f, funding_instruksi: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setModalFunding(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
                Batal
              </button>
              <button onClick={handleJadwalkanFunding} disabled={pending || !fundingForm.funding_mulai || !fundingForm.funding_selesai}
                className="flex-1 rounded-xl bg-sky-600 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50 transition-colors cursor-pointer">
                {pending ? 'Menyimpan...' : 'Jadwalkan'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Jadwalkan Akad */}
      <Modal open={!!modalAkad} onClose={() => setModalAkad(null)} title="Jadwalkan Akad">
        {modalAkad && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Jadwalkan penandatanganan akad untuk <strong>{modalAkad.nama_proyek}</strong>.</p>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Jadwal Akad</label>
              <input type="date"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                value={akadForm.jadwal_akad} onChange={e => setAkadForm(f => ({ ...f, jadwal_akad: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Nama Saksi 1</label>
              <input
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                value={akadForm.saksi_nama} onChange={e => setAkadForm(f => ({ ...f, saksi_nama: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Nama Saksi 2</label>
              <input
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                value={akadForm.saksi_2_nama} onChange={e => setAkadForm(f => ({ ...f, saksi_2_nama: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setModalAkad(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
                Batal
              </button>
              <button onClick={handleJadwalkanAkad} disabled={pending || !akadForm.jadwal_akad}
                className="flex-1 rounded-xl bg-violet-600 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 transition-colors cursor-pointer">
                {pending ? 'Menyimpan...' : 'Jadwalkan'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Penawaran */}
      <Modal open={!!modalPenawaran} onClose={() => setModalPenawaran(null)} title="Kirim Penawaran ke Anggota">
        {modalPenawaran && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Pilih anggota yang akan menerima penawaran proyek <strong>{modalPenawaran.nama_proyek}</strong>:
            </p>
            <div className="max-h-64 overflow-y-auto space-y-1.5 rounded-xl border border-gray-200 p-3">
              {anggota.filter(a => a.status === 'AKTIF').map(a => (
                <label key={a.id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" className="h-4 w-4 accent-emerald-600"
                    checked={penawaranIds.includes(a.id)}
                    onChange={e => setPenawaranIds(ids =>
                      e.target.checked ? [...ids, a.id] : ids.filter(i => i !== a.id)
                    )} />
                  <span className="text-sm text-gray-700">{a.kode_anggota} · {a.nama}</span>
                </label>
              ))}
              {anggota.filter(a => a.status === 'AKTIF').length === 0 && (
                <p className="py-4 text-center text-sm text-gray-400">Tidak ada anggota aktif</p>
              )}
            </div>
            <p className="text-xs text-gray-400">{penawaranIds.length} anggota dipilih</p>
            <div className="flex gap-3">
              <button onClick={() => setModalPenawaran(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
                Batal
              </button>
              <button onClick={handleKirimPenawaran} disabled={!penawaranIds.length || pending}
                className="flex-1 rounded-xl bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer">
                {pending ? 'Mengirim...' : `Kirim ke ${penawaranIds.length} Anggota`}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ─── TAB: SIMPANAN ────────────────────────────────────────────────────────────

function TabSimpanan({ orgId, anggota, setoranPending, stats }: {
  orgId: string; anggota: KojasmatAnggota[]; setoranPending: KojasmatSetoranPending[]; stats: KojasmatStats
}) {
  const [pending, startTransition] = useTransition()
  const [dateFilter, setDateFilter] = useState<string>('SEMUA')
  const [report, setReport] = useState<KojasmatSimpananReport | null>(null)
  
  const simpananLabels: Record<string, string> = {
    POKOK: 'Pokok',
    WAJIB: 'Wajib',
    SUKARELA: 'Sukarela',
    PROYEK: 'Proyek',
    HIBAH_NAMETAG: 'Name Tag',
    HIBAH_MEMBERCARD: 'Member Card',
    HIBAH_KAJIAN: 'Kajian',
    HIBAH_BOP: 'BOP',
  }

  const chartData = useMemo(() => {
    let pokok = 0, wajib = 0, sukarela = 0, proyek = 0, hibah = 0
    for (const b of (report?.breakdown_per_jenis || [])) {
      if (b.jenis === 'POKOK') pokok += Number(b.total)
      else if (b.jenis === 'WAJIB') wajib += Number(b.total)
      else if (b.jenis === 'SUKARELA') sukarela += Number(b.total)
      else if (b.jenis === 'PROYEK') proyek += Number(b.total)
      else if (b.jenis.startsWith('HIBAH_')) hibah += Number(b.total)
    }
    return [
      { name: 'Pokok', total: pokok },
      { name: 'Wajib', total: wajib },
      { name: 'Sukarela', total: sukarela },
      { name: 'Proyek', total: proyek },
      { name: 'Hibah', total: hibah },
    ].sort((a, b) => b.total - a.total)
  }, [report])

  useEffect(() => {
    let start: string | undefined
    let end: string | undefined
    const now = new Date()

    if (dateFilter === 'HARI_INI') {
      start = now.toISOString().split('T')[0]
      end = start
    } else if (dateFilter === 'KEMARIN') {
      const yesterday = new Date(now)
      yesterday.setDate(now.getDate() - 1)
      start = yesterday.toISOString().split('T')[0]
      end = start
    } else if (dateFilter === '7_HARI') {
      const past = new Date(now)
      past.setDate(now.getDate() - 7)
      start = past.toISOString().split('T')[0]
      end = now.toISOString().split('T')[0]
    } else if (dateFilter === '30_HARI') {
      const past = new Date(now)
      past.setDate(now.getDate() - 30)
      start = past.toISOString().split('T')[0]
      end = now.toISOString().split('T')[0]
    } else if (dateFilter === 'BULAN_INI') {
      start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
    } else if (dateFilter === 'BULAN_LALU') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
      end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]
    } else if (dateFilter === 'TAHUN_INI') {
      start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]
      end = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0]
    } else if (dateFilter === 'TAHUN_LALU') {
      start = new Date(now.getFullYear() - 1, 0, 1).toISOString().split('T')[0]
      end = new Date(now.getFullYear() - 1, 11, 31).toISOString().split('T')[0]
    }

    getSimpananReport(orgId, start, end).then(setReport)
  }, [orgId, dateFilter])

  const [selectedAnggota, setSelectedAnggota] = useState<KojasmatAnggota | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [bukuAnggota, setBukuAnggota] = useState<KojasmatAnggota | null>(null)
  const [bukuOpen, setBukuOpen] = useState(false)
  const [mutasiError, setMutasiError] = useState<string | null>(null)
  const [mutasiSuccess, setMutasiSuccess] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({
    jenis_simpanan: 'WAJIB', jenis_mutasi: 'SETOR',
    jumlah: '', keterangan: '', tanggal: new Date().toISOString().split('T')[0]
  })

  const [setoranList, setSetoranList] = useState(setoranPending)
  const setoranOnly = setoranList.filter(s => s.jenis_mutasi === 'SETOR')
  const tarikOnly = setoranList.filter(s => s.jenis_mutasi === 'TARIK')
  const [setoranActionId, setSetoranActionId] = useState<string | null>(null)
  const [setoranError, setSetoranError] = useState<{ id: string; message: string } | null>(null)
  const [tolakSetoran, setTolakSetoran] = useState<KojasmatSetoranPending | null>(null)
  const [catatanTolak, setCatatanTolak] = useState('')
  const [tolakTarik, setTolakTarik] = useState<KojasmatSetoranPending | null>(null)
  const [catatanTolakTarik, setCatatanTolakTarik] = useState('')

  function handleSetujuiSetoran(id: string) {
    setSetoranActionId(id)
    setSetoranError(null)
    startTransition(async () => {
      const res = await setujuiSetoranSimpanan(id)
      setSetoranActionId(null)
      if (res.error) { setSetoranError({ id, message: res.error }); return }
      setSetoranList(prev => prev.filter(s => s.id !== id))
      setMutasiSuccess('Setoran berhasil diverifikasi dan masuk ke saldo anggota')
    })
  }

  function handleTolakSetoran() {
    if (!tolakSetoran || !catatanTolak.trim()) return
    setSetoranActionId(tolakSetoran.id)
    startTransition(async () => {
      const res = await tolakSetoranSimpanan(tolakSetoran.id, catatanTolak)
      setSetoranActionId(null)
      if (res.error) { setSetoranError({ id: tolakSetoran.id, message: res.error }); setTolakSetoran(null); return }
      setSetoranList(prev => prev.filter(s => s.id !== tolakSetoran.id))
      setTolakSetoran(null)
      setCatatanTolak('')
    })
  }

  function handleSetujuiTarik(id: string) {
    setSetoranActionId(id)
    setSetoranError(null)
    startTransition(async () => {
      const res = await setujuiTarikSimpanan(id)
      setSetoranActionId(null)
      if (res.error) { setSetoranError({ id, message: res.error }); return }
      setSetoranList(prev => prev.filter(s => s.id !== id))
      setMutasiSuccess('Penarikan berhasil disetujui dan saldo anggota berkurang')
    })
  }

  function handleTolakTarik() {
    if (!tolakTarik || !catatanTolakTarik.trim()) return
    setSetoranActionId(tolakTarik.id)
    startTransition(async () => {
      const res = await tolakTarikSimpanan(tolakTarik.id, catatanTolakTarik)
      setSetoranActionId(null)
      if (res.error) { setSetoranError({ id: tolakTarik.id, message: res.error }); setTolakTarik(null); return }
      setSetoranList(prev => prev.filter(s => s.id !== tolakTarik.id))
      setTolakTarik(null)
      setCatatanTolakTarik('')
    })
  }

  async function openBuktiSetoran(key: string) {
    const res = await fetch(`/api/kojasmat/file?key=${encodeURIComponent(key)}`)
    const { url } = await res.json() as { url: string }
    window.open(url, '_blank')
  }

  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [sortOrder, setSortOrder] = useState<'kode' | 'nama' | 'status' | 'total'>('kode')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [currentPage, setCurrentPage] = useState(1)

  const mergedAnggota = anggota.map(a => {
    const r = report?.breakdown_per_anggota.find(x => x.anggota_id === a.id)
    return { ...a, simpanan: r?.simpanan || {}, total_simpanan: r?.total || 0 }
  })

  const filteredData = mergedAnggota.filter(a => {
    const matchSearch = a.nama.toLowerCase().includes(search.toLowerCase()) || 
                        a.kode_anggota.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'ALL' || a.status === filterStatus
    return matchSearch && matchStatus
  })

  const sortedData = [...filteredData].sort((a, b) => {
    let cmp = 0
    if (sortOrder === 'kode') cmp = a.kode_anggota.localeCompare(b.kode_anggota)
    else if (sortOrder === 'nama') cmp = a.nama.localeCompare(b.nama)
    else if (sortOrder === 'status') cmp = a.status.localeCompare(b.status)
    else if (sortOrder === 'total') cmp = a.total_simpanan - b.total_simpanan
    return sortDir === 'asc' ? cmp : -cmp
  })

  const itemsPerPage = 10
  const totalPages = Math.ceil(sortedData.length / itemsPerPage) || 1
  const paginatedData = sortedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  useEffect(() => {
    setCurrentPage(1)
  }, [search, filterStatus, sortOrder, sortDir])

  function openBukuTabungan(a: KojasmatAnggota) {
    setBukuAnggota(a)
    setBukuOpen(true)
  }

  function openTransaksi(a: KojasmatAnggota) {
    setSelectedAnggota(a)
    setBukuOpen(false)
    setModalOpen(true)
  }

  function handleMutasi() {
    if (!selectedAnggota) return
    setMutasiError(null)
    startTransition(async () => {
      const res = await catatSimpananMutasi({
        org_id: orgId,
        anggota_id: selectedAnggota.id,
        jenis_simpanan: form.jenis_simpanan as 'POKOK' | 'WAJIB' | 'SUKARELA' | 'PROYEK' | 'HIBAH_NAMETAG' | 'HIBAH_MEMBERCARD' | 'HIBAH_KAJIAN' | 'HIBAH_BOP',
        jenis_mutasi: form.jenis_mutasi as 'SETOR' | 'TARIK' | 'KOREKSI',
        jumlah: Number(form.jumlah),
        keterangan: form.keterangan || undefined,
        tanggal: form.tanggal,
      })
      if (res.error) {
        setMutasiError(res.error)
        return
      }
      setMutasiError(null)
      setMutasiSuccess(
        `${form.jenis_mutasi === 'SETOR' ? 'Setoran' : form.jenis_mutasi === 'TARIK' ? 'Penarikan' : 'Koreksi'} berhasil dicatat`
      )
      setModalOpen(false)
      setForm({ jenis_simpanan: 'WAJIB', jenis_mutasi: 'SETOR', jumlah: '', keterangan: '', tanggal: new Date().toISOString().split('T')[0] })
    })
  }

  const COLORS = ['#059669', '#2563eb', '#d97706', '#7c3aed', '#dc2626', '#db2777', '#0d9488', '#ea580c']

  return (
    <div className="space-y-4">
      {/* ─── SUMMARY GRAFIK & TABEL ─── */}
      {!report ? (
        <div className="py-20 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
      ) : chartData.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Distribusi Saldo & Hibah</h3>
              <div className="relative flex items-center">
                <CalendarClock className="absolute left-2.5 h-3.5 w-3.5 text-gray-400" />
                <select 
                  value={dateFilter}
                  onChange={e => setDateFilter(e.target.value)}
                  className="rounded-lg border border-gray-200 bg-gray-50/50 py-1.5 pl-8 pr-6 text-xs outline-none focus:border-emerald-500 appearance-none cursor-pointer text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <option value="SEMUA">Semua Waktu</option>
                  <option value="HARI_INI">Hari Ini</option>
                  <option value="KEMARIN">Kemarin</option>
                  <option value="7_HARI">7 Hari Terakhir</option>
                  <option value="30_HARI">30 Hari Terakhir</option>
                  <option value="BULAN_INI">Bulan Ini</option>
                  <option value="BULAN_LALU">Bulan Lalu</option>
                  <option value="TAHUN_INI">Tahun Ini</option>
                  <option value="TAHUN_LALU">Tahun Lalu</option>
                </select>
              </div>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="total"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(val: any) => [`Rp ${Number(val).toLocaleString('id-ID')}`, 'Total']}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-sm font-semibold text-gray-900">Rincian Nominal</h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  {chartData.map((d, i) => (
                    <tr key={i} className="hover:bg-gray-50/50">
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                          <span className="text-gray-600">{d.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-right font-semibold text-gray-900 tabular-nums">
                        Rp {d.total.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-emerald-50/50 font-bold">
                    <td className="py-3 px-4 text-emerald-800">TOTAL KESELURUHAN</td>
                    <td className="py-3 px-4 text-right text-emerald-800 tabular-nums">
                      Rp {chartData.reduce((acc, curr) => acc + curr.total, 0).toLocaleString('id-ID')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {setoranOnly.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-200 bg-amber-100/60">
            <p className="text-sm font-semibold text-amber-900">
              Setoran Menunggu Verifikasi ({setoranOnly.length})
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Anggota mengajukan setoran lewat portal member — periksa bukti transfer sebelum menyetujui.
            </p>
          </div>
          <div className="divide-y divide-amber-100">
            {setoranOnly.map(s => (
              <div key={s.id} className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{s.anggota_nama} <span className="text-gray-400 font-mono text-xs">· {s.kode_anggota}</span></p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Simpanan {s.jenis_simpanan} · {fmt(Number(s.jumlah))}
                    {s.metode_bayar && <> · {METODE_BAYAR_LABEL[s.metode_bayar] ?? s.metode_bayar}</>}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{fmtWaktu(s.created_at)}</p>
                  {s.keterangan && <p className="text-xs text-gray-400 mt-0.5">{s.keterangan}</p>}
                  {s.bukti_file_key && (
                    <button type="button" onClick={() => openBuktiSetoran(s.bukti_file_key!)}
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 mt-1.5 cursor-pointer">
                      <Eye className="h-3 w-3" /> Lihat Bukti Transfer
                    </button>
                  )}
                  {setoranError?.id === s.id && (
                    <p className="text-xs text-rose-600 mt-1.5">{setoranError.message}</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => { setTolakSetoran(s); setCatatanTolak('') }}
                    disabled={pending && setoranActionId === s.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50">
                    <XCircle className="h-3.5 w-3.5" /> Tolak
                  </button>
                  <button onClick={() => handleSetujuiSetoran(s.id)}
                    disabled={pending && setoranActionId === s.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-50">
                    <CheckCircle className="h-3.5 w-3.5" />
                    {pending && setoranActionId === s.id ? 'Memproses...' : 'Setujui'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tarikOnly.length > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/60 overflow-hidden">
          <div className="px-4 py-3 border-b border-rose-200 bg-rose-100/60">
            <p className="text-sm font-semibold text-rose-900">
              Penarikan Menunggu Verifikasi ({tarikOnly.length})
            </p>
            <p className="text-xs text-rose-700 mt-0.5">
              Anggota mengajukan penarikan simpanan sukarela — pastikan saldo cukup dan transfer dana sebelum menyetujui.
            </p>
          </div>
          <div className="divide-y divide-rose-100">
            {tarikOnly.map(s => (
              <div key={s.id} className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{s.anggota_nama} <span className="text-gray-400 font-mono text-xs">· {s.kode_anggota}</span></p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Simpanan {s.jenis_simpanan} · {fmt(Number(s.jumlah))}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{fmtWaktu(s.created_at)}</p>
                  {s.keterangan && <p className="text-xs text-gray-600 mt-0.5">Tujuan: {s.keterangan}</p>}
                  {setoranError?.id === s.id && (
                    <p className="text-xs text-rose-600 mt-1.5">{setoranError.message}</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => { setTolakTarik(s); setCatatanTolakTarik('') }}
                    disabled={pending && setoranActionId === s.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50">
                    <XCircle className="h-3.5 w-3.5" /> Tolak
                  </button>
                  <button onClick={() => handleSetujuiTarik(s.id)}
                    disabled={pending && setoranActionId === s.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-50">
                    <CheckCircle className="h-3.5 w-3.5" />
                    {pending && setoranActionId === s.id ? 'Memproses...' : 'Setujui'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-1 w-full flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder="Cari anggota..."
              value={search} onChange={e => setSearch(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2">
            <div className="relative flex items-center">
              <Filter className="absolute left-3 h-4 w-4 text-gray-400" />
              <select 
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-8 text-sm outline-none focus:border-emerald-500 appearance-none cursor-pointer"
              >
                <option value="ALL">Semua Status</option>
                <option value="CALON">Calon</option>
                <option value="AKTIF">Aktif</option>
                <option value="TIDAK_AKTIF">Tidak Aktif</option>
                <option value="DIBEKUKAN">Dibekukan</option>
              </select>
            </div>

            <div className="flex rounded-xl border border-gray-200 bg-white overflow-hidden">
              <select
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value as any)}
                className="border-none py-2 pl-3 pr-8 text-sm outline-none focus:ring-0 bg-transparent appearance-none cursor-pointer"
              >
                <option value="kode">Urut Kode</option>
                <option value="nama">Urut Nama</option>
                <option value="status">Urut Status</option>
                <option value="total">Urut Total Saldo</option>
              </select>
              <button 
                onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                className="px-2 border-l border-gray-200 hover:bg-gray-50 text-gray-500 cursor-pointer flex items-center justify-center"
                title={`Urut ${sortDir === 'asc' ? 'Menaik' : 'Menurun'}`}
              >
                <ArrowUpDown className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {mutasiSuccess && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <span>{mutasiSuccess}</span>
          <button onClick={() => setMutasiSuccess(null)} className="ml-4 text-emerald-500 hover:text-emerald-700 cursor-pointer">✕</button>
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Anggota</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Total Simpanan</th>
                <th className="px-4 py-3 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginatedData.length === 0 && (
                <tr><td colSpan={9} className="py-10 text-center text-gray-400">Tidak ada anggota</td></tr>
              )}
              {paginatedData.map(a => {
                const sPokok = (a as any).simpanan?.POKOK || 0
                const sWajib = (a as any).simpanan?.WAJIB || 0
                const sSuka = (a as any).simpanan?.SUKARELA || 0
                const sProyek = (a as any).simpanan?.PROYEK || 0
                const sHibah = Object.entries((a as any).simpanan || {}).filter(([k]) => k.startsWith('HIBAH_')).reduce((acc, [_, v]) => acc + Number(v), 0)
                const total = (a as any).total_simpanan || 0

                return (
                <tr key={a.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 whitespace-nowrap">{a.nama}</p>
                    <p className="text-xs text-gray-400 font-mono">{a.kode_anggota}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge text={a.status}
                      cls={a.status === 'AKTIF' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-700">{fmt(total)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openBukuTabungan(a)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer">
                        <BookOpen className="h-3.5 w-3.5" /> Buku Tabungan
                      </button>
                      <button onClick={() => openTransaksi(a)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer">
                        <Banknote className="h-3.5 w-3.5" /> Transaksi
                      </button>
                    </div>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/50 px-4 py-3">
            <span className="text-sm text-gray-500">
              Menampilkan <span className="font-medium text-gray-900">{paginatedData.length}</span> dari <span className="font-medium text-gray-900">{filteredData.length}</span> data
            </span>
            <div className="flex items-center gap-1">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-200 disabled:opacity-50 cursor-pointer flex items-center justify-center"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 text-sm font-medium text-gray-700 min-w-[3rem] text-center">
                {currentPage} / {totalPages}
              </span>
              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-200 disabled:opacity-50 cursor-pointer flex items-center justify-center"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Tolak Setoran */}
      <Modal open={!!tolakSetoran} onClose={() => { setTolakSetoran(null); setCatatanTolak('') }}
        title={`Tolak Setoran — ${tolakSetoran?.anggota_nama ?? ''}`}>
        {tolakSetoran && (
          <div className="space-y-3">
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-sm">
              <p className="font-medium text-gray-900">Simpanan {tolakSetoran.jenis_simpanan}</p>
              <p className="text-gray-500 mt-0.5">{fmt(Number(tolakSetoran.jumlah))}</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Alasan penolakan *</label>
              <textarea rows={3}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                placeholder="Contoh: bukti transfer tidak jelas / nominal tidak sesuai"
                value={catatanTolak} onChange={e => setCatatanTolak(e.target.value)} />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => { setTolakSetoran(null); setCatatanTolak('') }}
                className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
                Batal
              </button>
              <button onClick={handleTolakSetoran} disabled={!catatanTolak.trim() || pending}
                className="flex-1 rounded-xl bg-rose-600 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50 transition-colors cursor-pointer">
                {pending ? 'Memproses...' : 'Tolak Setoran'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Tolak Penarikan */}
      <Modal open={!!tolakTarik} onClose={() => { setTolakTarik(null); setCatatanTolakTarik('') }}
        title={`Tolak Penarikan — ${tolakTarik?.anggota_nama ?? ''}`}>
        {tolakTarik && (
          <div className="space-y-3">
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-sm">
              <p className="font-medium text-gray-900">Simpanan {tolakTarik.jenis_simpanan}</p>
              <p className="text-gray-500 mt-0.5">{fmt(Number(tolakTarik.jumlah))}</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Alasan penolakan *</label>
              <textarea rows={3}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                placeholder="Contoh: rekening tujuan tidak valid"
                value={catatanTolakTarik} onChange={e => setCatatanTolakTarik(e.target.value)} />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => { setTolakTarik(null); setCatatanTolakTarik('') }}
                className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
                Batal
              </button>
              <button onClick={handleTolakTarik} disabled={!catatanTolakTarik.trim() || pending}
                className="flex-1 rounded-xl bg-rose-600 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50 transition-colors cursor-pointer">
                {pending ? 'Memproses...' : 'Tolak Penarikan'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Buku Tabungan Drawer */}
      <Drawer
        open={bukuOpen}
        onClose={() => setBukuOpen(false)}
        title={`Buku Tabungan — ${bukuAnggota?.nama ?? ''}`}
      >
        {bukuAnggota && (
          <BukuTabunganPanel
            key={bukuAnggota.id}
            anggota={bukuAnggota}
            orgId={orgId}
            onTransaksi={() => openTransaksi(bukuAnggota)}
          />
        )}
      </Drawer>

      {/* Modal Transaksi */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setMutasiError(null) }}
        title={`Transaksi Simpanan — ${selectedAnggota?.nama ?? ''}`}>
        <div className="space-y-3">
          {mutasiError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {mutasiError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Jenis Simpanan</label>
              <select className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                value={form.jenis_simpanan}
                onChange={e => setForm(f => ({ ...f, jenis_simpanan: e.target.value }))}>
                <option value="POKOK">Simpanan Pokok</option>
                <option value="WAJIB">Simpanan Wajib</option>
                <option value="SUKARELA">Simpanan Sukarela</option>
                <option value="HIBAH_NAMETAG">Hibah Name Tag</option>
                <option value="HIBAH_MEMBERCARD">Hibah Member Card</option>
                <option value="HIBAH_KAJIAN">Hibah Kajian</option>
                <option value="HIBAH_BOP">Hibah BOP</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Jenis Mutasi</label>
              <select className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                value={form.jenis_mutasi}
                onChange={e => setForm(f => ({ ...f, jenis_mutasi: e.target.value }))}>
                <option value="SETOR">Setoran</option>
                <option value="TARIK">Penarikan</option>
                <option value="KOREKSI">Koreksi</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Jumlah (Rp)</label>
              <input type="number"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                placeholder="50000"
                value={form.jumlah} onChange={e => setForm(f => ({ ...f, jumlah: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Tanggal</label>
              <input type="date"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                value={form.tanggal} onChange={e => setForm(f => ({ ...f, tanggal: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Keterangan</label>
            <input
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              placeholder="Contoh: Setoran wajib bulan Juni"
              value={form.keterangan} onChange={e => setForm(f => ({ ...f, keterangan: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)}
              className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
              Batal
            </button>
            <button onClick={handleMutasi} disabled={!form.jumlah || pending}
              className={cn('flex-1 rounded-xl py-2 text-sm font-medium text-white transition-colors cursor-pointer disabled:opacity-50',
                form.jenis_mutasi === 'TARIK' ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-600 hover:bg-emerald-700')}>
              {pending ? 'Memproses...'
                : form.jenis_mutasi === 'SETOR' ? 'Catat Setoran'
                : form.jenis_mutasi === 'TARIK' ? 'Catat Penarikan'
                : 'Catat Koreksi'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── TAB: PELATIHAN ───────────────────────────────────────────────────────────

function CopyLinkButton({ pelatihanId }: { pelatihanId: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    const url = `${window.location.origin}/kojasmat/daftar/${pelatihanId}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer shrink-0',
        copied
          ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
      )}
    >
      {copied ? <><Check className="h-3.5 w-3.5" /> Tersalin!</> : <><Copy className="h-3.5 w-3.5" /> Salin Link Daftar</>}
    </button>
  )
}

type PesertaPelatihan = {
  id: string
  pelatihan_id: string
  anggota_id: string
  status: string
  nama: string
  kode_anggota: string
  phone: string | null
}

function PesertaPelatihanPanel({ pelatihan }: { pelatihan: KojasmatPelatihan }) {
  const [pending, startTransition] = useTransition()
  const [peserta, setPeserta] = useState<PesertaPelatihan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getPesertaPelatihan(pelatihan.id).then(rows => {
      if (!cancelled) {
        setPeserta(rows as PesertaPelatihan[])
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [pelatihan.id])

  function handleLuluskan(pesertaId: string, anggotaId: string) {
    startTransition(async () => {
      await luluskanPeserta(pesertaId, anggotaId)
      setPeserta(prev => prev.map(p => p.id === pesertaId ? { ...p, status: 'LULUS' } : p))
    })
  }

  const statusColor: Record<string, string> = {
    TERDAFTAR: 'bg-blue-100 text-blue-700',
    LULUS:     'bg-emerald-100 text-emerald-700',
  }

  if (loading) return <div className="py-8 text-center text-sm text-gray-400">Memuat peserta...</div>

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">{peserta.length} peserta terdaftar di <strong>{pelatihan.judul}</strong></p>
      {peserta.length === 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white py-10 text-center text-gray-400 text-sm">
          Belum ada anggota yang mendaftar
        </div>
      )}
      {peserta.map(p => (
        <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white p-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{p.nama}</p>
            <p className="text-xs text-gray-400">{p.kode_anggota}{p.phone ? ` · ${p.phone}` : ''}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge text={p.status === 'LULUS' ? 'Lulus' : 'Terdaftar'} cls={statusColor[p.status] ?? 'bg-gray-100 text-gray-600'} />
            {p.status !== 'LULUS' && (
              <button
                onClick={() => handleLuluskan(p.id, p.anggota_id)}
                disabled={pending}
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors cursor-pointer"
              >
                Luluskan
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function TabPelatihan({ orgId, pelatihan, anggota }: {
  orgId: string; pelatihan: KojasmatPelatihan[]; anggota: KojasmatAnggota[]
}) {
  const [pending, startTransition] = useTransition()
  const [modalNew, setModalNew] = useState(false)
  const [modalDaftar, setModalDaftar] = useState<KojasmatPelatihan | null>(null)
  const [modalPeserta, setModalPeserta] = useState<KojasmatPelatihan | null>(null)
  const [selectedAnggotaId, setSelectedAnggotaId] = useState('')
  const [form, setForm] = useState({
    judul: '', deskripsi: '', instruktur: '', tanggal: '', lokasi: '', kuota: '30'
  })

  function handleCreate() {
    startTransition(async () => {
      await createPelatihan({ org_id: orgId, ...form, kuota: Number(form.kuota) || 30 })
      setModalNew(false)
      setForm({ judul: '', deskripsi: '', instruktur: '', tanggal: '', lokasi: '', kuota: '30' })
    })
  }

  function handleDaftar() {
    if (!modalDaftar || !selectedAnggotaId) return
    startTransition(async () => {
      await daftarPesertaPelatihan({ org_id: orgId, pelatihan_id: modalDaftar.id, anggota_id: selectedAnggotaId })
      setModalDaftar(null)
      setSelectedAnggotaId('')
    })
  }

  const statusColor: Record<string, string> = {
    TERJADWAL: 'bg-blue-100 text-blue-700',
    SELESAI:   'bg-emerald-100 text-emerald-700',
    DIBATALKAN: 'bg-red-100 text-red-700',
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setModalNew(true)}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors cursor-pointer">
          <Plus className="h-4 w-4" /> Jadwal Pelatihan
        </button>
      </div>

      <div className="space-y-3">
        {pelatihan.length === 0 && (
          <div className="rounded-2xl border border-gray-100 bg-white py-12 text-center text-gray-400">
            Belum ada jadwal pelatihan
          </div>
        )}
        {pelatihan.map(p => (
          <div key={p.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Badge text={p.status} cls={statusColor[p.status] ?? 'bg-gray-100 text-gray-600'} />
                <h3 className="font-semibold text-gray-900 mt-1">{p.judul}</h3>
                <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-500">
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{p.tanggal}</span>
                  {p.instruktur && <span>Instruktur: {p.instruktur}</span>}
                  {p.lokasi && <span>{p.lokasi}</span>}
                  <span>{p.peserta_count ?? 0}/{p.kuota} peserta</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <CopyLinkButton pelatihanId={p.id} />
                <button onClick={() => setModalPeserta(p)}
                  className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
                  <Users className="h-3.5 w-3.5" /> Lihat Peserta
                </button>
                {p.status === 'TERJADWAL' && (
                  <button onClick={() => { setModalDaftar(p); setSelectedAnggotaId('') }}
                    className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer">
                    <Plus className="h-3.5 w-3.5" /> Daftarkan
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal open={modalNew} onClose={() => setModalNew(false)} title="Jadwalkan Pelatihan Baru">
        <div className="space-y-3">
          {([
            { key: 'judul', label: 'Judul Pelatihan *', placeholder: 'Contoh: Pelatihan Anggota Baru' },
            { key: 'instruktur', label: 'Instruktur', placeholder: 'Nama instruktur' },
            { key: 'lokasi', label: 'Lokasi', placeholder: 'Contoh: Aula Koperasi' },
          ] as { key: keyof typeof form; label: string; placeholder: string }[]).map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
              <input
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder={placeholder}
                value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Tanggal *</label>
              <input type="date"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                value={form.tanggal} onChange={e => setForm(f => ({ ...f, tanggal: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Kuota</label>
              <input type="number"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                value={form.kuota} onChange={e => setForm(f => ({ ...f, kuota: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalNew(false)}
              className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
              Batal
            </button>
            <button onClick={handleCreate} disabled={!form.judul || !form.tanggal || pending}
              className="flex-1 rounded-xl bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer">
              {pending ? 'Menyimpan...' : 'Jadwalkan'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!modalDaftar} onClose={() => setModalDaftar(null)} title="Daftarkan Peserta">
        {modalDaftar && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Pilih anggota untuk didaftarkan ke <strong>{modalDaftar.judul}</strong>:
            </p>
            <select
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              value={selectedAnggotaId} onChange={e => setSelectedAnggotaId(e.target.value)}>
              <option value="">— pilih anggota —</option>
              {anggota.map(a => <option key={a.id} value={a.id}>{a.kode_anggota} · {a.nama}</option>)}
            </select>
            <div className="flex gap-3">
              <button onClick={() => setModalDaftar(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
                Batal
              </button>
              <button onClick={handleDaftar} disabled={!selectedAnggotaId || pending}
                className="flex-1 rounded-xl bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer">
                {pending ? 'Mendaftarkan...' : 'Daftarkan'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Drawer open={!!modalPeserta} onClose={() => setModalPeserta(null)} title="Daftar Pendaftar">
        {modalPeserta && <PesertaPelatihanPanel pelatihan={modalPeserta} />}
      </Drawer>
    </div>
  )
}

// ─── TAB: PERMOHONAN ─────────────────────────────────────────────────────────

const STATUS_PEND: Record<string, { label: string; color: string }> = {
  MENUNGGU:  { label: 'Menunggu',  color: 'bg-amber-100 text-amber-700' },
  DISETUJUI: { label: 'Disetujui', color: 'bg-emerald-100 text-emerald-700' },
  DITOLAK:   { label: 'Ditolak',   color: 'bg-red-100 text-red-700' },
  DIREVISI:  { label: 'Revisi',    color: 'bg-blue-100 text-blue-700' },
}

// Jumlah soal per test — harus sinkron dengan SOAL_PER_TEST di
// modules/kojasmat/actions/kojasmat-test.actions.ts (Quiz 1) dan
// kojasmat-sahabat.actions.ts (Quiz 2)
const SOAL_MINIMAL: Record<'MASUK' | 'SAHABAT', number> = { MASUK: 15, SAHABAT: 40 }

type KredensialAnggota = {
  kode_anggota: string
  nama: string
  login_identifier: string | null
  temp_password: string | null
}

// Antrean anggota TEMAN yang sudah lulus test kedua dan menunggu persetujuan
// staf untuk naik ke tingkat Sahabat.
function SahabatApprovalPanel({ orgId }: { orgId: string }) {
  const [pending, startTransition] = useTransition()
  const [list, setList] = useState<KojasmatTestSahabatPending[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [tolakTarget, setTolakTarget] = useState<KojasmatTestSahabatPending | null>(null)
  const [catatanTolak, setCatatanTolak] = useState('')

  useEffect(() => {
    let cancelled = false
    getTestSahabatPendingByOrg(orgId).then(rows => { if (!cancelled) { setList(rows); setLoading(false) } })
    return () => { cancelled = true }
  }, [orgId])

  function handleSetujui(id: string) {
    setActionId(id)
    startTransition(async () => {
      const res = await setujuiTestSahabat(id)
      setActionId(null)
      if ('error' in res) return
      setList(prev => prev.filter(t => t.id !== id))
    })
  }

  function handleTolak() {
    if (!tolakTarget || !catatanTolak.trim()) return
    setActionId(tolakTarget.id)
    startTransition(async () => {
      const res = await tolakTestSahabat(tolakTarget.id, catatanTolak)
      setActionId(null)
      if ('error' in res) return
      setList(prev => prev.filter(t => t.id !== tolakTarget.id))
      setTolakTarget(null)
      setCatatanTolak('')
    })
  }

  if (loading || list.length === 0) return null

  return (
    <>
      <div className="rounded-2xl border border-purple-200 bg-purple-50/60 overflow-hidden">
        <div className="px-4 py-3 border-b border-purple-200 bg-purple-100/60">
          <p className="text-sm font-semibold text-purple-900">
            Upgrade Sahabat Menunggu Persetujuan ({list.length})
          </p>
          <p className="text-xs text-purple-700 mt-0.5">
            Anggota sudah lulus test kedua — setujui untuk membuka akses eksekusi proyek, transfer, dan fitur lainnya.
          </p>
        </div>
        <div className="divide-y divide-purple-100">
          {list.map(t => (
            <div key={t.id} className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-gray-900 text-sm">{t.anggota_nama} <span className="text-gray-400 font-mono text-xs">· {t.kode_anggota}</span></p>
                <p className="text-xs text-gray-500 mt-0.5">Skor {t.skor}% ({t.jumlah_benar}/{t.soal_ids.length} benar)</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => { setTolakTarget(t); setCatatanTolak('') }}
                  disabled={pending && actionId === t.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50">
                  <XCircle className="h-3.5 w-3.5" /> Tolak
                </button>
                <button onClick={() => handleSetujui(t.id)}
                  disabled={pending && actionId === t.id}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-700 transition-colors cursor-pointer disabled:opacity-50">
                  <CheckCircle className="h-3.5 w-3.5" />
                  {pending && actionId === t.id ? 'Memproses...' : 'Setujui'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal open={!!tolakTarget} onClose={() => { setTolakTarget(null); setCatatanTolak('') }}
        title={`Tolak Upgrade Sahabat — ${tolakTarget?.anggota_nama ?? ''}`}>
        {tolakTarget && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Alasan penolakan *</label>
              <textarea rows={3}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                placeholder="Contoh: perlu wawancara tambahan"
                value={catatanTolak} onChange={e => setCatatanTolak(e.target.value)} />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => { setTolakTarget(null); setCatatanTolak('') }}
                className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
                Batal
              </button>
              <button onClick={handleTolak} disabled={!catatanTolak.trim() || pending}
                className="flex-1 rounded-xl bg-rose-600 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50 transition-colors cursor-pointer">
                {pending ? 'Memproses...' : 'Tolak Upgrade'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

function TabPermohonan({ orgId, pendaftaran, moduleSettings }: { orgId: string; pendaftaran: KojasmatPendaftaran[]; moduleSettings: Props['moduleSettings'] }) {
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useState<KojasmatPendaftaran | null>(null)
  const [dokumen, setDokumen] = useState<KojasmatDokumen[]>([])
  const [loadingDok, setLoadingDok] = useState(false)
  const [testRiwayat, setTestRiwayat] = useState<KojasmatTestMasukRingkas[]>([])
  const [catatanForm, setCatatanForm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('MENUNGGU')
  const [actionResult, setActionResult] = useState<string | null>(null)
  const [kredensial, setKredensial] = useState<KredensialAnggota | null>(null)
  const [copied, setCopied] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  const filtered = pendaftaran.filter(p =>
    filterStatus === 'SEMUA' || p.status === filterStatus
  )

  async function openDetail(p: KojasmatPendaftaran) {
    setSelected(p)
    setCatatanForm('')
    setActionResult(null)
    setLoadingDok(true)
    setTestRiwayat([])
    try {
      const docs = await getDokumenByRef('PENDAFTARAN', p.id)
      // juga cek dokumen yang sudah dipindahkan ke ANGGOTA
      const docsAnggota = p.anggota_id ? await getDokumenByRef('ANGGOTA', p.anggota_id) : []
      setDokumen([...docs, ...docsAnggota])
      const riwayat = await getTestMasukByPendaftaran(orgId, p.id)
      setTestRiwayat(riwayat)
    } finally {
      setLoadingDok(false)
    }
  }

  async function openSignedUrl(key: string) {
    const res = await fetch(`/api/kojasmat/file?key=${encodeURIComponent(key)}`)
    const { url } = await res.json() as { url: string }
    window.open(url, '_blank')
  }

  function buildWaText(k: KredensialAnggota) {
    const appUrl = typeof window !== 'undefined' ? window.location.origin : ''
    return interpolate(moduleSettings.pesan_otomatis.pendaftaran_disetujui_teman.body, {
      nama: k.nama,
      kode_anggota: k.kode_anggota,
      login_url: `${appUrl}/anggota/login`,
      login_identifier: k.login_identifier ?? '-',
      temp_password: k.temp_password ?? '(gunakan password saat mendaftar)',
    })
  }

  function handleAction(action: 'setujui' | 'tolak' | 'revisi') {
    if (!selected) return
    const nama = selected.nama_lengkap
    startTransition(async () => {
      let res
      if (action === 'setujui') res = await setujuiPendaftaran(selected.id)
      else if (action === 'tolak') res = await tolakPendaftaran(selected.id, catatanForm)
      else res = await mintaRevisiPendaftaran(selected.id, catatanForm)

      if (res.error) { setActionResult(`Gagal: ${res.error}`); return }

      if (action === 'setujui' && 'data' in res && res.data) {
        const d = res.data as { kode_anggota: string; temp_password: string | null; login_identifier: string | null }
        setSelected(null)
        setKredensial({
          kode_anggota: d.kode_anggota,
          nama,
          login_identifier: d.login_identifier,
          temp_password: d.temp_password,
        })
      } else {
        setActionResult('Berhasil diproses.')
        setSelected(null)
      }
    })
  }

  async function handleCopyWa() {
    if (!kredensial) return
    await navigator.clipboard.writeText(buildWaText(kredensial))
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-1">
          {(['MENUNGGU', 'DIREVISI', 'DISETUJUI', 'DITOLAK', 'SEMUA'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={cn('rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer',
                filterStatus === s ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
              {s === 'SEMUA' ? 'Semua' : STATUS_PEND[s]?.label ?? s}
              {s !== 'SEMUA' && (
                <span className="ml-1 text-gray-400">
                  ({pendaftaran.filter(p => p.status === s).length})
                </span>
              )}
            </button>
          ))}
        </div>
        <a
          href={`/anggota/daftar?org=${orgId}`}
          target="_blank"
          className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <Link2 className="h-3.5 w-3.5" /> Link Daftar
        </a>
      </div>

      <SahabatApprovalPanel orgId={orgId} />

      {actionResult && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-center justify-between">
          <span>{actionResult}</span>
          <button onClick={() => setActionResult(null)} className="ml-3 text-emerald-400 hover:text-emerald-600 cursor-pointer"><XCircle className="h-4 w-4" /></button>
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Nama</th>
                <th className="px-4 py-3 text-left font-medium">Kontak</th>
                <th className="px-4 py-3 text-left font-medium">Pekerjaan</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Tanggal</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-gray-400">Tidak ada permohonan</td></tr>
              )}
              {filtered.map(p => {
                const sp = STATUS_PEND[p.status] ?? { label: p.status, color: 'bg-gray-100 text-gray-600' }
                return (
                  <tr key={p.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.nama_lengkap}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {p.phone && <div>{p.phone}</div>}
                      {p.email && <div>{p.email}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{p.pekerjaan ?? '—'}</td>
                    <td className="px-4 py-3"><Badge text={sp.label} cls={sp.color} /></td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{String(p.created_at).split('T')[0]}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => openDetail(p)}
                        className="rounded-lg p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer">
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Detail Permohonan">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Nama', selected.nama_lengkap],
                ['NIK', selected.nik ?? '—'],
                ['Phone', selected.phone ?? '—'],
                ['Email', selected.email ?? '—'],
                ['Pekerjaan', selected.pekerjaan ?? '—'],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs text-gray-400">{k}</p>
                  <p className="font-medium text-gray-800">{v}</p>
                </div>
              ))}
              <div className="col-span-2">
                <p className="text-xs text-gray-400">Alamat</p>
                <p className="font-medium text-gray-800">{selected.alamat ?? '—'}</p>
              </div>
              {(selected.kontak_darurat_nama || selected.kontak_darurat_phone) && (
                <div className="col-span-2 rounded-xl border border-red-100 bg-red-50 p-3">
                  <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-1.5">Kontak Darurat</p>
                  <p className="font-medium text-gray-800">
                    {selected.kontak_darurat_nama ?? '—'}
                    {selected.kontak_darurat_hubungan && (
                      <span className="ml-1.5 font-normal text-gray-500">({selected.kontak_darurat_hubungan})</span>
                    )}
                  </p>
                  <p className="text-sm text-gray-600">{selected.kontak_darurat_phone ?? '—'}</p>
                  {selected.kontak_darurat_alamat && (
                    <p className="text-sm text-gray-600 mt-1">{selected.kontak_darurat_alamat}</p>
                  )}
                </div>
              )}
              {selected.alasan_bergabung && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-400">Alasan Bergabung</p>
                  <p className="text-gray-700 text-sm">{selected.alasan_bergabung}</p>
                </div>
              )}
              {selected.layanan_diinginkan && selected.layanan_diinginkan.length > 0 && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-400 mb-1">Layanan Yang Diinginkan</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.layanan_diinginkan.map(l => (
                      <span key={l} className="rounded-lg bg-emerald-50 border border-emerald-100 px-2 py-1 text-xs text-emerald-700">{l}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="col-span-2">
                <p className="text-xs text-gray-400">Komitmen Disetujui</p>
                <p className="font-medium text-gray-800">
                  {selected.komitmen_disetujui_at
                    ? new Date(selected.komitmen_disetujui_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
                    : '— belum menyelesaikan step Komitmen'}
                </p>
              </div>
            </div>

            {/* Dokumen */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Dokumen</p>
              {loadingDok ? (
                <p className="text-sm text-gray-400">Memuat dokumen...</p>
              ) : dokumen.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Belum ada dokumen dilampirkan</p>
              ) : (
                <div className="space-y-2">
                  {dokumen.map(d => (
                    <div key={d.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{d.jenis_dokumen}</p>
                        <p className="text-xs text-gray-400">{d.nama_file}</p>
                      </div>
                      <button onClick={() => openSignedUrl(d.file_key)}
                        className="flex items-center gap-1 rounded-lg bg-white border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer">
                        <Eye className="h-3.5 w-3.5" /> Lihat
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Test Masuk */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Riwayat Test Masuk</p>
              {loadingDok ? (
                <p className="text-sm text-gray-400">Memuat riwayat test...</p>
              ) : testRiwayat.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Belum mengerjakan test masuk</p>
              ) : (
                <div className="space-y-2">
                  {testRiwayat.map(t => (
                    <div key={t.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
                      <div>
                        <span className="text-gray-500">Quiz #{t.attempt_number}</span>
                        {t.skor != null && (
                          <span className="ml-2 text-gray-800 font-medium">
                            {Number(t.skor).toFixed(0)}% ({t.jumlah_benar} benar)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {t.apresiasi && (
                          <span className="flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-700">
                            <Star className="h-3 w-3" /> {t.apresiasi}
                          </span>
                        )}
                        <Badge text={t.status}
                          cls={t.status === 'LULUS' ? 'bg-emerald-100 text-emerald-700' : t.status === 'GAGAL' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Rincian Pembayaran — harus sama persis dengan item & nominal yang ditampilkan
                di Ringkasan Pembayaran wizard publik (lihat DaftarClient.tsx step 'bayar') */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Rincian Pembayaran</p>
              {selected.status_bayar !== 'SUDAH' ? (
                <p className="text-sm text-gray-400 italic">Belum melakukan pembayaran</p>
              ) : (() => {
                const sp = Number(selected.simpanan_pokok_dibayar ?? 0)
                const sw = Number(selected.simpanan_wajib_dibayar ?? 0)
                const adk = Number(selected.biaya_admin_dibayar ?? 0)
                const ijarah = Number(selected.ijarah_fee_dibayar ?? 0)
                const sukarela = Number(selected.simpanan_sukarela_dibayar ?? 0)
                const total = sp + sw + adk + ijarah + sukarela
                return (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 space-y-1.5 text-sm">
                  {sp > 0 && (
                    <div className="flex justify-between">
                      <span className="text-emerald-700">Simpanan Pokok (SP)</span>
                      <span className="font-medium text-emerald-800">{fmt(sp)}</span>
                    </div>
                  )}
                  {sw > 0 && (
                    <div className="flex justify-between">
                      <span className="text-emerald-700">Simpanan Wajib (SW)</span>
                      <span className="font-medium text-emerald-800">{fmt(sw)}</span>
                    </div>
                  )}
                  {ijarah > 0 && (
                    <div className="flex justify-between">
                      <span className="text-emerald-700">Ijarah Platform</span>
                      <span className="font-medium text-emerald-800">{fmt(ijarah)}</span>
                    </div>
                  )}
                  {sukarela > 0 && (
                    <div className="flex justify-between">
                      <span className="text-emerald-700">Simpanan Sukarela</span>
                      <span className="font-medium text-emerald-800">{fmt(sukarela)}</span>
                    </div>
                  )}
                  {adk > 0 && (
                    <div className="flex justify-between">
                      <span className="text-emerald-700">Admin Keanggotaan (ADK)</span>
                      <span className="font-medium text-emerald-800">{fmt(adk)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-emerald-200 pt-1.5 font-bold">
                    <span className="text-emerald-800">Total Dibayar</span>
                    <span className="text-emerald-900">{fmt(total)}</span>
                  </div>
                  {selected.dibayar_at && (
                    <p className="text-xs text-emerald-600 pt-1">Dibayar: {String(selected.dibayar_at).split('T')[0]}</p>
                  )}
                </div>
                )
              })()}
            </div>

            {selected.status === 'MENUNGGU' && (
              <button onClick={() => setPreviewOpen(true)}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
                <Smartphone className="h-4 w-4" /> Preview Portal Anggota
              </button>
            )}

            {selected.catatan_pengurus && (
              <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2 text-sm text-blue-700">
                <span className="font-medium">Catatan sebelumnya:</span> {selected.catatan_pengurus}
              </div>
            )}

            {(selected.status === 'MENUNGGU' || selected.status === 'DIREVISI') && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Catatan (untuk tolak / revisi)</label>
                  <textarea rows={2}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 resize-none"
                    placeholder="Tuliskan alasan atau hal yang perlu diperbaiki..."
                    value={catatanForm} onChange={e => setCatatanForm(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleAction('tolak')} disabled={!catatanForm.trim() || pending}
                    className="flex-1 rounded-xl border border-red-200 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors cursor-pointer">
                    Tolak
                  </button>
                  <button onClick={() => handleAction('revisi')} disabled={!catatanForm.trim() || pending}
                    className="flex-1 rounded-xl border border-blue-200 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-40 transition-colors cursor-pointer">
                    Minta Revisi
                  </button>
                  <button onClick={() => handleAction('setujui')} disabled={pending}
                    className="flex-1 rounded-xl bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer">
                    {pending ? 'Memproses...' : 'Setujui'}
                  </button>
                </div>
              </>
            )}
            {selected.status === 'DISETUJUI' && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-700 text-center">
                Permohonan sudah disetujui. Anggota sudah terdaftar.
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal Kredensial WA */}
      <Modal open={!!kredensial} onClose={() => setKredensial(null)} title="Anggota Disetujui — Info Login">
        {kredensial && (
          <div className="space-y-4">
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-center">
              <p className="text-xs text-emerald-600 mb-1">Kode Anggota</p>
              <p className="text-2xl font-bold font-mono text-emerald-700">{kredensial.kode_anggota}</p>
              <p className="text-sm text-emerald-600 mt-0.5">{kredensial.nama}</p>
            </div>

            {kredensial.temp_password ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Kredensial Login</p>
                <div className="rounded-xl border border-gray-100 bg-gray-50 divide-y divide-gray-100">
                  {kredensial.login_identifier && (
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-xs text-gray-400">Email / NIK</span>
                      <span className="font-mono text-sm font-medium text-gray-800">{kredensial.login_identifier}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-xs text-gray-400">Password Sementara</span>
                    <span className="font-mono text-sm font-bold text-gray-900 tracking-widest">{kredensial.temp_password}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-400">Anggota bisa login di halaman <strong>/login</strong> lalu akses dashboard mereka.</p>
              </div>
            ) : (
              <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-700">
                Anggota tidak memiliki email/NIK — akun login tidak dibuat. Tambahkan email/NIK di tab Anggota untuk membuat akun.
              </div>
            )}

            {/* Preview pesan WA */}
            {kredensial.temp_password && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pesan WhatsApp Siap Kirim</p>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700 whitespace-pre-wrap font-mono text-xs leading-relaxed">
                  {buildWaText(kredensial)}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setKredensial(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
                Tutup
              </button>
              {kredensial.temp_password && (
                <button onClick={handleCopyWa}
                  className={cn(
                    'flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors cursor-pointer',
                    copied
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  )}>
                  {copied ? '✓ Tersalin!' : 'Salin Pesan WA'}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Preview Portal — read-only, staf lihat apa yang dilihat calon anggota,
          tanpa membuat kojasmat_anggota atau memberi akses login sungguhan. */}
      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="Preview Portal Anggota">
        {selected && (
          <div className="space-y-4">
            <p className="text-xs text-gray-400">
              Tampilan ini persis seperti yang dilihat <strong>{selected.nama_lengkap}</strong> di halaman
              &quot;Menunggu Verifikasi&quot; setelah membayar — hanya untuk staf, tidak membuat akun anggota.
            </p>
            <div className="rounded-2xl border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-center gap-2 bg-amber-500 py-2.5 text-sm font-semibold text-white">
                <Clock className="h-4 w-4" /> Status: Menunggu Verifikasi Pengurus
              </div>
              <div className="bg-white p-5 text-center">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 mb-3">
                  <CheckCircle className="h-7 w-7 text-emerald-600" />
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-1">Pembayaran Diterima — Menunggu Verifikasi</h3>
                <p className="text-xs text-gray-500 mb-4">
                  Pengurus akan memverifikasi pembayaran sebelum akun keanggotaan diaktifkan.
                </p>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 text-left">
                  Menu Anda (aktif setelah diverifikasi)
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { label: 'Beranda', icon: Home },
                    { label: 'Simpanan', icon: Wallet },
                    { label: 'Proyek', icon: Briefcase },
                    { label: 'Investasi', icon: Coins },
                    { label: 'Penawaran', icon: Bell },
                  ].map(m => (
                    <div key={m.label} className="relative flex flex-col items-center gap-1 rounded-xl border border-gray-100 bg-gray-50 py-3 px-1">
                      <div className="relative">
                        <m.icon className="h-5 w-5 text-gray-300" />
                        <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-gray-300">
                          <Lock className="h-2.5 w-2.5 text-white" />
                        </span>
                      </div>
                      <span className="text-[10px] font-medium text-gray-400 text-center leading-tight">{m.label}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs text-gray-400">
                  Kode pendaftaran: <span className="font-mono">{selected.id.slice(0, 8).toUpperCase()}</span>
                </p>
              </div>
            </div>
            <button onClick={() => setPreviewOpen(false)}
              className="w-full rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
              Tutup
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ─── TAB: LAPORAN ─────────────────────────────────────────────────────────────

function TabLaporan({ laporan }: { laporan: KojasmatLaporanProyek[] }) {
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useState<KojasmatLaporanProyek | null>(null)
  const [catatan, setCatatan] = useState('')

  function handleUlas(status: 'DITINJAU' | 'DIVERIFIKASI') {
    if (!selected) return
    startTransition(async () => {
      await ulasLaporan(selected.id, catatan, status)
      setSelected(null)
    })
  }

  const statusColor: Record<string, string> = {
    DIKIRIM: 'bg-blue-100 text-blue-700',
    DITINJAU: 'bg-amber-100 text-amber-700',
    DIVERIFIKASI: 'bg-emerald-100 text-emerald-700',
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Proyek</th>
                <th className="px-4 py-3 text-left font-medium">Pengaju</th>
                <th className="px-4 py-3 text-left font-medium">Periode</th>
                <th className="px-4 py-3 text-right font-medium">Omzet</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {laporan.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-gray-400">Belum ada laporan masuk</td></tr>
              )}
              {laporan.map(l => (
                <tr key={l.id} className={cn('hover:bg-gray-50/60 transition-colors', l.is_terlambat && 'bg-red-50/40')}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 text-sm">{l.proyek_nama ?? '—'}</p>
                    {l.is_terlambat && <span className="text-xs text-red-500 font-medium">Terlambat</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{l.pengaju_nama ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {String(l.periode_mulai).split('T')[0]} s/d {String(l.periode_akhir).split('T')[0]}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {fmt(Number(l.omzet_periode))}
                  </td>
                  <td className="px-4 py-3"><Badge text={l.status} cls={statusColor[l.status] ?? 'bg-gray-100 text-gray-600'} /></td>
                  <td className="px-4 py-3">
                    <button onClick={() => { setSelected(l); setCatatan('') }}
                      className="rounded-lg p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer">
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Detail Laporan">
        {selected && (
          <div className="space-y-4">
            <div className="rounded-xl bg-gray-50 p-4 space-y-2 text-sm">
              <p className="font-semibold text-gray-800">{selected.proyek_nama}</p>
              <p className="text-gray-500">Periode: {String(selected.periode_mulai).split('T')[0]} — {String(selected.periode_akhir).split('T')[0]}</p>
              <p className="text-gray-500">Omzet: <strong className="text-gray-800">{fmt(Number(selected.omzet_periode))}</strong></p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Ringkasan Kegiatan</p>
              <p className="text-sm text-gray-700 whitespace-pre-line">{selected.ringkasan}</p>
            </div>
            {selected.kendala && (
              <div>
                <p className="text-xs font-semibold text-red-500 mb-1">Kendala</p>
                <p className="text-sm text-gray-700">{selected.kendala}</p>
              </div>
            )}
            {selected.rencana_kedepan && (
              <div>
                <p className="text-xs font-semibold text-blue-500 mb-1">Rencana Ke Depan</p>
                <p className="text-sm text-gray-700">{selected.rencana_kedepan}</p>
              </div>
            )}
            {selected.status !== 'DIVERIFIKASI' && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Catatan Pengurus</label>
                  <textarea rows={2}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 resize-none"
                    value={catatan} onChange={e => setCatatan(e.target.value)} />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => handleUlas('DITINJAU')} disabled={pending}
                    className="flex-1 rounded-xl border border-amber-200 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer">
                    Tandai Ditinjau
                  </button>
                  <button onClick={() => handleUlas('DIVERIFIKASI')} disabled={pending}
                    className="flex-1 rounded-xl bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors cursor-pointer">
                    Verifikasi
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

// ─── TAB: TINDAKAN ────────────────────────────────────────────────────────────

function TabTindakan({ orgId, anggota, proyek, tindakan }: {
  orgId: string; anggota: KojasmatAnggota[]; proyek: KojasmatProyek[]; tindakan: KojasmatTindakan[]
}) {
  const [pending, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    anggota_id: '', proyek_id: '',
    jenis: 'PERINGATAN' as KojasmatTindakan['jenis'],
    alasan: '',
  })

  function handleBeri() {
    startTransition(async () => {
      await beriTindakan({
        org_id: orgId, anggota_id: form.anggota_id,
        proyek_id: form.proyek_id || undefined,
        jenis: form.jenis, alasan: form.alasan,
      })
      setModalOpen(false)
      setForm({ anggota_id: '', proyek_id: '', jenis: 'PERINGATAN', alasan: '' })
    })
  }

  const jenisColor: Record<string, string> = {
    PERINGATAN:              'bg-amber-100 text-amber-700',
    TINJAUAN_ULANG:          'bg-blue-100 text-blue-700',
    PENCABUTAN_KEANGGOTAAN:  'bg-red-100 text-red-700',
  }
  const statusColor: Record<string, string> = {
    AKTIF:      'bg-red-50 text-red-600',
    SELESAI:    'bg-emerald-50 text-emerald-600',
    DIBATALKAN: 'bg-gray-100 text-gray-500',
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors cursor-pointer">
          <AlertTriangle className="h-4 w-4" /> Beri Tindakan
        </button>
      </div>

      <div className="space-y-3">
        {tindakan.length === 0 && (
          <div className="rounded-2xl border border-gray-100 bg-white py-12 text-center text-gray-400">
            Belum ada tindakan atau sanksi
          </div>
        )}
        {tindakan.map(t => (
          <div key={t.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex flex-wrap gap-2 mb-1">
                  <Badge text={t.jenis.replace(/_/g,' ')} cls={jenisColor[t.jenis] ?? 'bg-gray-100 text-gray-600'} />
                  <Badge text={t.status} cls={statusColor[t.status] ?? 'bg-gray-100 text-gray-600'} />
                </div>
                <p className="font-semibold text-gray-900">{t.anggota_nama ?? '—'}</p>
                {t.proyek_nama && <p className="text-sm text-gray-500">Proyek: {t.proyek_nama}</p>}
                <p className="text-sm text-gray-600 mt-1">{t.alasan}</p>
                <p className="text-xs text-gray-400 mt-1">{String(t.created_at).split('T')[0]}</p>
              </div>
              {t.status === 'AKTIF' && (
                <button onClick={() => startTransition(async () => { await selesaikanTindakan(t.id) })} disabled={pending}
                  className="shrink-0 flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer">
                  <CheckCircle className="h-3.5 w-3.5" /> Selesai
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Berikan Tindakan / Sanksi">
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Anggota *</label>
            <select className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-500"
              value={form.anggota_id} onChange={e => setForm(f => ({ ...f, anggota_id: e.target.value }))}>
              <option value="">— pilih anggota —</option>
              {anggota.map(a => <option key={a.id} value={a.id}>{a.kode_anggota} · {a.nama}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Terkait Proyek (opsional)</label>
            <select className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-500"
              value={form.proyek_id} onChange={e => setForm(f => ({ ...f, proyek_id: e.target.value }))}>
              <option value="">— tidak terkait proyek —</option>
              {proyek.map(p => <option key={p.id} value={p.id}>{p.kode_proyek} · {p.nama_proyek}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Jenis Tindakan *</label>
            <select className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-500"
              value={form.jenis} onChange={e => setForm(f => ({ ...f, jenis: e.target.value as KojasmatTindakan['jenis'] }))}>
              <option value="PERINGATAN">Peringatan</option>
              <option value="TINJAUAN_ULANG">Tinjauan Ulang</option>
              <option value="PENCABUTAN_KEANGGOTAAN">Pencabutan Keanggotaan</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Alasan / Dasar Tindakan *</label>
            <textarea rows={3}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-500 resize-none"
              placeholder="Jelaskan pelanggaran atau alasan tindakan ini..."
              value={form.alasan} onChange={e => setForm(f => ({ ...f, alasan: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)}
              className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
              Batal
            </button>
            <button onClick={handleBeri} disabled={!form.anggota_id || !form.alasan.trim() || pending}
              className="flex-1 rounded-xl bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors cursor-pointer">
              {pending ? 'Menyimpan...' : 'Berikan Tindakan'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function TabBankSoal({ orgId, bankSoal, moduleSettings, bankAccounts, qrisPreviewUrl }: {
  orgId: string
  bankSoal: KojasmatBankSoal[]
  moduleSettings: Props['moduleSettings']
  bankAccounts: Props['bankAccounts']
  qrisPreviewUrl: string | null
}) {
  const [pending, startTransition] = useTransition()
  const [modalSoal, setModalSoal] = useState<KojasmatBankSoal | 'new' | null>(null)
  const [jenisFilter, setJenisFilter] = useState<'MASUK' | 'SAHABAT'>('MASUK')
  const [form, setForm] = useState({
    pertanyaan: '', pilihan_a: '', pilihan_b: '', pilihan_c: '', pilihan_d: '',
    jawaban_benar: 'A' as 'A' | 'B' | 'C' | 'D', jenis: 'MASUK' as 'MASUK' | 'SAHABAT', is_active: true,
  })
  const [settingsForm, setSettingsForm] = useState({
    passing_threshold: String(moduleSettings.passing_threshold),
    biaya_admin_pendaftaran: String(moduleSettings.biaya_admin_pendaftaran),
    nominal_simpanan_pokok: String(moduleSettings.nominal_simpanan_pokok),
    nominal_simpanan_wajib: String(moduleSettings.nominal_simpanan_wajib),
    bank_account_id: moduleSettings.bank_account_id ?? '',
    ijarah_platform_fee: String(moduleSettings.ijarah_platform_fee),
    ijarah_platform_periode_hari: String(moduleSettings.ijarah_platform_periode_hari),
    ijarah_sukarela_opsional_minimal: String(moduleSettings.ijarah_sukarela_opsional_minimal),
    admin_whatsapp: moduleSettings.admin_whatsapp,
  })
  const [tierForm, setTierForm] = useState(
    moduleSettings.apresiasi_tiers.map(t => ({ min_score: String(t.min_score), label: t.label }))
  )
  const [komitmenForm, setKomitmenForm] = useState<KomitmenSection[]>(moduleSettings.komitmen_sections)
  const [qrisUploading, setQrisUploading] = useState(false)
  const [qrisPreview, setQrisPreview] = useState(qrisPreviewUrl)
  const [qrisName, setQrisName] = useState(moduleSettings.qris_image_name)

  const bankSoalFiltered = bankSoal.filter(s => s.jenis === jenisFilter)
  const aktifCount = bankSoalFiltered.filter(s => s.is_active).length

  async function handleQrisUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setQrisUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('org_id', orgId)
      fd.append('ref_type', 'QRIS')
      const res = await fetch('/api/kojasmat/upload', { method: 'POST', body: fd })
      const json = await res.json() as { key?: string; name?: string; error?: string }
      if (!res.ok || json.error || !json.key) return
      await updateModuleSettings(orgId, { qris_image_key: json.key, qris_image_name: json.name ?? file.name })
      setQrisPreview(URL.createObjectURL(file))
      setQrisName(json.name ?? file.name)
    } finally {
      setQrisUploading(false)
      e.target.value = ''
    }
  }

  function handleHapusQris() {
    startTransition(async () => {
      await updateModuleSettings(orgId, { qris_image_key: null, qris_image_name: null })
      setQrisPreview(null)
      setQrisName(null)
    })
  }

  function openNew() {
    setForm({ pertanyaan: '', pilihan_a: '', pilihan_b: '', pilihan_c: '', pilihan_d: '', jawaban_benar: 'A', jenis: jenisFilter, is_active: true })
    setModalSoal('new')
  }

  function openEdit(s: KojasmatBankSoal) {
    setForm({
      pertanyaan: s.pertanyaan, pilihan_a: s.pilihan_a, pilihan_b: s.pilihan_b,
      pilihan_c: s.pilihan_c, pilihan_d: s.pilihan_d, jawaban_benar: s.jawaban_benar,
      jenis: s.jenis, is_active: s.is_active,
    })
    setModalSoal(s)
  }

  function handleSimpan() {
    startTransition(async () => {
      await simpanBankSoal({
        id: modalSoal === 'new' ? undefined : modalSoal?.id,
        org_id: orgId,
        ...form,
      })
      setModalSoal(null)
    })
  }

  function handleHapus(id: string) {
    startTransition(async () => { await hapusBankSoal(id, orgId) })
  }

  function handleSimpanSettings() {
    startTransition(async () => {
      await updateModuleSettings(orgId, {
        passing_threshold: Number(settingsForm.passing_threshold) || 70,
        biaya_admin_pendaftaran: Number(settingsForm.biaya_admin_pendaftaran) || 0,
        nominal_simpanan_pokok: Number(settingsForm.nominal_simpanan_pokok) || 0,
        nominal_simpanan_wajib: Number(settingsForm.nominal_simpanan_wajib) || 0,
        bank_account_id: settingsForm.bank_account_id || null,
        ijarah_platform_fee: Number(settingsForm.ijarah_platform_fee) || 0,
        ijarah_platform_periode_hari: Number(settingsForm.ijarah_platform_periode_hari) || 30,
        ijarah_sukarela_opsional_minimal: Number(settingsForm.ijarah_sukarela_opsional_minimal) || 0,
        apresiasi_tiers: tierForm
          .filter(t => t.label.trim())
          .map(t => ({ min_score: Number(t.min_score) || 0, label: t.label.trim() })),
        komitmen_sections: komitmenForm.filter(s => s.title.trim() && s.checkbox_label.trim()),
        admin_whatsapp: settingsForm.admin_whatsapp.replace(/\D/g, ''),
      })
    })
  }

  function updateTier(index: number, field: 'min_score' | 'label', value: string) {
    setTierForm(list => list.map((t, i) => i === index ? { ...t, [field]: value } : t))
  }

  function addTier() {
    setTierForm(list => [...list, { min_score: '0', label: '' }])
  }

  function removeTier(index: number) {
    setTierForm(list => list.filter((_, i) => i !== index))
  }

  function updateKomitmenSection(index: number, field: keyof KomitmenSection, value: string) {
    setKomitmenForm(list => list.map((s, i) => i === index ? { ...s, [field]: value } : s))
  }

  function addKomitmenSection() {
    setKomitmenForm(list => [...list, { title: '', body: '', checkbox_label: '' }])
  }

  function removeKomitmenSection(index: number) {
    setKomitmenForm(list => list.filter((_, i) => i !== index))
  }

  const formValid = form.pertanyaan.trim() && form.pilihan_a.trim() && form.pilihan_b.trim()
    && form.pilihan_c.trim() && form.pilihan_d.trim()

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-1">Pengaturan Test &amp; Pembayaran Pendaftaran</h3>
        <p className="text-sm text-gray-500 mb-4">
          Dipakai di wizard publik pendaftaran anggota baru (test masuk + pembayaran).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Ambang Lulus Test (%)</label>
            <input type="number" min={0} max={100}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              value={settingsForm.passing_threshold}
              onChange={e => setSettingsForm(f => ({ ...f, passing_threshold: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Biaya Admin Pendaftaran (Rp)</label>
            <input type="number" min={0}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              value={settingsForm.biaya_admin_pendaftaran}
              onChange={e => setSettingsForm(f => ({ ...f, biaya_admin_pendaftaran: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Nominal Simpanan Pokok / SP (Rp)</label>
            <input type="number" min={0}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              value={settingsForm.nominal_simpanan_pokok}
              onChange={e => setSettingsForm(f => ({ ...f, nominal_simpanan_pokok: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Nominal Simpanan Wajib / SW (Rp)</label>
            <input type="number" min={0}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              value={settingsForm.nominal_simpanan_wajib}
              onChange={e => setSettingsForm(f => ({ ...f, nominal_simpanan_wajib: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Rekening Tujuan Transfer</label>
            <select
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              value={settingsForm.bank_account_id}
              onChange={e => setSettingsForm(f => ({ ...f, bank_account_id: e.target.value }))}>
              <option value="">— pilih rekening —</option>
              {bankAccounts.map(b => (
                <option key={b.id} value={b.id}>{b.bank_name} · {b.account_number}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">No. WhatsApp Admin (bantuan calon anggota)</label>
            <input
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              placeholder="Contoh: 6281234567890"
              value={settingsForm.admin_whatsapp}
              onChange={e => setSettingsForm(f => ({ ...f, admin_whatsapp: e.target.value }))} />
            <p className="mt-1 text-xs text-gray-400">Tombol &quot;Hubungi Admin&quot; di halaman menunggu verifikasi akan membuka WhatsApp ke nomor ini.</p>
          </div>
        </div>

        <div className="mt-5 pt-5 border-t border-gray-100">
          <h4 className="text-sm font-semibold text-gray-900 mb-1">Akad Ijarah Platform</h4>
          <p className="text-xs text-gray-500 mb-3">
            Tarif default akad ijarah anggota baru — nilai ini di-snapshot per anggota saat pendaftaran disetujui,
            perubahan di sini tidak mengubah akad anggota yang sudah berjalan.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Tarif Ijarah (Rp)</label>
              <input type="number" min={0}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                value={settingsForm.ijarah_platform_fee}
                onChange={e => setSettingsForm(f => ({ ...f, ijarah_platform_fee: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Periode Tagihan (hari)</label>
              <input type="number" min={1}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                value={settingsForm.ijarah_platform_periode_hari}
                onChange={e => setSettingsForm(f => ({ ...f, ijarah_platform_periode_hari: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Minimal Tabungan Opsional (Rp)</label>
              <input type="number" min={0}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                value={settingsForm.ijarah_sukarela_opsional_minimal}
                onChange={e => setSettingsForm(f => ({ ...f, ijarah_sukarela_opsional_minimal: e.target.value }))} />
            </div>
          </div>
        </div>

        <div className="mt-5 pt-5 border-t border-gray-100">
          <label className="mb-1 block text-sm font-medium text-gray-700">QRIS Pembayaran</label>
          <p className="text-xs text-gray-500 mb-3">
            Opsional — calon anggota bisa memilih bayar via transfer bank atau scan QRIS ini.
          </p>
          <div className="flex items-start gap-4">
            {qrisPreview ? (
              <img src={qrisPreview} alt="QRIS" className="h-32 w-32 rounded-xl border border-gray-200 object-contain shrink-0" />
            ) : (
              <div className="flex h-32 w-32 items-center justify-center rounded-xl border border-dashed border-gray-300 text-gray-300 shrink-0">
                <Wallet className="h-8 w-8" />
              </div>
            )}
            <div className="flex-1 space-y-2">
              {qrisName && <p className="text-sm text-gray-700 truncate">{qrisName}</p>}
              <label className={cn(
                'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer',
                qrisUploading ? 'bg-gray-100 text-gray-400 pointer-events-none' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}>
                {qrisUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {qrisPreview ? 'Ganti QRIS' : 'Upload QRIS'}
                <input type="file" className="sr-only" accept=".jpg,.jpeg,.png,.webp"
                  onChange={handleQrisUpload} disabled={qrisUploading} />
              </label>
              {qrisPreview && (
                <button onClick={handleHapusQris} disabled={pending}
                  className="ml-2 inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors cursor-pointer">
                  <Trash2 className="h-3.5 w-3.5" /> Hapus
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 pt-5 border-t border-gray-100">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-sm font-semibold text-gray-900">Apresiasi Hasil Test</h4>
            <button onClick={addTier}
              className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer">
              <Plus className="h-3.5 w-3.5" /> Tambah Tingkat
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Label penghargaan yang ditampilkan ke calon anggota sesuai skor test masuk (mis. Mumtaz, Jayyid Jiddan).
          </p>
          <div className="space-y-2">
            {tierForm.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="number" min={0} max={100}
                  className="w-20 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  value={t.min_score}
                  onChange={e => updateTier(i, 'min_score', e.target.value)} />
                <span className="text-xs text-gray-400 shrink-0">% ke atas →</span>
                <input
                  className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  placeholder="Label apresiasi, mis. Mumtaz"
                  value={t.label}
                  onChange={e => updateTier(i, 'label', e.target.value)} />
                <button onClick={() => removeTier(i)}
                  className="shrink-0 rounded-xl border border-red-200 bg-red-50 p-2 text-red-600 hover:bg-red-100 transition-colors cursor-pointer">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {tierForm.length === 0 && (
              <p className="text-xs text-gray-400">Belum ada tingkat apresiasi — tambahkan minimal satu.</p>
            )}
          </div>
        </div>

        <div className="mt-5 pt-5 border-t border-gray-100">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-sm font-semibold text-gray-900">Bagian Komitmen (Sebelum Bayar)</h4>
            <button onClick={addKomitmenSection}
              className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer">
              <Plus className="h-3.5 w-3.5" /> Tambah Bagian
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Ditampilkan berurutan di step &quot;Komitmen&quot; wizard pendaftaran publik, tepat sebelum step Bayar.
            Calon anggota wajib mencentang semua bagian untuk lanjut. Draft awal disalin dari materi lama —
            mohon periksa &amp; lengkapi teksnya (khususnya bagian yang masih terpotong) sebelum dipakai anggota sungguhan.
          </p>
          <div className="space-y-3">
            {komitmenForm.map((s, i) => (
              <div key={i} className="rounded-xl border border-gray-200 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-xs font-semibold text-gray-400 w-5">{i + 1}.</span>
                  <input
                    className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium outline-none focus:border-emerald-500"
                    placeholder="Judul bagian, mis. Pemahaman Akad"
                    value={s.title}
                    onChange={e => updateKomitmenSection(i, 'title', e.target.value)} />
                  <button onClick={() => removeKomitmenSection(i)}
                    className="shrink-0 rounded-xl border border-red-200 bg-red-50 p-2 text-red-600 hover:bg-red-100 transition-colors cursor-pointer">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <textarea rows={3}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 resize-none"
                  placeholder="Isi penjelasan bagian ini..."
                  value={s.body}
                  onChange={e => updateKomitmenSection(i, 'body', e.target.value)} />
                <input
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  placeholder="Teks checkbox persetujuan, mis. Saya memahami dan menyetujui ketentuan di atas."
                  value={s.checkbox_label}
                  onChange={e => updateKomitmenSection(i, 'checkbox_label', e.target.value)} />
              </div>
            ))}
            {komitmenForm.length === 0 && (
              <p className="text-xs text-gray-400">Belum ada bagian komitmen — tambahkan minimal satu.</p>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-2.5">
          <span className="text-sm text-emerald-700">Total Biaya Simpanan Keanggotaan (SPK)</span>
          <span className="text-sm font-semibold text-emerald-800">
            {fmt((Number(settingsForm.nominal_simpanan_pokok) || 0) + (Number(settingsForm.nominal_simpanan_wajib) || 0) + (Number(settingsForm.biaya_admin_pendaftaran) || 0))}
          </span>
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={handleSimpanSettings} disabled={pending}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer">
            {pending ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </button>
        </div>
      </div>

      <div className="flex gap-2 rounded-xl bg-gray-100 p-1 max-w-sm">
        <button type="button" onClick={() => setJenisFilter('MASUK')}
          className={cn('flex-1 rounded-lg py-2 text-sm font-medium transition-colors cursor-pointer',
            jenisFilter === 'MASUK' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500')}>
          Test Masuk
        </button>
        <button type="button" onClick={() => setJenisFilter('SAHABAT')}
          className={cn('flex-1 rounded-lg py-2 text-sm font-medium transition-colors cursor-pointer',
            jenisFilter === 'SAHABAT' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500')}>
          Test Sahabat
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Bank Soal {jenisFilter === 'MASUK' ? 'Test Masuk' : 'Test Sahabat (Upgrade)'}</h3>
          <p className={cn('text-sm', aktifCount < SOAL_MINIMAL[jenisFilter] ? 'text-red-600 font-medium' : 'text-gray-500')}>
            {aktifCount} soal aktif {aktifCount < SOAL_MINIMAL[jenisFilter] && `— minimal ${SOAL_MINIMAL[jenisFilter]} soal aktif dibutuhkan agar test bisa dimulai`}
          </p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors cursor-pointer">
          <Plus className="h-4 w-4" /> Tambah Soal
        </button>
      </div>

      <div className="space-y-3">
        {bankSoalFiltered.length === 0 && (
          <div className="rounded-2xl border border-gray-100 bg-white py-12 text-center text-gray-400">
            Belum ada soal di bank soal
          </div>
        )}
        {bankSoalFiltered.map(s => (
          <div key={s.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge text={s.is_active ? 'Aktif' : 'Nonaktif'}
                    cls={s.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'} />
                </div>
                <h4 className="font-medium text-gray-900 mt-1">{s.pertanyaan}</h4>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-500">
                  {(['A', 'B', 'C', 'D'] as const).map(opt => (
                    <div key={opt} className={cn(opt === s.jawaban_benar && 'font-semibold text-emerald-700')}>
                      {opt}. {s[`pilihan_${opt.toLowerCase()}` as 'pilihan_a']}
                      {opt === s.jawaban_benar && <CheckCircle className="inline h-3.5 w-3.5 ml-1" />}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => openEdit(s)}
                  className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <button onClick={() => handleHapus(s.id)} disabled={pending}
                  className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors cursor-pointer">
                  <Trash2 className="h-3.5 w-3.5" /> Hapus
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal open={!!modalSoal} onClose={() => setModalSoal(null)} title={modalSoal === 'new' ? 'Tambah Soal Baru' : 'Edit Soal'}>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Jenis Test *</label>
            <div className="flex gap-2 rounded-xl bg-gray-100 p-1">
              <button type="button" onClick={() => setForm(f => ({ ...f, jenis: 'MASUK' }))}
                className={cn('flex-1 rounded-lg py-2 text-sm font-medium transition-colors cursor-pointer',
                  form.jenis === 'MASUK' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500')}>
                Test Masuk
              </button>
              <button type="button" onClick={() => setForm(f => ({ ...f, jenis: 'SAHABAT' }))}
                className={cn('flex-1 rounded-lg py-2 text-sm font-medium transition-colors cursor-pointer',
                  form.jenis === 'SAHABAT' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500')}>
                Test Sahabat
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Pertanyaan *</label>
            <textarea rows={2}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 resize-none"
              value={form.pertanyaan} onChange={e => setForm(f => ({ ...f, pertanyaan: e.target.value }))} />
          </div>
          {(['a', 'b', 'c', 'd'] as const).map(opt => (
            <div key={opt} className="flex items-center gap-2">
              <input type="radio" name="jawaban_benar" className="h-4 w-4 cursor-pointer accent-emerald-600"
                checked={form.jawaban_benar === opt.toUpperCase()}
                onChange={() => setForm(f => ({ ...f, jawaban_benar: opt.toUpperCase() as 'A' | 'B' | 'C' | 'D' }))} />
              <input
                className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                placeholder={`Pilihan ${opt.toUpperCase()}`}
                value={form[`pilihan_${opt}` as 'pilihan_a']}
                onChange={e => setForm(f => ({ ...f, [`pilihan_${opt}`]: e.target.value }))} />
            </div>
          ))}
          <p className="text-xs text-gray-400">Pilih radio di sebelah kiri untuk menandai jawaban yang benar.</p>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalSoal(null)}
              className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
              Batal
            </button>
            <button onClick={handleSimpan} disabled={!formValid || pending}
              className="flex-1 rounded-xl bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer">
              {pending ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── TAB: PENGATURAN AKUN ─────────────────────────────────────────────────────

const ACCOUNT_TYPE_LABEL: Record<KojasmatAccountOption['type'], string> = {
  ASSET: 'Aset',
  LIABILITY: 'Liabilitas',
  EQUITY: 'Ekuitas',
  REVENUE: 'Pendapatan',
  EXPENSE: 'Beban',
}

const ACCOUNT_ROLE_GROUPS: { title: string; roles: KojasmatAccountRole[] }[] = [
  { title: 'Umum', roles: ['kas'] },
  { title: 'Simpanan Anggota', roles: ['simpanan_pokok', 'simpanan_wajib', 'simpanan_sukarela'] },
  { title: 'Pembiayaan Proyek', roles: ['dst_murabahah', 'dst_mudharabah', 'piutang_pembiayaan', 'bagi_hasil'] },
  { title: 'Ujrah Wakalah', roles: ['ujrah_murabahah', 'ujrah_mudharabah'] },
  { title: 'Administrasi & Proyek', roles: ['pendapatan_admin', 'pendapatan_proyek', 'beban_proyek'] },
  { title: 'Ijarah Platform', roles: ['pendapatan_ijarah'] },
]

function AccountRoleSelect({
  role, value, accounts, onChange,
}: {
  role: KojasmatAccountRole
  value: string
  accounts: KojasmatAccountOption[]
  onChange: (role: KojasmatAccountRole, value: string) => void
}) {
  const grouped = new Map<KojasmatAccountOption['type'], KojasmatAccountOption[]>()
  for (const account of accounts) {
    const list = grouped.get(account.type) || []
    list.push(account)
    grouped.set(account.type, list)
  }
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-gray-700">{KOJASMAT_ACCOUNT_ROLE_LABEL[role]}</label>
      <select
        value={value}
        onChange={(e) => onChange(role, e.target.value)}
        className="w-full cursor-pointer rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
      >
        <option value="">— Tidak dipetakan —</option>
        {Array.from(grouped.entries()).map(([type, list]) => (
          <optgroup key={type} label={ACCOUNT_TYPE_LABEL[type]}>
            {list.map((account) => (
              <option key={account.id} value={account.id}>{account.code} · {account.name}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  )
}

function TabPengaturanAkun({ orgId, accountMapping, accounts }: {
  orgId: string; accountMapping: KojasmatAccountMapping; accounts: KojasmatAccountOption[]
}) {
  const [pending, startTransition] = useTransition()
  const [draft, setDraft] = useState<KojasmatAccountMapping>(accountMapping)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const completedCount = KOJASMAT_ACCOUNT_ROLES.filter((role) => draft[role]).length

  function handleChange(role: KojasmatAccountRole, value: string) {
    setDraft((prev) => ({ ...prev, [role]: value || null }))
  }

  function handleSave() {
    setMessage(null)
    startTransition(async () => {
      const res = await saveKojasmatAccountMappingAction(orgId, draft)
      if (!res.success) {
        setMessage({ type: 'error', text: res.error || 'Pemetaan akun gagal disimpan.' })
        return
      }
      setMessage({ type: 'success', text: 'Pemetaan akun berhasil disimpan.' })
    })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-3">
        <p className="text-sm font-semibold text-blue-900">
          Pemetaan Akun COA ({completedCount}/{KOJASMAT_ACCOUNT_ROLES.length} terisi)
        </p>
        <p className="text-xs text-blue-700 mt-0.5">
          Tentukan akun mana dari Chart of Account koperasi ini yang dipakai tiap jenis jurnal.
          Peran yang belum dipetakan akan dilewati (transaksi tetap tercatat di modul,
          hanya belum masuk buku besar akuntansi).
        </p>
      </div>

      {message && (
        <div className={cn(
          'rounded-xl border px-4 py-3 text-sm font-semibold',
          message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'
        )}>
          {message.text}
        </div>
      )}

      {ACCOUNT_ROLE_GROUPS.map((group) => (
        <div key={group.title} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="mb-3 text-sm font-bold text-gray-900">{group.title}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {group.roles.map((role) => (
              <AccountRoleSelect
                key={role}
                role={role}
                value={draft[role] || ''}
                accounts={accounts}
                onChange={handleChange}
              />
            ))}
          </div>
        </div>
      ))}

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={pending}
          className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer">
          {pending ? 'Menyimpan...' : 'Simpan Pemetaan Akun'}
        </button>
      </div>
    </div>
  )
}

// ─── TAB: NOTIFIKASI WHATSAPP ─────────────────────────────────────────────────

function TabNotifikasi({ orgId, whatsappSettings, pesanOtomatis }: { orgId: string; whatsappSettings: TenantWhatsappConfig; pesanOtomatis: PesanOtomatisSettings }) {
  const [pending, startTransition] = useTransition()
  const [config, setConfig] = useState<TenantWhatsappConfig>(whatsappSettings)
  const [testPhone, setTestPhone] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [testMessage, setTestMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [pesanForm, setPesanForm] = useState<PesanOtomatisSettings>(pesanOtomatis)
  const [pesanMessage, setPesanMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function updatePesan(key: PesanOtomatisKey, field: 'body' | 'enabled', value: string | boolean) {
    setPesanForm(form => ({ ...form, [key]: { ...form[key], [field]: value } }))
  }

  function handleSimpanTemplate() {
    setPesanMessage(null)
    startTransition(async () => {
      const payload = Object.fromEntries(
        (Object.keys(pesanForm) as PesanOtomatisKey[]).map(k => [k, { body: pesanForm[k].body, enabled: pesanForm[k].enabled }])
      )
      const res = await updateModuleSettings(orgId, { pesan_otomatis: payload as unknown as Props['moduleSettings']['pesan_otomatis'] })
      if (res.error) { setPesanMessage({ type: 'error', text: res.error }); return }
      setPesanMessage({ type: 'success', text: 'Template pesan otomatis berhasil disimpan.' })
    })
  }

  function handleSave() {
    setMessage(null)
    startTransition(async () => {
      const res = await saveKojasmatWhatsappSettingsAction(orgId, config)
      if (!res.success) { setMessage({ type: 'error', text: res.error || 'Gagal menyimpan pengaturan.' }); return }
      setMessage({ type: 'success', text: 'Pengaturan notifikasi WhatsApp berhasil disimpan.' })
    })
  }

  function handleSendTest() {
    setTestMessage(null)
    startTransition(async () => {
      const res = await sendKojasmatTestWhatsappAction(orgId, testPhone)
      if (res.error) { setTestMessage({ type: 'error', text: res.error }); return }
      setTestMessage({ type: 'success', text: `Pesan uji coba berhasil dikirim ke ${testPhone}.` })
    })
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-emerald-700 font-bold mb-1">
          <MessageCircle size={20} />
          <h2 className="text-lg text-gray-900">Provider WhatsApp</h2>
        </div>
        <p className="text-xs text-gray-500 mb-5">
          Kojasmat mengirim konfirmasi WhatsApp (pendaftaran disetujui, setoran diverifikasi/ditolak) lewat{' '}
          <a href="https://dripsender.id" target="_blank" rel="noreferrer" className="text-emerald-700 underline">dripsender.id</a>.
        </p>

        {message && (
          <div className={cn(
            'mb-4 rounded-xl border px-4 py-3 text-sm font-semibold',
            message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'
          )}>
            {message.text}
          </div>
        )}

        <label className="flex items-center justify-between p-3.5 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition cursor-pointer mb-5">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={18} className="text-emerald-600" />
            <div>
              <span className="font-bold text-gray-900 text-sm block">Aktifkan Notifikasi WhatsApp</span>
              <span className="text-xs text-gray-500">Kalau dimatikan, konfirmasi WA otomatis tidak akan terkirim.</span>
            </div>
          </div>
          <input type="checkbox" checked={config.enabled}
            onChange={e => setConfig(c => ({ ...c, enabled: e.target.checked }))}
            className="h-5 w-5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer" />
        </label>

        <div>
          <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 mb-1">
            <Key size={13} /> API Key Dripsender
          </label>
          <input type="password"
            placeholder="Masukkan API key dari dashboard dripsender.id"
            value={config.dripsenderApiKey}
            onChange={e => setConfig(c => ({ ...c, dripsenderApiKey: e.target.value }))}
            className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm font-mono focus:border-emerald-500 focus:outline-none" />
          <p className="mt-1.5 text-xs text-gray-400">Disimpan terenkripsi, khusus untuk koperasi ini.</p>
        </div>

        <div className="flex justify-end mt-5">
          <button onClick={handleSave} disabled={pending}
            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer">
            {pending ? 'Menyimpan...' : 'Simpan Pengaturan WhatsApp'}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-emerald-700 font-bold mb-1">
          <FileText size={20} />
          <h2 className="text-lg text-gray-900">Template Pesan Otomatis</h2>
        </div>
        <p className="text-xs text-gray-500 mb-5">
          Pesan WhatsApp yang terkirim otomatis ke calon anggota/anggota di setiap tahap pendaftaran &amp; upgrade Sahabat. Gunakan <code className="text-xs bg-gray-100 rounded px-1 py-0.5">{'{{variabel}}'}</code> untuk menyisipkan info otomatis.
        </p>

        {pesanMessage && (
          <div className={cn(
            'mb-4 rounded-xl border px-4 py-3 text-sm font-semibold',
            pesanMessage.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'
          )}>
            {pesanMessage.text}
          </div>
        )}

        <div className="space-y-4">
          {(Object.keys(pesanForm) as PesanOtomatisKey[]).map(key => {
            const entry = pesanForm[key]
            return (
              <div key={key} className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{entry.label}</p>
                    <p className="text-xs text-gray-500">{entry.deskripsi}</p>
                  </div>
                  <label className="flex items-center gap-1.5 shrink-0 cursor-pointer">
                    <span className="text-xs text-gray-500">Aktif</span>
                    <input type="checkbox" checked={entry.enabled}
                      onChange={e => updatePesan(key, 'enabled', e.target.checked)}
                      className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer" />
                  </label>
                </div>
                <textarea rows={5}
                  value={entry.body}
                  onChange={e => updatePesan(key, 'body', e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-mono outline-none focus:border-emerald-500" />
                <p className="mt-1.5 text-xs text-gray-400">
                  Variabel tersedia: {entry.variabel.map(v => `{{${v}}}`).join(', ')}
                </p>
              </div>
            )
          })}
        </div>

        <div className="flex justify-end mt-5">
          <button onClick={handleSimpanTemplate} disabled={pending}
            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer">
            {pending ? 'Menyimpan...' : 'Simpan Template Pesan'}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-800 bg-gray-900 text-white p-6 shadow-xl">
        <div className="flex items-center gap-2 font-bold mb-1 text-emerald-400">
          <Send size={18} />
          <h2 className="text-lg text-white">Uji Coba Pengiriman WhatsApp</h2>
        </div>
        <p className="text-xs text-gray-300 mb-4">
          Simpan pengaturan dulu sebelum uji coba, supaya API key yang dipakai sudah yang terbaru.
        </p>

        {testMessage && (
          <div className={cn(
            'mb-4 p-3.5 rounded-xl border text-xs font-semibold',
            testMessage.type === 'success' ? 'bg-emerald-950 border-emerald-500/40 text-emerald-300' : 'bg-rose-950 border-rose-500/40 text-rose-300'
          )}>
            {testMessage.text}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <input type="tel"
            placeholder="Nomor WhatsApp tujuan uji coba, mis. 6281234567890"
            value={testPhone} onChange={e => setTestPhone(e.target.value)}
            className="flex-1 rounded-xl bg-white/10 border border-white/20 px-4 py-2.5 text-sm text-white placeholder-gray-400 focus:border-emerald-400 focus:outline-none" />
          <button onClick={handleSendTest} disabled={pending || !testPhone}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-gray-950 hover:bg-emerald-400 transition-colors cursor-pointer disabled:opacity-50 shrink-0">
            <MessageCircle size={16} />
            {pending ? 'Mengirim...' : 'Kirim Test WhatsApp'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ROOT CLIENT ──────────────────────────────────────────────────────────────

type ActiveTab = 'dashboard' | 'permohonan' | 'anggota' | 'proyek' | 'simpanan' | 'pelatihan' | 'laporan' | 'tindakan' | 'soal' | 'akun' | 'notifikasi'

export default function KojasmatClient({
  orgId, stats, anggota, proyek, pelatihan, pendaftaran, laporan, tindakan,
  bankSoal, moduleSettings, bankAccounts, qrisPreviewUrl, setoranPending,
  accountMapping, chartOfAccounts, whatsappSettings,
}: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard')
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const checkScroll = useCallback(() => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
      setCanScrollLeft(scrollLeft > 0)
      setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth)
    }
  }, [])

  useEffect(() => {
    checkScroll()
    window.addEventListener('resize', checkScroll)
    return () => window.removeEventListener('resize', checkScroll)
  }, [checkScroll])

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '') as ActiveTab
      const validTabs = ['dashboard', 'permohonan', 'anggota', 'proyek', 'simpanan', 'pelatihan', 'laporan', 'tindakan', 'soal', 'akun']
      if (validTabs.includes(hash)) {
        setActiveTab(hash)
      }
    }
    handleHash()
    window.addEventListener('hashchange', handleHash)
    return () => window.removeEventListener('hashchange', handleHash)
  }, [])

  const handleTabClick = (key: ActiveTab) => {
    setActiveTab(key)
    window.history.replaceState(null, '', `#${key}`)
  }

  const pendingPendaftaran = stats.antrian_pendaftaran ?? 0
  const tindakanAktif = tindakan.filter(t => t.status === 'AKTIF').length

  const tabs: { key: ActiveTab; label: string; icon: React.ElementType; badge?: number; badgeColor?: string }[] = [
    { key: 'dashboard',   label: 'Dashboard',    icon: LayoutDashboard },
    { key: 'permohonan',  label: 'Permohonan',   icon: ClipboardList,  badge: pendingPendaftaran || undefined, badgeColor: 'bg-amber-100 text-amber-700' },
    { key: 'anggota',     label: 'Anggota',       icon: Users,          badge: stats.total_anggota },
    { key: 'proyek',      label: 'Proyek',         icon: Briefcase,      badge: (stats.antrian_dmr + stats.antrian_dps) || undefined, badgeColor: 'bg-amber-100 text-amber-700' },
    { key: 'simpanan',    label: 'Simpanan',       icon: Wallet,        badge: setoranPending.length || undefined, badgeColor: 'bg-amber-100 text-amber-700' },
    { key: 'pelatihan',   label: 'Pelatihan',      icon: GraduationCap },
    { key: 'laporan',     label: 'Laporan',         icon: FileText,      badge: laporan.filter(l => l.status === 'DIKIRIM').length || undefined },
    { key: 'tindakan',    label: 'Tindakan',        icon: AlertTriangle, badge: tindakanAktif || undefined, badgeColor: 'bg-red-100 text-red-700' },
    { key: 'soal',        label: 'Bank Soal',       icon: BookOpen,      badge: bankSoal.filter(s => s.is_active && s.jenis === 'MASUK').length < SOAL_MINIMAL.MASUK ? bankSoal.filter(s => s.is_active && s.jenis === 'MASUK').length : undefined, badgeColor: 'bg-red-100 text-red-700' },
    { key: 'akun',        label: 'Pengaturan Akun', icon: Landmark,      badge: (KOJASMAT_ACCOUNT_ROLES.length - KOJASMAT_ACCOUNT_ROLES.filter(r => accountMapping[r]).length) || undefined, badgeColor: 'bg-amber-100 text-amber-700' },
    { key: 'notifikasi',  label: 'Notifikasi',      icon: MessageCircle, badge: whatsappSettings.enabled ? undefined : 1, badgeColor: 'bg-amber-100 text-amber-700' },
  ]

  return (
    <div className="min-h-screen bg-slate-50/40 pb-10">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600">
            <Star className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Kojasmat</h1>
            <p className="text-sm text-gray-500">Platform Koperasi Syariah — Pembiayaan &amp; Simpanan</p>
          </div>
        </div>

        <div className="relative mt-5 -mx-6 px-6 sm:mx-0 sm:px-0 group">
          <div 
            ref={scrollRef}
            onScroll={checkScroll}
            className="flex gap-1 overflow-x-auto snap-x snap-mandatory [&::-webkit-scrollbar]:hidden" 
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {tabs.map(t => (
              <button key={t.key} onClick={() => handleTabClick(t.key)}
                className={cn(
                  'snap-start flex-none flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer',
                  activeTab === t.key
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                )}>
                <t.icon className="h-4 w-4" />
                {t.label}
                {t.badge !== undefined && t.badge > 0 && (
                  <span className={cn('rounded-full px-1.5 py-0.5 text-xs font-semibold',
                    t.badgeColor ?? 'bg-gray-100 text-gray-600')}>
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
          {/* Scroll Fade Indicators with Chevron */}
          {canScrollLeft && (
            <button 
              onClick={() => scrollRef.current?.scrollBy({ left: -200, behavior: 'smooth' })}
              className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-white via-white/80 to-transparent flex items-center justify-start pl-1 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
            >
              <ChevronLeft className="h-5 w-5 drop-shadow-sm" />
            </button>
          )}
          {canScrollRight && (
            <button 
              onClick={() => scrollRef.current?.scrollBy({ left: 200, behavior: 'smooth' })}
              className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white via-white/80 to-transparent flex items-center justify-end pr-1 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
            >
              <ChevronRight className="h-5 w-5 drop-shadow-sm" />
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto px-4 pt-6">
        {activeTab === 'dashboard'  && <TabDashboard stats={stats} orgId={orgId} />}
        {activeTab === 'permohonan' && <TabPermohonan orgId={orgId} pendaftaran={pendaftaran} moduleSettings={moduleSettings} />}
        {activeTab === 'anggota'    && <TabAnggota orgId={orgId} anggota={anggota} />}
        {activeTab === 'proyek'     && <TabProyek orgId={orgId} proyek={proyek} anggota={anggota} />}
        {activeTab === 'simpanan'   && <TabSimpanan orgId={orgId} anggota={anggota} setoranPending={setoranPending} stats={stats} />}
        {activeTab === 'pelatihan'  && <TabPelatihan orgId={orgId} pelatihan={pelatihan} anggota={anggota} />}
        {activeTab === 'laporan'    && <TabLaporan laporan={laporan} />}
        {activeTab === 'tindakan'   && <TabTindakan orgId={orgId} anggota={anggota} proyek={proyek} tindakan={tindakan} />}
        {activeTab === 'soal'       && <TabBankSoal orgId={orgId} bankSoal={bankSoal} moduleSettings={moduleSettings} bankAccounts={bankAccounts} qrisPreviewUrl={qrisPreviewUrl} />}
        {activeTab === 'akun'       && <TabPengaturanAkun orgId={orgId} accountMapping={accountMapping} accounts={chartOfAccounts} />}
        {activeTab === 'notifikasi' && <TabNotifikasi orgId={orgId} whatsappSettings={whatsappSettings} pesanOtomatis={moduleSettings.pesan_otomatis} />}
      </div>
    </div>
  )
}
