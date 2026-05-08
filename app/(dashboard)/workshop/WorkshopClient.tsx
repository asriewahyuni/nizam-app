'use client'

import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Wrench,
  Plus,
  Search,
  Car,
  ClipboardList,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Package,
  ChevronDown,
  ChevronRight,
  Trash2,
  X,
  User,
  Gauge,
} from 'lucide-react'
import { formatRupiah, formatDate } from '@/lib/utils'
import {
  createWorkshopVehicle,
  createWorkshopWorkOrder,
  updateWorkOrderStatus,
  addWorkOrderItem,
  deleteWorkOrderItem,
} from '@/modules/workshop/actions/workshop.actions'
import type {
  WorkshopWorkOrder,
  WorkshopVehicle,
  WorkshopStatus,
} from '@/modules/workshop/lib/workshop-types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  orgId: string
  workOrders: WorkshopWorkOrder[]
  vehicles: WorkshopVehicle[]
  contacts: { id: string; name: string }[]
}

type Tab = 'spk' | 'vehicles'

// ─── Konstanta ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<WorkshopStatus, { label: string; color: string; icon: React.ReactNode }> = {
  ANTRI:        { label: 'Antri',          color: 'bg-slate-100 text-slate-500 border-slate-200',    icon: <Clock size={12} /> },
  DIKERJAKAN:   { label: 'Dikerjakan',     color: 'bg-blue-50 text-blue-600 border-blue-200',        icon: <Wrench size={12} /> },
  MENUNGGU_PART:{ label: 'Tunggu Part',    color: 'bg-amber-50 text-amber-600 border-amber-200',     icon: <Package size={12} /> },
  SELESAI:      { label: 'Selesai',        color: 'bg-emerald-50 text-emerald-600 border-emerald-200', icon: <CheckCircle2 size={12} /> },
  DISERAHKAN:   { label: 'Diserahkan',     color: 'bg-purple-50 text-purple-600 border-purple-200',  icon: <CheckCircle2 size={12} /> },
  CANCEL:       { label: 'Dibatalkan',     color: 'bg-rose-50 text-rose-600 border-rose-200',        icon: <XCircle size={12} /> },
}

const STATUS_TRANSITIONS: Record<WorkshopStatus, WorkshopStatus[]> = {
  ANTRI:         ['DIKERJAKAN', 'CANCEL'],
  DIKERJAKAN:    ['MENUNGGU_PART', 'SELESAI', 'CANCEL'],
  MENUNGGU_PART: ['DIKERJAKAN', 'CANCEL'],
  SELESAI:       ['DISERAHKAN'],
  DISERAHKAN:    [],
  CANCEL:        [],
}

// ─── WorkshopClient ───────────────────────────────────────────────────────────

