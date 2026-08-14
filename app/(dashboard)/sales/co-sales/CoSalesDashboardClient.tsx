'use client'

import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  Truck,
  DollarSign,
  Package,
  Plus,
  ArrowRight,
  Pencil,
  MapPin,
  FileBarChart,
  Link2,
  Check,
} from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import { PageHeader, StatCard, EmptyState, StatusBadge, SafeButton } from '@/components/ui/NizamUI'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { Modal, FormRow, inputCls } from '@/components/canvasser/CanvasserModal'
import { createCanvasserVan, updateCanvasserVan, createSession } from '@/modules/canvasser/actions/canvasser.actions'
import type { CanvasserVan, CanvasserTodayDashboard, StockItem, EmployeeOption, CanvasserVanLocation } from '@/modules/canvasser/lib/canvasser-types'

interface ProductOption {
  id: string
  name: string
  unit: string
  sellingPrice: number
}

interface WarehouseOption {
  id: string
  name: string
}

interface Props {
  orgId: string
  branchId: string | null
  vans: CanvasserVan[]
  todayDashboard: CanvasserTodayDashboard
  products: ProductOption[]
  employees: EmployeeOption[]
  vanLocations: CanvasserVanLocation[]
  brandColor: string
  warehouses: WarehouseOption[]
}

