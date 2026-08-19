'use client'

// Klinik Pratama — 4 tab tambahan: Daftar Poli, Rawat Inap, Mutasi Obat,
// Daftar Pasien. Dipisah dari KlinikClient.tsx (yang sudah >1300 baris)
// supaya tetap mudah dinavigasi; styling & pola state (useTransition, message
// banner, inline-expand form) sengaja disamakan persis dengan tab-tab lain.

import { useEffect, useState, useTransition } from 'react'
import {
  CheckCircle2, AlertCircle, Plus, Pencil, Power, DoorOpen, BedDouble, UserPlus2,
  LogOut, Ban, Search, ArrowDownCircle, ArrowUpCircle, ChevronDown, ChevronUp,
  Users, FileText, Loader2,
} from 'lucide-react'
import { cn, formatRupiah, formatDate } from '@/lib/utils'
import type { BranchSummary } from '@/modules/organization/lib/org-context'
import {
  getKlinikPoliByBranch, createKlinikPoli, updateKlinikPoli, setKlinikPoliActive, type KlinikPoli, type KlinikStafMedis,
} from '@/modules/klinik/actions/klinik.actions'
import {
  getKlinikKamarByBranch, createKlinikKamar, setKlinikKamarActive, setTempatTidurMaintenance,
  admitPasienRawatInap, dischargePasienRawatInap, cancelAdmisiRawatInap,
  type KlinikKamar, type KlinikTempatTidur,
} from '@/modules/klinik/actions/klinik-kamar.actions'
import {
  getKlinikStockMovementsPage,
  type KlinikStockMovementRow,
} from '@/modules/klinik/actions/klinik-mutasi-obat.actions'
import {
  KLINIK_STOCK_REFERENCE_TYPES, type KlinikStockReferenceType,
} from '@/modules/klinik/lib/klinik-mutasi-obat.shared'
import {
  searchKlinikPasien, getKlinikPasienPage, type KlinikPasienSearchResult, type KlinikPasienListRow,
} from '@/modules/klinik/actions/klinik-pasien.actions'
import {
  getRekamMedisHistoryByPasien, logAksesRekamMedis, type KlinikRekamMedisHistoryByPasienRow,
} from '@/modules/klinik/actions/klinik-rekam-medis.actions'

function MessageBanner({ message }: { message: { type: 'success' | 'error'; text: string } | null }) {
  if (!message) return null
  return (
    <div
      role="status"
      className={cn(
        'flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold',
        message.type === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-rose-200 bg-rose-50 text-rose-800'
      )}
    >
      {message.type === 'success'
        ? <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
        : <AlertCircle className="size-4 shrink-0" aria-hidden="true" />}
      {message.text}
    </div>
  )
}

// ─── TAB: DAFTAR POLI ─────────────────────────────────────────────────────────

