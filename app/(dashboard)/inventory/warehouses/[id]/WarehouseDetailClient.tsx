'use client'

import React, { useEffect, useState } from 'react'
import { ArrowLeft, Plus, MapPin, Search, Maximize, CheckCircle2, Trash2, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatDate, formatRupiah } from '@/lib/utils'
import { createWarehouseBin, deleteWarehouseBin } from '@/modules/inventory/actions/warehouse.actions'

type WarehouseBinStockItem = {
  product_id: string
  product_name: string
  product_sku: string | null
  product_unit: string | null
  batch_number: string | null
  expiry_date: string | null
  quantity: number
  unit_cost: number
  stock_value: number
}

type WarehouseBinSummary = {
  sku_count: number
  batch_count: number
  total_quantity: number
  total_asset_value: number
}

type WarehouseUnassignedStockSummary = {
  sku_count: number
  batch_count: number
  total_quantity: number
  total_asset_value: number
}

type WarehouseBin = {
  id: string
  code: string
  description: string | null
  barcode: string | null
  stock_summary: WarehouseBinSummary
  stock_items: WarehouseBinStockItem[]
}

type WarehouseBinLike = Partial<WarehouseBin> & Partial<{
  sku_count: number
  batch_count: number
  total_quantity: number
  total_asset_value: number
}>

type WarehouseRecord = {
  id: string
  name: string
  code: string
  address?: string | null
}

interface WarehouseDetailClientProps {
  orgId: string
  activeBranchId: string | null
  activeBranchName?: string | null
  warehouse: WarehouseRecord
  initialBins: WarehouseBin[]
  unassignedStockSummary: WarehouseUnassignedStockSummary
  userRole: string
}

const quantityFormatter = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

function toFiniteNumber(value: unknown): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatQuantity(value: number) {
  return quantityFormatter.format(toFiniteNumber(value))
}

function normalizeStockItem(item: Partial<WarehouseBinStockItem> | null | undefined): WarehouseBinStockItem {
  return {
    product_id: String(item?.product_id || ''),
    product_name: String(item?.product_name || 'Tanpa Nama Produk'),
    product_sku: item?.product_sku ? String(item.product_sku) : null,
    product_unit: item?.product_unit ? String(item.product_unit) : null,
    batch_number: item?.batch_number ? String(item.batch_number) : null,
    expiry_date: item?.expiry_date ? String(item.expiry_date) : null,
    quantity: toFiniteNumber(item?.quantity),
    unit_cost: toFiniteNumber(item?.unit_cost),
    stock_value: toFiniteNumber(item?.stock_value),
  }
}

function normalizeBin(bin: WarehouseBinLike | null | undefined): WarehouseBin {
  const stockItems = Array.isArray(bin?.stock_items)
    ? bin.stock_items.map((item) => normalizeStockItem(item)).filter((item) => item.product_id)
    : []

  return {
    id: String(bin?.id || ''),
    code: String(bin?.code || ''),
    description: typeof bin?.description === 'string' && bin.description.trim() ? bin.description : null,
    barcode: typeof bin?.barcode === 'string' && bin.barcode.trim() ? bin.barcode : null,
    stock_summary: {
      sku_count: Math.max(0, Math.round(toFiniteNumber(bin?.stock_summary?.sku_count ?? bin?.sku_count))),
      batch_count: Math.max(0, Math.round(toFiniteNumber(bin?.stock_summary?.batch_count ?? bin?.batch_count))),
      total_quantity: toFiniteNumber(bin?.stock_summary?.total_quantity ?? bin?.total_quantity),
      total_asset_value: toFiniteNumber(bin?.stock_summary?.total_asset_value ?? bin?.total_asset_value),
    },
    stock_items: stockItems,
  }
}

function KpiCard({
  label,
  value,
  note,
}: {
  label: string
  value: string
  note: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-xs font-medium text-slate-500">{note}</p>
    </div>
  )
}