export function CoSalesDashboardClient({ orgId, vans, todayDashboard, products, employees, vanLocations, brandColor, warehouses }: Props) {
  const [showVanModal, setShowVanModal] = useState(false)
  const [showSessionModal, setShowSessionModal] = useState(false)
  const [sessionVanId, setSessionVanId] = useState<string | null>(null)
  const [editVan, setEditVan] = useState<CanvasserVan | null>(null)
  const locationByVan = new Map(vanLocations.map(l => [l.vanId, l]))

  function openSessionModal(vanId: string) {
    setSessionVanId(vanId)
    setShowSessionModal(true)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        tag="Sales Lapangan"
        title="Tirta Canvasser"
        subtitle="Kunjungan harian, stok van, order & piutang canvasser."
        icon={<Truck />}
        actions={
          <>
            <Link href="/sales/co-sales/laporan" className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors duration-150 cursor-pointer">
              <FileBarChart className="w-4 h-4" />
              Laporan Performa
            </Link>
            <button type="button"
              onClick={() => setShowVanModal(true)}
              style={{ backgroundColor: brandColor }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-white font-medium rounded-lg hover:opacity-90 transition-opacity duration-150 shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Tambah Van
            </button>
          </>
        }
      />

      {/* Section 1 — Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Truck} label="Kendaraan Aktif" value={String(todayDashboard.activeVans)} color="blue" />
        <StatCard icon={DollarSign} label="Total Penjualan" value={formatRupiah(todayDashboard.totalSalesToday)} color="emerald" />
        <StatCard icon={Package} label="Kas Terkumpul" value={formatRupiah(todayDashboard.totalCashCollected)} color="amber" />
        <StatCard icon={DollarSign} label="AR Ditagih" value={formatRupiah(todayDashboard.totalArCollected)} color="rose" />
      </div>

      {/* Section 2 — Daftar Van */}
      {vans.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="Belum ada van/kendaraan canvasser"
          description="Tambahkan van dan tunjuk karyawan sebagai canvasser untuk mulai operasional sales lapangan."
          action={
            <button type="button" onClick={() => setShowVanModal(true)} style={{ backgroundColor: brandColor }}
              className="inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity duration-150 cursor-pointer">
              <Plus size={16} /> Tambah Van
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {todayDashboard.vans.map(van => (
            <VanCard
              key={van.id}
              van={van}
              location={locationByVan.get(van.id) || null}
              brandColor={brandColor}
              onStartSession={() => openSessionModal(van.id)}
              onEdit={() => setEditVan(van)}
            />
          ))}
        </div>
      )}

      {/* Modal: Buat Sesi */}
      <AnimatePresence>
        {showSessionModal && sessionVanId && (
          <CreateSessionModal
            orgId={orgId}
            vanId={sessionVanId}
            vans={vans}
            products={products}
            warehouses={warehouses}
            brandColor={brandColor}
            onClose={() => { setShowSessionModal(false); setSessionVanId(null) }}
          />
        )}
      </AnimatePresence>

      {/* Modal: Tambah Van */}
      <AnimatePresence>
        {showVanModal && (
          <VanFormModal orgId={orgId} employees={employees} brandColor={brandColor} onClose={() => setShowVanModal(false)} />
        )}
      </AnimatePresence>

      {/* Modal: Edit Van */}
      <AnimatePresence>
        {editVan && (
          <VanFormModal orgId={orgId} employees={employees} brandColor={brandColor} van={editVan} onClose={() => setEditVan(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Van Card ─────────────────────────────────────────────────────────────────

function timeAgoLabel(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'baru saja'
  if (minutes < 60) return `${minutes} menit lalu`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} jam lalu`
  return `${Math.floor(hours / 24)} hari lalu`
}

function VanCard({ van, location, brandColor, onStartSession, onEdit }: {
  van: CanvasserTodayDashboard['vans'][number]
  location: CanvasserVanLocation | null
  brandColor: string
  onStartSession: () => void
  onEdit: () => void
}) {
  const status = van.session?.status === 'AKTIF' ? 'AKTIF' : van.session?.status === 'SELESAI' ? 'SELESAI' : 'BELUM MULAI'
  const statusVariant = status === 'AKTIF' ? 'success' : status === 'SELESAI' ? 'neutral' : 'warning'

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-base font-bold text-slate-900 truncate">{van.name}</p>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{van.driverName} {van.plateNumber ? `· ${van.plateNumber}` : ''}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <StatusBadge label={status} variant={statusVariant} />
          <button type="button" onClick={onEdit}
            className="p-1.5 text-slate-300 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors duration-150 cursor-pointer"
            aria-label={`Edit ${van.name}`}
          >
            <Pencil size={14} />
          </button>
        </div>
      </div>

      {van.session && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Kunjungan</span>
            <span className="font-semibold text-slate-700 tabular-nums">{van.visitsDone} / {van.visitsTotal} outlet</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-300"
              style={{ width: `${van.visitsTotal > 0 ? (van.visitsDone / van.visitsTotal) * 100 : 0}%`, backgroundColor: brandColor }}
            />
          </div>
          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-slate-500">Penjualan sesi ini</span>
            <span className="font-bold tabular-nums" style={{ color: brandColor }}>{formatRupiah(van.session.totalSales)}</span>
          </div>
        </div>
      )}

      {location && (
        <a
          href={`https://www.google.com/maps?q=${location.lat},${location.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-700 transition-colors duration-150 cursor-pointer"
        >
          <MapPin size={12} /> Lokasi terakhir {timeAgoLabel(location.updatedAt)} · buka di Maps
        </a>
      )}

      <div className="flex gap-2 pt-1">
        {/* Sesi hari ini bisa lebih dari satu (mis. putaran ke-2) — createSession
            di backend cuma memblokir kalau ADA sesi berstatus AKTIF, jadi begitu
            status SELESAI, "Mulai Sesi" harus tetap muncul di samping "Lihat Detail". */}
        {status !== 'BELUM MULAI' && (
          <Link
            href={`/sales/co-sales/${van.id}`}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition-colors duration-150 cursor-pointer min-h-[44px]"
          >
            Lihat Detail <ArrowRight size={14} />
          </Link>
        )}
        {status !== 'AKTIF' && (
          <button type="button"
            onClick={onStartSession}
            style={{ backgroundColor: brandColor }}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-white text-xs font-bold rounded-xl hover:opacity-90 transition-opacity duration-150 cursor-pointer min-h-[44px]"
          >
            Mulai Sesi
          </button>
        )}
        <CopyLinkButton vanId={van.id} />
      </div>
    </div>
  )
}

// Link akses langsung ke layar van ini — dikirim manual (mis. via WhatsApp) ke
// canvasser yang bertanggung jawab, supaya bisa di-bookmark/Add to Home Screen
// tanpa perlu auto-detect lewat akun login.
function CopyLinkButton({ vanId }: { vanId: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const url = `${window.location.origin}/sales/co-sales/${vanId}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API tidak tersedia/ditolak — abaikan diam-diam.
    }
  }

  return (
    <button type="button"
      onClick={handleCopy}
      className="flex items-center justify-center px-3 py-2 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 transition-colors duration-150 cursor-pointer min-h-[44px] min-w-[44px]"
      aria-label="Salin link akses van"
      title="Salin link akses van"
    >
      {copied ? <Check size={16} className="text-emerald-600" /> : <Link2 size={16} />}
    </button>
  )
}

// ─── Modal: Buat Sesi ─────────────────────────────────────────────────────────

function CreateSessionModal({ orgId, vanId, vans, products, warehouses, brandColor, onClose }: {
  orgId: string
  vanId: string
  vans: CanvasserVan[]
  products: ProductOption[]
  warehouses: WarehouseOption[]
  brandColor: string
  onClose: () => void
}) {
  const [qtyByProduct, setQtyByProduct] = useState<Record<string, number>>({})
  const [sourceWarehouseId, setSourceWarehouseId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const van = vans.find(v => v.id === vanId)
  const sourceOptions = warehouses.filter(w => w.id !== van?.warehouseId)

  async function handleSubmit() {
    setError(null)
    const openingStock: StockItem[] = products
      .filter(p => (qtyByProduct[p.id] || 0) > 0)
      .map(p => ({ product_id: p.id, product_name: p.name, qty_loaded: qtyByProduct[p.id], unit: p.unit }))

    if (openingStock.length > 0 && !sourceWarehouseId) {
      setError('Pilih gudang sumber stok terlebih dahulu.')
      throw new Error('validation')
    }

    const res = await createSession(orgId, { van_id: vanId, source_warehouse_id: sourceWarehouseId || undefined, opening_stock: openingStock })
    if (res.error) { setError(res.error); throw new Error(res.error) }
    window.location.reload()
  }

  return (
    <Modal title={`Mulai Sesi — ${van?.name || ''}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-slate-500">Input stok produk yang dimuat ke van sebelum berangkat.</p>
        {sourceOptions.length > 0 && (
          <FormRow label="Gudang Sumber">
            <select
              value={sourceWarehouseId}
              onChange={e => setSourceWarehouseId(e.target.value)}
              className={inputCls}
            >
              <option value="">— Pilih gudang —</option>
              {sourceOptions.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </FormRow>
        )}
        {products.length === 0 ? (
          <p className="text-sm text-amber-600 font-semibold italic">Belum ada produk aktif. Tambahkan produk di modul Inventori dulu.</p>
        ) : (
          <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-100 divide-y divide-slate-50">
            {products.map(p => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div>
                  <p className="text-sm font-semibold text-slate-700">{p.name}</p>
                  <p className="text-[10px] text-slate-400 uppercase">{p.unit}</p>
                </div>
                <input
                  type="number" min="0" step="1"
                  value={qtyByProduct[p.id] || ''}
                  onChange={e => setQtyByProduct(prev => ({ ...prev, [p.id]: Number(e.target.value) }))}
                  placeholder="0"
                  className="w-24 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
              </div>
            ))}
          </div>
        )}
        {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 cursor-pointer">Batal</button>
          <SafeButton onClick={handleSubmit} loadingText="Memulai..." className="!rounded-xl" style={{ backgroundColor: brandColor, borderColor: brandColor }}>
            Mulai
          </SafeButton>
        </div>
      </div>
    </Modal>
  )
}

// ─── Modal: Tambah / Edit Van ──────────────────────────────────────────────────

function VanFormModal({ orgId, employees, brandColor, van, onClose }: {
  orgId: string
  employees: EmployeeOption[]
  brandColor: string
  van?: CanvasserVan
  onClose: () => void
}) {
  const isEdit = Boolean(van)
  const [code, setCode] = useState(van?.code || '')
  const [name, setName] = useState(van?.name || '')
  const [plateNumber, setPlateNumber] = useState(van?.plateNumber || '')
  const [employeeId, setEmployeeId] = useState(van?.canvasserEmployeeId || '')
  const [error, setError] = useState<string | null>(null)

  const employeeOptions = employees.map(e => ({ id: e.id, name: e.name, code: e.phone || '' }))

  async function handleSubmit() {
    setError(null)
    if (!employeeId) { setError('Pilih karyawan sebagai canvasser terlebih dahulu.'); throw new Error('validation') }

    const res = isEdit && van
      ? await updateCanvasserVan(orgId, van.id, {
          name,
          canvasser_employee_id: employeeId,
          plate_number: plateNumber,
        })
      : await createCanvasserVan(orgId, {
          code,
          name,
          canvasser_employee_id: employeeId,
          plate_number: plateNumber || undefined,
        })

    if (res.error) { setError(res.error); throw new Error(res.error) }
    onClose()
    window.location.reload()
  }

  return (
    <Modal title={isEdit ? `Edit Van — ${van?.name}` : 'Tambah Van Canvasser'} onClose={onClose}>
      <div className="space-y-4">
        {!isEdit && (
          <FormRow label="Kode" required>
            <input value={code} onChange={e => setCode(e.target.value)} required placeholder="VAN-01" className={inputCls} />
          </FormRow>
        )}
        <FormRow label="Nama Van" required>
          <input value={name} onChange={e => setName(e.target.value)} required placeholder="Van Selatan" className={inputCls} />
        </FormRow>
        <FormRow label="Canvasser (Karyawan)" required>
          <SearchableSelect
            options={employeeOptions}
            value={employeeId}
            onChange={setEmployeeId}
            placeholder="— Pilih karyawan —"
            searchPlaceholder="Cari nama karyawan..."
          />
          {employees.length === 0 && (
            <p className="text-[10px] text-amber-600 font-semibold mt-1">Belum ada data karyawan. Tambahkan dulu di modul Karyawan/HRIS.</p>
          )}
        </FormRow>
        <FormRow label="Nomor Plat">
          <input value={plateNumber} onChange={e => setPlateNumber(e.target.value.toUpperCase())} placeholder="B 1234 XYZ" className={`${inputCls} uppercase`} />
        </FormRow>
        {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 cursor-pointer">Batal</button>
          <SafeButton onClick={handleSubmit} loadingText="Menyimpan..." className="!rounded-xl" style={{ backgroundColor: brandColor, borderColor: brandColor }}>
            Simpan
          </SafeButton>
        </div>
      </div>
    </Modal>
  )
}