export function TabDaftarPoli({ orgId, branch }: { orgId: string; branch: BranchSummary | null }) {
  const [pending, startTransition] = useTransition()
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [poliList, setPoliList] = useState<KlinikPoli[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ kode: '', nama: '' })
  const [showNewForm, setShowNewForm] = useState(false)
  const [newPoli, setNewPoli] = useState({ kode: '', nama: '' })

  async function loadData() {
    if (!branch) { setLoading(false); return }
    setPoliList(await getKlinikPoliByBranch(orgId, branch.id, true))
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch?.id])

  function handleCreate() {
    if (!branch) return
    setMessage(null)
    startTransition(async () => {
      const res = await createKlinikPoli(orgId, branch.id, newPoli)
      if ('error' in res) { setMessage({ type: 'error', text: res.error }); return }
      setNewPoli({ kode: '', nama: '' })
      setShowNewForm(false)
      setMessage({ type: 'success', text: 'Poli baru berhasil ditambahkan.' })
      await loadData()
    })
  }

  function handleStartEdit(poli: KlinikPoli) {
    setEditingId(poli.id)
    setEditForm({ kode: poli.kode, nama: poli.nama })
  }

  function handleSaveEdit(poliId: string) {
    setMessage(null)
    startTransition(async () => {
      const res = await updateKlinikPoli(orgId, poliId, editForm)
      if ('error' in res) { setMessage({ type: 'error', text: res.error }); return }
      setEditingId(null)
      setMessage({ type: 'success', text: 'Poli berhasil diperbarui.' })
      await loadData()
    })
  }

  function handleToggleActive(poli: KlinikPoli) {
    setMessage(null)
    startTransition(async () => {
      const res = await setKlinikPoliActive(orgId, poli.id, !poli.is_active)
      if ('error' in res) { setMessage({ type: 'error', text: res.error }); return }
      await loadData()
    })
  }

  if (!branch) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
        Pilih Cabang aktif terlebih dahulu untuk mengelola poli.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <MessageBanner message={message} />

      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-bold text-slate-900">Daftar Poli</p>
          <button
            type="button"
            onClick={() => setShowNewForm((v) => !v)}
            className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-cyan-700 transition-colors duration-150 hover:text-cyan-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Poli Baru
          </button>
        </div>

        {showNewForm && (
          <div className="mb-4 space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text" placeholder="Kode (mis. UMUM)" value={newPoli.kode}
                onChange={(e) => setNewPoli((p) => ({ ...p, kode: e.target.value }))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              />
              <input
                type="text" placeholder="Nama poli" value={newPoli.nama}
                onChange={(e) => setNewPoli((p) => ({ ...p, nama: e.target.value }))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              />
            </div>
            <button
              type="button" onClick={handleCreate} disabled={pending}
              className="cursor-pointer rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors duration-150 hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
            >
              Simpan Poli
            </button>
          </div>
        )}

        {loading ? (
          <p className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400"><Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Memuat poli...</p>
        ) : poliList.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Belum ada poli. Tambahkan poli pertama.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500">
                <th className="py-1.5 pr-3 font-semibold">Kode</th>
                <th className="py-1.5 pr-3 font-semibold">Nama</th>
                <th className="py-1.5 pr-3 font-semibold">Status</th>
                <th className="py-1.5 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {poliList.map((poli) => (
                <tr key={poli.id} className="border-b border-slate-50 transition-colors duration-150 hover:bg-slate-50/60">
                  {editingId === poli.id ? (
                    <td colSpan={4} className="py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text" value={editForm.kode}
                          onChange={(e) => setEditForm((f) => ({ ...f, kode: e.target.value }))}
                          className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                        />
                        <input
                          type="text" value={editForm.nama}
                          onChange={(e) => setEditForm((f) => ({ ...f, nama: e.target.value }))}
                          className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                        />
                        <button
                          type="button" onClick={() => handleSaveEdit(poli.id)} disabled={pending}
                          className="cursor-pointer rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-700 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
                        >
                          Simpan
                        </button>
                        <button
                          type="button" onClick={() => setEditingId(null)}
                          className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
                        >
                          Batal
                        </button>
                      </div>
                    </td>
                  ) : (
                    <>
                      <td className="py-2 pr-3 font-semibold text-slate-900">{poli.kode}</td>
                      <td className="py-2 pr-3 text-slate-700">{poli.nama}</td>
                      <td className="py-2 pr-3">
                        <span className={cn(
                          'rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
                          poli.is_active ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-500'
                        )}>
                          {poli.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button" onClick={() => handleStartEdit(poli)}
                          className="mr-1 inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-cyan-600 hover:bg-cyan-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
                          title="Edit poli"
                        >
                          <Pencil className="size-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button" onClick={() => handleToggleActive(poli)} disabled={pending}
                          className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
                          title={poli.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                        >
                          <Power className="size-3.5" aria-hidden="true" />
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─── TAB: RAWAT INAP ──────────────────────────────────────────────────────────

const BED_STATUS_BADGE: Record<KlinikTempatTidur['status'], string> = {
  TERSEDIA: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  TERISI: 'border-rose-200 bg-rose-50 text-rose-800',
  MAINTENANCE: 'border-amber-200 bg-amber-50 text-amber-800',
}
const BED_STATUS_LABEL: Record<KlinikTempatTidur['status'], string> = {
  TERSEDIA: 'Tersedia', TERISI: 'Terisi', MAINTENANCE: 'Perbaikan',
}

export function TabRawatInap({
  orgId, branch, poliList, dokterList,
}: {
  orgId: string
  branch: BranchSummary | null
  poliList: KlinikPoli[]
  dokterList: KlinikStafMedis[]
}) {
  const [pending, startTransition] = useTransition()
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [kamarList, setKamarList] = useState<KlinikKamar[]>([])

  const [showNewKamarForm, setShowNewKamarForm] = useState(false)
  const [newKamar, setNewKamar] = useState({ tipeKamar: 'VIP', nama: '', ukuranM2: '', tarifPerMalam: '', fasilitas: '', jumlahBed: '1' })

  const [admitBedId, setAdmitBedId] = useState<string | null>(null)
  const [admitPoliId, setAdmitPoliId] = useState('')
  const [admitPasienQuery, setAdmitPasienQuery] = useState('')
  const [admitPasienResults, setAdmitPasienResults] = useState<KlinikPasienSearchResult[]>([])
  const [admitPasien, setAdmitPasien] = useState<KlinikPasienSearchResult | null>(null)
  const [admitDiagnosis, setAdmitDiagnosis] = useState('')
  const [admitDokterId, setAdmitDokterId] = useState('')
  const [admitCatatan, setAdmitCatatan] = useState('')

  async function loadData() {
    if (!branch) { setLoading(false); return }
    setKamarList(await getKlinikKamarByBranch(orgId, branch.id))
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch?.id])

  function resetAdmitForm() {
    setAdmitBedId(null)
    setAdmitPasienQuery('')
    setAdmitPasienResults([])
    setAdmitPasien(null)
    setAdmitDiagnosis('')
    setAdmitDokterId('')
    setAdmitCatatan('')
  }

  function handleCreateKamar() {
    if (!branch) return
    setMessage(null)
    const tarif = Number(newKamar.tarifPerMalam)
    const jumlahBed = Number(newKamar.jumlahBed)
    if (!newKamar.nama.trim()) { setMessage({ type: 'error', text: 'Nama kamar wajib diisi.' }); return }
    startTransition(async () => {
      const res = await createKlinikKamar(orgId, branch.id, {
        tipeKamar: newKamar.tipeKamar,
        nama: newKamar.nama,
        ukuranM2: newKamar.ukuranM2 ? Number(newKamar.ukuranM2) : null,
        tarifPerMalam: tarif,
        fasilitas: newKamar.fasilitas.split(',').map((s) => s.trim()).filter(Boolean),
        jumlahBed,
      })
      if ('error' in res) { setMessage({ type: 'error', text: res.error }); return }
      setNewKamar({ tipeKamar: 'VIP', nama: '', ukuranM2: '', tarifPerMalam: '', fasilitas: '', jumlahBed: '1' })
      setShowNewKamarForm(false)
      setMessage({ type: 'success', text: 'Kamar baru berhasil ditambahkan.' })
      await loadData()
    })
  }

  function handleSearchAdmitPasien(q: string) {
    setAdmitPasienQuery(q)
    setAdmitPasien(null)
    if (q.trim().length < 2) { setAdmitPasienResults([]); return }
    startTransition(async () => {
      setAdmitPasienResults(await searchKlinikPasien(orgId, q))
    })
  }

  function handleAdmit() {
    if (!branch || !admitBedId) return
    setMessage(null)
    if (!admitPasien) { setMessage({ type: 'error', text: 'Pilih pasien terlebih dahulu.' }); return }
    if (!admitPoliId) { setMessage({ type: 'error', text: 'Pilih poli untuk kunjungan rawat inap.' }); return }
    startTransition(async () => {
      const res = await admitPasienRawatInap({
        orgId, branchId: branch.id, tempatTidurId: admitBedId, pasienId: admitPasien.id, poliRawatInapId: admitPoliId,
        diagnosisMasuk: admitDiagnosis || null, dokterPenanggungJawabId: admitDokterId || null, catatan: admitCatatan || null,
      })
      if ('error' in res) { setMessage({ type: 'error', text: res.error }); return }
      setMessage({ type: 'success', text: `${admitPasien.nama} berhasil diadmisi.` })
      resetAdmitForm()
      await loadData()
    })
  }

  function handleDischarge(rawatInapId: string, pasienNama: string | null) {
    if (!window.confirm(`Pulangkan ${pasienNama || 'pasien'}? Tagihan kamar akan otomatis dibuat saat kunjungan diselesaikan di Kasir.`)) return
    setMessage(null)
    startTransition(async () => {
      const res = await dischargePasienRawatInap(orgId, rawatInapId)
      if ('error' in res) { setMessage({ type: 'error', text: res.error }); return }
      setMessage({ type: 'success', text: 'Pasien berhasil dipulangkan. Lanjutkan ke Kasir di tab Pendaftaran & Antrian untuk tagihan.' })
      await loadData()
    })
  }

  function handleCancelAdmisi(rawatInapId: string) {
    if (!window.confirm('Batalkan admisi ini? Bed akan kembali tersedia tanpa tagihan.')) return
    setMessage(null)
    startTransition(async () => {
      const res = await cancelAdmisiRawatInap(orgId, rawatInapId)
      if ('error' in res) { setMessage({ type: 'error', text: res.error }); return }
      await loadData()
    })
  }

  function handleToggleMaintenance(bed: KlinikTempatTidur) {
    setMessage(null)
    startTransition(async () => {
      const res = await setTempatTidurMaintenance(orgId, bed.id, bed.status !== 'MAINTENANCE')
      if ('error' in res) { setMessage({ type: 'error', text: res.error }); return }
      await loadData()
    })
  }

  if (!branch) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
        Pilih Cabang aktif terlebih dahulu untuk mengelola rawat inap.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <MessageBanner message={message} />

      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-bold text-slate-900">Kamar Rawat Inap</p>
          <button
            type="button"
            onClick={() => setShowNewKamarForm((v) => !v)}
            className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-cyan-700 transition-colors duration-150 hover:text-cyan-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Kamar Baru
          </button>
        </div>

        {showNewKamarForm && (
          <div className="mb-4 space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <input
                type="text" placeholder="Tipe (VIP/BPJS/dst)" value={newKamar.tipeKamar}
                onChange={(e) => setNewKamar((p) => ({ ...p, tipeKamar: e.target.value }))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              />
              <input
                type="text" placeholder="Nama kamar" value={newKamar.nama}
                onChange={(e) => setNewKamar((p) => ({ ...p, nama: e.target.value }))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              />
              <input
                type="number" min="0" step="0.1" placeholder="Ukuran (m²)" value={newKamar.ukuranM2}
                onChange={(e) => setNewKamar((p) => ({ ...p, ukuranM2: e.target.value }))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              />
              <input
                type="number" min="0" placeholder="Tarif/malam (Rp)" value={newKamar.tarifPerMalam}
                onChange={(e) => setNewKamar((p) => ({ ...p, tarifPerMalam: e.target.value }))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              />
              <input
                type="text" placeholder="Fasilitas, pisah koma (AC, TV, Kamar mandi dalam)" value={newKamar.fasilitas}
                onChange={(e) => setNewKamar((p) => ({ ...p, fasilitas: e.target.value }))}
                className="col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 sm:col-span-3"
              />
              <input
                type="number" min="1" max="50" placeholder="Jumlah bed" value={newKamar.jumlahBed}
                onChange={(e) => setNewKamar((p) => ({ ...p, jumlahBed: e.target.value }))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              />
            </div>
            <button
              type="button" onClick={handleCreateKamar} disabled={pending}
              className="cursor-pointer rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors duration-150 hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
            >
              Simpan Kamar
            </button>
          </div>
        )}

        {loading ? (
          <p className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400"><Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Memuat kamar...</p>
        ) : kamarList.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Belum ada kamar. Tambahkan kamar pertama.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {kamarList.map((kamar) => (
              <div key={kamar.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <DoorOpen className="size-4 text-cyan-600" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-bold text-slate-900">{kamar.nama}</p>
                      <p className="text-xs text-slate-500">
                        {kamar.tipe_kamar}{kamar.ukuran_m2 ? ` · ${kamar.ukuran_m2} m²` : ''} · {formatRupiah(kamar.tarif_per_malam)}/malam
                      </p>
                    </div>
                  </div>
                  <button
                    type="button" disabled={pending}
                    onClick={() => startTransition(async () => { await setKlinikKamarActive(orgId, kamar.id, !kamar.is_active); await loadData() })}
                    className={cn(
                      'shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500',
                      kamar.is_active ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-500'
                    )}
                  >
                    {kamar.is_active ? 'Aktif' : 'Nonaktif'}
                  </button>
                </div>

                {kamar.fasilitas.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1">
                    {kamar.fasilitas.map((f) => (
                      <span key={f} className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200">{f}</span>
                    ))}
                  </div>
                )}

                <div className="space-y-1.5">
                  {kamar.beds.map((bed) => (
                    <div key={bed.id} className="rounded-lg border border-slate-100 bg-white px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <BedDouble className="size-3.5 text-slate-400" aria-hidden="true" />
                          <span className="text-xs font-semibold text-slate-900">{bed.kode_bed}</span>
                          <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-semibold', BED_STATUS_BADGE[bed.status])}>
                            {BED_STATUS_LABEL[bed.status]}
                          </span>
                        </div>
                        {bed.status === 'TERSEDIA' && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button" onClick={() => { setAdmitBedId(bed.id); setAdmitPoliId(poliList[0]?.id ?? '') }}
                              className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-cyan-700 hover:text-cyan-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
                            >
                              <UserPlus2 className="size-3.5" aria-hidden="true" />
                              Rawat Pasien
                            </button>
                            <button
                              type="button" onClick={() => handleToggleMaintenance(bed)} disabled={pending}
                              className="cursor-pointer text-xs font-semibold text-slate-500 transition-colors duration-150 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
                            >
                              Perbaikan
                            </button>
                          </div>
                        )}
                        {bed.status === 'MAINTENANCE' && (
                          <button
                            type="button" onClick={() => handleToggleMaintenance(bed)} disabled={pending}
                            className="cursor-pointer text-xs font-semibold text-emerald-700 hover:text-emerald-800 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
                          >
                            Tandai Tersedia
                          </button>
                        )}
                        {bed.status === 'TERISI' && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button" onClick={() => handleDischarge(bed.rawat_inap_id as string, bed.pasien_nama)} disabled={pending}
                              className="flex cursor-pointer items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
                            >
                              <LogOut className="size-3.5" aria-hidden="true" />
                              Pulangkan
                            </button>
                            <button
                              type="button" onClick={() => handleCancelAdmisi(bed.rawat_inap_id as string)} disabled={pending}
                              className="cursor-pointer text-xs font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
                              title="Batalkan admisi (kesalahan input)"
                            >
                              <Ban className="size-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        )}
                      </div>
                      {bed.status === 'TERISI' && (
                        <p className="mt-1 pl-5 text-[11px] text-slate-500">
                          {bed.pasien_nama} · masuk {bed.admitted_at ? formatDate(bed.admitted_at, 'short') : '-'}
                        </p>
                      )}

                      {admitBedId === bed.id && (
                        <div className="mt-3 space-y-2 rounded-lg border border-cyan-100 bg-cyan-50/40 p-3">
                          {admitPasien ? (
                            <div className="flex items-center justify-between rounded-lg border border-cyan-200 bg-white px-3 py-2">
                              <div>
                                <p className="text-xs font-semibold text-cyan-900">{admitPasien.nama}</p>
                                <p className="text-[11px] text-cyan-700">{admitPasien.no_rm}</p>
                              </div>
                              <button type="button" onClick={() => setAdmitPasien(null)} className="cursor-pointer text-[11px] font-semibold text-cyan-700 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500">Ganti</button>
                            </div>
                          ) : (
                            <div className="relative">
                              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                              <input
                                type="text" value={admitPasienQuery} onChange={(e) => handleSearchAdmitPasien(e.target.value)}
                                placeholder="Cari pasien (nama/no. RM)..."
                                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                              />
                              {admitPasienResults.length > 0 && (
                                <div className="mt-1 max-h-32 space-y-0.5 overflow-y-auto rounded-lg border border-slate-100 bg-white p-1">
                                  {admitPasienResults.map((p) => (
                                    <button
                                      key={p.id} type="button"
                                      onClick={() => { setAdmitPasien(p); setAdmitPasienResults([]); setAdmitPasienQuery('') }}
                                      className="flex w-full cursor-pointer items-center justify-between rounded px-2 py-1.5 text-left text-xs hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
                                    >
                                      <span className="font-medium text-slate-900">{p.nama}</span>
                                      <span className="text-slate-500">{p.no_rm}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={admitPoliId} onChange={(e) => setAdmitPoliId(e.target.value)}
                              className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                            >
                              <option value="">Pilih poli...</option>
                              {poliList.map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}
                            </select>
                            <select
                              value={admitDokterId} onChange={(e) => setAdmitDokterId(e.target.value)}
                              className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                            >
                              <option value="">Dokter PJ (opsional)</option>
                              {dokterList.map((d) => <option key={d.id} value={d.id}>{d.employee_name}</option>)}
                            </select>
                          </div>
                          <textarea
                            value={admitDiagnosis} onChange={(e) => setAdmitDiagnosis(e.target.value)}
                            placeholder="Diagnosis masuk" rows={2}
                            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button" onClick={handleAdmit} disabled={pending}
                              className="cursor-pointer rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-700 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
                            >
                              Admisi Pasien
                            </button>
                            <button
                              type="button" onClick={resetAdmitForm}
                              className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
                            >
                              Batal
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── TAB: MUTASI OBAT ─────────────────────────────────────────────────────────

const REF_TYPE_META: Record<KlinikStockReferenceType, { label: string; badge: string }> = {
  KLINIK_RECEIPT: { label: 'Penerimaan Obat', badge: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  KLINIK_RESEP: { label: 'Pemakaian Resep', badge: 'border-cyan-200 bg-cyan-50 text-cyan-800' },
  KLINIK_VOID_RETURN: { label: 'Retur (Void)', badge: 'border-amber-200 bg-amber-50 text-amber-800' },
}

export function TabMutasiObat({ orgId, branch }: { orgId: string; branch: BranchSummary | null }) {
  const [pending, startTransition] = useTransition()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<KlinikStockMovementRow[]>([])
  const [totalIn, setTotalIn] = useState(0)
  const [totalOut, setTotalOut] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const [search, setSearch] = useState('')
  const [referenceType, setReferenceType] = useState<KlinikStockReferenceType | ''>('')
  const [direction, setDirection] = useState<'in' | 'out' | ''>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  async function loadData(targetPage = page) {
    if (!branch) { setLoading(false); return }
    setLoading(true)
    const result = await getKlinikStockMovementsPage(orgId, branch.id, {
      page: targetPage, search, referenceType: referenceType || null, direction: direction || null,
      dateFrom: dateFrom || null, dateTo: dateTo || null,
    })
    setRows(result.rows)
    setTotalIn(result.totalIn)
    setTotalOut(result.totalOut)
    setTotalPages(result.totalPages)
    setPage(result.page)
    setLoading(false)
  }

  useEffect(() => {
    loadData(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch?.id])

  function applyFilters() {
    startTransition(async () => { await loadData(1) })
  }

  if (!branch) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
        Pilih Cabang aktif terlebih dahulu untuk melihat mutasi obat.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <ArrowDownCircle className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Total Masuk</p>
            <p className="text-lg font-extrabold tabular-nums text-slate-900">{totalIn.toLocaleString('id-ID')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex size-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <ArrowUpCircle className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Total Keluar</p>
            <p className="text-lg font-extrabold tabular-nums text-slate-900">{totalOut.toLocaleString('id-ID')}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama/SKU obat..."
              className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            />
          </div>
          <select
            value={referenceType} onChange={(e) => setReferenceType(e.target.value as KlinikStockReferenceType | '')}
            className="cursor-pointer rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
          >
            <option value="">Semua jenis</option>
            {KLINIK_STOCK_REFERENCE_TYPES.map((rt) => <option key={rt} value={rt}>{REF_TYPE_META[rt].label}</option>)}
          </select>
          <select
            value={direction} onChange={(e) => setDirection(e.target.value as 'in' | 'out' | '')}
            className="cursor-pointer rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
          >
            <option value="">Semua arah</option>
            <option value="in">Masuk</option>
            <option value="out">Keluar</option>
          </select>
          <input
            type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
          />
          <input
            type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
          />
          <button
            type="button" onClick={applyFilters} disabled={pending}
            className="cursor-pointer rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
          >
            Terapkan
          </button>
        </div>

        {loading ? (
          <p className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400"><Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Memuat mutasi obat...</p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Belum ada mutasi obat untuk filter ini.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500">
                    <th className="py-1.5 pr-3 font-semibold">Tanggal</th>
                    <th className="py-1.5 pr-3 font-semibold">Produk</th>
                    <th className="py-1.5 pr-3 font-semibold">Jenis</th>
                    <th className="py-1.5 pr-3 text-right font-semibold">Qty</th>
                    <th className="py-1.5 pr-3 text-right font-semibold">HPP/Unit</th>
                    <th className="py-1.5 pr-3 text-right font-semibold">Nilai</th>
                    <th className="py-1.5 font-semibold">Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const meta = REF_TYPE_META[r.reference_type as KlinikStockReferenceType]
                    const isIn = r.quantity > 0
                    return (
                      <tr key={r.id} className="border-b border-slate-50 transition-colors duration-150 hover:bg-slate-50/60">
                        <td className="py-2 pr-3 whitespace-nowrap text-slate-700">{formatDate(r.movement_date, 'short')}</td>
                        <td className="py-2 pr-3">
                          <p className="font-medium text-slate-900">{r.product_name}</p>
                          {r.product_sku && <p className="text-[11px] text-slate-400">{r.product_sku}</p>}
                        </td>
                        <td className="py-2 pr-3">
                          <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap', meta?.badge)}>
                            {meta?.label ?? r.reference_type}
                          </span>
                        </td>
                        <td className={cn('py-2 pr-3 whitespace-nowrap text-right tabular-nums font-semibold', isIn ? 'text-emerald-700' : 'text-rose-700')}>
                          {isIn ? '+' : ''}{r.quantity.toLocaleString('id-ID')} {r.product_unit || ''}
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap text-right tabular-nums text-slate-600">{formatRupiah(r.unit_price)}</td>
                        <td className="py-2 pr-3 whitespace-nowrap text-right tabular-nums font-semibold text-slate-900">{formatRupiah(Math.abs(r.quantity) * r.unit_price)}</td>
                        <td className="py-2 text-slate-500">{r.notes || '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-slate-500">Halaman {page} dari {totalPages}</p>
              <div className="flex gap-2">
                <button
                  type="button" disabled={page <= 1 || pending}
                  onClick={() => startTransition(async () => { await loadData(page - 1) })}
                  className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
                >
                  Sebelumnya
                </button>
                <button
                  type="button" disabled={page >= totalPages || pending}
                  onClick={() => startTransition(async () => { await loadData(page + 1) })}
                  className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── TAB: DAFTAR PASIEN → REKAM MEDIS ──────────────────────────────────────────

const RM_STATUS_BADGE: Record<'DRAFT' | 'FINAL', string> = {
  DRAFT: 'border-amber-200 bg-amber-50 text-amber-800',
  FINAL: 'border-emerald-200 bg-emerald-50 text-emerald-800',
}

export function TabDaftarPasien({ orgId }: { orgId: string }) {
  const [pending, startTransition] = useTransition()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<KlinikPasienListRow[]>([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const [expandedPasienId, setExpandedPasienId] = useState<string | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [history, setHistory] = useState<KlinikRekamMedisHistoryByPasienRow[]>([])

  async function loadData(targetPage = page, targetSearch = search) {
    setLoading(true)
    const result = await getKlinikPasienPage(orgId, { search: targetSearch, page: targetPage, limit: 20 })
    setRows(result.rows)
    setTotalPages(result.totalPages)
    setPage(result.page)
    setLoading(false)
  }

  useEffect(() => {
    loadData(1, '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleToggleExpand(pasienId: string) {
    if (expandedPasienId === pasienId) { setExpandedPasienId(null); return }
    setExpandedPasienId(pasienId)
    setHistoryLoading(true)
    startTransition(async () => {
      await logAksesRekamMedis(orgId, pasienId, 'Lihat riwayat rekam medis dari Daftar Pasien')
      setHistory(await getRekamMedisHistoryByPasien(pasienId))
      setHistoryLoading(false)
    })
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="mb-4 relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="text" value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') startTransition(async () => { await loadData(1) }) }}
            placeholder="Cari nama atau no. RM, lalu tekan Enter..."
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
          />
        </div>

        {loading ? (
          <p className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400"><Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Memuat pasien...</p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Tidak ada pasien ditemukan.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((p) => (
              <div key={p.id} className="rounded-xl border border-slate-100">
                <button
                  type="button" onClick={() => handleToggleExpand(p.id)}
                  className="flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left transition-colors duration-150 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-full bg-cyan-50 text-cyan-600">
                      <Users className="size-4" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{p.nama}</p>
                      <p className="text-xs text-slate-500">
                        {p.no_rm}{p.no_hp ? ` · ${p.no_hp}` : ''}{p.registered_branch_nama ? ` · ${p.registered_branch_nama}` : ''}
                      </p>
                    </div>
                  </div>
                  {expandedPasienId === p.id ? <ChevronUp className="size-4 text-slate-400" aria-hidden="true" /> : <ChevronDown className="size-4 text-slate-400" aria-hidden="true" />}
                </button>

                {expandedPasienId === p.id && (
                  <div className="border-t border-slate-100 bg-slate-50/60 p-4">
                    <div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-700">
                      <FileText className="size-3.5" aria-hidden="true" />
                      Riwayat Rekam Medis
                    </div>
                    {historyLoading ? (
                      <p className="flex items-center justify-center gap-2 py-4 text-xs text-slate-400"><Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />Memuat riwayat...</p>
                    ) : history.length === 0 ? (
                      <p className="py-4 text-center text-xs text-slate-400">Belum ada rekam medis untuk pasien ini.</p>
                    ) : (
                      <div className="space-y-2">
                        {history.map((h) => (
                          <div key={h.id} className="rounded-xl border border-slate-100 bg-white p-3">
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-slate-900">
                                {formatDate(h.tanggal, 'short')} · {h.poli_nama}{h.staf_medis_nama ? ` · ${h.staf_medis_nama}` : ''}
                              </p>
                              <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-semibold', RM_STATUS_BADGE[h.status])}>
                                {h.status === 'FINAL' ? 'Final' : 'Draft'}
                              </span>
                            </div>
                            <dl className="grid gap-1.5 text-[11px] text-slate-600 sm:grid-cols-2">
                              {h.anamnesis && <div><dt className="font-semibold text-slate-500">Anamnesis</dt><dd>{h.anamnesis}</dd></div>}
                              {h.diagnosis_text && <div><dt className="font-semibold text-slate-500">Diagnosis</dt><dd>{h.diagnosis_text}{h.diagnosis_icd10 ? ` (${h.diagnosis_icd10})` : ''}</dd></div>}
                              {h.terapi && <div><dt className="font-semibold text-slate-500">Terapi</dt><dd>{h.terapi}</dd></div>}
                              {h.catatan && <div className="sm:col-span-2"><dt className="font-semibold text-slate-500">Catatan</dt><dd className="whitespace-pre-wrap">{h.catatan}</dd></div>}
                            </dl>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && rows.length > 0 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-slate-500">Halaman {page} dari {totalPages}</p>
            <div className="flex gap-2">
              <button
                type="button" disabled={page <= 1 || pending}
                onClick={() => startTransition(async () => { await loadData(page - 1) })}
                className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
              >
                Sebelumnya
              </button>
              <button
                type="button" disabled={page >= totalPages || pending}
                onClick={() => startTransition(async () => { await loadData(page + 1) })}
                className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
              >
                Berikutnya
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