export function WorkshopClient({ orgId, workOrders, vehicles, contacts }: Props) {
  const [tab, setTab] = useState<Tab>('spk')
  const [search, setSearch] = useState('')
  const [showSpkModal, setShowSpkModal] = useState(false)
  const [showVehicleModal, setShowVehicleModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<WorkshopWorkOrder | null>(null)
  const [loading, setLoading] = useState(false)

  // Filter berdasarkan pencarian
  const filteredOrders = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return workOrders
    return workOrders.filter(o =>
      o.spkNumber.toLowerCase().includes(q) ||
      o.contactName.toLowerCase().includes(q) ||
      o.vehicle?.plateNumber.toLowerCase().includes(q) ||
      o.mechanicName?.toLowerCase().includes(q)
    )
  }, [workOrders, search])

  const filteredVehicles = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return vehicles
    return vehicles.filter(v =>
      v.plateNumber.toLowerCase().includes(q) ||
      v.brand.toLowerCase().includes(q) ||
      v.model.toLowerCase().includes(q) ||
      v.contactName.toLowerCase().includes(q)
    )
  }, [vehicles, search])

  // Statistik ringkas
  const stats = useMemo(() => ({
    antri:      workOrders.filter(o => o.status === 'ANTRI').length,
    dikerjakan: workOrders.filter(o => o.status === 'DIKERJAKAN').length,
    selesai:    workOrders.filter(o => o.status === 'SELESAI' || o.status === 'DISERAHKAN').length,
    total:      workOrders.length,
  }), [workOrders])

  async function handleCreateSpk(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const res = await createWorkshopWorkOrder(orgId, new FormData(e.currentTarget))
    if (res.error) alert(res.error)
    else { setShowSpkModal(false); window.location.reload() }
    setLoading(false)
  }

  async function handleCreateVehicle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const res = await createWorkshopVehicle(orgId, new FormData(e.currentTarget))
    if (res.error) alert(res.error)
    else { setShowVehicleModal(false); window.location.reload() }
    setLoading(false)
  }

  async function handleStatusChange(order: WorkshopWorkOrder, status: WorkshopStatus) {
    const res = await updateWorkOrderStatus(orgId, order.id, status)
    if (res.error) alert(res.error)
    else window.location.reload()
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Wrench size={32} className="text-[#003366]" />
            Bengkel Motor
          </h1>
          <p className="text-sm text-slate-500 font-medium">
            Manajemen Surat Perintah Kerja, kendaraan, dan servis bengkel motor.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowVehicleModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-700 text-sm font-bold rounded-2xl hover:bg-slate-200 transition-all"
          >
            <Car size={16} /> Daftarkan Kendaraan
          </button>
          <button
            onClick={() => setShowSpkModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#003366] text-white text-sm font-bold rounded-2xl hover:bg-[#002d5a] shadow-xl shadow-[#003366]/10 transition-all"
          >
            <Plus size={16} /> Buat SPK
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total SPK', value: stats.total,      color: 'text-slate-700', bg: 'bg-slate-50' },
          { label: 'Antri',     value: stats.antri,      color: 'text-slate-500', bg: 'bg-slate-50' },
          { label: 'Dikerjakan',value: stats.dikerjakan, color: 'text-blue-600',  bg: 'bg-blue-50' },
          { label: 'Selesai',   value: stats.selesai,    color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-5 border border-slate-100`}>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
            <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex bg-slate-100 rounded-2xl p-1 gap-1">
          {(['spk', 'vehicles'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setSearch('') }}
              className={`px-5 py-2 text-sm font-black rounded-xl transition-all ${
                tab === t ? 'bg-white text-[#003366] shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {t === 'spk' ? (
                <span className="flex items-center gap-2"><ClipboardList size={14} /> SPK</span>
              ) : (
                <span className="flex items-center gap-2"><Car size={14} /> Kendaraan</span>
              )}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={tab === 'spk' ? 'Cari SPK, pelanggan, plat...' : 'Cari plat, merek, model...'}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003366]/20"
          />
        </div>
      </div>

      {/* Content */}
      {tab === 'spk' ? (
        <SpkList
          orders={filteredOrders}
          selectedOrder={selectedOrder}
          onSelect={setSelectedOrder}
          onStatusChange={handleStatusChange}
          orgId={orgId}
        />
      ) : (
        <VehicleList vehicles={filteredVehicles} />
      )}

      {/* Modal: Buat SPK */}
      <AnimatePresence>
        {showSpkModal && (
          <Modal title="Buat Surat Perintah Kerja" onClose={() => setShowSpkModal(false)}>
            <form onSubmit={handleCreateSpk} className="space-y-4">
              <FormRow label="Kendaraan">
                <select name="vehicle_id" className={inputCls}>
                  <option value="">— Pilih kendaraan —</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.plateNumber} — {v.brand} {v.model}
                    </option>
                  ))}
                </select>
              </FormRow>
              <FormRow label="Pelanggan">
                <select name="contact_id" className={inputCls}>
                  <option value="">— Pilih pelanggan —</option>
                  {contacts.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </FormRow>
              <FormRow label="Nama Mekanik">
                <input name="mechanic_name" placeholder="Contoh: Budi" className={inputCls} />
              </FormRow>
              <FormRow label="Keluhan Pelanggan" required>
                <textarea name="customer_complaint" rows={2} required className={inputCls} placeholder="Deskripsikan keluhan..." />
              </FormRow>
              <div className="grid grid-cols-2 gap-4">
                <FormRow label="Odometer Masuk (km)">
                  <input name="odometer_in" type="number" min="0" className={inputCls} placeholder="0" />
                </FormRow>
                <FormRow label="Est. Selesai">
                  <input name="estimated_finish" type="datetime-local" className={inputCls} />
                </FormRow>
              </div>
              <FormRow label="Catatan">
                <textarea name="notes" rows={2} className={inputCls} placeholder="Catatan tambahan..." />
              </FormRow>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowSpkModal(false)} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700">Batal</button>
                <button type="submit" disabled={loading} className="px-6 py-2.5 bg-[#003366] text-white text-sm font-bold rounded-2xl disabled:opacity-50">
                  {loading ? 'Menyimpan...' : 'Buat SPK'}
                </button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      {/* Modal: Daftarkan Kendaraan */}
      <AnimatePresence>
        {showVehicleModal && (
          <Modal title="Daftarkan Kendaraan" onClose={() => setShowVehicleModal(false)}>
            <form onSubmit={handleCreateVehicle} className="space-y-4">
              <FormRow label="Pelanggan">
                <select name="contact_id" className={inputCls}>
                  <option value="">— Pilih pelanggan —</option>
                  {contacts.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </FormRow>
              <FormRow label="Nomor Plat" required>
                <input name="plate_number" required placeholder="Contoh: B 1234 ABC" className={`${inputCls} uppercase`} />
              </FormRow>
              <div className="grid grid-cols-2 gap-4">
                <FormRow label="Merek" required>
                  <input name="brand" required placeholder="Honda, Yamaha, dll." className={inputCls} />
                </FormRow>
                <FormRow label="Model" required>
                  <input name="model" required placeholder="Beat, Vario, dll." className={inputCls} />
                </FormRow>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <FormRow label="Tahun">
                  <input name="year" type="number" min="1980" max="2030" placeholder="2022" className={inputCls} />
                </FormRow>
                <FormRow label="Warna">
                  <input name="color" placeholder="Merah" className={inputCls} />
                </FormRow>
                <FormRow label="Odometer (km)">
                  <input name="last_odometer" type="number" min="0" defaultValue="0" className={inputCls} />
                </FormRow>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormRow label="Bahan Bakar">
                  <select name="fuel_type" defaultValue="BENSIN" className={inputCls}>
                    <option value="BENSIN">Bensin</option>
                    <option value="LISTRIK">Listrik</option>
                  </select>
                </FormRow>
                <FormRow label="Transmisi">
                  <select name="transmission" defaultValue="MANUAL" className={inputCls}>
                    <option value="MANUAL">Manual</option>
                    <option value="MATIC">Matic</option>
                  </select>
                </FormRow>
              </div>
              <FormRow label="No. Mesin">
                <input name="engine_number" placeholder="Nomor mesin..." className={inputCls} />
              </FormRow>
              <FormRow label="No. Rangka">
                <input name="chassis_number" placeholder="Nomor rangka..." className={inputCls} />
              </FormRow>
              <FormRow label="Catatan">
                <textarea name="notes" rows={2} className={inputCls} placeholder="Kondisi, riwayat, dll." />
              </FormRow>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowVehicleModal(false)} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700">Batal</button>
                <button type="submit" disabled={loading} className="px-6 py-2.5 bg-[#003366] text-white text-sm font-bold rounded-2xl disabled:opacity-50">
                  {loading ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── SPK List ─────────────────────────────────────────────────────────────────

function SpkList({
  orders,
  selectedOrder,
  onSelect,
  onStatusChange,
  orgId,
}: {
  orders: WorkshopWorkOrder[]
  selectedOrder: WorkshopWorkOrder | null
  onSelect: (o: WorkshopWorkOrder | null) => void
  onStatusChange: (o: WorkshopWorkOrder, s: WorkshopStatus) => void
  orgId: string
}) {
  if (orders.length === 0) {
    return (
      <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-[32px] text-slate-400 font-bold italic">
        Belum ada Surat Perintah Kerja.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {orders.map(order => (
        <SpkCard
          key={order.id}
          order={order}
          isExpanded={selectedOrder?.id === order.id}
          onToggle={() => onSelect(selectedOrder?.id === order.id ? null : order)}
          onStatusChange={onStatusChange}
          orgId={orgId}
        />
      ))}
    </div>
  )
}

function SpkCard({
  order,
  isExpanded,
  onToggle,
  onStatusChange,
  orgId,
}: {
  order: WorkshopWorkOrder
  isExpanded: boolean
  onToggle: () => void
  onStatusChange: (o: WorkshopWorkOrder, s: WorkshopStatus) => void
  orgId: string
}) {
  const [showItemForm, setShowItemForm] = useState(false)
  const [itemLoading, setItemLoading] = useState(false)
  const cfg = STATUS_CONFIG[order.status]

  async function handleAddItem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setItemLoading(true)
    const res = await addWorkOrderItem(orgId, order.id, new FormData(e.currentTarget))
    if (res.error) alert(res.error)
    else { setShowItemForm(false); window.location.reload() }
    setItemLoading(false)
  }

  async function handleDeleteItem(itemId: string) {
    if (!confirm('Hapus item ini?')) return
    const res = await deleteWorkOrderItem(orgId, order.id, itemId)
    if (res.error) alert(res.error)
    else window.location.reload()
  }

  const transitions = STATUS_TRANSITIONS[order.status]

  return (
    <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden">
      {/* Card header — selalu terlihat */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-6 text-left hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SPK</p>
            <p className="text-sm font-black text-slate-900">{order.spkNumber}</p>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kendaraan</p>
            <p className="text-sm font-bold text-slate-700">
              {order.vehicle
                ? `${order.vehicle.plateNumber} · ${order.vehicle.brand} ${order.vehicle.model}`
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pelanggan</p>
            <p className="text-sm font-bold text-slate-700">{order.contactName || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</p>
            <p className="text-sm font-black text-[#003366]">{formatRupiah(order.total)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black rounded-full uppercase border ${cfg.color}`}>
            {cfg.icon} {cfg.label}
          </span>
          {isExpanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
        </div>
      </button>

      {/* Detail panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 space-y-6 border-t border-slate-50">

              {/* Info */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4">
                <InfoCell label="Mekanik" value={order.mechanicName || '—'} />
                <InfoCell label="Odometer Masuk" value={order.odometerIn ? `${order.odometerIn.toLocaleString('id-ID')} km` : '—'} />
                <InfoCell label="Est. Selesai" value={order.estimatedFinish ? formatDate(order.estimatedFinish) : '—'} />
                <InfoCell label="Keluhan" value={order.customerComplaint || '—'} />
                <InfoCell label="Diagnosis" value={order.diagnosis || '—'} />
                <InfoCell label="Dibuat" value={formatDate(order.createdAt)} />
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Item Pekerjaan</p>
                  {!['SELESAI','DISERAHKAN','CANCEL'].includes(order.status) && (
                    <button
                      onClick={() => setShowItemForm(v => !v)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-200 transition"
                    >
                      <Plus size={12} /> Tambah Item
                    </button>
                  )}
                </div>

                {order.items.length === 0 ? (
                  <p className="text-sm text-slate-400 italic text-center py-4 border-2 border-dashed border-slate-100 rounded-2xl">
                    Belum ada item. Tambahkan jasa atau spare part.
                  </p>
                ) : (
                  <div className="rounded-2xl overflow-hidden border border-slate-100">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nama</th>
                          <th className="text-center px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipe</th>
                          <th className="text-right px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Qty</th>
                          <th className="text-right px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Harga</th>
                          <th className="text-right px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Subtotal</th>
                          <th className="w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {order.items.map(item => (
                          <tr key={item.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 font-medium text-slate-700">{item.name}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                item.itemType === 'JASA'
                                  ? 'bg-blue-50 text-blue-600'
                                  : 'bg-orange-50 text-orange-600'
                              }`}>
                                {item.itemType}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-slate-600">{item.quantity}</td>
                            <td className="px-4 py-3 text-right text-slate-600">{formatRupiah(item.unitPrice)}</td>
                            <td className="px-4 py-3 text-right font-bold text-slate-900">{formatRupiah(item.subtotal)}</td>
                            <td className="px-4 py-3">
                              {!['SELESAI','DISERAHKAN','CANCEL'].includes(order.status) && (
                                <button onClick={() => handleDeleteItem(item.id)} className="text-slate-300 hover:text-rose-500 transition">
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50">
                        <tr>
                          <td colSpan={4} className="px-4 py-2.5 text-right text-xs font-black text-slate-500 uppercase tracking-widest">Total</td>
                          <td className="px-4 py-2.5 text-right font-black text-[#003366]">{formatRupiah(order.total)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                {/* Form tambah item */}
                <AnimatePresence>
                  {showItemForm && (
                    <motion.form
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      onSubmit={handleAddItem}
                      className="mt-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3"
                    >
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Tipe</label>
                          <select name="item_type" defaultValue="JASA" className={inputCls}>
                            <option value="JASA">Jasa</option>
                            <option value="PART">Spare Part</option>
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Nama</label>
                          <input name="name" required placeholder="Ganti oli, kampas rem, dll." className={inputCls} />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Qty</label>
                          <input name="quantity" type="number" min="0.01" step="0.01" defaultValue="1" className={inputCls} />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Harga Satuan</label>
                          <input name="unit_price" type="number" min="0" defaultValue="0" className={inputCls} />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setShowItemForm(false)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700">Batal</button>
                        <button type="submit" disabled={itemLoading} className="px-5 py-2 bg-[#003366] text-white text-xs font-bold rounded-xl disabled:opacity-50">
                          {itemLoading ? 'Menyimpan...' : 'Tambah Item'}
                        </button>
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>

              {/* Aksi status */}
              {transitions.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-50">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest self-center mr-2">Ubah status:</p>
                  {transitions.map(nextStatus => {
                    const nextCfg = STATUS_CONFIG[nextStatus]
                    return (
                      <button
                        key={nextStatus}
                        onClick={() => onStatusChange(order, nextStatus)}
                        className={`flex items-center gap-1.5 px-4 py-2 text-xs font-black rounded-xl border transition-all hover:opacity-80 ${nextCfg.color}`}
                      >
                        {nextCfg.icon} {nextCfg.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Vehicle List ─────────────────────────────────────────────────────────────

function VehicleList({ vehicles }: { vehicles: WorkshopVehicle[] }) {
  if (vehicles.length === 0) {
    return (
      <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-[32px] text-slate-400 font-bold italic">
        Belum ada kendaraan terdaftar.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {vehicles.map(v => (
        <motion.div
          key={v.id}
          whileHover={{ y: -4 }}
          className="bg-white rounded-[24px] border border-slate-100 shadow-sm p-6 space-y-4 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-all">
            <Car size={80} strokeWidth={1} />
          </div>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xl font-black text-slate-900 tracking-tight">{v.plateNumber}</p>
              <p className="text-sm font-bold text-[#003366]">{v.brand} {v.model} {v.year ? `(${v.year})` : ''}</p>
            </div>
            <span className="px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-black rounded-full uppercase">
              {v.transmission}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Pemilik</p>
              <div className="flex items-center gap-1 mt-0.5">
                <User size={11} className="text-slate-400" />
                <span className="font-bold text-slate-700">{v.contactName || '—'}</span>
              </div>
            </div>
            <div>
              <p className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Odometer</p>
              <div className="flex items-center gap-1 mt-0.5">
                <Gauge size={11} className="text-slate-400" />
                <span className="font-bold text-slate-700">{v.lastOdometer.toLocaleString('id-ID')} km</span>
              </div>
            </div>
            {v.color && (
              <div>
                <p className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Warna</p>
                <p className="font-bold text-slate-700 mt-0.5">{v.color}</p>
              </div>
            )}
            <div>
              <p className="font-black text-slate-400 uppercase tracking-widest text-[10px]">BBM</p>
              <p className="font-bold text-slate-700 mt-0.5">{v.fuelType}</p>
            </div>
          </div>
          {v.notes && (
            <p className="text-xs text-slate-400 italic border-t border-slate-50 pt-3">{v.notes}</p>
          )}
        </motion.div>
      ))}
    </div>
  )
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

const inputCls =
  'w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-[#003366]/20'

function FormRow({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">
        {label}{required && <span className="text-rose-400 ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="text-sm font-medium text-slate-700 mt-0.5">{value}</p>
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
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
        className="bg-white rounded-[32px] w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-lg font-black text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-2 text-slate-300 hover:text-slate-600 rounded-xl transition">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </motion.div>
    </motion.div>
  )
}
