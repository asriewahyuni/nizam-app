'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import {
  Users, Briefcase, PiggyBank, GraduationCap, LayoutDashboard,
  Plus, Search, ChevronRight, CheckCircle, XCircle,
  ArrowUpCircle, Shield, Send, RefreshCw,
  TrendingUp, Banknote, Star, Clock
} from 'lucide-react'
import {
  createAnggota, updateAnggota,
  catatSimpananMutasi,
  createProyek, updateProyekStatus, submitProyekKeDPS,
  submitDpsReview, kirimPenawaranProyek,
  createPelatihan, daftarPesertaPelatihan,
  type KojasmatAnggota, type KojasmatProyek, type KojasmatPelatihan, type KojasmatStats,
} from '@/modules/kojasmat/actions/kojasmat.actions'
import { seedKojasmatDummyData } from '@/modules/kojasmat/actions/kojasmat-seeder.actions'

// ─── TYPES ────────────────────────────────────────────────────────────────────

type Props = {
  orgId: string
  stats: KojasmatStats
  anggota: KojasmatAnggota[]
  proyek: KojasmatProyek[]
  pelatihan: KojasmatPelatihan[]
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} label="Total Anggota" value={stats.total_anggota} sub={`${stats.anggota_aktif} aktif`} />
        <StatCard icon={Briefcase} label="Total Proyek" value={stats.total_proyek} sub={`${stats.proyek_berjalan} berjalan`} />
        <StatCard icon={PiggyBank} label="Total Simpanan" value={fmt(Number(stats.total_simpanan))} />
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

      {/* Dummy Data Section */}
      {stats.total_anggota === 0 && (
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
      )}

      {seedResult && (
        <div className={cn('rounded-xl border p-4 text-sm',
          seedResult.startsWith('Gagal')
            ? 'border-red-200 bg-red-50 text-red-700'
            : 'border-emerald-200 bg-emerald-50 text-emerald-700')}>
          {seedResult}
        </div>
      )}

      {/* Konfirmasi Modal */}
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
    </div>
  )
}

// ─── TAB: ANGGOTA ─────────────────────────────────────────────────────────────

type AnggotaForm = {
  nama: string; nik: string; email: string; phone: string
  alamat: string; pekerjaan: string; joined_at: string; notes: string
}

const emptyAnggotaForm: AnggotaForm = {
  nama: '', nik: '', email: '', phone: '', alamat: '', pekerjaan: '', joined_at: '', notes: ''
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
              joined_at: a.joined_at ?? '', notes: a.notes ?? '' })
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
        await updateAnggota(selected.id, { ...selected, ...form })
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
                <th className="px-4 py-3 w-10" />
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
                    {a.is_verified
                      ? <CheckCircle className="h-4 w-4 text-emerald-500" />
                      : <XCircle className="h-4 w-4 text-gray-300" />}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{a.joined_at ? String(a.joined_at).split('T')[0] : '—'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => openEdit(a)}
                      className="rounded-lg p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer">
                      <ChevronRight className="h-4 w-4" />
                    </button>
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
  ujrah_pct: string
  durasi_bulan: string; agunan: string; notes: string
}

const emptyProyekForm: ProyekForm = {
  pengaju_id: '', nama_proyek: '', deskripsi: '',
  jenis_akad: 'MUDHARABAH', kebutuhan_modal: '',
  ujrah_pct: '5',
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
        ujrah_pct: Number(form.ujrah_pct),
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
              Ujrah Wakalah (% dari modal)
              <span className="ml-1 font-normal text-gray-400 text-xs">— fee agen koperasi, bukan nisbah bagi hasil</span>
            </label>
            <input type="number" min="0" max="100" step="0.5"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              value={form.ujrah_pct}
              onChange={e => setForm(f => ({ ...f, ujrah_pct: e.target.value }))} />
            <p className="mt-1 text-xs text-gray-400">
              Seluruh keuntungan proyek menjadi hak pemodal. Koperasi hanya menerima ujrah ini sebagai biaya layanan wakalah.
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

// ─── ROOT CLIENT ──────────────────────────────────────────────────────────────

type ActiveTab = 'dashboard' | 'anggota' | 'proyek' | 'simpanan' | 'pelatihan'

export default function KojasmatClient({ orgId, stats, anggota, proyek, pelatihan }: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard')

  const tabs: { key: ActiveTab; label: string; icon: React.ElementType; badge?: number }[] = [
    { key: 'dashboard', label: 'Dashboard',  icon: LayoutDashboard },
    { key: 'anggota',   label: 'Anggota',    icon: Users,          badge: stats.total_anggota },
    { key: 'proyek',    label: 'Proyek',      icon: Briefcase,     badge: stats.antrian_dps || undefined },
    { key: 'simpanan',  label: 'Simpanan',    icon: PiggyBank },
    { key: 'pelatihan', label: 'Pelatihan',   icon: GraduationCap },
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
              {t.badge !== undefined && (
                <span className={cn('rounded-full px-1.5 py-0.5 text-xs font-semibold',
                  t.key === 'proyek' && t.badge > 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600')}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pt-6">
        {activeTab === 'dashboard'  && <TabDashboard stats={stats} orgId={orgId} />}
        {activeTab === 'anggota'    && <TabAnggota orgId={orgId} anggota={anggota} />}
        {activeTab === 'proyek'     && <TabProyek orgId={orgId} proyek={proyek} anggota={anggota} />}
        {activeTab === 'simpanan'   && <TabSimpanan orgId={orgId} anggota={anggota} />}
        {activeTab === 'pelatihan'  && <TabPelatihan orgId={orgId} pelatihan={pelatihan} anggota={anggota} />}
      </div>
    </div>
  )
}
