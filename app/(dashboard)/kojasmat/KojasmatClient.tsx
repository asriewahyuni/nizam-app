'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import {
  Users, Briefcase, Wallet, GraduationCap, LayoutDashboard,
  Plus, Search, ChevronRight, CheckCircle, XCircle,
  ArrowUpCircle, Shield, Send, RefreshCw,
  TrendingUp, Banknote, Star, Clock, FileText,
  AlertTriangle, ClipboardList, Eye, Link2, ExternalLink
} from 'lucide-react'
import {
  createAnggota, updateAnggota,
  catatSimpananMutasi,
  createProyek, updateProyekStatus, submitProyekKeDPS,
  submitDpsReview, kirimPenawaranProyek,
  createPelatihan, daftarPesertaPelatihan,
  type KojasmatAnggota, type KojasmatProyek, type KojasmatPelatihan, type KojasmatStats,
} from '@/modules/kojasmat/actions/kojasmat.actions'
import {
  setujuiPendaftaran, tolakPendaftaran, mintaRevisiPendaftaran,
  getDokumenByRef, beriTindakan, selesaikanTindakan, ulasLaporan,
  type KojasmatPendaftaran, type KojasmatDokumen,
  type KojasmatLaporanProyek, type KojasmatTindakan,
} from '@/modules/kojasmat/actions/kojasmat-membership.actions'
import { seedKojasmatDummyData, resetAndReseedKojasmat } from '@/modules/kojasmat/actions/kojasmat-seeder.actions'

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
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

const STATUS_PROYEK: Record<string, { label: string; color: string }> = {
  DRAFT:       { label: 'Draft',       color: 'bg-gray-100 text-gray-600' },
  REVIEW_DPS:  { label: 'Review DPS',  color: 'bg-yellow-100 text-yellow-700' },
  DISETUJUI:   { label: 'Disetujui',   color: 'bg-blue-100 text-blue-700' },
  DITOLAK:     { label: 'Ditolak',     color: 'bg-red-100 text-red-700' },
  OPEN:        { label: 'Open',        color: 'bg-cyan-100 text-cyan-700' },
  TERPENUHI:   { label: 'Terpenuhi',   color: 'bg-indigo-100 text-indigo-700' },
  BERJALAN:    { label: 'Berjalan',    color: 'bg-emerald-100 text-emerald-700' },
  SELESAI:     { label: 'Selesai',     color: 'bg-emerald-200 text-emerald-800' },
  BAGI_HASIL:  { label: 'Bagi Hasil',  color: 'bg-purple-100 text-purple-700' },
  DITUTUP:     { label: 'Ditutup',     color: 'bg-gray-200 text-gray-500' },
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

// ─── TAB: DASHBOARD ───────────────────────────────────────────────────────────

function TabDashboard({ stats, orgId }: { stats: KojasmatStats; orgId: string }) {
  const [pending, startTransition] = useTransition()
  const [seedResult, setSeedResult] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)

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

      {stats.antrian_dps > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
          <Shield className="h-5 w-5 text-yellow-600 shrink-0" />
          <div>
            <p className="font-medium text-yellow-800">{stats.antrian_dps} proyek menunggu review DPS</p>
            <p className="text-sm text-yellow-600">Buka tab Proyek → Antrian DPS untuk meninjau</p>
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
    </div>
  )
}

// ─── TAB: ANGGOTA ─────────────────────────────────────────────────────────────

type AnggotaForm = {
  nama: string; nik: string; email: string; phone: string
  alamat: string; pekerjaan: string; joined_at: string; notes: string
  is_verified: boolean; status: string
}

const emptyAnggotaForm: AnggotaForm = {
  nama: '', nik: '', email: '', phone: '', alamat: '', pekerjaan: '', joined_at: '', notes: '',
  is_verified: false, status: 'CALON',
}

