'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  Landmark, CheckCircle2, AlertCircle, Stethoscope, Search, UserPlus, Plus,
  Users, PhoneCall, Ban, ChevronDown, ChevronUp, UserCog, CalendarCheck, LogIn,
  Pill, PackagePlus, Send, Boxes, MonitorPlay, ExternalLink, Copy, Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BranchSummary } from '@/modules/organization/lib/org-context'
import {
  searchKlinikPasien, createKlinikPasien, type KlinikPasienSearchResult,
} from '@/modules/klinik/actions/klinik-pasien.actions'
import {
  createKunjunganWalkIn, getAntrianHariIni, updateStatusKunjungan, type KlinikAntrianRow,
} from '@/modules/klinik/actions/klinik-kunjungan.actions'
import {
  getConfirmedBookingsToday, checkInBooking, type KlinikBookingRow,
} from '@/modules/klinik/actions/klinik-booking.actions'
import {
  dispenseResep, getPendingResepByBranch, getObatStockByBranch, receiveObat, searchKlinikObat,
  type KlinikWarehouseOption, type KlinikPendingResep, type KlinikObatStockRow, type KlinikObatOption,
} from '@/modules/klinik/actions/klinik-resep.actions'
import {
  createKlinikPoli, createKlinikStafMedis, type KlinikPoli, type KlinikStafMedis, type KlinikTarifLayanan,
} from '@/modules/klinik/actions/klinik.actions'
import { saveKlinikAccountMappingAction } from '@/modules/klinik/actions/klinik-account-mapping.actions'
import { retryPostUnpostedJournals } from '@/modules/klinik/actions/klinik-tagihan.actions'
import {
  KLINIK_ACCOUNT_ROLES,
  KLINIK_ACCOUNT_ROLE_LABEL,
  type KlinikAccountRole,
  type KlinikAccountMapping,
  type KlinikAccountOption,
} from '@/modules/klinik/lib/klinik-account-mapping.shared'
import PemeriksaanPanel from './PemeriksaanPanel'
import { TabDaftarPoli, TabRawatInap, TabMutasiObat, TabDaftarPasien } from './KlinikTabsExtra'

// ─── TAB: PENDAFTARAN & ANTRIAN ───────────────────────────────────────────────

const JENIS_KUNJUNGAN_LABEL: Record<'umum' | 'bpjs' | 'asuransi', string> = {
  umum: 'Umum',
  bpjs: 'BPJS',
  asuransi: 'Asuransi',
}

const STATUS_BADGE: Record<KlinikAntrianRow['status'], string> = {
  MENUNGGU: 'bg-amber-50 text-amber-800 border-amber-200',
  DIPERIKSA: 'bg-cyan-50 text-cyan-800 border-cyan-200',
  SELESAI: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  BATAL: 'bg-rose-50 text-rose-800 border-rose-200',
}

const STATUS_LABEL: Record<KlinikAntrianRow['status'], string> = {
  MENUNGGU: 'Menunggu',
  DIPERIKSA: 'Diperiksa',
  SELESAI: 'Selesai',
  BATAL: 'Batal',
}