export function WarehouseDetailClient({
  orgId,
  activeBranchId,
  activeBranchName,
  warehouse,
  initialBins,
  unassignedStockSummary,
  userRole,
}: WarehouseDetailClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const shouldAutoOpenCreateBin = searchParams.get('createBin') === '1'
  const isAdmin = ['owner', 'admin', 'manager'].includes(userRole)
  const binMutationGuardMessage = !activeBranchId
    ? 'Mode Semua Unit hanya untuk baca. Pilih unit aktif untuk mengelola bin gudang.'
    : null
  const [bins, setBins] = useState<WarehouseBin[]>(() => initialBins.map((bin) => normalizeBin(bin)))
  const [showModal, setShowModal] = useState(() => shouldAutoOpenCreateBin && isAdmin && Boolean(activeBranchId))
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')
  const [expandedBinId, setExpandedBinId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    code: '',
    description: '',
    barcode: ''
  })

  useEffect(() => {
    if (!shouldAutoOpenCreateBin) return
    router.replace(`/inventory/warehouses/${warehouse.id}`)
  }, [router, shouldAutoOpenCreateBin, warehouse.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (binMutationGuardMessage) {
      alert(binMutationGuardMessage)
      return
    }

    setSubmitting(true)
    const res = await createWarehouseBin(orgId, { ...formData, warehouse_id: warehouse.id })

    if ('error' in res && res.error) {
      alert(res.error)
    } else if ('data' in res) {
      setBins((current) => [...current, normalizeBin(res.data)])
      setShowModal(false)
      setFormData({ code: '', description: '', barcode: '' })
    }

    setSubmitting(false)
  }

  const handleDelete = async (binId: string) => {
    if (binMutationGuardMessage) {
      alert(binMutationGuardMessage)
      return
    }

    if (!confirm('Yakin ingin menghapus Bin ini? Data terkait stok mungkin terpengaruh.')) return

    const res = await deleteWarehouseBin(orgId, binId)
    if (!('error' in res) || !res.error) {
      setBins((current) => current.filter((bin) => bin.id !== binId))
      setExpandedBinId((current) => current === binId ? null : current)
    } else {
      alert(res.error)
    }
  }

  const normalizedSearch = search.trim().toLowerCase()
  const filteredBins = bins.filter((bin) => {
    if (!normalizedSearch) return true

    const stockSearchText = bin.stock_items
      .flatMap((item) => [
        item.product_name,
        item.product_sku,
        item.batch_number,
        item.expiry_date,
      ])
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return [
      bin.code,
      bin.description,
      bin.barcode,
      stockSearchText,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch))
  })

  const occupiedBins = bins.filter((bin) =>
    bin.stock_items.length > 0 || Math.abs(bin.stock_summary.total_quantity) > 0.0001
  ).length

  const hasUnassignedStock = Math.abs(unassignedStockSummary.total_quantity) > 0.0001
  const totalAssetValue = bins.reduce((sum, bin) => sum + bin.stock_summary.total_asset_value, 0)
  const totalQuantity = bins.reduce((sum, bin) => sum + bin.stock_summary.total_quantity, 0)
  const uniqueSkuCount = new Set(
    bins.flatMap((bin) => bin.stock_items.map((item) => item.product_id).filter(Boolean))
  ).size

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      {/* Header with Background */}
      <div className="relative overflow-hidden rounded-xl bg-slate-900 border border-slate-800 shadow-md p-8 sm:p-5 text-white">
        <div className="absolute top-0 right-0 p-5 opacity-10">
          <MapPin size={240} className="transform rotate-12 translate-x-12 -translate-y-12" />
        </div>

        <div className="relative z-10">
          <Link href="/inventory/warehouses" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-bold mb-6">
            <ArrowLeft size={16} /> Kembali ke Daftar Gudang
          </Link>

          <div className="flex flex-col md:flex-row gap-6 md:items-end justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold uppercase tracking-wide">
                <CheckCircle2 size={14} /> Warehouse Aktif
              </div>
              <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">{warehouse.name}</h1>
              <div className="flex items-center gap-2 text-slate-400 font-medium max-w-lg leading-relaxed">
                <MapPin size={18} className="shrink-0" />
                <span>{warehouse.address || 'Alamat fisik belum diatur.'}</span>
              </div>
            </div>

            <div className="bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4 flex flex-col gap-1 min-w-[200px]">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Kode WMS</span>
              <span className="text-3xl font-semibold text-white">{warehouse.code}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bin Management Section */}
      <div className="space-y-6">
        {binMutationGuardMessage && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-800 shadow-sm">
            {binMutationGuardMessage} {activeBranchName ? `Unit aktif saat ini: ${activeBranchName}.` : ''}
          </div>
        )}

        <div className="rounded-xl border border-emerald-100 bg-emerald-50/80 px-5 py-5 shadow-sm">
          <p className="text-sm font-semibold text-emerald-950">Master lokasi dan isi bin sekarang dipisah jelas.</p>
          <p className="mt-1 text-sm font-medium text-emerald-800">
            Kode rak, barcode, dan deskripsi tetap jadi master layout. SKU, qty, batch, expiry, dan nilai aset di bawah ini dihitung otomatis dari stok aktif pada bin.
          </p>
        </div>

        {hasUnassignedStock && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-5 shadow-sm">
            <p className="text-sm font-semibold text-amber-950">Ada stok gudang yang belum ditempatkan ke bin.</p>
            <p className="mt-1 text-sm font-medium text-amber-900">
              Inventory umum tetap menampilkan stok ini, tetapi kartu bin di halaman ini hanya menghitung stok yang sudah punya lokasi bin.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-white px-3 py-1.5 text-amber-800">
                {unassignedStockSummary.sku_count.toLocaleString('id-ID')} SKU belum ditempatkan
              </span>
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-white px-3 py-1.5 text-amber-800">
                {formatQuantity(unassignedStockSummary.total_quantity)} Qty belum punya bin
              </span>
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-white px-3 py-1.5 text-amber-800">
                Nilai {formatRupiah(unassignedStockSummary.total_asset_value)}
              </span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            label="Total Bin"
            value={bins.length.toLocaleString('id-ID')}
            note={`${Math.max(0, bins.length - occupiedBins).toLocaleString('id-ID')} bin masih kosong`}
          />
          <KpiCard
            label="Bin Terisi"
            value={occupiedBins.toLocaleString('id-ID')}
            note="Bin yang sudah memiliki isi stok"
          />
          <KpiCard
            label="SKU Aktif"
            value={uniqueSkuCount.toLocaleString('id-ID')}
            note={`${formatQuantity(totalQuantity)} unit on-hand tersimpan`}
          />
          <KpiCard
            label="Nilai Aset"
            value={formatRupiah(totalAssetValue, true)}
            note="Estimasi dari average cost / purchase price"
          />
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">Layout Bins & Lorong</h2>
            <p className="text-slate-500 font-medium text-sm">Pemetaan struktur rak untuk putaway, lengkap dengan isi bin saat ini.</p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari bin, barcode, SKU, batch..."
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-medium"
              />
            </div>

            {isAdmin && (
              <button
                onClick={() => setShowModal(true)}
                disabled={Boolean(binMutationGuardMessage)}
                title={binMutationGuardMessage || 'Tambah bin baru'}
                className="shrink-0 flex items-center gap-2 px-4 py-3 bg-slate-900 hover:bg-black text-white font-bold rounded-xl transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-900"
              >
                <Plus size={18} /> Bin Baru
              </button>
            )}
          </div>
        </div>

        {/* Bin Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {filteredBins.length === 0 ? (
            <div className="col-span-full py-16 bg-white border border-slate-200 border-dashed rounded-xl flex flex-col items-center justify-center text-center">
              <Maximize size={48} className="text-slate-200 mb-4" />
              <h3 className="font-bold text-slate-900 text-lg">{bins.length === 0 ? 'Belum Ada Bin' : 'Bin Tidak Ditemukan'}</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto mt-2">
                {bins.length === 0
                  ? 'Buat Bin/Lorong/Rak pertama Anda untuk memetakan kapasitas gudang secara 3D.'
                  : 'Coba kata kunci lain. Anda bisa mencari berdasarkan kode bin, barcode, SKU, nama produk, atau batch.'}
              </p>
            </div>
          ) : (
            filteredBins.map((bin) => {
              const hasStock = bin.stock_items.length > 0 || Math.abs(bin.stock_summary.total_quantity) > 0.0001
              const isExpanded = expandedBinId === bin.id

              return (
                <div key={bin.id} className="relative bg-white border border-slate-200 rounded-xl p-5 sm:p-6 hover:border-emerald-500 transition-colors group shadow-sm">
                  <div className="flex items-start justify-between gap-4 mb-5">
                    <div className="space-y-3 min-w-0">
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold tracking-wide uppercase border border-slate-200/60">
                        {warehouse.code}-{bin.code}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-2xl tracking-tight">{bin.code}</h4>
                        <p className="text-sm font-medium text-slate-500 mt-1 line-clamp-2">
                          {bin.description || 'Tidak ada deskripsi lokasi tambahan.'}
                        </p>
                      </div>
                    </div>

                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(bin.id)}
                        disabled={Boolean(binMutationGuardMessage)}
                        title={binMutationGuardMessage || 'Hapus bin'}
                        className="text-slate-300 hover:text-rose-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-slate-300"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.22em]">Master Lokasi</span>
                          <span className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${hasStock ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {hasStock ? 'Terisi' : 'Kosong'}
                          </span>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Kode Penuh</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{warehouse.code}-{bin.code}</p>
                          </div>

                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Barcode ID</p>
                            <p className="mt-1 text-sm font-bold text-emerald-700 font-mono break-all">
                              {bin.barcode || <span className="text-slate-300">Belum diset</span>}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700">
                            {bin.stock_summary.sku_count.toLocaleString('id-ID')} SKU
                          </span>
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700">
                            {formatQuantity(bin.stock_summary.total_quantity)} Qty
                          </span>
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700">
                            {bin.stock_summary.batch_count.toLocaleString('id-ID')} Batch
                          </span>
                          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700">
                            {formatRupiah(bin.stock_summary.total_asset_value)}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 lg:min-w-[220px]">
                        <button
                          type="button"
                          onClick={() => setExpandedBinId((current) => current === bin.id ? null : bin.id)}
                          className="inline-flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-bold text-emerald-900 transition-colors hover:bg-emerald-50"
                        >
                          <span>{isExpanded ? 'Sembunyikan Isi Bin' : 'Lihat Isi Bin'}</span>
                          <ChevronDown size={18} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                        <p className="text-xs font-medium text-slate-500">
                          {hasStock
                            ? 'Klik untuk melihat detail SKU, qty, batch, expiry, dan nilai stok.'
                            : hasUnassignedStock
                              ? 'Bin ini belum berisi stok. Gudang masih punya stok yang belum ditempatkan ke bin.'
                              : 'Bin ini masih kosong dan siap dipakai untuk putaway baru.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-[0.22em]">Isi Bin Saat Ini</p>
                          <p className="mt-1 text-sm font-medium text-emerald-900">
                            Data ini otomatis mengikuti stok yang benar-benar tersimpan di bin. Stok gudang yang belum punya bin belum dihitung di kartu ini.
                          </p>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Nilai Aset</p>
                          <p className="mt-1 text-xl font-semibold text-emerald-950">{formatRupiah(bin.stock_summary.total_asset_value)}</p>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 xl:grid-cols-4 gap-3">
                        <div className="rounded-xl border border-white/80 bg-white/80 px-3 py-3">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">SKU Aktif</p>
                          <p className="mt-1 text-lg font-semibold text-slate-900">{bin.stock_summary.sku_count.toLocaleString('id-ID')}</p>
                        </div>
                        <div className="rounded-xl border border-white/80 bg-white/80 px-3 py-3">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Qty On-Hand</p>
                          <p className="mt-1 text-lg font-semibold text-slate-900">{formatQuantity(bin.stock_summary.total_quantity)}</p>
                        </div>
                        <div className="rounded-xl border border-white/80 bg-white/80 px-3 py-3">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Batch/Lot</p>
                          <p className="mt-1 text-lg font-semibold text-slate-900">{bin.stock_summary.batch_count.toLocaleString('id-ID')}</p>
                        </div>
                        <div className="rounded-xl border border-white/80 bg-white/80 px-3 py-3">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Basis Valuasi</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">Avg cost / beli</p>
                        </div>
                      </div>

                      {!hasStock ? (
                        hasUnassignedStock ? (
                          <div className="mt-4 rounded-xl border border-dashed border-amber-200 bg-amber-50/80 px-4 py-5 text-sm font-medium text-amber-900">
                            Bin ini belum ditempati stok. Namun gudang ini masih memiliki {formatQuantity(unassignedStockSummary.total_quantity)} qty dari {unassignedStockSummary.sku_count.toLocaleString('id-ID')} SKU yang belum dialokasikan ke bin, jadi stoknya tetap terlihat di Inventory umum.
                          </div>
                        ) : (
                          <div className="mt-4 rounded-xl border border-dashed border-emerald-200 bg-white/70 px-4 py-5 text-sm font-medium text-emerald-900">
                            Bin ini masih kosong. Cocok untuk slot putaway baru karena belum ada SKU yang aktif menempati lokasi ini.
                          </div>
                        )
                      ) : (
                        <div className={`mt-4 space-y-3 ${bin.stock_items.length > 3 ? 'max-h-72 overflow-y-auto pr-1' : ''}`}>
                          {bin.stock_items.map((item) => (
                            <div key={`${bin.id}-${item.product_id}-${item.batch_number || 'no-batch'}-${item.expiry_date || 'no-expiry'}`} className="rounded-xl border border-white/80 bg-white/90 px-4 py-4">
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-900 truncate">{item.product_name}</p>
                                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                                    {item.product_sku || 'Tanpa SKU'}
                                    {item.product_unit ? ` • ${item.product_unit}` : ''}
                                  </p>
                                </div>
                                <div className="shrink-0 text-right">
                                  <p className="text-lg font-semibold text-slate-900">{formatQuantity(item.quantity)}</p>
                                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Qty</p>
                                </div>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                {item.batch_number && (
                                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                                    Batch {item.batch_number}
                                  </span>
                                )}
                                {item.expiry_date && (
                                  <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                                    ED {formatDate(item.expiry_date, 'short')}
                                  </span>
                                )}
                                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                                  Nilai {formatRupiah(item.stock_value)}
                                </span>
                                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                                  HPP {formatRupiah(item.unit_cost)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Modal Add Bin */}
      {showModal && !binMutationGuardMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Maximize size={20} className="text-emerald-600" /> Pembuatan Bin Lokasi
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Kode Bin / Rak <span className="text-rose-500">*</span></label>
                <div className="flex items-center">
                  <div className="px-4 py-3 bg-slate-100 border border-slate-200 border-r-0 rounded-l-xl text-sm font-bold text-slate-500">
                    {warehouse.code}-
                  </div>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="flex-1 bg-white border border-slate-200 rounded-r-xl px-4 py-3 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none uppercase placeholder:font-normal placeholder:normal-case"
                    placeholder="A1, RAK-C..."
                    required
                    maxLength={20}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Barcode Khusus (Opsional)</label>
                <input
                  type="text"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="Scan barcode di rak ini..."
                />
                <p className="text-[10px] text-slate-500 mt-1">Kosongkan jika sistem otomatis membuat berdasarkan kode.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Deskripsi Tambahan</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none resize-none h-20"
                  placeholder="Lantai 1, khusus barang rapuh..."
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-3 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200">
                  Batal
                </button>
                <button type="submit" disabled={submitting} className="flex-1 px-4 py-3 text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-70">
                  {submitting ? 'Menyimpan...' : 'Buat Bin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
