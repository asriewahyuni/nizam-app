'use client'

import React, { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  ArrowLeft,
  MapPin,
  Plus,
  Trash2,
  Play,
  ShoppingCart,
  Wallet,
  SkipForward,
  CheckCircle2,
  Package,
  ClipboardList,
} from 'lucide-react'
import { formatRupiah, formatDate } from '@/lib/utils'
import {
  addVisit,
  updateVisitStatus,
  createOrder,
  recordARCollection,
  closeSession,
} from '@/modules/canvasser/actions/canvasser.actions'
import { Modal, FormRow, inputCls } from '../CoSalesDashboardClient'
import type {
  CanvasserVan,
  CanvasserSession,
  CanvasserVisit,
  PaymentMethod,
  StockItem,
} from '@/modules/canvasser/lib/canvasser-types'

interface ContactOption { id: string; name: string; address: string | null; creditLimit: number }
interface ProductOption { id: string; name: string; unit: string; sellingPrice: number }

interface Props {
  orgId: string
  branchId: string | null
  van: CanvasserVan
  session: CanvasserSession | null
  visits: CanvasserVisit[]
  contacts: ContactOption[]
  products: ProductOption[]
}

type Tab = 'kunjungan' | 'stok' | 'rekap'

const AR_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  NORMAL: { label: 'Normal', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  MENDEKATI_LIMIT: { label: 'Mendekati Limit', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  BLOKIR: { label: 'Blokir', color: 'bg-rose-50 text-rose-700 border-rose-200' },
}

const VISIT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  BELUM: { label: 'Belum', color: 'bg-slate-100 text-slate-500 border-slate-200' },
  DALAM_PERJALANAN: { label: 'Dalam Perjalanan', color: 'bg-blue-50 text-blue-600 border-blue-200' },
  SELESAI: { label: 'Selesai', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  SKIP: { label: 'Skip', color: 'bg-slate-100 text-slate-400 border-slate-200' },
}

export function VanOperationalClient({ orgId, van, session, visits, contacts, products }: Props) {
  const [tab, setTab] = useState<Tab>('kunjungan')
  const [showAddVisit, setShowAddVisit] = useState(false)
  const [showCloseSession, setShowCloseSession] = useState(false)

  const rekap = useMemo(() => {
    const allOrders = visits.flatMap(v => v.orders || []).filter(o => o.status === 'SELESAI')
    const allCollections = visits.flatMap(v => v.arCollections || [])
    const tunai = allOrders.filter(o => o.paymentMethod === 'TUNAI').reduce((s, o) => s + o.total, 0)
    const transfer = allOrders.filter(o => o.paymentMethod === 'TRANSFER').reduce((s, o) => s + o.total, 0)
    const kredit = allOrders.filter(o => o.paymentMethod === 'KREDIT').reduce((s, o) => s + o.total, 0)
    const arTotal = allCollections.reduce((s, c) => s + c.amount, 0)
    const visitsDone = visits.filter(v => v.status === 'SELESAI' || v.status === 'SKIP').length
    return { allOrders, tunai, transfer, kredit, total: tunai + transfer + kredit, arTotal, visitsDone }
  }, [visits])

  const stockRows = useMemo(() => {
    const soldByProduct = new Map<string, number>()
    for (const visit of visits) {
      for (const order of visit.orders || []) {
        if (order.status !== 'SELESAI') continue
        for (const item of order.items || []) {
          if (!item.productId) continue
          soldByProduct.set(item.productId, (soldByProduct.get(item.productId) || 0) + item.qty)
        }
      }
    }
    return (session?.openingStock || []).map((s: StockItem) => {
      const sold = soldByProduct.get(s.product_id) || 0
      return { ...s, sold, remaining: Math.max(0, s.qty_loaded - sold) }
    })
  }, [session, visits])

  if (!session) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center space-y-4">
        <p className="text-lg font-bold text-slate-700">Belum ada sesi aktif hari ini untuk {van.name}.</p>
        <Link href="/sales/co-sales" className="inline-flex items-center gap-2 text-[#003366] font-semibold hover:underline cursor-pointer">
          <ArrowLeft size={16} /> Kembali ke Dashboard & Mulai Sesi
        </Link>
      </div>
    )
  }

  const availableContacts = contacts.filter(c => !visits.some(v => v.contactId === c.id))

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link href="/sales/co-sales" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600 mb-1 cursor-pointer">
            <ArrowLeft size={12} /> Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">{van.name}</h1>
          <p className="text-sm text-slate-500">{van.driverName} · Sesi {formatDate(session.sessionDate)}</p>
        </div>
        {session.status === 'AKTIF' && (
          <button type="button"
            onClick={() => setShowCloseSession(true)}
            className="px-5 py-2.5 bg-rose-600 text-white text-sm font-bold rounded-xl hover:bg-rose-700 transition-all cursor-pointer"
          >
            Tutup Sesi
          </button>
        )}
        {session.status === 'SELESAI' && (
          <span className="px-4 py-2 bg-slate-100 text-slate-500 text-xs font-bold rounded-xl uppercase">Sesi Ditutup</span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 rounded-xl p-1 gap-1 w-fit">
        {([['kunjungan', 'Kunjungan', ClipboardList], ['stok', 'Stok Van', Package], ['rekap', 'Rekap Sesi', Wallet]] as const).map(([val, label, Icon]) => (
          <button type="button"
            key={val}
            onClick={() => setTab(val)}
            className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl transition-all cursor-pointer ${
              tab === val ? 'bg-white text-[#003366] shadow-sm' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === 'kunjungan' && (
        <div className="space-y-4">
          {session.status === 'AKTIF' && (
            <button type="button"
              onClick={() => setShowAddVisit(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-dashed border-slate-200 text-slate-500 text-sm font-bold rounded-xl hover:border-[#003366]/30 hover:text-[#003366] transition-all cursor-pointer"
            >
              <Plus size={16} /> Tambah Kunjungan Outlet
            </button>
          )}
          {visits.length === 0 ? (
            <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-[24px] text-slate-400 font-semibold italic">
              Belum ada rencana kunjungan.
            </div>
          ) : (
            visits.map(visit => (
              <VisitCard key={visit.id} orgId={orgId} sessionId={session.id} visit={visit} products={products} sessionActive={session.status === 'AKTIF'} />
            ))
          )}
        </div>
      )}

      {tab === 'stok' && (
        <div className="rounded-[20px] overflow-hidden border border-slate-200 shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-5 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Produk</th>
                <th className="text-right px-5 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Dimuat</th>
                <th className="text-right px-5 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Terjual</th>
                <th className="text-right px-5 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Sisa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {stockRows.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-slate-400 italic">Tidak ada stok dimuat di sesi ini.</td></tr>
              ) : stockRows.map(row => (
                <tr key={row.product_id} className="hover:bg-slate-50/50">
                  <td className="px-5 py-3 font-medium text-slate-700">{row.product_name}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{row.qty_loaded} {row.unit}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-blue-600 font-semibold">{row.sold} {row.unit}</td>
                  <td className="px-5 py-3 text-right tabular-nums font-bold text-slate-900">{row.remaining} {row.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'rekap' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <RekapStat label="Total Penjualan" value={formatRupiah(rekap.total)} />
            <RekapStat label="Tunai / Transfer" value={formatRupiah(rekap.tunai + rekap.transfer)} />
            <RekapStat label="Kredit" value={formatRupiah(rekap.kredit)} />
            <RekapStat label="AR Ditagih" value={formatRupiah(rekap.arTotal)} />
          </div>
          <p className="text-sm text-slate-500">Outlet dikunjungi: <span className="font-bold text-slate-700">{rekap.visitsDone} / {visits.length}</span></p>
          <div className="rounded-[20px] overflow-hidden border border-slate-200 shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-5 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">No. Order</th>
                  <th className="text-left px-5 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Metode</th>
                  <th className="text-right px-5 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rekap.allOrders.length === 0 ? (
                  <tr><td colSpan={3} className="px-5 py-10 text-center text-slate-400 italic">Belum ada order hari ini.</td></tr>
                ) : rekap.allOrders.map(o => (
                  <tr key={o.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3 font-mono text-xs text-slate-600">{o.orderNumber}</td>
                    <td className="px-5 py-3 text-slate-600">{o.paymentMethod}</td>
                    <td className="px-5 py-3 text-right font-semibold text-slate-900 tabular-nums">{formatRupiah(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showAddVisit && (
          <AddVisitModal
            orgId={orgId}
            sessionId={session.id}
            contacts={availableContacts}
            nextOrder={visits.length + 1}
            onClose={() => setShowAddVisit(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCloseSession && (
          <CloseSessionModal
            orgId={orgId}
            sessionId={session.id}
            openingStock={session.openingStock}
            stockRows={stockRows}
            onClose={() => setShowCloseSession(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function RekapStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold text-slate-900 mt-1 tabular-nums">{value}</p>
    </div>
  )
}

// ─── Visit Card ───────────────────────────────────────────────────────────────

function VisitCard({ orgId, sessionId, visit, products, sessionActive }: {
  orgId: string
  sessionId: string
  visit: CanvasserVisit
  products: ProductOption[]
  sessionActive: boolean
}) {
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [showArModal, setShowArModal] = useState(false)
  const [busy, setBusy] = useState(false)

  const arCfg = AR_STATUS_CONFIG[visit.arStatus]
  const statusCfg = VISIT_STATUS_CONFIG[visit.status]
  const pct = visit.creditLimit > 0 ? Math.min(100, (visit.arOutstanding / visit.creditLimit) * 100) : (visit.arOutstanding > 0 ? 100 : 0)

  async function handleStatus(status: CanvasserVisit['status']) {
    setBusy(true)
    const res = await updateVisitStatus(orgId, visit.id, status)
    if (res.error) alert(res.error)
    else window.location.reload()
    setBusy(false)
  }

  const canAct = sessionActive && visit.status !== 'SELESAI' && visit.status !== 'SKIP'

  return (
    <div className="bg-white rounded-[20px] border border-slate-200 shadow-sm p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded-full text-[10px] font-semibold uppercase border ${statusCfg.color}`}>{statusCfg.label}</span>
          <p className="text-sm font-bold text-slate-900">{visit.contactName}</p>
        </div>
        <span className="text-xs text-slate-400 font-semibold">#{visit.visitOrder}</span>
      </div>
      {visit.address && (
        <p className="flex items-center gap-1.5 text-xs text-slate-500"><MapPin size={12} /> {visit.address}</p>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">AR: {formatRupiah(visit.arOutstanding)} / Limit {formatRupiah(visit.creditLimit)}</span>
          <span className={`font-bold ${visit.arStatus === 'BLOKIR' ? 'text-rose-600' : visit.arStatus === 'MENDEKATI_LIMIT' ? 'text-amber-600' : 'text-emerald-600'}`}>
            {arCfg.label}
          </span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${visit.arStatus === 'BLOKIR' ? 'bg-rose-500' : visit.arStatus === 'MENDEKATI_LIMIT' ? 'bg-amber-500' : 'bg-emerald-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {(visit.orders?.length || 0) > 0 && (
        <div className="text-xs text-slate-500 pt-1 border-t border-slate-50">
          {visit.orders!.filter(o => o.status === 'SELESAI').length} order · {formatRupiah(visit.orders!.filter(o => o.status === 'SELESAI').reduce((s, o) => s + o.total, 0))}
        </div>
      )}

      {canAct && (
        <div className="flex flex-wrap gap-2 pt-1">
          {visit.status === 'BELUM' && (
            <ActionButton icon={<Play size={12} />} label="Mulai Kunjungi" onClick={() => handleStatus('DALAM_PERJALANAN')} disabled={busy} />
          )}
          <ActionButton icon={<ShoppingCart size={12} />} label="Catat Order" onClick={() => setShowOrderModal(true)} disabled={busy} />
          <ActionButton icon={<Wallet size={12} />} label="Tagih AR" onClick={() => setShowArModal(true)} disabled={busy} />
          <ActionButton icon={<CheckCircle2 size={12} />} label="Selesai" onClick={() => handleStatus('SELESAI')} disabled={busy} />
          <ActionButton icon={<SkipForward size={12} />} label="Skip" onClick={() => handleStatus('SKIP')} disabled={busy} muted />
        </div>
      )}

      <AnimatePresence>
        {showOrderModal && (
          <OrderModal
            orgId={orgId}
            sessionId={sessionId}
            visit={visit}
            products={products}
            onClose={() => setShowOrderModal(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showArModal && (
          <ArCollectionModal
            orgId={orgId}
            sessionId={sessionId}
            visit={visit}
            onClose={() => setShowArModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function ActionButton({ icon, label, onClick, disabled, muted }: {
  icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; muted?: boolean
}) {
  return (
    <button type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all disabled:opacity-50 cursor-pointer ${
        muted ? 'bg-slate-50 text-slate-400 hover:bg-slate-100' : 'bg-[#003366]/5 text-[#003366] hover:bg-[#003366]/10'
      }`}
    >
      {icon} {label}
    </button>
  )
}

// ─── Modal: Tambah Kunjungan ────────────────────────────────────────────────────

function AddVisitModal({ orgId, sessionId, contacts, nextOrder, onClose }: {
  orgId: string
  sessionId: string
  contacts: ContactOption[]
  nextOrder: number
  onClose: () => void
}) {
  const [contactId, setContactId] = useState('')
  const [address, setAddress] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function handleContactChange(id: string) {
    setContactId(id)
    const c = contacts.find(x => x.id === id)
    setAddress(c?.address || '')
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!contactId) return
    setSubmitting(true)
    const res = await addVisit(orgId, sessionId, { contact_id: contactId, visit_order: nextOrder, address: address || undefined })
    if (res.error) alert(res.error)
    else window.location.reload()
    setSubmitting(false)
  }

  return (
    <Modal title="Tambah Kunjungan Outlet" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormRow label="Outlet / Pelanggan" required>
          <select value={contactId} onChange={e => handleContactChange(e.target.value)} required className={inputCls}>
            <option value="">— Pilih outlet —</option>
            {contacts.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {contacts.length === 0 && (
            <p className="text-[10px] text-amber-600 font-semibold mt-1">Semua kontak sudah masuk daftar kunjungan hari ini.</p>
          )}
        </FormRow>
        <FormRow label="Alamat">
          <textarea value={address} onChange={e => setAddress(e.target.value)} rows={2} className={inputCls} />
        </FormRow>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 cursor-pointer">Batal</button>
          <button type="submit" disabled={submitting || !contactId} className="px-6 py-2.5 bg-[#003366] text-white text-sm font-bold rounded-xl disabled:opacity-50 cursor-pointer">
            {submitting ? 'Menyimpan...' : 'Tambah'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Modal: Catat Order ─────────────────────────────────────────────────────────

function OrderModal({ orgId, sessionId, visit, products, onClose }: {
  orgId: string
  sessionId: string
  visit: CanvasserVisit
  products: ProductOption[]
  onClose: () => void
}) {
  const [items, setItems] = useState<{ product_id: string; qty: number; unit_price: number }[]>([])
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('TUNAI')
  const [submitting, setSubmitting] = useState(false)

  const total = items.reduce((s, i) => s + i.qty * i.unit_price, 0)
  const blockedForCredit = visit.arStatus === 'BLOKIR' && paymentMethod === 'KREDIT'

  function addItemRow() {
    if (products.length === 0) return
    const p = products[0]
    setItems(prev => [...prev, { product_id: p.id, qty: 1, unit_price: p.sellingPrice }])
  }

  function updateItem(index: number, patch: Partial<{ product_id: string; qty: number }>) {
    setItems(prev => prev.map((it, i) => {
      if (i !== index) return it
      const next = { ...it, ...patch }
      if (patch.product_id) {
        const p = products.find(x => x.id === patch.product_id)
        next.unit_price = p?.sellingPrice || 0
      }
      return next
    }))
  }

  function removeItem(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (items.length === 0) { alert('Tambahkan minimal 1 item.'); return }
    if (blockedForCredit) { alert('Customer ini diblokir. Hanya transaksi TUNAI atau TRANSFER yang diizinkan.'); return }
    setSubmitting(true)
    const res = await createOrder(orgId, {
      session_id: sessionId,
      visit_id: visit.id,
      contact_id: visit.contactId || '',
      payment_method: paymentMethod,
      items,
    })
    if (res.error) alert(res.error)
    else window.location.reload()
    setSubmitting(false)
  }

  return (
    <Modal title={`Catat Order — ${visit.contactName}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <select
                value={item.product_id}
                onChange={e => updateItem(idx, { product_id: e.target.value })}
                className={`${inputCls} flex-1`}
              >
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} — {formatRupiah(p.sellingPrice)}</option>
                ))}
              </select>
              <input
                type="number" min="0.01" step="0.01"
                value={item.qty}
                onChange={e => updateItem(idx, { qty: Number(e.target.value) })}
                className="w-20 px-2 py-2 bg-white border border-slate-200 rounded-xl text-sm text-right"
              />
              <button type="button" onClick={() => removeItem(idx)} className="text-slate-300 hover:text-rose-500 transition cursor-pointer">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button type="button" onClick={addItemRow} disabled={products.length === 0}
            className="flex items-center gap-1.5 text-xs font-bold text-[#003366] hover:underline disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
            <Plus size={14} /> Tambah Produk
          </button>
        </div>

        <FormRow label="Metode Bayar">
          <div className="flex gap-2">
            {(['TUNAI', 'TRANSFER', 'KREDIT'] as PaymentMethod[]).map(m => (
              <button key={m} type="button"
                onClick={() => setPaymentMethod(m)}
                className={`px-4 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                  paymentMethod === m ? 'bg-[#003366] text-white border-[#003366]' : 'bg-white text-slate-500 border-slate-200'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          {blockedForCredit && (
            <p className="text-[11px] text-rose-600 font-bold mt-2">Customer ini diblokir. Hanya transaksi TUNAI atau TRANSFER yang diizinkan.</p>
          )}
        </FormRow>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <span className="text-sm font-semibold text-slate-500">Total</span>
          <span className="text-lg font-bold text-[#003366] tabular-nums">{formatRupiah(total)}</span>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 cursor-pointer">Batal</button>
          <button type="submit" disabled={submitting || items.length === 0 || blockedForCredit} className="px-6 py-2.5 bg-[#003366] text-white text-sm font-bold rounded-xl disabled:opacity-50 cursor-pointer">
            {submitting ? 'Memproses...' : 'Konfirmasi Order'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Modal: Tagih AR ────────────────────────────────────────────────────────────

function ArCollectionModal({ orgId, sessionId, visit, onClose }: {
  orgId: string
  sessionId: string
  visit: CanvasserVisit
  onClose: () => void
}) {
  const [amount, setAmount] = useState(0)
  const [method, setMethod] = useState<'TUNAI' | 'TRANSFER'>('TUNAI')
  const [refNo, setRefNo] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (amount <= 0) return
    setSubmitting(true)
    const res = await recordARCollection(orgId, {
      session_id: sessionId,
      visit_id: visit.id,
      contact_id: visit.contactId || '',
      amount,
      payment_method: method,
      reference_no: method === 'TRANSFER' ? refNo || undefined : undefined,
    })
    if (res.error) alert(res.error)
    else window.location.reload()
    setSubmitting(false)
  }

  return (
    <Modal title={`Tagih AR — ${visit.contactName}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm">
          <p className="text-slate-500">Piutang outstanding: <span className="font-bold text-slate-900">{formatRupiah(visit.arOutstanding)}</span></p>
        </div>
        <FormRow label="Jumlah Dibayar" required>
          <input
            type="number" min="1" step="1" required
            value={amount || ''}
            onChange={e => setAmount(Number(e.target.value))}
            className={inputCls}
          />
        </FormRow>
        <FormRow label="Metode">
          <div className="flex gap-2">
            {(['TUNAI', 'TRANSFER'] as const).map(m => (
              <button key={m} type="button"
                onClick={() => setMethod(m)}
                className={`px-4 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                  method === m ? 'bg-[#003366] text-white border-[#003366]' : 'bg-white text-slate-500 border-slate-200'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </FormRow>
        {method === 'TRANSFER' && (
          <FormRow label="No. Referensi">
            <input value={refNo} onChange={e => setRefNo(e.target.value)} className={inputCls} />
          </FormRow>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 cursor-pointer">Batal</button>
          <button type="submit" disabled={submitting || amount <= 0} className="px-6 py-2.5 bg-[#003366] text-white text-sm font-bold rounded-xl disabled:opacity-50 cursor-pointer">
            {submitting ? 'Memproses...' : 'Catat Pembayaran'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Modal: Tutup Sesi ──────────────────────────────────────────────────────────

function CloseSessionModal({ orgId, sessionId, stockRows, onClose }: {
  orgId: string
  sessionId: string
  openingStock: StockItem[]
  stockRows: (StockItem & { sold: number; remaining: number })[]
  onClose: () => void
}) {
  const [returns, setReturns] = useState<Record<string, number>>(
    Object.fromEntries(stockRows.map(r => [r.product_id, r.remaining]))
  )
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    const closingStock: StockItem[] = stockRows.map(r => ({
      product_id: r.product_id,
      product_name: r.product_name,
      qty_loaded: r.qty_loaded,
      qty_sold: r.sold,
      qty_return: returns[r.product_id] ?? r.remaining,
      unit: r.unit,
    }))
    const res = await closeSession(orgId, sessionId, { closing_stock: closingStock })
    if (res.error) alert(res.error)
    else window.location.href = '/sales/co-sales'
    setSubmitting(false)
  }

  return (
    <Modal title="Tutup Sesi" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-slate-500">Konfirmasi stok sisa yang kembali ke depo. Setoran kas & jurnal akan dicatat otomatis.</p>
        <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-100 divide-y divide-slate-50">
          {stockRows.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400 italic">Tidak ada stok untuk direkonsiliasi.</p>
          ) : stockRows.map(r => (
            <div key={r.product_id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div>
                <p className="text-sm font-semibold text-slate-700">{r.product_name}</p>
                <p className="text-[10px] text-slate-400">Sisa sistem: {r.remaining} {r.unit}</p>
              </div>
              <input
                type="number" min="0" step="1"
                value={returns[r.product_id] ?? 0}
                onChange={e => setReturns(prev => ({ ...prev, [r.product_id]: Number(e.target.value) }))}
                className="w-24 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#003366]/20"
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 cursor-pointer">Batal</button>
          <button type="submit" disabled={submitting} className="px-6 py-2.5 bg-rose-600 text-white text-sm font-bold rounded-xl disabled:opacity-50 cursor-pointer">
            {submitting ? 'Menutup...' : 'Selesai & Tutup'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