function TabPendaftaran({
  orgId, branch, poliList: initialPoliList, initialPoliId, initialAntrian, warehouses, dokterList, tarifLayananList,
}: {
  orgId: string
  branch: BranchSummary | null
  poliList: KlinikPoli[]
  initialPoliId: string | null
  initialAntrian: KlinikAntrianRow[]
  warehouses: KlinikWarehouseOption[]
  dokterList: KlinikStafMedis[]
  tarifLayananList: KlinikTarifLayanan[]
}) {
  const [pending, startTransition] = useTransition()
  const [poliList, setPoliList] = useState(initialPoliList)
  const [poliId, setPoliId] = useState(initialPoliId)
  const [antrian, setAntrian] = useState(initialAntrian)
  const [expandedKunjunganId, setExpandedKunjunganId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [antrianLinkCopied, setAntrianLinkCopied] = useState(false)

  const [showNewPoliForm, setShowNewPoliForm] = useState(poliList.length === 0)
  const [newPoli, setNewPoli] = useState({ kode: '', nama: '' })

  const [bookings, setBookings] = useState<KlinikBookingRow[]>([])

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<KlinikPasienSearchResult[]>([])
  const [selectedPasien, setSelectedPasien] = useState<KlinikPasienSearchResult | null>(null)
  const [showNewPasienForm, setShowNewPasienForm] = useState(false)
  const [newPasien, setNewPasien] = useState({ nama: '', nik: '', tglLahir: '', jenisKelamin: '', noHp: '' })
  const [jenisKunjungan, setJenisKunjungan] = useState<'umum' | 'bpjs' | 'asuransi'>('umum')
  const [keluhan, setKeluhan] = useState('')

  async function refreshAntrian(targetPoliId: string) {
    const rows = await getAntrianHariIni(branch!.id, targetPoliId)
    setAntrian(rows)
  }

  async function refreshBookings(targetPoliId: string) {
    if (!branch) return
    const rows = await getConfirmedBookingsToday(orgId, branch.id, targetPoliId)
    setBookings(rows)
  }

  useEffect(() => {
    if (poliId) refreshBookings(poliId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poliId])

  function handlePoliChange(id: string) {
    setPoliId(id)
    startTransition(async () => { await refreshAntrian(id) })
  }

  function handleCopyAntrianLink() {
    if (!branch) return
    const url = `${window.location.origin}/klinik/antrian/${branch.id}`
    navigator.clipboard.writeText(url).then(() => {
      setAntrianLinkCopied(true)
      setTimeout(() => setAntrianLinkCopied(false), 2000)
    })
  }

  function handleCheckIn(bookingId: string) {
    if (!branch) return
    setMessage(null)
    startTransition(async () => {
      const res = await checkInBooking(orgId, branch.id, bookingId)
      if ('error' in res) {
        setMessage({ type: 'error', text: res.error })
        return
      }
      setMessage({ type: 'success', text: `Check-in berhasil — nomor antrian ${res.data.noAntrian}.` })
      if (poliId) {
        await refreshAntrian(poliId)
        await refreshBookings(poliId)
      }
    })
  }

  function handleSearch(q: string) {
    setSearchQuery(q)
    setSelectedPasien(null)
    if (q.trim().length < 2) {
      setSearchResults([])
      return
    }
    startTransition(async () => {
      setSearchResults(await searchKlinikPasien(orgId, q))
    })
  }

  function handleCreatePoli() {
    if (!branch) return
    setMessage(null)
    startTransition(async () => {
      const res = await createKlinikPoli(orgId, branch.id, newPoli)
      if ('error' in res) {
        setMessage({ type: 'error', text: res.error })
        return
      }
      setPoliList((prev) => [...prev, res.data])
      setPoliId(res.data.id)
      setShowNewPoliForm(false)
      setNewPoli({ kode: '', nama: '' })
      await refreshAntrian(res.data.id)
    })
  }

  function handleDaftar() {
    setMessage(null)
    if (!branch) {
      setMessage({ type: 'error', text: 'Pilih cabang aktif terlebih dahulu.' })
      return
    }
    if (!poliId) {
      setMessage({ type: 'error', text: 'Pilih poli terlebih dahulu.' })
      return
    }
    if (!selectedPasien && !newPasien.nama.trim()) {
      setMessage({ type: 'error', text: 'Cari pasien terdaftar atau isi data pasien baru.' })
      return
    }

    startTransition(async () => {
      let pasienId = selectedPasien?.id ?? null

      if (!pasienId) {
        const created = await createKlinikPasien(orgId, {
          nama: newPasien.nama,
          nik: newPasien.nik || null,
          tglLahir: newPasien.tglLahir || null,
          jenisKelamin: newPasien.jenisKelamin === 'L' || newPasien.jenisKelamin === 'P' ? newPasien.jenisKelamin : null,
          noHp: newPasien.noHp || null,
          registeredBranchId: branch.id,
        })
        if ('error' in created) {
          setMessage({ type: 'error', text: created.error })
          return
        }
        pasienId = created.data.id
      }

      const result = await createKunjunganWalkIn({
        orgId, branchId: branch.id, pasienId, poliId: poliId as string, jenisKunjungan, keluhan: keluhan || null,
      })
      if ('error' in result) {
        setMessage({ type: 'error', text: result.error })
        return
      }

      setMessage({ type: 'success', text: `Pasien terdaftar — nomor antrian ${result.data.no_antrian}.` })
      setSearchQuery('')
      setSearchResults([])
      setSelectedPasien(null)
      setShowNewPasienForm(false)
      setNewPasien({ nama: '', nik: '', tglLahir: '', jenisKelamin: '', noHp: '' })
      setKeluhan('')
      await refreshAntrian(poliId as string)
    })
  }

  function handleStatusChange(kunjunganId: string, status: 'DIPERIKSA' | 'SELESAI' | 'BATAL') {
    setMessage(null)
    startTransition(async () => {
      const res = await updateStatusKunjungan(kunjunganId, status)
      if ('error' in res) {
        setMessage({ type: 'error', text: res.error })
        return
      }
      if (poliId) await refreshAntrian(poliId)
    })
  }

  if (!branch) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
        Pilih Cabang aktif terlebih dahulu (menu Cabang di ERP) untuk mulai mendaftarkan pasien.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {message && (
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
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Form pendaftaran */}
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <label htmlFor="klinik-poli-select" className="text-sm font-bold text-slate-900">Poli</label>
              <button
                type="button"
                onClick={() => setShowNewPoliForm((v) => !v)}
                className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-cyan-700 transition-colors duration-150 hover:text-cyan-800"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Poli Baru
              </button>
            </div>

            {poliList.length > 0 && (
              <select
                id="klinik-poli-select"
                value={poliId ?? ''}
                onChange={(e) => handlePoliChange(e.target.value)}
                className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition-colors duration-150 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              >
                {poliList.map((poli) => (
                  <option key={poli.id} value={poli.id}>{poli.kode} — {poli.nama}</option>
                ))}
              </select>
            )}

            {showNewPoliForm && (
              <div className="mt-3 space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Kode (mis. UMUM)"
                    value={newPoli.kode}
                    onChange={(e) => setNewPoli((p) => ({ ...p, kode: e.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                  />
                  <input
                    type="text"
                    placeholder="Nama poli"
                    value={newPoli.nama}
                    onChange={(e) => setNewPoli((p) => ({ ...p, nama: e.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCreatePoli}
                  disabled={pending}
                  className="cursor-pointer rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors duration-150 hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Simpan Poli
                </button>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <p className="mb-3 text-sm font-bold text-slate-900">Pasien</p>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Cari nama, no. RM, NIK, atau no. HP..."
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none transition-colors duration-150 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              />
            </div>

            {selectedPasien ? (
              <div className="mt-3 flex items-center justify-between rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2.5">
                <div>
                  <p className="text-sm font-semibold text-cyan-900">{selectedPasien.nama}</p>
                  <p className="text-xs text-cyan-700">{selectedPasien.no_rm}{selectedPasien.nik ? ` · NIK ${selectedPasien.nik}` : ''}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPasien(null)}
                  className="cursor-pointer text-xs font-semibold text-cyan-700 underline transition-colors duration-150 hover:text-cyan-900"
                >
                  Ganti
                </button>
              </div>
            ) : (
              <>
                {searchResults.length > 0 && (
                  <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                    {searchResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { setSelectedPasien(p); setSearchResults([]); setSearchQuery('') }}
                        className="flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-slate-50"
                      >
                        <span className="font-medium text-slate-900">{p.nama}</span>
                        <span className="text-xs text-slate-500">{p.no_rm}</span>
                      </button>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowNewPasienForm((v) => !v)}
                  className="mt-3 flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-cyan-700 transition-colors duration-150 hover:text-cyan-800"
                >
                  <UserPlus className="size-3.5" aria-hidden="true" />
                  {showNewPasienForm ? 'Batal daftar pasien baru' : 'Pasien belum terdaftar? Daftarkan baru'}
                </button>

                {showNewPasienForm && (
                  <div className="mt-3 space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <input
                      type="text"
                      placeholder="Nama lengkap *"
                      value={newPasien.nama}
                      onChange={(e) => setNewPasien((p) => ({ ...p, nama: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="NIK"
                        value={newPasien.nik}
                        onChange={(e) => setNewPasien((p) => ({ ...p, nik: e.target.value }))}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                      />
                      <input
                        type="date"
                        value={newPasien.tglLahir}
                        onChange={(e) => setNewPasien((p) => ({ ...p, tglLahir: e.target.value }))}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={newPasien.jenisKelamin}
                        onChange={(e) => setNewPasien((p) => ({ ...p, jenisKelamin: e.target.value }))}
                        className="cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                      >
                        <option value="">Jenis kelamin</option>
                        <option value="L">Laki-laki</option>
                        <option value="P">Perempuan</option>
                      </select>
                      <input
                        type="text"
                        placeholder="No. HP"
                        value={newPasien.noHp}
                        onChange={(e) => setNewPasien((p) => ({ ...p, noHp: e.target.value }))}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <p className="mb-3 text-sm font-bold text-slate-900">Detail Kunjungan</p>
            <div className="space-y-1.5">
              <label htmlFor="klinik-jenis-kunjungan" className="text-xs font-semibold text-slate-700">Jenis Kunjungan</label>
              <select
                id="klinik-jenis-kunjungan"
                value={jenisKunjungan}
                onChange={(e) => setJenisKunjungan(e.target.value as 'umum' | 'bpjs' | 'asuransi')}
                className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition-colors duration-150 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              >
                {(Object.keys(JENIS_KUNJUNGAN_LABEL) as Array<keyof typeof JENIS_KUNJUNGAN_LABEL>).map((key) => (
                  <option key={key} value={key}>{JENIS_KUNJUNGAN_LABEL[key]}</option>
                ))}
              </select>
            </div>
            <div className="mt-3 space-y-1.5">
              <label htmlFor="klinik-keluhan" className="text-xs font-semibold text-slate-700">Keluhan (opsional)</label>
              <textarea
                id="klinik-keluhan"
                value={keluhan}
                onChange={(e) => setKeluhan(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition-colors duration-150 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              />
            </div>

            <button
              type="button"
              onClick={handleDaftar}
              disabled={pending || poliList.length === 0}
              className="mt-4 w-full cursor-pointer rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-cyan-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? 'Memproses...' : 'Daftar & Ambil Nomor Antrian'}
            </button>
          </div>
        </div>

        {/* Antrian hari ini */}
        <div className="space-y-4 lg:col-span-3">
          {bookings.length > 0 && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <CalendarCheck className="size-4 text-cyan-600" aria-hidden="true" />
                <p className="text-sm font-bold text-slate-900">Booking Hari Ini — Belum Check-in</p>
              </div>
              <div className="space-y-2">
                {bookings.map((b) => (
                  <div key={b.id} className="flex flex-col gap-2 rounded-xl border border-cyan-100 bg-cyan-50/40 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {new Date(b.starts_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} · {b.pasien_nama}
                      </p>
                      <p className="text-xs text-slate-500">{b.staf_medis_name} · {b.pasien_kontak}{b.keluhan ? ` · ${b.keluhan}` : ''}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCheckIn(b.id)}
                      disabled={pending}
                      className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors duration-150 hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <LogIn className="size-3.5" aria-hidden="true" />
                      Check-in
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-slate-500" aria-hidden="true" />
                <p className="text-sm font-bold text-slate-900">Antrian Hari Ini</p>
              </div>
              <div className="flex items-center gap-1">
                <span className="hidden items-center gap-1.5 pr-1 text-xs font-semibold text-slate-500 sm:flex">
                  <MonitorPlay className="size-3.5" aria-hidden="true" />
                  Layar Antrian
                </span>
                <a
                  href={`/klinik/antrian/${branch.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Buka layar antrian (tab baru)"
                  className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-cyan-700"
                >
                  <ExternalLink className="size-4" aria-hidden="true" />
                </a>
                <button
                  type="button"
                  onClick={handleCopyAntrianLink}
                  title="Salin link layar antrian"
                  className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-cyan-700"
                >
                  {antrianLinkCopied
                    ? <Check className="size-4 text-emerald-600" aria-hidden="true" />
                    : <Copy className="size-4" aria-hidden="true" />}
                </button>
              </div>
            </div>

            {antrian.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">Belum ada pasien terdaftar untuk poli ini hari ini.</p>
            ) : (
              <div className="space-y-2">
                {antrian.map((row) => {
                  const isExpanded = expandedKunjunganId === row.id
                  const canExpand = row.status === 'DIPERIKSA' || row.status === 'SELESAI'
                  return (
                    <div key={row.id} className="rounded-xl border border-slate-100 p-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-base font-bold text-slate-700">
                            {row.no_antrian}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{row.pasien_nama}</p>
                            <p className="text-xs text-slate-500">
                              {row.pasien_no_rm} · {JENIS_KUNJUNGAN_LABEL[row.jenis_kunjungan as 'umum' | 'bpjs' | 'asuransi'] || row.jenis_kunjungan}
                              {row.keluhan ? ` · ${row.keluhan}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', STATUS_BADGE[row.status])}>
                            {STATUS_LABEL[row.status]}
                          </span>
                          {row.status === 'MENUNGGU' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleStatusChange(row.id, 'DIPERIKSA')}
                                disabled={pending}
                                title="Panggil pasien"
                                className="flex size-9 cursor-pointer items-center justify-center rounded-lg text-cyan-600 transition-colors duration-150 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <PhoneCall className="size-4" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStatusChange(row.id, 'BATAL')}
                                disabled={pending}
                                title="Batalkan"
                                className="flex size-9 cursor-pointer items-center justify-center rounded-lg text-rose-600 transition-colors duration-150 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Ban className="size-4" aria-hidden="true" />
                              </button>
                            </>
                          )}
                          {canExpand && (
                            <button
                              type="button"
                              onClick={() => setExpandedKunjunganId(isExpanded ? null : row.id)}
                              title={isExpanded ? 'Tutup pemeriksaan' : 'Buka pemeriksaan'}
                              className="flex size-9 cursor-pointer items-center justify-center rounded-lg text-slate-600 transition-colors duration-150 hover:bg-slate-100"
                            >
                              {isExpanded ? <ChevronUp className="size-4" aria-hidden="true" /> : <ChevronDown className="size-4" aria-hidden="true" />}
                            </button>
                          )}
                        </div>
                      </div>

                      {isExpanded && branch && (
                        <PemeriksaanPanel
                          orgId={orgId}
                          branchId={branch.id}
                          kunjunganId={row.id}
                          pasienId={row.pasien_id}
                          kunjunganStatus={row.status}
                          warehouses={warehouses}
                          dokterList={dokterList}
                          tarifLayananList={tarifLayananList}
                          onFinalized={() => { if (poliId) refreshAntrian(poliId) }}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── TAB: PENGATURAN AKUN ─────────────────────────────────────────────────────

const ACCOUNT_TYPE_LABEL: Record<KlinikAccountOption['type'], string> = {
  ASSET: 'Aset',
  LIABILITY: 'Liabilitas',
  EQUITY: 'Ekuitas',
  REVENUE: 'Pendapatan',
  EXPENSE: 'Beban',
}

const ACCOUNT_ROLE_GROUPS: { title: string; roles: KlinikAccountRole[] }[] = [
  { title: 'Umum', roles: ['kas'] },
  { title: 'Pendapatan', roles: ['pendapatan_konsultasi', 'pendapatan_tindakan', 'pendapatan_obat', 'pendapatan_kamar_inap'] },
  { title: 'Apotek & Persediaan', roles: ['hpp_obat', 'persediaan_obat', 'kerugian_obat_kadaluarsa'] },
  { title: 'BPJS (disiapkan untuk fase integrasi berikutnya)', roles: ['piutang_bpjs'] },
]

function AccountRoleSelect({
  role, value, accounts, onChange,
}: {
  role: KlinikAccountRole
  value: string
  accounts: KlinikAccountOption[]
  onChange: (role: KlinikAccountRole, value: string) => void
}) {
  const grouped = new Map<KlinikAccountOption['type'], KlinikAccountOption[]>()
  for (const account of accounts) {
    const list = grouped.get(account.type) || []
    list.push(account)
    grouped.set(account.type, list)
  }
  const selectId = `klinik-akun-${role}`
  return (
    <div className="space-y-1.5">
      <label htmlFor={selectId} className="text-xs font-semibold text-slate-700">
        {KLINIK_ACCOUNT_ROLE_LABEL[role]}
      </label>
      <select
        id={selectId}
        value={value}
        onChange={(e) => onChange(role, e.target.value)}
        className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors duration-150 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
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

function TabPengaturanAkun({ orgId, branchId, accountMapping, accounts, unpostedCount: initialUnpostedCount }: {
  orgId: string; branchId: string | null; accountMapping: KlinikAccountMapping; accounts: KlinikAccountOption[]; unpostedCount: number
}) {
  const [pending, startTransition] = useTransition()
  const [draft, setDraft] = useState<KlinikAccountMapping>(accountMapping)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [unpostedCount, setUnpostedCount] = useState(initialUnpostedCount)

  const completedCount = KLINIK_ACCOUNT_ROLES.filter((role) => draft[role]).length

  function handleChange(role: KlinikAccountRole, value: string) {
    setDraft((prev) => ({ ...prev, [role]: value || null }))
  }

  function handleSave() {
    setMessage(null)
    startTransition(async () => {
      // branch_id null = simpan sebagai default org-level; override per-cabang
      // menyusul di UI Kasir/Billing (fase berikutnya).
      const res = await saveKlinikAccountMappingAction(orgId, null, draft)
      if (!res.success) {
        setMessage({ type: 'error', text: res.error || 'Pemetaan akun gagal disimpan.' })
        return
      }
      setMessage({ type: 'success', text: 'Pemetaan akun berhasil disimpan.' })
    })
  }

  function handleRetryPosting() {
    if (!branchId) return
    setMessage(null)
    startTransition(async () => {
      const res = await retryPostUnpostedJournals(orgId, branchId)
      setUnpostedCount((prev) => Math.max(0, prev - res.posted))
      setMessage({
        type: res.posted > 0 ? 'success' : 'error',
        text: res.posted > 0
          ? `${res.posted} jurnal berhasil diposting ulang.`
          : 'Belum ada jurnal yang bisa diposting — lengkapi pemetaan akun di atas dulu.',
      })
    })
  }

  return (
    <div className="space-y-4">
      {unpostedCount > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-amber-900">
              {unpostedCount} transaksi belum masuk buku besar
            </p>
            <p className="text-xs text-amber-800">
              Terjadi karena peran akun belum lengkap dipetakan saat transaksi berlangsung. Lengkapi pemetaan di bawah, lalu posting ulang.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRetryPosting}
            disabled={pending || !branchId}
            className="shrink-0 cursor-pointer rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white transition-colors duration-150 hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Posting Jurnal Tertunda
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-cyan-100 bg-cyan-50/60 px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-cyan-900">
          <Landmark className="size-4" aria-hidden="true" />
          Pemetaan Akun COA ({completedCount}/{KLINIK_ACCOUNT_ROLES.length} terisi)
        </p>
        <p className="mt-0.5 text-xs text-cyan-800">
          Tentukan akun mana dari Chart of Account klinik ini yang dipakai tiap jenis jurnal.
          Peran yang belum dipetakan akan dilewati (transaksi tetap tercatat di modul,
          hanya belum masuk buku besar akuntansi).
        </p>
      </div>

      {message && (
        <div
          role="status"
          className={cn(
            'flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold',
            message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-800'
          )}
        >
          {message.type === 'success'
            ? <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
            : <AlertCircle className="size-4 shrink-0" aria-hidden="true" />}
          {message.text}
        </div>
      )}

      {ACCOUNT_ROLE_GROUPS.map((group) => (
        <div key={group.title} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="mb-3 text-sm font-bold text-slate-900">{group.title}</p>
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
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="cursor-pointer rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-cyan-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? 'Menyimpan...' : 'Simpan Pemetaan Akun'}
        </button>
      </div>
    </div>
  )
}

// ─── TAB: TENAGA MEDIS ────────────────────────────────────────────────────────

const JENIS_TENAGA_MEDIS_LABEL: Record<KlinikStafMedis['jenis'], string> = {
  dokter: 'Dokter',
  perawat: 'Perawat',
  bidan: 'Bidan',
  apoteker: 'Apoteker',
}

function TabTenagaMedis({
  orgId, employees, stafMedisList: initialList, poliList,
}: {
  orgId: string
  employees: Array<{ id: string; name: string }>
  stafMedisList: KlinikStafMedis[]
  poliList: KlinikPoli[]
}) {
  const [pending, startTransition] = useTransition()
  const [stafMedisList, setStafMedisList] = useState(initialList)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ employeeId: '', jenis: 'dokter' as KlinikStafMedis['jenis'], strNumber: '', sipNumber: '', spesialisasi: '', poliId: '' })

  const alreadyLinkedIds = new Set(stafMedisList.map((s) => s.employee_id))
  const availableEmployees = employees.filter((e) => !alreadyLinkedIds.has(e.id))

  function handleCreate() {
    if (!form.employeeId) {
      setMessage({ type: 'error', text: 'Pilih karyawan terlebih dahulu.' })
      return
    }
    setMessage(null)
    startTransition(async () => {
      const res = await createKlinikStafMedis(orgId, {
        employeeId: form.employeeId,
        jenis: form.jenis,
        strNumber: form.strNumber || null,
        sipNumber: form.sipNumber || null,
        spesialisasi: form.spesialisasi || null,
        poliId: form.poliId || null,
      })
      if ('error' in res) {
        setMessage({ type: 'error', text: res.error })
        return
      }
      setStafMedisList((prev) => [...prev, res.data])
      setShowForm(false)
      setForm({ employeeId: '', jenis: 'dokter', strNumber: '', sipNumber: '', spesialisasi: '', poliId: '' })
      setMessage({ type: 'success', text: 'Tenaga medis berhasil ditambahkan.' })
    })
  }

  return (
    <div className="space-y-4">
      {message && (
        <div
          role="status"
          className={cn(
            'flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold',
            message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-800'
          )}
        >
          {message.type === 'success'
            ? <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
            : <AlertCircle className="size-4 shrink-0" aria-hidden="true" />}
          {message.text}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <UserCog className="size-4 text-slate-500" aria-hidden="true" />
            Dokter, Perawat, Bidan &amp; Apoteker
          </p>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-cyan-700 transition-colors duration-150 hover:text-cyan-800"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Tautkan Karyawan
          </button>
        </div>

        {showForm && (
          <div className="mb-4 space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">
              Karyawan harus sudah terdaftar di modul HRIS. Menautkan di sini menambah kredensial medis (STR/SIP) tanpa mengubah data payroll.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                value={form.employeeId}
                onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}
                className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              >
                <option value="">Pilih karyawan</option>
                {availableEmployees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
              <select
                value={form.jenis}
                onChange={(e) => setForm((f) => ({ ...f, jenis: e.target.value as KlinikStafMedis['jenis'] }))}
                className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              >
                {(Object.keys(JENIS_TENAGA_MEDIS_LABEL) as Array<KlinikStafMedis['jenis']>).map((jenis) => (
                  <option key={jenis} value={jenis}>{JENIS_TENAGA_MEDIS_LABEL[jenis]}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="No. STR"
                value={form.strNumber}
                onChange={(e) => setForm((f) => ({ ...f, strNumber: e.target.value }))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              />
              <input
                type="text"
                placeholder="No. SIP"
                value={form.sipNumber}
                onChange={(e) => setForm((f) => ({ ...f, sipNumber: e.target.value }))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              />
              <input
                type="text"
                placeholder="Spesialisasi (opsional)"
                value={form.spesialisasi}
                onChange={(e) => setForm((f) => ({ ...f, spesialisasi: e.target.value }))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              />
              <select
                value={form.poliId}
                onChange={(e) => setForm((f) => ({ ...f, poliId: e.target.value }))}
                className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              >
                <option value="">Poli utama (opsional)</option>
                {poliList.map((p) => (
                  <option key={p.id} value={p.id}>{p.nama}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleCreate}
              disabled={pending}
              className="cursor-pointer rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white transition-colors duration-150 hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Simpan
            </button>
          </div>
        )}

        {stafMedisList.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Belum ada tenaga medis ditautkan.</p>
        ) : (
          <div className="space-y-2">
            {stafMedisList.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{s.employee_name}</p>
                  <p className="text-xs text-slate-500">
                    {JENIS_TENAGA_MEDIS_LABEL[s.jenis]}
                    {s.str_number ? ` · STR ${s.str_number}` : ''}
                    {s.spesialisasi ? ` · ${s.spesialisasi}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── TAB: APOTEK ──────────────────────────────────────────────────────────────

function TabApotek({
  orgId, branch, warehouses,
}: {
  orgId: string
  branch: BranchSummary | null
  warehouses: KlinikWarehouseOption[]
}) {
  const [pending, startTransition] = useTransition()
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [pendingResep, setPendingResep] = useState<KlinikPendingResep[]>([])
  const [stock, setStock] = useState<KlinikObatStockRow[]>([])

  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '')
  const [obatQuery, setObatQuery] = useState('')
  const [obatResults, setObatResults] = useState<KlinikObatOption[]>([])
  const [selectedObat, setSelectedObat] = useState<KlinikObatOption | null>(null)
  const [receiveForm, setReceiveForm] = useState({ jumlah: '1', batchNumber: '', expiryDate: '', hargaBeli: '' })

  async function loadData() {
    if (!branch) {
      setLoading(false)
      return
    }
    const [resep, stockRows] = await Promise.all([
      getPendingResepByBranch(orgId, branch.id),
      getObatStockByBranch(orgId, branch.id),
    ])
    setPendingResep(resep)
    setStock(stockRows)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch?.id])

  function handleDispense(resepId: string) {
    if (!branch) return
    setMessage(null)
    startTransition(async () => {
      const res = await dispenseResep(orgId, branch.id, resepId)
      if ('error' in res) {
        setMessage({ type: 'error', text: res.error })
        return
      }
      setMessage({ type: 'success', text: 'Obat berhasil diserahkan ke pasien.' })
      await loadData()
    })
  }

  function handleObatSearch(q: string) {
    setObatQuery(q)
    setSelectedObat(null)
    if (q.trim().length < 2) {
      setObatResults([])
      return
    }
    startTransition(async () => {
      setObatResults(await searchKlinikObat(orgId, q))
    })
  }

  function handleReceive() {
    if (!branch) return
    if (!selectedObat) {
      setMessage({ type: 'error', text: 'Pilih obat terlebih dahulu.' })
      return
    }
    if (!warehouseId) {
      setMessage({ type: 'error', text: 'Pilih gudang terlebih dahulu.' })
      return
    }
    setMessage(null)
    startTransition(async () => {
      const res = await receiveObat({
        orgId,
        branchId: branch.id,
        productId: selectedObat.id,
        warehouseId,
        jumlah: Number(receiveForm.jumlah) || 0,
        batchNumber: receiveForm.batchNumber,
        expiryDate: receiveForm.expiryDate,
        hargaBeli: Number(receiveForm.hargaBeli) || 0,
      })
      if ('error' in res) {
        setMessage({ type: 'error', text: res.error })
        return
      }
      setMessage({ type: 'success', text: 'Penerimaan obat tercatat.' })
      setSelectedObat(null)
      setObatQuery('')
      setReceiveForm({ jumlah: '1', batchNumber: '', expiryDate: '', hargaBeli: '' })
      await loadData()
    })
  }

  if (!branch) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
        Pilih Cabang aktif terlebih dahulu untuk mengelola apotek.
      </div>
    )
  }

  if (loading) {
    return <p className="py-8 text-center text-sm text-slate-400">Memuat data apotek...</p>
  }

  return (
    <div className="space-y-6">
      {message && (
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
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Pill className="size-4 text-cyan-600" aria-hidden="true" />
              <p className="text-sm font-bold text-slate-900">Resep Menunggu Diserahkan</p>
            </div>

            {pendingResep.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">Tidak ada resep yang menunggu diserahkan.</p>
            ) : (
              <div className="space-y-2">
                {pendingResep.map((resep) => (
                  <div key={resep.id} className="rounded-xl border border-slate-100 p-3">
                    <div className="mb-1.5 flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900">
                        No. {resep.no_antrian} · {resep.pasien_nama} <span className="font-normal text-slate-400">({resep.pasien_no_rm})</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => handleDispense(resep.id)}
                        disabled={pending}
                        className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors duration-150 hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Send className="size-3.5" aria-hidden="true" />
                        Serahkan Obat
                      </button>
                    </div>
                    <ul className="space-y-0.5 text-xs text-slate-600">
                      {resep.items.map((item) => (
                        <li key={item.id}>{item.product_name} × {item.jumlah}{item.dosis ? ` — ${item.dosis}` : ''}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Boxes className="size-4 text-slate-500" aria-hidden="true" />
              <p className="text-sm font-bold text-slate-900">Stok Obat</p>
            </div>
            {stock.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">Belum ada stok obat tercatat.</p>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-500">
                      <th className="py-1.5 font-semibold">Obat</th>
                      <th className="py-1.5 font-semibold">Batch</th>
                      <th className="py-1.5 font-semibold">Kadaluarsa</th>
                      <th className="py-1.5 text-right font-semibold">Stok</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stock.map((s, i) => (
                      <tr key={`${s.product_id}-${s.batch_number}-${i}`} className="border-b border-slate-50">
                        <td className="py-1.5 text-slate-800">{s.product_name}</td>
                        <td className="py-1.5 text-slate-500">{s.batch_number || '—'}</td>
                        <td className={cn('py-1.5', s.expiry_date && new Date(s.expiry_date) < new Date() ? 'font-semibold text-rose-600' : 'text-slate-500')}>
                          {s.expiry_date ? new Date(s.expiry_date).toLocaleDateString('id-ID') : '—'}
                        </td>
                        <td className="py-1.5 text-right font-semibold tabular-nums text-slate-800">{s.quantity} {s.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <PackagePlus className="size-4 text-cyan-600" aria-hidden="true" />
              <p className="text-sm font-bold text-slate-900">Penerimaan Obat</p>
            </div>

            {warehouses.length > 1 && (
              <div className="mb-3 space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Gudang</label>
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  className="w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="relative">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  type="text"
                  value={selectedObat ? selectedObat.name : obatQuery}
                  onChange={(e) => handleObatSearch(e.target.value)}
                  placeholder="Cari nama obat..."
                  className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none transition-colors duration-150 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                />
              </div>
              {obatResults.length > 0 && !selectedObat && (
                <div className="absolute z-10 mt-1 w-full space-y-0.5 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                  {obatResults.map((obat) => (
                    <button
                      key={obat.id}
                      type="button"
                      onClick={() => { setSelectedObat(obat); setObatResults([]) }}
                      className="flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-150 hover:bg-slate-50"
                    >
                      <span>{obat.name}</span>
                      <span className="text-xs text-slate-400">{obat.unit}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Jumlah</label>
                <input
                  type="number"
                  min={1}
                  value={receiveForm.jumlah}
                  onChange={(e) => setReceiveForm((f) => ({ ...f, jumlah: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">No. Batch</label>
                <input
                  type="text"
                  value={receiveForm.batchNumber}
                  onChange={(e) => setReceiveForm((f) => ({ ...f, batchNumber: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Harga Beli per Unit (Rp)</label>
                <input
                  type="number"
                  min={1}
                  value={receiveForm.hargaBeli}
                  onChange={(e) => setReceiveForm((f) => ({ ...f, hargaBeli: e.target.value }))}
                  placeholder="Dipakai untuk hitung HPP saat obat diserahkan ke pasien"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Tanggal Kadaluarsa</label>
                <input
                  type="date"
                  value={receiveForm.expiryDate}
                  onChange={(e) => setReceiveForm((f) => ({ ...f, expiryDate: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleReceive}
              disabled={pending}
              className="mt-4 w-full cursor-pointer rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? 'Memproses...' : 'Catat Penerimaan Obat'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── ROOT ──────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'pendaftaran' as const, label: 'Pendaftaran & Antrian' },
  { key: 'apotek' as const, label: 'Apotek' },
  { key: 'mutasi-obat' as const, label: 'Mutasi Obat' },
  { key: 'rawat-inap' as const, label: 'Rawat Inap' },
  { key: 'poli' as const, label: 'Daftar Poli' },
  { key: 'pasien' as const, label: 'Daftar Pasien' },
  { key: 'tenaga-medis' as const, label: 'Tenaga Medis' },
  { key: 'akun' as const, label: 'Pengaturan Akun' },
]

export default function KlinikClient({
  orgId, branch, poliList, initialPoliId, initialAntrian, warehouses, stafMedisList, tarifLayananList, employees,
  accountMapping, chartOfAccounts, unpostedCount,
}: {
  orgId: string
  branch: BranchSummary | null
  poliList: KlinikPoli[]
  initialPoliId: string | null
  initialAntrian: KlinikAntrianRow[]
  warehouses: KlinikWarehouseOption[]
  stafMedisList: KlinikStafMedis[]
  tarifLayananList: KlinikTarifLayanan[]
  employees: Array<{ id: string; name: string }>
  accountMapping: KlinikAccountMapping
  chartOfAccounts: KlinikAccountOption[]
  unpostedCount: number
}) {
  const [activeTab, setActiveTab] = useState<typeof TABS[number]['key']>('pendaftaran')
  const dokterList = stafMedisList.filter((s) => s.jenis === 'dokter' || s.jenis === 'perawat' || s.jenis === 'bidan')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
          <Stethoscope className="size-5" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Klinik Pratama</h1>
          <p className="text-sm text-slate-500">
            {branch ? `Cabang aktif: ${branch.name}` : 'Belum ada Cabang aktif dipilih.'}
          </p>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'cursor-pointer whitespace-nowrap rounded-t-lg px-4 py-2.5 text-sm font-semibold transition-colors duration-150',
              activeTab === tab.key
                ? 'border-b-2 border-cyan-600 text-cyan-700'
                : 'text-slate-500 hover:text-slate-900'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'pendaftaran' && (
        <TabPendaftaran
          orgId={orgId}
          branch={branch}
          poliList={poliList}
          initialPoliId={initialPoliId}
          initialAntrian={initialAntrian}
          warehouses={warehouses}
          dokterList={dokterList}
          tarifLayananList={tarifLayananList}
        />
      )}
      {activeTab === 'apotek' && (
        <TabApotek orgId={orgId} branch={branch} warehouses={warehouses} />
      )}
      {activeTab === 'mutasi-obat' && (
        <TabMutasiObat orgId={orgId} branch={branch} />
      )}
      {activeTab === 'rawat-inap' && (
        <TabRawatInap orgId={orgId} branch={branch} poliList={poliList} dokterList={dokterList} />
      )}
      {activeTab === 'poli' && (
        <TabDaftarPoli orgId={orgId} branch={branch} />
      )}
      {activeTab === 'pasien' && (
        <TabDaftarPasien orgId={orgId} />
      )}
      {activeTab === 'tenaga-medis' && (
        <TabTenagaMedis orgId={orgId} employees={employees} stafMedisList={stafMedisList} poliList={poliList} />
      )}
      {activeTab === 'akun' && (
        <TabPengaturanAkun
          orgId={orgId}
          branchId={branch?.id ?? null}
          accountMapping={accountMapping}
          accounts={chartOfAccounts}
          unpostedCount={unpostedCount}
        />
      )}
    </div>
  )
}
