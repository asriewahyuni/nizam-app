'use client'

import { useEffect, useState, useTransition } from 'react'
import { FileText, Pill, Plus, Trash2, CheckCircle2, AlertCircle, Send, Receipt, Undo2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getRekamMedisByKunjungan, saveRekamMedisDraft, finalizeRekamMedis,
  type KlinikRekamMedis,
} from '@/modules/klinik/actions/klinik-rekam-medis.actions'
import {
  getResepByKunjungan, createResep, dispenseResep, searchKlinikObat,
  type KlinikResepRow, type KlinikResepDetailRow, type KlinikObatOption, type KlinikWarehouseOption,
} from '@/modules/klinik/actions/klinik-resep.actions'
import {
  getTagihanByKunjungan, createTagihan, markTagihanLunas, voidTagihan,
  type KlinikTagihan, type KlinikTagihanDetailRow,
} from '@/modules/klinik/actions/klinik-tagihan.actions'
import { getRawatInapByKunjungan, type KlinikRawatInapDetail } from '@/modules/klinik/actions/klinik-kamar.actions'
import type { KlinikStafMedis, KlinikTarifLayanan } from '@/modules/klinik/actions/klinik.actions'

type ResepWithItems = KlinikResepRow & { items: KlinikResepDetailRow[] }

const METODE_BAYAR_LABEL: Record<'tunai' | 'bpjs' | 'asuransi', string> = {
  tunai: 'Tunai',
  bpjs: 'BPJS',
  asuransi: 'Asuransi',
}

