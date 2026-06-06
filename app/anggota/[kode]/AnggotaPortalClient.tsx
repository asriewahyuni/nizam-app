'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import {
  PiggyBank, Briefcase, Bell, LogOut, TrendingUp,
  CheckCircle, Clock, ArrowUpCircle, ArrowDownCircle,
  ChevronRight, Star, GraduationCap
} from 'lucide-react'
import {
  createProyek, updateStatusPenawaran, createPembiayaan,
  type KojasmatAnggota, type KojasmatProyek, type KojasmatSimpanan,
  type KojasmatPenawaran, type KojasmatPembiayaan,
} from '@/modules/kojasmat/actions/kojasmat.actions'

// ─── TYPES ────────────────────────────────────────────────────────────────────

type Props = {
  anggota: KojasmatAnggota
  simpanan: KojasmatSimpanan[]
  proyekDiajukan: KojasmatProyek[]
  pembiayaan: KojasmatPembiayaan[]
  penawaran: KojasmatPenawaran[]
  orgNama: string
}

type ActiveTab = 'beranda' | 'simpanan' | 'proyek' | 'penawaran'

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
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

// ─── MODAL ────────────────────────────────────────────────────────────────────

function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">{title}</h2>
        {children}
      </div>
    </div>
  )
}

// ─── TAB: BERANDA ─────────────────────────────────────────────────────────────