function TabAnggota({ orgId, anggota }: { orgId: string; anggota: KojasmatAnggota[] }) {
  const [pending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [selected, setSelected] = useState<KojasmatAnggota | null>(null)
  const [form, setForm] = useState<AnggotaForm>(emptyAnggotaForm)

  const filtered = anggota.filter(a =>
    a.nama.toLowerCase().includes(search.toLowerCase()) ||
    a.kode_anggota.toLowerCase().includes(search.toLowerCase())
  )

  function openEdit(a: KojasmatAnggota) {
    setSelected(a)
    setForm({ nama: a.nama, nik: a.nik ?? '', email: a.email ?? '', phone: a.phone ?? '',
              alamat: a.alamat ?? '', pekerjaan: a.pekerjaan ?? '',
              joined_at: a.joined_at ?? '', notes: a.notes ?? '',
              is_verified: a.is_verified, status: a.status })
    setModalOpen(true)
  }

  function openNew() {
    setSelected(null)
    setForm(emptyAnggotaForm)
    setModalOpen(true)
  }

  function handleSave() {
    startTransition(async () => {
      if (selected) {
        await updateAnggota(selected.id, {
          ...selected, ...form,
          status: form.status as KojasmatAnggota['status'],
        })
      } else {
        await createAnggota({ org_id: orgId, ...form })
      }
      setModalOpen(false)
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
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            placeholder="Cari nama atau kode..."
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors cursor-pointer">
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
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="py-10 text-center text-gray-400">Belum ada anggota</td></tr>
              )}
              {filtered.map(a => (
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
                      <a href={`/anggota/${a.kode_anggota}`} target="_blank"
                        className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-100 transition-colors cursor-pointer whitespace-nowrap">
                        <ExternalLink className="h-3.5 w-3.5" /> Portal
                      </a>
                      <button onClick={() => openEdit(a)}
                        className="rounded-lg p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer">
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
    </div>
  )
}

// ─── TAB: PROYEK ──────────────────────────────────────────────────────────────

type ProyekForm = {
  pengaju_id: string; nama_proyek: string; deskripsi: string
  jenis_akad: string; kebutuhan_modal: string
  ujrah_nominal: string
  durasi_bulan: string; agunan: string; notes: string
}

const emptyProyekForm: ProyekForm = {
  pengaju_id: '', nama_proyek: '', deskripsi: '',
  jenis_akad: 'MUDHARABAH', kebutuhan_modal: '',
  ujrah_nominal: '150000',
  durasi_bulan: '6', agunan: '', notes: ''
}

function TabProyek({ orgId, proyek, anggota }: {
  orgId: string; proyek: KojasmatProyek[]; anggota: KojasmatAnggota[]
}) {
  const [pending, startTransition] = useTransition()
  const [subTab, setSubTab] = useState<'semua' | 'dps'>('semua')
  const [modalNew, setModalNew] = useState(false)
  const [modalDps, setModalDps] = useState<KojasmatProyek | null>(null)
  const [modalPenawaran, setModalPenawaran] = useState<KojasmatProyek | null>(null)
  const [dpsForm, setDpsForm] = useState<{ keputusan: 'DISETUJUI' | 'DITOLAK' | 'REVISI'; catatan: string }>({ keputusan: 'DISETUJUI', catatan: '' })
  const [form, setForm] = useState<ProyekForm>(emptyProyekForm)
  const [penawaranIds, setPenawaranIds] = useState<string[]>([])

  const antrianDps = proyek.filter(p => p.status === 'REVIEW_DPS')
  const displayProyek = subTab === 'dps' ? antrianDps : proyek

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
        durasi_bulan: Number(form.durasi_bulan),
        agunan: form.agunan || undefined,
        notes: form.notes || undefined,
      })
      setModalNew(false)
      setForm(emptyProyekForm)
    })
  }

  function handleDpsReview() {
    if (!modalDps) return
    startTransition(async () => {
      await submitDpsReview({
        org_id: orgId,
        proyek_id: modalDps.id,
        keputusan: dpsForm.keputusan,
        catatan: dpsForm.catatan || undefined,
      })
      setModalDps(null)
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-1">
          {([
            ['semua', 'Semua Proyek'],
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
            {subTab === 'dps' ? 'Tidak ada proyek menunggu review DPS' : 'Belum ada proyek'}
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
                    Pengaju: {p.pengaju_nama ?? '—'} · {p.durasi_bulan} bulan
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-gray-900">{fmt(Number(p.kebutuhan_modal))}</p>
                  <p className="text-xs text-gray-400">Kebutuhan modal</p>
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
                  <button onClick={() => startTransition(() => { submitProyekKeDPS(p.id) })}
                    className="flex items-center gap-1.5 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-1.5 text-xs font-medium text-yellow-700 hover:bg-yellow-100 transition-colors cursor-pointer">
                    <Send className="h-3.5 w-3.5" /> Kirim ke DPS
                  </button>
                )}
                {p.status === 'REVIEW_DPS' && (
                  <button onClick={() => { setModalDps(p); setDpsForm({ keputusan: 'DISETUJUI' as const, catatan: '' }) }}
                    className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors cursor-pointer">
                    <Shield className="h-3.5 w-3.5" /> Review DPS
                  </button>
                )}
                {p.status === 'DISETUJUI' && (
                  <button onClick={() => handleStatus(p.id, 'OPEN')}
                    className="flex items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-medium text-cyan-700 hover:bg-cyan-100 transition-colors cursor-pointer">
                    <ArrowUpCircle className="h-3.5 w-3.5" /> Buka Pendanaan
                  </button>
                )}
                {p.status === 'OPEN' && (
                  <button onClick={() => { setModalPenawaran(p); setPenawaranIds([]) }}
                    className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer">
                    <Send className="h-3.5 w-3.5" /> Kirim Penawaran
                  </button>
                )}
                {p.status === 'TERPENUHI' && (
                  <button onClick={() => handleStatus(p.id, 'BERJALAN')}
                    className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer">
                    <RefreshCw className="h-3.5 w-3.5" /> Mulai Berjalan
                  </button>
                )}
                {p.status === 'BERJALAN' && (
                  <button onClick={() => handleStatus(p.id, 'SELESAI')}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer">
                    <CheckCircle className="h-3.5 w-3.5" /> Tandai Selesai
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal Proyek Baru */}
      <Modal open={modalNew} onClose={() => setModalNew(false)} title="Buat Proyek Baru">
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Pengaju Anggota *</label>
            <select
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              value={form.pengaju_id} onChange={e => setForm(f => ({ ...f, pengaju_id: e.target.value }))}>
              <option value="">— pilih anggota —</option>
              {anggota.map(a => <option key={a.id} value={a.id}>{a.kode_anggota} · {a.nama}</option>)}
            </select>
          </div>
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
              <option value="MUDHARABAH">Mudharabah — Modal Penuh Koperasi</option>
              <option value="MURABAHAH">Murabahah — Jual Beli Cicil</option>
              <option value="INAN">Musyarakah Inan — Modal Bersama</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Kebutuhan Modal (Rp) *</label>
              <input type="number"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="5000000"
                value={form.kebutuhan_modal} onChange={e => setForm(f => ({ ...f, kebutuhan_modal: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Durasi (bulan)</label>
              <input type="number"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                value={form.durasi_bulan} onChange={e => setForm(f => ({ ...f, durasi_bulan: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Ujrah Wakalah (Rp, nominal tetap)
              <span className="ml-1 font-normal text-gray-400 text-xs">— fee agen koperasi, bukan nisbah bagi hasil</span>
            </label>
            <input type="number" min="0" step="1000"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder="Contoh: 150000"
              value={form.ujrah_nominal}
              onChange={e => setForm(f => ({ ...f, ujrah_nominal: e.target.value }))} />
            <p className="mt-1 text-xs text-gray-400">
              Seluruh keuntungan proyek menjadi hak pemodal. Koperasi hanya menerima ujrah nominal ini sebagai biaya layanan wakalah.
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
      <Modal open={!!modalDps} onClose={() => setModalDps(null)} title="Review DPS">
        {modalDps && (
          <div className="space-y-4">
            <div className="rounded-xl bg-amber-50 p-4">
              <p className="font-medium text-amber-800">{modalDps.nama_proyek}</p>
              <p className="text-sm text-amber-600 mt-1">
                {modalDps.jenis_akad} · {fmt(Number(modalDps.kebutuhan_modal))} · {modalDps.durasi_bulan} bulan
              </p>
              {modalDps.deskripsi && <p className="text-sm text-amber-700 mt-2">{modalDps.deskripsi}</p>}
              {modalDps.agunan && <p className="text-xs text-amber-600 mt-1">Agunan: {modalDps.agunan}</p>}
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Keputusan DPS</label>
              <div className="flex gap-2">
                {(['DISETUJUI', 'REVISI', 'DITOLAK'] as const).map(k => (
                  <button key={k} onClick={() => setDpsForm(f => ({ ...f, keputusan: k }))}
                    className={cn('flex-1 rounded-xl border py-2 text-xs font-medium transition-colors cursor-pointer',
                      dpsForm.keputusan === k
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
              <label className="mb-1 block text-sm font-medium text-gray-700">Catatan DPS</label>
              <textarea rows={3}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 resize-none"
                placeholder="Catatan untuk pengaju..."
                value={dpsForm.catatan} onChange={e => setDpsForm(f => ({ ...f, catatan: e.target.value }))} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalDps(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
                Batal
              </button>
              <button onClick={handleDpsReview} disabled={pending}
                className="flex-1 rounded-xl bg-amber-500 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50 transition-colors cursor-pointer">
                {pending ? 'Menyimpan...' : 'Submit Review'}
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

function TabSimpanan({ orgId, anggota }: { orgId: string; anggota: KojasmatAnggota[] }) {
  const [pending, startTransition] = useTransition()
  const [selectedAnggota, setSelectedAnggota] = useState<KojasmatAnggota | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [mutasiError, setMutasiError] = useState<string | null>(null)
  const [mutasiSuccess, setMutasiSuccess] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({
    jenis_simpanan: 'WAJIB', jenis_mutasi: 'SETOR',
    jumlah: '', keterangan: '', tanggal: new Date().toISOString().split('T')[0]
  })

  const filtered = anggota.filter(a =>
    a.nama.toLowerCase().includes(search.toLowerCase()) ||
    a.kode_anggota.includes(search)
  )

  function handleMutasi() {
    if (!selectedAnggota) return
    setMutasiError(null)
    startTransition(async () => {
      const res = await catatSimpananMutasi({
        org_id: orgId,
        anggota_id: selectedAnggota.id,
        jenis_simpanan: form.jenis_simpanan as 'POKOK' | 'WAJIB' | 'SUKARELA',
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

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          placeholder="Cari anggota..."
          value={search} onChange={e => setSearch(e.target.value)}
        />
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
                <th className="px-4 py-3 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr><td colSpan={3} className="py-10 text-center text-gray-400">Tidak ada anggota</td></tr>
              )}
              {filtered.map(a => (
                <tr key={a.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{a.nama}</p>
                    <p className="text-xs text-gray-400 font-mono">{a.kode_anggota}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge text={a.status}
                      cls={a.status === 'AKTIF' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => { setSelectedAnggota(a); setModalOpen(true) }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer">
                      <Banknote className="h-3.5 w-3.5" /> Transaksi
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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

function TabPelatihan({ orgId, pelatihan, anggota }: {
  orgId: string; pelatihan: KojasmatPelatihan[]; anggota: KojasmatAnggota[]
}) {
  const [pending, startTransition] = useTransition()
  const [modalNew, setModalNew] = useState(false)
  const [modalDaftar, setModalDaftar] = useState<KojasmatPelatihan | null>(null)
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
              {p.status === 'TERJADWAL' && (
                <button onClick={() => { setModalDaftar(p); setSelectedAnggotaId('') }}
                  className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer shrink-0">
                  <Plus className="h-3.5 w-3.5" /> Daftarkan
                </button>
              )}
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

type KredensialAnggota = {
  kode_anggota: string
  nama: string
  login_identifier: string | null
  temp_password: string | null
}

function TabPermohonan({ orgId, pendaftaran }: { orgId: string; pendaftaran: KojasmatPendaftaran[] }) {
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useState<KojasmatPendaftaran | null>(null)
  const [dokumen, setDokumen] = useState<KojasmatDokumen[]>([])
  const [loadingDok, setLoadingDok] = useState(false)
  const [catatanForm, setCatatanForm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('MENUNGGU')
  const [actionResult, setActionResult] = useState<string | null>(null)
  const [kredensial, setKredensial] = useState<KredensialAnggota | null>(null)
  const [copied, setCopied] = useState(false)

  const filtered = pendaftaran.filter(p =>
    filterStatus === 'SEMUA' || p.status === filterStatus
  )

  async function openDetail(p: KojasmatPendaftaran) {
    setSelected(p)
    setCatatanForm('')
    setActionResult(null)
    setLoadingDok(true)
    try {
      const docs = await getDokumenByRef('PENDAFTARAN', p.id)
      // juga cek dokumen yang sudah dipindahkan ke ANGGOTA
      const docsAnggota = p.anggota_id ? await getDokumenByRef('ANGGOTA', p.anggota_id) : []
      setDokumen([...docs, ...docsAnggota])
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
    return [
      `Halo ${k.nama},`,
      ``,
      `Pendaftaran keanggotaan koperasi Anda telah *DISETUJUI* ✅`,
      ``,
      `*Kode Anggota:* ${k.kode_anggota}`,
      `*Login di:* ${appUrl}/login`,
      k.login_identifier ? `*Email/NIK:* ${k.login_identifier}` : null,
      k.temp_password ? `*Password:* ${k.temp_password}` : null,
      ``,
      `Silakan login dan ganti password setelah masuk pertama kali.`,
      `Selamat bergabung! 🤝`,
    ].filter(Boolean).join('\n')
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
              {selected.alasan_bergabung && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-400">Alasan Bergabung</p>
                  <p className="text-gray-700 text-sm">{selected.alasan_bergabung}</p>
                </div>
              )}
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

// ─── ROOT CLIENT ──────────────────────────────────────────────────────────────

type ActiveTab = 'dashboard' | 'permohonan' | 'anggota' | 'proyek' | 'simpanan' | 'pelatihan' | 'laporan' | 'tindakan'

export default function KojasmatClient({ orgId, stats, anggota, proyek, pelatihan, pendaftaran, laporan, tindakan }: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard')

  const pendingPendaftaran = stats.antrian_pendaftaran ?? 0
  const tindakanAktif = tindakan.filter(t => t.status === 'AKTIF').length

  const tabs: { key: ActiveTab; label: string; icon: React.ElementType; badge?: number; badgeColor?: string }[] = [
    { key: 'dashboard',   label: 'Dashboard',    icon: LayoutDashboard },
    { key: 'permohonan',  label: 'Permohonan',   icon: ClipboardList,  badge: pendingPendaftaran || undefined, badgeColor: 'bg-amber-100 text-amber-700' },
    { key: 'anggota',     label: 'Anggota',       icon: Users,          badge: stats.total_anggota },
    { key: 'proyek',      label: 'Proyek',         icon: Briefcase,      badge: stats.antrian_dps || undefined, badgeColor: 'bg-amber-100 text-amber-700' },
    { key: 'simpanan',    label: 'Simpanan',       icon: Wallet },
    { key: 'pelatihan',   label: 'Pelatihan',      icon: GraduationCap },
    { key: 'laporan',     label: 'Laporan',         icon: FileText,      badge: laporan.filter(l => l.status === 'DIKIRIM').length || undefined },
    { key: 'tindakan',    label: 'Tindakan',        icon: AlertTriangle, badge: tindakanAktif || undefined, badgeColor: 'bg-red-100 text-red-700' },
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

        <div className="mt-5 flex gap-1 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={cn(
                'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer',
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
      </div>

      <div className="mx-auto max-w-5xl px-4 pt-6">
        {activeTab === 'dashboard'  && <TabDashboard stats={stats} orgId={orgId} />}
        {activeTab === 'permohonan' && <TabPermohonan orgId={orgId} pendaftaran={pendaftaran} />}
        {activeTab === 'anggota'    && <TabAnggota orgId={orgId} anggota={anggota} />}
        {activeTab === 'proyek'     && <TabProyek orgId={orgId} proyek={proyek} anggota={anggota} />}
        {activeTab === 'simpanan'   && <TabSimpanan orgId={orgId} anggota={anggota} />}
        {activeTab === 'pelatihan'  && <TabPelatihan orgId={orgId} pelatihan={pelatihan} anggota={anggota} />}
        {activeTab === 'laporan'    && <TabLaporan laporan={laporan} />}
        {activeTab === 'tindakan'   && <TabTindakan orgId={orgId} anggota={anggota} proyek={proyek} tindakan={tindakan} />}
      </div>
    </div>
  )
}
