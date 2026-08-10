'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  Truck,
  DollarSign,
  Package,
  Smartphone,
  Plus,
  X,
  ArrowRight,
} from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import { createCanvasserVan, createSession } from '@/modules/canvasser/actions/canvasser.actions'
import type { CanvasserVan, CanvasserTodayDashboard, StockItem } from '@/modules/canvasser/lib/canvasser-types'

interface ProductOption {
  id: string
  name: string
  unit: string
  sellingPrice: number
}

interface Props {
  orgId: string
  branchId: string | null
  vans: CanvasserVan[]
  todayDashboard: CanvasserTodayDashboard
  products: ProductOption[]
}

export function CoSalesDashboardClient({ orgId, vans, todayDashboard, products }: Props) {
  const [showVanModal, setShowVanModal] = useState(false)
  const [showSessionModal, setShowSessionModal] = useState(false)
  const [sessionVanId, setSessionVanId] = useState<string | null>(null)

  function openSessionModal(vanId: string) {
    setSessionVanId(vanId)
    setShowSessionModal(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tirta Canvasser</h1>
          <p className="text-sm text-slate-500">Kunjungan harian, stok van, order & piutang canvasser.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/pos-mobile" className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
            <Smartphone className="w-4 h-4" />
            Mobile POS
          </Link>
          <button type="button"
            onClick={() => setShowVanModal(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#003366] text-white font-medium rounded-lg hover:bg-[#002d5a] transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Tambah Van
          </button>
        </div>
      </div>

      {/* Section 1 — Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Truck className="w-5 h-5" />} label="Kendaraan Aktif" value={String(todayDashboard.activeVans)} color="blue" />
        <StatCard icon={<DollarSign className="w-5 h-5" />} label="Total Penjualan" value={formatRupiah(todayDashboard.totalSalesToday)} color="emerald" />
        <StatCard icon={<Package className="w-5 h-5" />} label="Kas Terkumpul" value={formatRupiah(todayDashboard.totalCashCollected)} color="amber" />
        <StatCard icon={<DollarSign className="w-5 h-5" />} label="AR Ditagih" value={formatRupiah(todayDashboard.totalArCollected)} color="rose" />
      </div>

      {/* Section 2 — Daftar Van */}
      {vans.length === 0 ? (
        <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-[24px] text-slate-400 font-semibold italic">
          Belum ada van/kendaraan canvasser. Tambahkan dulu untuk mulai operasional.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {todayDashboard.vans.map(van => (
            <VanCard key={van.id} van={van} onStartSession={() => openSessionModal(van.id)} />
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
            onClose={() => { setShowSessionModal(false); setSessionVanId(null) }}
          />
        )}
      </AnimatePresence>

      {/* Modal: Tambah Van */}
      <AnimatePresence>
        {showVanModal && (
          <CreateVanModal orgId={orgId} onClose={() => setShowVanModal(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

const STAT_COLORS: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-600',
  emerald: 'bg-emerald-100 text-emerald-600',
  amber: 'bg-amber-100 text-amber-600',
  rose: 'bg-rose-100 text-rose-600',
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${STAT_COLORS[color]}`}>
        {icon}
      </div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
      <h3 className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{value}</h3>
    </div>
  )
}

// ─── Van Card ─────────────────────────────────────────────────────────────────

function VanCard({ van, onStartSession }: {
  van: CanvasserTodayDashboard['vans'][number]
  onStartSession: () => void
}) {
  const status = van.session?.status === 'AKTIF' ? 'AKTIF' : van.session?.status === 'SELESAI' ? 'SELESAI' : 'BELUM MULAI'
  const statusColor = status === 'AKTIF' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : status === 'SELESAI' ? 'bg-slate-100 text-slate-500 border-slate-200'
    : 'bg-amber-50 text-amber-700 border-amber-200'

  return (
    <div className="bg-white rounded-[20px] border border-slate-200 shadow-sm p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-base font-bold text-slate-900">{van.name}</p>
          <p className="text-xs text-slate-500 mt-0.5">{van.driverName} {van.plateNumber ? `· ${van.plateNumber}` : ''}</p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase border ${statusColor}`}>
          {status}
        </span>
      </div>

      {van.session && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Kunjungan</span>
            <span className="font-semibold text-slate-700">{van.visitsDone} / {van.visitsTotal} outlet</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#003366] transition-all"
              style={{ width: `${van.visitsTotal > 0 ? (van.visitsDone / van.visitsTotal) * 100 : 0}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-slate-500">Penjualan sesi ini</span>
            <span className="font-bold text-[#003366] tabular-nums">{formatRupiah(van.session.totalSales)}</span>
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        {van.session ? (
          <Link
            href={`/sales/co-sales/${van.id}`}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition-all cursor-pointer"
          >
            Lihat Detail <ArrowRight size={14} />
          </Link>
        ) : (
          <button type="button"
            onClick={onStartSession}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-[#003366] text-white text-xs font-bold rounded-xl hover:bg-[#002d5a] transition-all cursor-pointer"
          >
            Mulai Sesi
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Modal: Buat Sesi ─────────────────────────────────────────────────────────

function CreateSessionModal({ orgId, vanId, vans, products, onClose }: {
  orgId: string
  vanId: string
  vans: CanvasserVan[]
  products: ProductOption[]
  onClose: () => void
}) {
  const [qtyByProduct, setQtyByProduct] = useState<Record<string, number>>({})
  const [submitting, setSubmitting] = useState(false)
  const van = vans.find(v => v.id === vanId)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    const openingStock: StockItem[] = products
      .filter(p => (qtyByProduct[p.id] || 0) > 0)
      .map(p => ({ product_id: p.id, product_name: p.name, qty_loaded: qtyByProduct[p.id], unit: p.unit }))

    const res = await createSession(orgId, { van_id: vanId, opening_stock: openingStock })
    if (res.error) alert(res.error)
    else window.location.reload()
    setSubmitting(false)
  }

  return (
    <Modal title={`Mulai Sesi — ${van?.name || ''}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-slate-500">Input stok produk yang dimuat ke van sebelum berangkat.</p>
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
                  className="w-24 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#003366]/20"
                />
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 cursor-pointer">Batal</button>
          <button type="submit" disabled={submitting} className="px-6 py-2.5 bg-[#003366] text-white text-sm font-bold rounded-xl disabled:opacity-50 cursor-pointer">
            {submitting ? 'Memulai...' : 'Mulai'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Modal: Tambah Van ────────────────────────────────────────────────────────

function CreateVanModal({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    const fd = new FormData(e.currentTarget)
    const res = await createCanvasserVan(orgId, {
      code: String(fd.get('code') || ''),
      name: String(fd.get('name') || ''),
      driver_name: String(fd.get('driver_name') || ''),
      plate_number: String(fd.get('plate_number') || '') || undefined,
      driver_phone: String(fd.get('driver_phone') || '') || undefined,
    })
    if (res.error) alert(res.error)
    else { onClose(); window.location.reload() }
    setSubmitting(false)
  }

  return (
    <Modal title="Tambah Van Canvasser" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormRow label="Kode" required>
          <input name="code" required placeholder="VAN-01" className={inputCls} />
        </FormRow>
        <FormRow label="Nama Van" required>
          <input name="name" required placeholder="Van Budi - Selatan" className={inputCls} />
        </FormRow>
        <FormRow label="Nama Driver" required>
          <input name="driver_name" required placeholder="Budi Santoso" className={inputCls} />
        </FormRow>
        <div className="grid grid-cols-2 gap-4">
          <FormRow label="Nomor Plat">
            <input name="plate_number" placeholder="B 1234 XYZ" className={`${inputCls} uppercase`} />
          </FormRow>
          <FormRow label="No. Telepon">
            <input name="driver_phone" placeholder="0812xxxxxxx" className={inputCls} />
          </FormRow>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 cursor-pointer">Batal</button>
          <button type="submit" disabled={submitting} className="px-6 py-2.5 bg-[#003366] text-white text-sm font-bold rounded-xl disabled:opacity-50 cursor-pointer">
            {submitting ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

export const inputCls =
  'w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-[#003366]/20'

export function FormRow({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
        {label}{required && <span className="text-rose-400 ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-[32px] w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-md"
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="p-2 text-slate-300 hover:text-slate-600 rounded-xl transition cursor-pointer">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </motion.div>
    </motion.div>
  )
}