function TabBeranda({ anggota, simpanan, proyekDiajukan, pembiayaan, penawaran }: Props) {
  const totalSimpanan = simpanan.reduce((s, x) => s + Number(x.saldo), 0)
  const proyekAktif = proyekDiajukan.filter(p => p.status === 'BERJALAN').length
  const penawaranBaru = penawaran.filter(p => p.status === 'TERKIRIM').length

  return (
    <div className="space-y-6">
      {/* Saldo summary */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 p-6 text-white shadow-lg">
        <p className="text-emerald-100 text-sm">Total Simpanan Anda</p>
        <p className="mt-2 text-3xl font-bold">{fmt(totalSimpanan)}</p>
        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-emerald-500 pt-4">
          {[
            { label: 'Pokok',    jenis: 'POKOK' },
            { label: 'Wajib',    jenis: 'WAJIB' },
            { label: 'Sukarela', jenis: 'SUKARELA' },
          ].map(({ label, jenis }) => {
            const s = simpanan.find(x => x.jenis === jenis)
            return (
              <div key={jenis} className="text-center">
                <p className="text-xs text-emerald-200">{label}</p>
                <p className="mt-0.5 font-semibold text-sm">{fmt(Number(s?.saldo ?? 0))}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-100 bg-white p-4 text-center shadow-sm">
          <Briefcase className="h-5 w-5 text-blue-500 mx-auto" />
          <p className="mt-1 text-xl font-bold text-gray-900">{proyekDiajukan.length}</p>
          <p className="text-xs text-gray-400">Proyek Saya</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 text-center shadow-sm">
          <TrendingUp className="h-5 w-5 text-emerald-500 mx-auto" />
          <p className="mt-1 text-xl font-bold text-gray-900">{pembiayaan.length}</p>
          <p className="text-xs text-gray-400">Dibiayai</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 text-center shadow-sm">
          <Bell className="h-5 w-5 text-amber-500 mx-auto" />
          <p className="mt-1 text-xl font-bold text-gray-900">{penawaranBaru}</p>
          <p className="text-xs text-gray-400">Penawaran</p>
        </div>
      </div>

      {/* Verifikasi banner */}
      {!anggota.is_verified && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-3">
            <GraduationCap className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-medium text-amber-800 text-sm">Akun belum terverifikasi</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Ikuti pelatihan koperasi yang dijadwalkan untuk memverifikasi keanggotaan Anda.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Proyek aktif */}
      {proyekAktif > 0 && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
            <p className="font-medium text-emerald-800 text-sm">{proyekAktif} proyek sedang berjalan</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── TAB: SIMPANAN ────────────────────────────────────────────────────────────

function TabSimpanan({ simpanan }: { simpanan: KojasmatSimpanan[] }) {
  const jenisInfo = {
    POKOK:    { label: 'Simpanan Pokok',    desc: 'Dibayarkan sekali saat pertama bergabung', color: 'bg-blue-50 border-blue-100' },
    WAJIB:    { label: 'Simpanan Wajib',    desc: 'Dibayarkan rutin setiap bulan', color: 'bg-emerald-50 border-emerald-100' },
    SUKARELA: { label: 'Simpanan Sukarela', desc: 'Tabungan bebas, bisa ditarik kapan saja', color: 'bg-purple-50 border-purple-100' },
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Saldo simpanan Anda per rekening:</p>
      {(['POKOK', 'WAJIB', 'SUKARELA'] as const).map(jenis => {
        const s = simpanan.find(x => x.jenis === jenis)
        const info = jenisInfo[jenis]
        return (
          <div key={jenis} className={cn('rounded-2xl border p-5', info.color)}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">{info.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{info.desc}</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-gray-900">{fmt(Number(s?.saldo ?? 0))}</p>
              </div>
            </div>
          </div>
        )
      })}
      <p className="text-xs text-gray-400 text-center mt-4">
        Untuk setoran atau penarikan, hubungi admin koperasi.
      </p>
    </div>
  )
}

// ─── TAB: PROYEK ──────────────────────────────────────────────────────────────

function TabProyek({ anggota, orgId, proyekDiajukan, pembiayaan }: {
  anggota: KojasmatAnggota; orgId?: string; proyekDiajukan: KojasmatProyek[]; pembiayaan: KojasmatPembiayaan[]
}) {
  const [pending, startTransition] = useTransition()
  const [modalNew, setModalNew] = useState(false)
  const [form, setForm] = useState({
    nama_proyek: '', deskripsi: '',
    jenis_akad: 'MUDHARABAH', kebutuhan_modal: '',
    durasi_bulan: '6', agunan: '',
  })

  function handleCreate() {
    if (!orgId) return
    startTransition(async () => {
      await createProyek({
        org_id: orgId,
        pengaju_id: anggota.id,
        nama_proyek: form.nama_proyek,
        deskripsi: form.deskripsi || undefined,
        jenis_akad: form.jenis_akad as 'MURABAHAH' | 'MUDHARABAH' | 'INAN',
        kebutuhan_modal: Number(form.kebutuhan_modal),
        durasi_bulan: Number(form.durasi_bulan),
        agunan: form.agunan || undefined,
      })
      setModalNew(false)
      setForm({ nama_proyek: '', deskripsi: '', jenis_akad: 'MUDHARABAH', kebutuhan_modal: '', durasi_bulan: '6', agunan: '' })
    })
  }

  return (
    <div className="space-y-4">
      {/* Proyek yang diajukan */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800">Proyek yang Saya Ajukan</h3>
          {anggota.is_verified && (
            <button onClick={() => setModalNew(true)}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-colors cursor-pointer">
              + Ajukan Proyek
            </button>
          )}
        </div>

        {proyekDiajukan.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-8 text-center text-sm text-gray-400">
            {anggota.is_verified
              ? 'Belum ada proyek yang diajukan'
              : 'Verifikasi keanggotaan terlebih dahulu untuk mengajukan proyek'}
          </div>
        ) : (
          <div className="space-y-3">
            {proyekDiajukan.map(p => {
              const st = STATUS_LABEL[p.status] ?? { label: p.status, color: 'bg-gray-100 text-gray-600' }
              return (
                <div key={p.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge text={st.label} cls={st.color} />
                        <Badge text={AKAD_LABEL[p.jenis_akad] ?? p.jenis_akad} cls="bg-gray-100 text-gray-600" />
                      </div>
                      <p className="font-medium text-gray-900 text-sm">{p.nama_proyek}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{p.durasi_bulan} bulan · {p.kode_proyek}</p>
                    </div>
                    <p className="font-bold text-gray-900 text-sm shrink-0">{fmt(Number(p.kebutuhan_modal))}</p>
                  </div>
                  {Number(p.modal_terkumpul) > 0 && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Terkumpul: {fmt(Number(p.modal_terkumpul))}</span>
                        <span>{Math.round(Number(p.modal_terkumpul) / Number(p.kebutuhan_modal) * 100)}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-gray-100">
                        <div className="h-1.5 rounded-full bg-emerald-500"
                          style={{ width: `${Math.min(100, Number(p.modal_terkumpul) / Number(p.kebutuhan_modal) * 100)}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Proyek yang dibiayai */}
      {pembiayaan.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-800 mb-3">Proyek yang Saya Biayai</h3>
          <div className="space-y-3">
            {pembiayaan.map((pm: KojasmatPembiayaan & {
              nama_proyek?: string; jenis_akad?: string; proyek_status?: string; ujrah_pct?: number
            }) => (
              <div key={pm.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{pm.nama_proyek ?? '—'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Porsi: {Number(pm.porsi_pct).toFixed(1)}% · 100% keuntungan untuk pemodal
                    </p>
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
        </div>
      )}

      {/* Modal Ajukan Proyek */}
      <Modal open={modalNew} onClose={() => setModalNew(false)} title="Ajukan Proyek Baru">
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Nama Proyek *</label>
            <input
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder="Contoh: Usaha Konveksi"
              value={form.nama_proyek} onChange={e => setForm(f => ({ ...f, nama_proyek: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Jenis Akad *</label>
            <select
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              value={form.jenis_akad} onChange={e => setForm(f => ({ ...f, jenis_akad: e.target.value }))}>
              <option value="MUDHARABAH">Mudharabah — Modal dari Koperasi</option>
              <option value="MURABAHAH">Murabahah — Pembelian Cicil</option>
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
            <label className="mb-1 block text-sm font-medium text-gray-700">Agunan / Jaminan</label>
            <input
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder="Contoh: BPKB Motor"
              value={form.agunan} onChange={e => setForm(f => ({ ...f, agunan: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Deskripsi Usaha</label>
            <textarea rows={3}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 resize-none"
              placeholder="Jelaskan usaha Anda secara singkat..."
              value={form.deskripsi} onChange={e => setForm(f => ({ ...f, deskripsi: e.target.value }))} />
          </div>
          <p className="text-xs text-gray-400">
            Proyek Anda akan diajukan ke DPS untuk ditinjau sebelum dibuka pendanaan.
          </p>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalNew(false)}
              className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
              Batal
            </button>
            <button onClick={handleCreate} disabled={!form.nama_proyek || !form.kebutuhan_modal || pending}
              className="flex-1 rounded-xl bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer">
              {pending ? 'Mengajukan...' : 'Ajukan Proyek'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── TAB: PENAWARAN ───────────────────────────────────────────────────────────

function TabPenawaran({ anggota, penawaran, orgId }: {
  anggota: KojasmatAnggota; penawaran: KojasmatPenawaran[]; orgId?: string
}) {
  const [pending, startTransition] = useTransition()
  const [modalBiayai, setModalBiayai] = useState<KojasmatPenawaran | null>(null)
  const [jumlah, setJumlah] = useState('')

  function handleTandai(id: string, status: string) {
    startTransition(async () => { await updateStatusPenawaran(id, status) })
  }

  function handleBiayai() {
    if (!modalBiayai || !orgId) return
    startTransition(async () => {
      await createPembiayaan({
        org_id: orgId,
        proyek_id: modalBiayai.proyek_id,
        pemodal_id: anggota.id,
        jumlah: Number(jumlah),
      })
      await updateStatusPenawaran(modalBiayai.id, 'BERMINAT')
      setModalBiayai(null)
      setJumlah('')
    })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Penawaran proyek yang dikirim untuk Anda:</p>

      {penawaran.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-10 text-center text-sm text-gray-400">
          Belum ada penawaran proyek untuk Anda
        </div>
      )}

      {penawaran.map(p => {
        const sisa = Number(p.kebutuhan_modal ?? 0) - Number(p.modal_terkumpul ?? 0)
        return (
          <div key={p.id} className={cn('rounded-xl border bg-white p-4 shadow-sm',
            p.status === 'TERKIRIM' ? 'border-emerald-200' : 'border-gray-100')}>
            {p.status === 'TERKIRIM' && (
              <div className="mb-2 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-medium text-emerald-600">Baru</span>
              </div>
            )}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="font-medium text-gray-900 text-sm">{p.nama_proyek ?? '—'}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {AKAD_LABEL[p.jenis_akad ?? ''] ?? p.jenis_akad} · {p.durasi_bulan ?? '?'} bulan
                </p>
                <div className="mt-2 flex gap-3 text-xs text-gray-600">
                  <span>Modal: <strong>{fmt(Number(p.kebutuhan_modal ?? 0))}</strong></span>
                  <span>Ujrah koperasi: <strong>{p.ujrah_pct ?? 5}%</strong> dari modal</span>
                </div>
                <p className="text-xs text-emerald-600 mt-1">Sisa kebutuhan: {fmt(sisa)}</p>
              </div>
            </div>

            {(p.status === 'TERKIRIM' || p.status === 'DIBACA') && p.proyek_status === 'OPEN' && (
              <div className="mt-3 flex gap-2">
                <button onClick={() => { setModalBiayai(p); setJumlah('') }}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-colors cursor-pointer">
                  <ArrowUpCircle className="h-3.5 w-3.5" /> Saya Mau Biayai
                </button>
                <button onClick={() => handleTandai(p.id, 'DIABAIKAN')} disabled={pending}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors cursor-pointer">
                  <ArrowDownCircle className="h-3.5 w-3.5" /> Lewatkan
                </button>
              </div>
            )}
            {p.status === 'BERMINAT' && (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-600">
                <CheckCircle className="h-3.5 w-3.5" /> Anda sudah berpartisipasi membiayai proyek ini
              </div>
            )}
            {p.status === 'DIABAIKAN' && (
              <p className="mt-2 text-xs text-gray-400">Penawaran dilewatkan</p>
            )}
          </div>
        )
      })}

      {/* Modal Biayai */}
      <Modal open={!!modalBiayai} onClose={() => setModalBiayai(null)} title="Biayai Proyek">
        {modalBiayai && (
          <div className="space-y-4">
            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="font-medium text-emerald-800">{modalBiayai.nama_proyek}</p>
              <p className="text-sm text-emerald-600 mt-1">
                Sisa kebutuhan: {fmt(Number(modalBiayai.kebutuhan_modal ?? 0) - Number(modalBiayai.modal_terkumpul ?? 0))}
              </p>
              <p className="text-xs text-emerald-600 mt-0.5">
                100% keuntungan untuk pemodal · Ujrah koperasi: {modalBiayai.ujrah_pct ?? 5}% dari modal
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Jumlah Pembiayaan (Rp) *</label>
              <input type="number"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="1000000"
                value={jumlah} onChange={e => setJumlah(e.target.value)} />
              <p className="mt-1 text-xs text-gray-400">
                Maks: {fmt(Number(modalBiayai.kebutuhan_modal ?? 0) - Number(modalBiayai.modal_terkumpul ?? 0))}
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalBiayai(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
                Batal
              </button>
              <button onClick={handleBiayai} disabled={!jumlah || pending}
                className="flex-1 rounded-xl bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer">
                {pending ? 'Memproses...' : 'Konfirmasi Pembiayaan'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────

export default function AnggotaPortalClient(props: Props) {
  const { anggota, simpanan, proyekDiajukan, pembiayaan, penawaran, orgNama } = props
  const [activeTab, setActiveTab] = useState<ActiveTab>('beranda')

  const tabs: { key: ActiveTab; label: string; icon: React.ElementType; badge?: number }[] = [
    { key: 'beranda',   label: 'Beranda',   icon: Star },
    { key: 'simpanan',  label: 'Simpanan',  icon: PiggyBank },
    { key: 'proyek',    label: 'Proyek',    icon: Briefcase },
    { key: 'penawaran', label: 'Penawaran', icon: Bell,
      badge: penawaran.filter(p => p.status === 'TERKIRIM').length || undefined },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 z-30 border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400">{orgNama}</p>
            <h1 className="font-bold text-gray-900">{anggota.nama}</h1>
            <p className="text-xs font-mono text-emerald-600">{anggota.kode_anggota}</p>
          </div>
          <div className="flex items-center gap-2">
            {anggota.is_verified && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                <CheckCircle className="h-3 w-3" /> Terverifikasi
              </span>
            )}
            <a href="/logout"
              className="rounded-full p-2 text-gray-400 hover:bg-gray-100 transition-colors cursor-pointer">
              <LogOut className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-lg px-4 py-6 pb-24">
        {activeTab === 'beranda'   && <TabBeranda {...props} />}
        {activeTab === 'simpanan'  && <TabSimpanan simpanan={simpanan} />}
        {activeTab === 'proyek'    && (
          <TabProyek anggota={anggota} orgId={anggota.org_id}
            proyekDiajukan={proyekDiajukan} pembiayaan={pembiayaan} />
        )}
        {activeTab === 'penawaran' && (
          <TabPenawaran anggota={anggota} penawaran={penawaran} orgId={anggota.org_id} />
        )}
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-lg">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={cn('relative flex flex-1 flex-col items-center gap-1 py-3 transition-colors cursor-pointer',
                activeTab === t.key ? 'text-emerald-600' : 'text-gray-400')}>
              <t.icon className="h-5 w-5" />
              <span className="text-xs font-medium">{t.label}</span>
              {t.badge !== undefined && (
                <span className="absolute top-2 right-1/4 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
