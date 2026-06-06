'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import {
  PiggyBank, Briefcase, Bell, LogOut, TrendingUp,
  CheckCircle, ArrowUpCircle, ArrowDownCircle,
  Star, GraduationCap, FileText, Send, Upload, XCircle,
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

// Upload satu dokumen proyek ke S3 lalu simpan metadata
async function uploadDokumenProyek(
  file: File,
  orgId: string,
  refType: string,
): Promise<{ key: string; name: string } | null> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('org_id', orgId)
  fd.append('ref_type', refType)
  const res = await fetch('/api/kojasmat/upload', { method: 'POST', body: fd })
  if (!res.ok) return null
  const { key, name } = await res.json() as { key: string; name: string }
  return { key, name }
}

function TabProyek({ anggota, orgId, proyekDiajukan, pembiayaan }: {
  anggota: KojasmatAnggota; orgId?: string; proyekDiajukan: KojasmatProyek[]; pembiayaan: KojasmatPembiayaan[]
}) {
  const [pending, startTransition] = useTransition()
  const [modalNew, setModalNew] = useState(false)
  const [uploadingDok, setUploadingDok] = useState(false)
  const [uploadedDoks, setUploadedDoks] = useState<{ key: string; name: string; jenis: string }[]>([])
  const [form, setForm] = useState({
    nama_proyek: '', deskripsi: '',
    jenis_akad: 'MUDHARABAH', kebutuhan_modal: '',
    durasi_bulan: '6', agunan: '',
    nisbah_pengaju: 30,
  })

  const nisbah_pemodal = 100 - form.nisbah_pengaju

  async function handleDokUpload(jenis: string, file: File) {
    if (!orgId) return
    setUploadingDok(true)
    const result = await uploadDokumenProyek(file, orgId, 'PROYEK')
    setUploadingDok(false)
    if (result) setUploadedDoks(prev => [...prev.filter(d => d.jenis !== jenis), { ...result, jenis }])
  }

  function removeDok(jenis: string) {
    setUploadedDoks(prev => prev.filter(d => d.jenis !== jenis))
  }

  function resetModal() {
    setModalNew(false)
    setForm({ nama_proyek: '', deskripsi: '', jenis_akad: 'MUDHARABAH', kebutuhan_modal: '', durasi_bulan: '6', agunan: '', nisbah_pengaju: 30 })
    setUploadedDoks([])
  }

  function handleCreate() {
    if (!orgId) return
    startTransition(async () => {
      const res = await createProyek({
        org_id: orgId,
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
      // Simpan dokumen yang sudah di-upload ke referensi proyek baru
      if (res.data && 'id' in res.data && uploadedDoks.length > 0) {
        const proyekId = (res.data as { id: string }).id
        for (const dok of uploadedDoks) {
          await simpanDokumen({
            org_id: orgId,
            referensi_type: 'PROYEK',
            referensi_id: proyekId,
            jenis_dokumen: dok.jenis as KojasmatDokumen['jenis_dokumen'],
            nama_file: dok.name,
            file_key: dok.key,
          })
        }
      }
      resetModal()
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
              nama_proyek?: string; jenis_akad?: string; proyek_status?: string; ujrah_nominal?: number
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
      <Modal open={modalNew} onClose={resetModal} title="Ajukan Proyek Baru">
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Nama Proyek *</label>
            <input
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              placeholder="Contoh: Usaha Konveksi"
              value={form.nama_proyek} onChange={e => setForm(f => ({ ...f, nama_proyek: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Jenis Akad *</label>
            <select
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
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
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                placeholder="5000000"
                value={form.kebutuhan_modal} onChange={e => setForm(f => ({ ...f, kebutuhan_modal: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Durasi (bulan)</label>
              <input type="number"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                value={form.durasi_bulan} onChange={e => setForm(f => ({ ...f, durasi_bulan: e.target.value }))} />
            </div>
          </div>

          {/* Nisbah Syirkah */}
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
            <label className="mb-2 block text-sm font-semibold text-blue-800">
              Pembagian Keuntungan (Nisbah Syirkah)
            </label>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs text-blue-700 w-28">Pengaju (Anda)</span>
              <input type="range" min={10} max={90} step={5}
                className="flex-1 accent-emerald-600 cursor-pointer"
                value={form.nisbah_pengaju}
                onChange={e => setForm(f => ({ ...f, nisbah_pengaju: Number(e.target.value) }))} />
              <span className="text-sm font-bold text-emerald-700 w-8 text-right">{form.nisbah_pengaju}%</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-blue-700 w-28">Pemodal</span>
              <div className="flex-1 h-2 rounded-full bg-blue-200">
                <div className="h-2 rounded-full bg-blue-500 transition-all"
                  style={{ width: `${nisbah_pemodal}%` }} />
              </div>
              <span className="text-sm font-bold text-blue-700 w-8 text-right">{nisbah_pemodal}%</span>
            </div>
            <p className="mt-1.5 text-xs text-blue-600">
              Koperasi menerima ujrah (biaya layanan) nominal tetap — tidak mengambil bagian dari keuntungan.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Agunan / Jaminan</label>
            <input
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              placeholder="Contoh: BPKB Motor"
              value={form.agunan} onChange={e => setForm(f => ({ ...f, agunan: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Deskripsi Usaha</label>
            <textarea rows={3}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 resize-none"
              placeholder="Jelaskan usaha Anda secara singkat..."
              value={form.deskripsi} onChange={e => setForm(f => ({ ...f, deskripsi: e.target.value }))} />
          </div>

          {/* Dokumen Proyek */}
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Dokumen Pendukung (opsional)</p>
            <div className="space-y-2">
              {(['PROYEKSI_KEUANGAN', 'ANALISA_BISNIS', 'PENAWARAN_SYIRKAH'] as const).map(jenis => {
                const jenisLabel: Record<string, string> = {
                  PROYEKSI_KEUANGAN: 'Proyeksi Keuangan',
                  ANALISA_BISNIS: 'Analisa Bisnis',
                  PENAWARAN_SYIRKAH: 'Penawaran Syirkah',
                }
                const uploaded = uploadedDoks.find(d => d.jenis === jenis)
                return (
                  <div key={jenis} className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                    <span className="flex-1 text-xs text-gray-600">{jenisLabel[jenis]}</span>
                    {uploaded ? (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="text-xs text-emerald-600 max-w-[100px] truncate">{uploaded.name}</span>
                        <button onClick={() => removeDok(jenis)}
                          className="text-gray-400 hover:text-red-500 cursor-pointer transition-colors">
                          <XCircle className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer">
                        <Upload className="h-3 w-3" /> Upload
                        <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
                          onChange={e => { if (e.target.files?.[0]) handleDokUpload(jenis, e.target.files[0]) }} />
                      </label>
                    )}
                  </div>
                )
              })}
            </div>
            {uploadingDok && <p className="mt-1 text-xs text-gray-400">Mengunggah dokumen...</p>}
          </div>

          <p className="text-xs text-gray-400">
            Proyek Anda akan diajukan ke DPS untuk ditinjau sebelum dibuka pendanaan.
          </p>
          <div className="flex gap-3 pt-2">
            <button onClick={resetModal}
              className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
              Batal
            </button>
            <button onClick={handleCreate} disabled={!form.nama_proyek || !form.kebutuhan_modal || pending || uploadingDok}
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
                  <span>Ujrah koperasi: <strong>{fmt(Number(p.ujrah_nominal ?? 0))}</strong> (nominal tetap)</span>
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
                100% keuntungan untuk pemodal · Ujrah koperasi: {fmt(Number(modalBiayai.ujrah_nominal ?? 0))} (nominal tetap)
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

// ─── TAB: LAPORAN ─────────────────────────────────────────────────────────────

function TabLaporan({ anggota, proyekDiajukan, laporan }: {
  anggota: KojasmatAnggota
  proyekDiajukan: KojasmatProyek[]
  laporan: KojasmatLaporanProyek[]
}) {
  const [pending, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    proyek_id: '',
    periode_mulai: '',
    periode_akhir: '',
    omzet_periode: '',
    ringkasan: '',
    kendala: '',
    rencana_kedepan: '',
  })

  const proyekBerjalan = proyekDiajukan.filter(p => p.status === 'BERJALAN')

  function resetForm() {
    setForm({ proyek_id: '', periode_mulai: '', periode_akhir: '', omzet_periode: '', ringkasan: '', kendala: '', rencana_kedepan: '' })
    setError(null)
    setModalOpen(false)
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
      resetForm()
    })
  }

  const statusColor: Record<string, string> = {
    DIKIRIM: 'bg-blue-100 text-blue-700',
    DITINJAU: 'bg-amber-100 text-amber-700',
    DIVERIFIKASI: 'bg-emerald-100 text-emerald-700',
  }

  return (
    <div className="space-y-4">
      {proyekBerjalan.length > 0 && (
        <button onClick={() => { setModalOpen(true); setError(null) }}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors cursor-pointer">
          <Send className="h-4 w-4" /> Kirim Laporan Mingguan
        </button>
      )}

      {proyekBerjalan.length === 0 && laporan.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-10 text-center text-sm text-gray-400">
          Tidak ada proyek berjalan — laporan mingguan hanya untuk proyek berstatus Berjalan.
        </div>
      )}

      {laporan.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Riwayat Laporan</p>
          {laporan.map(l => (
            <div key={l.id} className={cn('rounded-xl border bg-white p-4 shadow-sm',
              l.is_terlambat ? 'border-red-200 bg-red-50/30' : 'border-gray-100')}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge text={l.status} cls={statusColor[l.status] ?? 'bg-gray-100 text-gray-600'} />
                    {l.is_terlambat && <Badge text="Terlambat" cls="bg-red-100 text-red-600" />}
                  </div>
                  <p className="font-medium text-gray-900 text-sm">{l.proyek_nama ?? '—'}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {String(l.periode_mulai).split('T')[0]} — {String(l.periode_akhir).split('T')[0]}
                  </p>
                  <p className="text-xs text-emerald-700 mt-1 font-medium">
                    Omzet: {fmt(Number(l.omzet_periode))}
                  </p>
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">{l.ringkasan}</p>
                  {l.catatan_pengurus && (
                    <p className="mt-1.5 text-xs text-amber-700 rounded-lg bg-amber-50 px-2 py-1">
                      Catatan pengurus: {l.catatan_pengurus}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Kirim Laporan */}
      <Modal open={modalOpen} onClose={resetForm} title="Laporan Mingguan Proyek">
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Proyek *</label>
            <select
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              value={form.proyek_id} onChange={e => setForm(f => ({ ...f, proyek_id: e.target.value }))}>
              <option value="">— pilih proyek —</option>
              {proyekBerjalan.map(p => (
                <option key={p.id} value={p.id}>{p.nama_proyek}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Periode Mulai *</label>
              <input type="date"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                value={form.periode_mulai} onChange={e => setForm(f => ({ ...f, periode_mulai: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Periode Akhir *</label>
              <input type="date"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                value={form.periode_akhir} onChange={e => setForm(f => ({ ...f, periode_akhir: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Omzet Periode (Rp) *</label>
            <input type="number"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              placeholder="0"
              value={form.omzet_periode} onChange={e => setForm(f => ({ ...f, omzet_periode: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Ringkasan Kegiatan *</label>
            <textarea rows={3}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 resize-none"
              placeholder="Ceritakan kegiatan usaha minggu ini..."
              value={form.ringkasan} onChange={e => setForm(f => ({ ...f, ringkasan: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Kendala (opsional)</label>
            <textarea rows={2}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 resize-none"
              placeholder="Masalah yang dihadapi..."
              value={form.kendala} onChange={e => setForm(f => ({ ...f, kendala: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Rencana Ke Depan (opsional)</label>
            <textarea rows={2}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 resize-none"
              placeholder="Target minggu depan..."
              value={form.rencana_kedepan} onChange={e => setForm(f => ({ ...f, rencana_kedepan: e.target.value }))} />
          </div>
          {error && (
            <p className="rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={resetForm}
              className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
              Batal
            </button>
            <button onClick={handleKirim}
              disabled={!form.proyek_id || !form.periode_mulai || !form.periode_akhir || !form.ringkasan || pending}
              className="flex-1 rounded-xl bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer">
              {pending ? 'Mengirim...' : 'Kirim Laporan'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────

export default function AnggotaPortalClient(props: Props) {
  const { anggota, simpanan, proyekDiajukan, pembiayaan, penawaran, laporan, orgNama } = props
  const [activeTab, setActiveTab] = useState<ActiveTab>('beranda')

  const laporanBelumVerifikasi = laporan.filter(l => l.status !== 'DIVERIFIKASI').length
  const proyekBerjalan = proyekDiajukan.filter(p => p.status === 'BERJALAN')

  const tabs: { key: ActiveTab; label: string; icon: React.ElementType; badge?: number }[] = [
    { key: 'beranda',   label: 'Beranda',   icon: Star },
    { key: 'simpanan',  label: 'Simpanan',  icon: PiggyBank },
    { key: 'proyek',    label: 'Proyek',    icon: Briefcase },
    { key: 'penawaran', label: 'Penawaran', icon: Bell,
      badge: penawaran.filter(p => p.status === 'TERKIRIM').length || undefined },
    ...(proyekBerjalan.length > 0 ? [{
      key: 'laporan' as ActiveTab, label: 'Laporan', icon: FileText,
      badge: laporanBelumVerifikasi || undefined,
    }] : []),
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
        {activeTab === 'laporan' && (
          <TabLaporan anggota={anggota} proyekDiajukan={proyekDiajukan} laporan={laporan} />
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
              {t.badge !== undefined && t.badge > 0 && (
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