export default function PemeriksaanPanel({
  orgId, branchId, kunjunganId, pasienId, kunjunganStatus, warehouses, dokterList, tarifLayananList, onFinalized,
}: {
  orgId: string
  branchId: string
  kunjunganId: string
  pasienId: string
  kunjunganStatus: 'MENUNGGU' | 'DIPERIKSA' | 'SELESAI' | 'BATAL'
  warehouses: KlinikWarehouseOption[]
  dokterList: KlinikStafMedis[]
  tarifLayananList: KlinikTarifLayanan[]
  onFinalized: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [rekamMedis, setRekamMedis] = useState<KlinikRekamMedis | null>(null)
  const [form, setForm] = useState({
    stafMedisId: '', anamnesis: '', diagnosisIcd10: '', diagnosisText: '', terapi: '', catatan: '',
  })

  const [resepList, setResepList] = useState<ResepWithItems[]>([])
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '')
  const [obatQuery, setObatQuery] = useState('')
  const [obatResults, setObatResults] = useState<KlinikObatOption[]>([])
  const [draftItems, setDraftItems] = useState<Array<{ product: KlinikObatOption; jumlah: number; dosis: string }>>([])

  const [tagihan, setTagihan] = useState<{ tagihan: KlinikTagihan; items: KlinikTagihanDetailRow[] } | null>(null)
  const [selectedLayananIds, setSelectedLayananIds] = useState<string[]>([])
  const [metodeBayar, setMetodeBayar] = useState<'tunai' | 'bpjs' | 'asuransi'>('tunai')
  const [rawatInap, setRawatInap] = useState<KlinikRawatInapDetail | null>(null)

  async function loadData() {
    const [rm, resep, tagihanData, rawatInapData] = await Promise.all([
      getRekamMedisByKunjungan(kunjunganId),
      getResepByKunjungan(kunjunganId),
      getTagihanByKunjungan(kunjunganId),
      getRawatInapByKunjungan(kunjunganId),
    ])
    setRawatInap(rawatInapData)
    setRekamMedis(rm.rekamMedis)
    if (rm.rekamMedis) {
      setForm({
        stafMedisId: rm.rekamMedis.staf_medis_id || '',
        anamnesis: rm.rekamMedis.anamnesis || '',
        diagnosisIcd10: rm.rekamMedis.diagnosis_icd10 || '',
        diagnosisText: rm.rekamMedis.diagnosis_text || '',
        terapi: rm.rekamMedis.terapi || '',
        catatan: rm.rekamMedis.catatan || '',
      })
    }
    setResepList(resep)
    setTagihan(tagihanData)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kunjunganId])

  const isLocked = rekamMedis?.status === 'FINAL'

  function handleSaveDraft() {
    setMessage(null)
    startTransition(async () => {
      const res = await saveRekamMedisDraft(orgId, kunjunganId, {
        stafMedisId: form.stafMedisId || null,
        anamnesis: form.anamnesis || null,
        diagnosisIcd10: form.diagnosisIcd10 || null,
        diagnosisText: form.diagnosisText || null,
        terapi: form.terapi || null,
        catatan: form.catatan || null,
      })
      if ('error' in res) {
        setMessage({ type: 'error', text: res.error })
        return
      }
      setRekamMedis(res.data)
      setMessage({ type: 'success', text: 'Rekam medis tersimpan (draft).' })
    })
  }

  function handleFinalize() {
    if (!rekamMedis) return
    setMessage(null)
    startTransition(async () => {
      const res = await finalizeRekamMedis(rekamMedis.id, form.stafMedisId || null)
      if ('error' in res) {
        setMessage({ type: 'error', text: res.error })
        return
      }
      setMessage({ type: 'success', text: 'Pemeriksaan selesai — rekam medis dikunci.' })
      await loadData()
      onFinalized()
    })
  }

  function handleObatSearch(q: string) {
    setObatQuery(q)
    if (q.trim().length < 2) {
      setObatResults([])
      return
    }
    startTransition(async () => {
      setObatResults(await searchKlinikObat(orgId, q))
    })
  }

  function addDraftItem(product: KlinikObatOption) {
    setDraftItems((prev) => [...prev, { product, jumlah: 1, dosis: '' }])
    setObatQuery('')
    setObatResults([])
  }

  function removeDraftItem(index: number) {
    setDraftItems((prev) => prev.filter((_, i) => i !== index))
  }

  function handleCreateResep() {
    if (draftItems.length === 0) {
      setMessage({ type: 'error', text: 'Tambahkan minimal 1 obat ke resep.' })
      return
    }
    if (!warehouseId) {
      setMessage({ type: 'error', text: 'Pilih gudang apotek terlebih dahulu.' })
      return
    }
    setMessage(null)
    startTransition(async () => {
      const res = await createResep({
        orgId, branchId, kunjunganId, warehouseId,
        stafMedisId: form.stafMedisId || null,
        items: draftItems.map((d) => ({ productId: d.product.id, jumlah: d.jumlah, dosis: d.dosis || null })),
      })
      if ('error' in res) {
        setMessage({ type: 'error', text: res.error })
        return
      }
      setDraftItems([])
      setMessage({ type: 'success', text: 'Resep tersimpan.' })
      await loadData()
    })
  }

  function handleDispense(resepId: string) {
    setMessage(null)
    startTransition(async () => {
      const res = await dispenseResep(orgId, branchId, resepId)
      if ('error' in res) {
        setMessage({ type: 'error', text: res.error })
        return
      }
      setMessage({ type: 'success', text: 'Obat berhasil diserahkan ke pasien.' })
      await loadData()
    })
  }

  function toggleLayanan(id: string) {
    setSelectedLayananIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function handleCreateTagihan() {
    setMessage(null)
    startTransition(async () => {
      const res = await createTagihan({
        orgId, branchId, kunjunganId, pasienId, metodeBayar,
        layananItems: selectedLayananIds.map((id) => ({ tarifLayananId: id, qty: 1 })),
      })
      if ('error' in res) {
        setMessage({ type: 'error', text: res.error })
        return
      }
      setMessage({ type: 'success', text: 'Tagihan dibuat.' })
      await loadData()
    })
  }

  function handleMarkLunas() {
    if (!tagihan) return
    setMessage(null)
    startTransition(async () => {
      const res = await markTagihanLunas(orgId, branchId, tagihan.tagihan.id)
      if ('error' in res) {
        setMessage({ type: 'error', text: res.error })
        return
      }
      setMessage({ type: 'success', text: 'Pembayaran tercatat.' })
      await loadData()
    })
  }

  function handleVoidTagihan() {
    if (!tagihan) return
    if (!window.confirm('Batalkan tagihan ini? Jurnal akan dibalik dan obat yang sudah diserahkan akan dikembalikan ke stok.')) return
    setMessage(null)
    startTransition(async () => {
      const res = await voidTagihan(orgId, branchId, tagihan.tagihan.id)
      if ('error' in res) {
        setMessage({ type: 'error', text: res.error })
        return
      }
      setMessage({ type: 'success', text: 'Tagihan dibatalkan.' })
      await loadData()
    })
  }

  if (loading) {
    return <p className="py-4 text-center text-sm text-slate-400">Memuat rekam medis...</p>
  }

  return (
    <div className="space-y-4 border-t border-slate-100 pt-4">
      {message && (
        <div
          role="status"
          className={cn(
            'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold',
            message.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          )}
        >
          {message.type === 'success'
            ? <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
            : <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />}
          {message.text}
        </div>
      )}

      {/* Rekam Medis */}
      <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <FileText className="size-4 text-cyan-600" aria-hidden="true" />
            Rekam Medis
          </p>
          {isLocked && (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
              Final — terkunci
            </span>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">Dokter/Perawat Pemeriksa</label>
          <select
            value={form.stafMedisId}
            onChange={(e) => setForm((f) => ({ ...f, stafMedisId: e.target.value }))}
            disabled={isLocked}
            className="w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            <option value="">— Pilih —</option>
            {dokterList.map((d) => (
              <option key={d.id} value={d.id}>{d.employee_name} ({d.jenis})</option>
            ))}
          </select>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-semibold text-slate-700">Anamnesis</label>
            <textarea
              value={form.anamnesis}
              onChange={(e) => setForm((f) => ({ ...f, anamnesis: e.target.value }))}
              disabled={isLocked}
              rows={2}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Kode Diagnosis (ICD-10)</label>
            <input
              type="text"
              value={form.diagnosisIcd10}
              onChange={(e) => setForm((f) => ({ ...f, diagnosisIcd10: e.target.value }))}
              disabled={isLocked}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Diagnosis</label>
            <input
              type="text"
              value={form.diagnosisText}
              onChange={(e) => setForm((f) => ({ ...f, diagnosisText: e.target.value }))}
              disabled={isLocked}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-semibold text-slate-700">Terapi</label>
            <textarea
              value={form.terapi}
              onChange={(e) => setForm((f) => ({ ...f, terapi: e.target.value }))}
              disabled={isLocked}
              rows={2}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-semibold text-slate-700">Catatan{isLocked ? ' (addendum ditambahkan otomatis di sini)' : ''}</label>
            <textarea
              value={form.catatan}
              onChange={(e) => setForm((f) => ({ ...f, catatan: e.target.value }))}
              disabled={isLocked}
              rows={2}
              className="w-full whitespace-pre-wrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
          </div>
        </div>

        {!isLocked && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={pending}
              className="cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors duration-150 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Simpan Draft
            </button>
            <button
              type="button"
              onClick={handleFinalize}
              disabled={pending || !rekamMedis}
              title={!rekamMedis ? 'Simpan draft terlebih dahulu' : undefined}
              className="cursor-pointer rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-colors duration-150 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Selesaikan Pemeriksaan
            </button>
          </div>
        )}
      </div>

      {/* Resep & Apotek */}
      <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
        <p className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
          <Pill className="size-4 text-cyan-600" aria-hidden="true" />
          Resep & Apotek
        </p>

        {resepList.length > 0 && (
          <div className="mb-3 space-y-2">
            {resepList.map((resep) => (
              <div key={resep.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className={cn(
                    'rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                    resep.status === 'DISPENSED' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'
                  )}>
                    {resep.status === 'DISPENSED' ? 'Sudah diserahkan' : 'Menunggu diserahkan'}
                  </span>
                  {resep.status === 'PENDING' && (
                    <button
                      type="button"
                      onClick={() => handleDispense(resep.id)}
                      disabled={pending}
                      className="flex cursor-pointer items-center gap-1 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors duration-150 hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Send className="size-3" aria-hidden="true" />
                      Serahkan Obat
                    </button>
                  )}
                </div>
                <ul className="space-y-0.5 text-xs text-slate-600">
                  {resep.items.map((item) => (
                    <li key={item.id}>
                      {item.product_name} × {item.jumlah}{item.dosis ? ` — ${item.dosis}` : ''}
                      {item.batch_number ? ` (batch ${item.batch_number})` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {!isLocked && (
          <>
            {warehouses.length > 1 && (
              <div className="mb-2 space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Gudang Apotek</label>
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
              <input
                type="text"
                value={obatQuery}
                onChange={(e) => handleObatSearch(e.target.value)}
                placeholder="Cari nama obat..."
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              />
              {obatResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full space-y-0.5 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                  {obatResults.map((obat) => (
                    <button
                      key={obat.id}
                      type="button"
                      onClick={() => addDraftItem(obat)}
                      className="flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-150 hover:bg-slate-50"
                    >
                      <span>{obat.name}</span>
                      <span className="text-xs text-slate-400">{obat.unit}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {draftItems.length > 0 && (
              <div className="mt-2 space-y-2">
                {draftItems.map((item, index) => (
                  <div key={`${item.product.id}-${index}`} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2">
                    <span className="flex-1 text-sm font-medium text-slate-800">{item.product.name}</span>
                    <input
                      type="number"
                      min={1}
                      value={item.jumlah}
                      onChange={(e) => setDraftItems((prev) => prev.map((d, i) => i === index ? { ...d, jumlah: Number(e.target.value) || 1 } : d))}
                      className="w-16 rounded-md border border-slate-200 px-2 py-1 text-sm outline-none focus:border-cyan-500"
                    />
                    <input
                      type="text"
                      placeholder="Aturan pakai"
                      value={item.dosis}
                      onChange={(e) => setDraftItems((prev) => prev.map((d, i) => i === index ? { ...d, dosis: e.target.value } : d))}
                      className="w-32 rounded-md border border-slate-200 px-2 py-1 text-sm outline-none focus:border-cyan-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeDraftItem(index)}
                      title="Hapus"
                      className="flex size-7 cursor-pointer items-center justify-center rounded-md text-rose-500 transition-colors duration-150 hover:bg-rose-50"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleCreateResep}
                  disabled={pending}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white transition-colors duration-150 hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  Simpan Resep
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Kasir & Tagihan — muncul setelah pemeriksaan selesai */}
      {kunjunganStatus === 'SELESAI' && (
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
            <Receipt className="size-4 text-cyan-600" aria-hidden="true" />
            Kasir &amp; Tagihan
          </p>

          {!tagihan ? (
            <div className="space-y-3">
              {tarifLayananList.length === 0 ? (
                <p className="text-xs text-slate-500">Belum ada tarif layanan. Tambahkan dulu di menu Pengaturan.</p>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-700">Layanan yang diberikan</p>
                  {tarifLayananList.map((t) => (
                    <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors duration-150 hover:bg-white">
                      <input
                        type="checkbox"
                        checked={selectedLayananIds.includes(t.id)}
                        onChange={() => toggleLayanan(t.id)}
                        className="size-4 cursor-pointer accent-cyan-600"
                      />
                      <span className="flex-1 text-slate-800">{t.nama_layanan}</span>
                      <span className="text-xs text-slate-500">Rp {t.harga.toLocaleString('id-ID')}</span>
                    </label>
                  ))}
                </div>
              )}

              {resepList.some((r) => r.status === 'DISPENSED') && (
                <p className="text-xs text-slate-500">Obat yang sudah diserahkan akan otomatis ditambahkan ke tagihan.</p>
              )}
              {rawatInap && rawatInap.status === 'PULANG' && (
                <p className="rounded-lg border border-cyan-100 bg-cyan-50/60 px-3 py-2 text-xs text-cyan-800">
                  Kamar {rawatInap.kamar_nama} ({rawatInap.tempat_tidur_kode}) — {rawatInap.malam} malam × Rp {rawatInap.tarif_per_malam_snapshot.toLocaleString('id-ID')} akan otomatis ditambahkan ke tagihan.
                </p>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Metode Pembayaran</label>
                <select
                  value={metodeBayar}
                  onChange={(e) => setMetodeBayar(e.target.value as 'tunai' | 'bpjs' | 'asuransi')}
                  className="w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                >
                  {(Object.keys(METODE_BAYAR_LABEL) as Array<'tunai' | 'bpjs' | 'asuransi'>).map((key) => (
                    <option key={key} value={key}>{METODE_BAYAR_LABEL[key]}</option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleCreateTagihan}
                disabled={pending}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white transition-colors duration-150 hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Receipt className="size-3.5" aria-hidden="true" />
                Buat Tagihan
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className={cn(
                    'rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                    tagihan.tagihan.status === 'LUNAS'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : tagihan.tagihan.status === 'VOID'
                        ? 'border-rose-200 bg-rose-50 text-rose-800'
                        : 'border-amber-200 bg-amber-50 text-amber-800'
                  )}>
                    {tagihan.tagihan.status === 'LUNAS' ? 'Lunas' : tagihan.tagihan.status === 'VOID' ? 'Dibatalkan' : 'Belum Bayar'}
                    {' · '}{METODE_BAYAR_LABEL[tagihan.tagihan.metode_bayar]}
                  </span>
                  <span className="text-sm font-bold tabular-nums text-slate-900">
                    Rp {tagihan.tagihan.total_tagihan.toLocaleString('id-ID')}
                  </span>
                </div>
                <ul className="space-y-0.5 text-xs text-slate-600">
                  {tagihan.items.map((item) => (
                    <li key={item.id} className="flex justify-between">
                      <span>{item.deskripsi} × {item.qty}</span>
                      <span className="tabular-nums">Rp {item.subtotal.toLocaleString('id-ID')}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-2">
                {tagihan.tagihan.status === 'BELUM_BAYAR' && (
                  <button
                    type="button"
                    onClick={handleMarkLunas}
                    disabled={pending}
                    className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-colors duration-150 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <CheckCircle2 className="size-3.5" aria-hidden="true" />
                    Tandai Lunas
                  </button>
                )}
                {tagihan.tagihan.status !== 'VOID' && (
                  <button
                    type="button"
                    onClick={handleVoidTagihan}
                    disabled={pending}
                    className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-700 transition-colors duration-150 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Undo2 className="size-3.5" aria-hidden="true" />
                    Batalkan Tagihan
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
