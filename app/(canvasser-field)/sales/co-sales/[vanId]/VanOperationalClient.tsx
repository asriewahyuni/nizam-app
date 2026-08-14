'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
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
  Users,
  UserMinus,
  History,
  WifiOff,
  RefreshCw,
  Clock,
} from 'lucide-react'
import { formatRupiah, formatDate } from '@/lib/utils'
import { EmptyState, StatusBadge, SafeButton, useConfirm } from '@/components/ui/NizamUI'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { Modal, FormRow, inputCls } from '@/components/canvasser/CanvasserModal'
import {
  addVisit,
  addStockToSession,
  closeSession,
  reorderVisits,
  getCustomerLedger,
  assignCustomerToVan,
  pingVanLocation,
} from '@/modules/canvasser/actions/canvasser.actions'
import { useCanvasserSync } from '@/modules/canvasser/lib/use-canvasser-sync.client'
import type { OutboxItem, UpdateVisitStatusOutboxPayload } from '@/modules/canvasser/lib/offline-store.client'
import type {
  CanvasserVan,
  CanvasserSession,
  CanvasserVisit,
  PaymentMethod,
  StockItem,
  CanvasserCustomerRosterEntry,
  CanvasserCustomerLedger,
} from '@/modules/canvasser/lib/canvasser-types'

interface ContactOption { id: string; name: string; address: string | null; creditLimit: number }
interface ProductOption { id: string; name: string; unit: string; sellingPrice: number }
interface UnassignedContact { id: string; name: string }

interface Props {
  orgId: string
  branchId: string | null
  van: CanvasserVan
  session: CanvasserSession | null
  visits: CanvasserVisit[]
  contacts: ContactOption[]
  products: ProductOption[]
  roster: CanvasserCustomerRosterEntry[]
  unassignedContacts: UnassignedContact[]
  brandColor: string
}

type Tab = 'kunjungan' | 'stok' | 'rekap' | 'pelanggan'

const AR_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error'> = {
  NORMAL: 'success',
  MENDEKATI_LIMIT: 'warning',
  BLOKIR: 'error',
}

const AR_STATUS_LABEL: Record<string, string> = {
  NORMAL: 'Normal',
  MENDEKATI_LIMIT: 'Mendekati Limit',
  BLOKIR: 'Blokir',
}

const VISIT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  BELUM: { label: 'Belum', color: 'bg-slate-100 text-slate-500 border-slate-200' },
  DALAM_PERJALANAN: { label: 'Dalam Perjalanan', color: 'bg-blue-50 text-blue-600 border-blue-200' },
  SELESAI: { label: 'Selesai', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  SKIP: { label: 'Skip', color: 'bg-slate-100 text-slate-400 border-slate-200' },
}

const BOTTOM_TABS = [
  ['kunjungan', 'Kunjungan', ClipboardList],
  ['stok', 'Stok', Package],
  ['rekap', 'Rekap', Wallet],
  ['pelanggan', 'Pelanggan', Users],
] as const

// GPS ping ke server tiap beberapa menit selama sesi aktif — dipakai dashboard
// supervisor untuk tampilkan "lokasi terakhir". One-shot getCurrentPosition
// (bukan watchPosition) mengikuti konvensi app/(dashboard)/fleet/FleetClient.tsx.
// Diam-diam gagal saat offline — data lokasi murni real-time, telat kirim tidak berguna.
const GPS_PING_INTERVAL_MS = 5 * 60 * 1000

export function VanOperationalClient({ orgId, van, session: initialSession, visits: initialVisits, contacts, products, roster, unassignedContacts, brandColor }: Props) {
  const sync = useCanvasserSync({ orgId, vanId: van.id, initialSession, initialVisits, products })
  const { session, visits, isOnline, outbox, pendingCount, failedCount } = sync

  const [tab, setTab] = useState<Tab>(session ? 'kunjungan' : 'pelanggan')
  const [showAddVisit, setShowAddVisit] = useState(false)
  const [showAddStock, setShowAddStock] = useState(false)
  const [showCloseSession, setShowCloseSession] = useState(false)
  const [showAssignCustomer, setShowAssignCustomer] = useState(false)
  const [ledgerContact, setLedgerContact] = useState<{ id: string; name: string } | null>(null)
  const { confirm, ConfirmUI } = useConfirm()

  useEffect(() => {
    if (session?.status !== 'AKTIF' || typeof navigator === 'undefined' || !navigator.geolocation) return
    function ping() {
      try {
        navigator.geolocation.getCurrentPosition(
          pos => { pingVanLocation(orgId, van.id, pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy).catch(() => {}) },
          () => { /* izin lokasi ditolak/gagal — abaikan, tidak mengganggu operasional */ },
          { enableHighAccuracy: false, timeout: 10000 }
        )
      } catch {
        // geolocation tidak tersedia/offline — abaikan diam-diam
      }
    }
    ping()
    const interval = setInterval(ping, GPS_PING_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [session?.status, orgId, van.id])

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

  const availableContacts = contacts.filter(c => !visits.some(v => v.contactId === c.id))
  const canCloseSession = isOnline && pendingCount === 0 && failedCount === 0

  async function handleMoveVisit(index: number, direction: -1 | 1) {
    if (!session || !isOnline) return
    const target = index + direction
    if (target < 0 || target >= visits.length) return
    const orderedIds = visits.map(v => v.id)
    ;[orderedIds[index], orderedIds[target]] = [orderedIds[target], orderedIds[index]]
    const res = await reorderVisits(orgId, session.id, orderedIds)
    if (!res.error) window.location.reload()
  }

  async function handleUnassignCustomer(contactId: string, contactName: string) {
    const ok = await confirm({ title: 'Lepas Pelanggan', message: `Lepas ${contactName} dari van ini? Outlet akan hilang dari daftar Pelanggan.`, confirmLabel: 'Lepas' })
    if (!ok) return
    const res = await assignCustomerToVan(orgId, contactId, null)
    if (!res.error) window.location.reload()
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-4 pt-4 pb-3 sticky top-0 z-20">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <Link href="/sales/co-sales" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600 mb-0.5 cursor-pointer">
              <ArrowLeft size={12} /> Dashboard
            </Link>
            <h1 className="text-lg font-bold text-slate-900 truncate">{van.name}</h1>
            <p className="text-xs text-slate-500 truncate">{van.driverName} {session ? `· Sesi ${formatDate(session.sessionDate)}` : '· Belum ada sesi aktif hari ini'}</p>
          </div>
          {session?.status === 'AKTIF' && (
            <button type="button"
              onClick={() => setShowCloseSession(true)}
              disabled={!canCloseSession}
              title={!isOnline ? 'Butuh koneksi internet' : pendingCount > 0 || failedCount > 0 ? 'Tunggu semua data tersinkron dulu' : undefined}
              className="shrink-0 px-4 py-2.5 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 transition-colors duration-150 cursor-pointer min-h-[44px] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Tutup Sesi
            </button>
          )}
          {session?.status === 'SELESAI' && (
            <span className="shrink-0 px-3 py-2 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-xl uppercase">Sesi Ditutup</span>
          )}
        </div>
      </div>

      {!isOnline && (
        <div className="shrink-0 bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-xs font-semibold text-amber-700">
          <WifiOff size={13} /> Mode Offline — perubahan tersimpan & akan sinkron otomatis saat online kembali.
        </div>
      )}
      {isOnline && failedCount > 0 && (
        <div className="shrink-0 bg-rose-50 border-b border-rose-200 px-4 py-2 flex items-center justify-between gap-2 text-xs font-semibold text-rose-700">
          <span className="flex items-center gap-2"><WifiOff size={13} /> {failedCount} perubahan gagal sinkron.</span>
          <button type="button" onClick={() => sync.retrySync()} className="flex items-center gap-1 underline cursor-pointer">
            <RefreshCw size={12} /> Coba Lagi
          </button>
        </div>
      )}
      {isOnline && failedCount === 0 && pendingCount > 0 && (
        <div className="shrink-0 bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center gap-2 text-xs font-semibold text-blue-700">
          <Clock size={13} /> Menyinkronkan {pendingCount} perubahan...
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-24">
        {tab === 'kunjungan' && (
          !session ? (
            <EmptyState icon={ClipboardList} title="Belum ada sesi aktif" description="Mulai sesi hari ini dari Dashboard untuk mencatat kunjungan." />
          ) : (
          <div className="space-y-4">
            {session.status === 'AKTIF' && (
              <button type="button"
                onClick={() => setShowAddVisit(true)}
                disabled={!isOnline}
                title={!isOnline ? 'Butuh koneksi internet' : undefined}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-dashed border-slate-200 text-slate-500 text-sm font-bold rounded-xl hover:text-slate-700 transition-colors duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed w-full justify-center"
                onMouseEnter={e => { e.currentTarget.style.borderColor = `${brandColor}4D` }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '' }}
              >
                <Plus size={16} /> Tambah Kunjungan Outlet
              </button>
            )}
            {visits.length === 0 ? (
              <EmptyState icon={ClipboardList} title="Belum ada rencana kunjungan" />
            ) : (
              visits.map((visit, index) => (
                <VisitCard
                  key={visit.id}
                  visit={visit}
                  products={products}
                  sessionActive={session.status === 'AKTIF'}
                  brandColor={brandColor}
                  isFirst={index === 0}
                  isLast={index === visits.length - 1}
                  reorderEnabled={isOnline}
                  onMoveUp={() => handleMoveVisit(index, -1)}
                  onMoveDown={() => handleMoveVisit(index, 1)}
                  outbox={outbox}
                  onCreateOrder={sync.dispatchCreateOrder}
                  onRecordAr={sync.dispatchRecordAr}
                  onUpdateStatus={sync.dispatchUpdateVisitStatus}
                />
              ))
            )}
          </div>
          )
        )}

        {tab === 'stok' && (
          !session ? (
            <EmptyState icon={Package} title="Belum ada sesi aktif" description="Stok van tampil setelah sesi hari ini dimulai." />
          ) : (
          <div className="space-y-4">
            {session.status === 'AKTIF' && (
              <button type="button"
                onClick={() => setShowAddStock(true)}
                disabled={!isOnline}
                title={!isOnline ? 'Butuh koneksi internet' : undefined}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-dashed border-slate-200 text-slate-500 text-sm font-bold rounded-xl hover:text-slate-700 transition-colors duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed w-full justify-center"
              >
                <Plus size={16} /> Tambah Stok
              </button>
            )}
            <div className="rounded-2xl overflow-hidden border border-slate-200/80 shadow-sm">
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
                    <tr><td colSpan={4} className="px-5 py-10 text-center text-slate-400 italic">Tidak ada stok dimuat di sesi ini. Tekan &quot;Tambah Stok&quot; di atas.</td></tr>
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
          </div>
          )
        )}

        {tab === 'rekap' && (
          !session ? (
            <EmptyState icon={Wallet} title="Belum ada sesi aktif" description="Rekap penjualan tampil setelah sesi hari ini dimulai." />
          ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <RekapStat label="Total Penjualan" value={formatRupiah(rekap.total)} />
              <RekapStat label="Tunai / Transfer" value={formatRupiah(rekap.tunai + rekap.transfer)} />
              <RekapStat label="Kredit" value={formatRupiah(rekap.kredit)} />
              <RekapStat label="AR Ditagih" value={formatRupiah(rekap.arTotal)} />
            </div>
            <p className="text-sm text-slate-500">Outlet dikunjungi: <span className="font-bold text-slate-700">{rekap.visitsDone} / {visits.length}</span></p>
            <div className="rounded-2xl overflow-hidden border border-slate-200/80 shadow-sm">
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
          )
        )}

        {tab === 'pelanggan' && (
          <div className="space-y-4">
            <button type="button"
              onClick={() => setShowAssignCustomer(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-dashed border-slate-200 text-slate-500 text-sm font-bold rounded-xl hover:text-slate-700 transition-colors duration-150 cursor-pointer w-full justify-center"
            >
              <Plus size={16} /> Assign Pelanggan
            </button>
            {roster.length === 0 ? (
              <EmptyState icon={Users} title="Belum ada pelanggan ter-assign" description="Assign outlet ke van ini agar tercatat sebagai tanggung jawab canvasser ini." />
            ) : (
              <div className="space-y-3">
                {roster.map(entry => (
                  <div key={entry.contactId} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{entry.contactName}</p>
                        {entry.address && <p className="text-xs text-slate-500 mt-0.5 truncate">{entry.address}</p>}
                      </div>
                      <StatusBadge label={AR_STATUS_LABEL[entry.arStatus]} variant={AR_STATUS_VARIANT[entry.arStatus]} />
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-slate-400">AR Outstanding</p>
                        <p className="font-bold text-slate-900 tabular-nums">{formatRupiah(entry.arOutstanding)}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Total Transaksi (lifetime)</p>
                        <p className="font-bold text-slate-900 tabular-nums">{entry.lifetimeOrderCount}x · {formatRupiah(entry.lifetimeSalesTotal)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button type="button"
                        onClick={() => setLedgerContact({ id: entry.contactId, name: entry.contactName })}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-50 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-100 transition-colors duration-150 cursor-pointer min-h-[44px]"
                      >
                        <History size={13} /> Riwayat Transaksi
                      </button>
                      <button type="button"
                        onClick={() => handleUnassignCustomer(entry.contactId, entry.contactName)}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-600 text-xs font-bold rounded-lg hover:bg-rose-100 transition-colors duration-150 cursor-pointer min-h-[44px]"
                      >
                        <UserMinus size={13} /> Lepas
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom tab bar — native app-shell style */}
      <nav
        className="shrink-0 fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex items-stretch z-30"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {BOTTOM_TABS.map(([val, label, Icon]) => (
          <button type="button"
            key={val}
            onClick={() => setTab(val)}
            style={tab === val ? { color: brandColor } : undefined}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-slate-400 transition-colors duration-150 cursor-pointer min-h-[56px]"
          >
            <Icon size={20} strokeWidth={tab === val ? 2.5 : 2} />
            <span className={`text-[10px] font-semibold ${tab === val ? '' : 'text-slate-400'}`}>{label}</span>
          </button>
        ))}
      </nav>

      <AnimatePresence>
        {session && showAddVisit && (
          <AddVisitModal
            orgId={orgId}
            sessionId={session.id}
            contacts={availableContacts}
            nextOrder={visits.length + 1}
            brandColor={brandColor}
            onClose={() => setShowAddVisit(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {session && showAddStock && (
          <AddStockModal
            orgId={orgId}
            sessionId={session.id}
            products={products}
            brandColor={brandColor}
            onClose={() => setShowAddStock(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {session && showCloseSession && (
          <CloseSessionModal
            orgId={orgId}
            sessionId={session.id}
            openingStock={session.openingStock}
            stockRows={stockRows}
            onClose={() => setShowCloseSession(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAssignCustomer && (
          <AssignCustomerModal
            orgId={orgId}
            vanId={van.id}
            unassignedContacts={unassignedContacts}
            brandColor={brandColor}
            onClose={() => setShowAssignCustomer(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {ledgerContact && (
          <CustomerLedgerModal
            orgId={orgId}
            contactId={ledgerContact.id}
            contactName={ledgerContact.name}
            onClose={() => setLedgerContact(null)}
          />
        )}
      </AnimatePresence>

      {ConfirmUI}
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

function PendingSyncBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-50 text-amber-600 border border-amber-100">
      <Clock size={9} /> Menunggu sinkron
    </span>
  )
}

// ─── Visit Card ───────────────────────────────────────────────────────────────

function VisitCard({ visit, products, sessionActive, brandColor, isFirst, isLast, reorderEnabled, onMoveUp, onMoveDown, outbox, onCreateOrder, onRecordAr, onUpdateStatus }: {
  visit: CanvasserVisit
  products: ProductOption[]
  sessionActive: boolean
  brandColor: string
  isFirst: boolean
  isLast: boolean
  reorderEnabled: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  outbox: OutboxItem[]
  onCreateOrder: (payload: { session_id: string; visit_id: string; contact_id: string; payment_method: PaymentMethod; items: { product_id: string; qty: number; unit_price: number }[] }) => Promise<{ error?: string }>
  onRecordAr: (payload: { session_id: string; visit_id: string; contact_id: string; amount: number; payment_method: PaymentMethod; reference_no?: string }) => Promise<{ error?: string }>
  onUpdateStatus: (payload: { visitId: string; status: CanvasserVisit['status'] }) => Promise<{ error?: string }>
}) {
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [showArModal, setShowArModal] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const statusCfg = VISIT_STATUS_CONFIG[visit.status]
  const pct = visit.creditLimit > 0 ? Math.min(100, (visit.arOutstanding / visit.creditLimit) * 100) : (visit.arOutstanding > 0 ? 100 : 0)
  const visitStatusPending = outbox.some((i) => i.type === 'UPDATE_VISIT_STATUS' && (i.payload as UpdateVisitStatusOutboxPayload).visitId === visit.id)
  const pendingOrderIds = new Set(outbox.filter((i) => i.type === 'CREATE_ORDER').map((i) => i.id))
  const pendingArIds = new Set(outbox.filter((i) => i.type === 'RECORD_AR').map((i) => i.id))

  async function handleStatus(status: CanvasserVisit['status']) {
    setBusy(true)
    setError(null)
    const res = await onUpdateStatus({ visitId: visit.id, status })
    if (res.error) setError(res.error)
    setBusy(false)
  }

  const canAct = sessionActive && visit.status !== 'SELESAI' && visit.status !== 'SKIP'

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {sessionActive && (
            <div className="flex flex-col shrink-0 -my-1">
              <button type="button" onClick={onMoveUp} disabled={isFirst || !reorderEnabled}
                className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-150 cursor-pointer"
                aria-label="Naikkan urutan">
                <ArrowUp size={13} />
              </button>
              <button type="button" onClick={onMoveDown} disabled={isLast || !reorderEnabled}
                className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-150 cursor-pointer"
                aria-label="Turunkan urutan">
                <ArrowDown size={13} />
              </button>
            </div>
          )}
          <span className={`px-2 py-1 rounded-full text-[10px] font-semibold uppercase border shrink-0 ${statusCfg.color}`}>{statusCfg.label}</span>
          <p className="text-sm font-bold text-slate-900 truncate">{visit.contactName}</p>
          {visitStatusPending && <PendingSyncBadge />}
        </div>
        <span className="text-xs text-slate-400 font-semibold shrink-0">#{visit.visitOrder}</span>
      </div>
      {visit.address && (
        <p className="flex items-center gap-1.5 text-xs text-slate-500"><MapPin size={12} /> {visit.address}</p>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">AR: {formatRupiah(visit.arOutstanding)} / Limit {formatRupiah(visit.creditLimit)}</span>
          <span className={`font-bold ${visit.arStatus === 'BLOKIR' ? 'text-rose-600' : visit.arStatus === 'MENDEKATI_LIMIT' ? 'text-amber-600' : 'text-emerald-600'}`}>
            {AR_STATUS_LABEL[visit.arStatus]}
          </span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${visit.arStatus === 'BLOKIR' ? 'bg-rose-500' : visit.arStatus === 'MENDEKATI_LIMIT' ? 'bg-amber-500' : 'bg-emerald-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {(visit.orders?.length || 0) > 0 && (
        <div className="text-xs text-slate-500 pt-1 border-t border-slate-50 space-y-1">
          <div>{visit.orders!.filter(o => o.status === 'SELESAI').length} order · {formatRupiah(visit.orders!.filter(o => o.status === 'SELESAI').reduce((s, o) => s + o.total, 0))}</div>
          {visit.orders!.some(o => pendingOrderIds.has(o.id)) && <PendingSyncBadge />}
        </div>
      )}
      {visit.arCollections?.some(c => pendingArIds.has(c.id)) && <PendingSyncBadge />}

      {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}

      {canAct && (
        <div className="flex flex-wrap gap-2 pt-1">
          {visit.status === 'BELUM' && (
            <ActionButton icon={<Play size={12} />} label="Mulai Kunjungi" onClick={() => handleStatus('DALAM_PERJALANAN')} disabled={busy} brandColor={brandColor} />
          )}
          <ActionButton icon={<ShoppingCart size={12} />} label="Catat Order" onClick={() => setShowOrderModal(true)} disabled={busy} brandColor={brandColor} />
          <ActionButton icon={<Wallet size={12} />} label="Tagih AR" onClick={() => setShowArModal(true)} disabled={busy} brandColor={brandColor} />
          <ActionButton icon={<CheckCircle2 size={12} />} label="Selesai" onClick={() => handleStatus('SELESAI')} disabled={busy} brandColor={brandColor} />
          <ActionButton icon={<SkipForward size={12} />} label="Skip" onClick={() => handleStatus('SKIP')} disabled={busy} muted />
        </div>
      )}

      <AnimatePresence>
        {showOrderModal && (
          <OrderModal
            visit={visit}
            products={products}
            brandColor={brandColor}
            onSubmit={onCreateOrder}
            onClose={() => setShowOrderModal(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showArModal && (
          <ArCollectionModal
            visit={visit}
            brandColor={brandColor}
            onSubmit={onRecordAr}
            onClose={() => setShowArModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function ActionButton({ icon, label, onClick, disabled, muted, brandColor }: {
  icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; muted?: boolean; brandColor?: string
}) {
  return (
    <button type="button"
      onClick={onClick}
      disabled={disabled}
      style={!muted && brandColor ? { color: brandColor, backgroundColor: `${brandColor}0D` } : undefined}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg transition-colors duration-150 disabled:opacity-50 cursor-pointer ${
        muted ? 'bg-slate-50 text-slate-400 hover:bg-slate-100' : 'hover:opacity-80'
      }`}
    >
      {icon} {label}
    </button>
  )
}

// ─── Modal: Tambah Kunjungan ────────────────────────────────────────────────────

function AddVisitModal({ orgId, sessionId, contacts, nextOrder, brandColor, onClose }: {
  orgId: string
  sessionId: string
  contacts: ContactOption[]
  nextOrder: number
  brandColor: string
  onClose: () => void
}) {
  const [contactId, setContactId] = useState('')
  const [address, setAddress] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleContactChange(id: string) {
    setContactId(id)
    const c = contacts.find(x => x.id === id)
    setAddress(c?.address || '')
  }

  async function handleSubmit() {
    setError(null)
    if (!contactId) { setError('Pilih outlet terlebih dahulu.'); throw new Error('validation') }
    const res = await addVisit(orgId, sessionId, { contact_id: contactId, visit_order: nextOrder, address: address || undefined })
    if (res.error) { setError(res.error); throw new Error(res.error) }
    window.location.reload()
  }

  return (
    <Modal title="Tambah Kunjungan Outlet" onClose={onClose}>
      <div className="space-y-4">
        <FormRow label="Outlet / Pelanggan" required>
          <select value={contactId} onChange={e => handleContactChange(e.target.value)} required className={inputCls}>
            <option value="">— Pilih outlet —</option>
            {contacts.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {contacts.length === 0 && (
            <p className="text-[10px] text-amber-600 font-semibold mt-1">Semua outlet ter-assign sudah masuk daftar kunjungan hari ini.</p>
          )}
        </FormRow>
        <FormRow label="Alamat">
          <textarea value={address} onChange={e => setAddress(e.target.value)} rows={2} className={inputCls} />
        </FormRow>
        {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 cursor-pointer">Batal</button>
          <SafeButton onClick={handleSubmit} disabled={!contactId} loadingText="Menyimpan..." className="!rounded-xl" style={{ backgroundColor: brandColor, borderColor: brandColor }}>
            Tambah
          </SafeButton>
        </div>
      </div>
    </Modal>
  )
}

// ─── Modal: Tambah Stok ─────────────────────────────────────────────────────────

function AddStockModal({ orgId, sessionId, products, brandColor, onClose }: {
  orgId: string
  sessionId: string
  products: ProductOption[]
  brandColor: string
  onClose: () => void
}) {
  const [qtyByProduct, setQtyByProduct] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)

  const items: StockItem[] = products
    .filter(p => (qtyByProduct[p.id] || 0) > 0)
    .map(p => ({ product_id: p.id, product_name: p.name, qty_loaded: qtyByProduct[p.id], unit: p.unit }))

  async function handleSubmit() {
    setError(null)
    if (items.length === 0) { setError('Isi minimal 1 qty produk.'); throw new Error('validation') }
    const res = await addStockToSession(orgId, sessionId, items)
    if (res.error) { setError(res.error); throw new Error(res.error) }
    window.location.reload()
  }

  return (
    <Modal title="Tambah Stok ke Sesi" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-slate-500">Qty yang diisi akan ditambahkan ke stok yang sudah dimuat (bukan menimpa).</p>
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
          <SafeButton onClick={handleSubmit} disabled={items.length === 0} loadingText="Menyimpan..." className="!rounded-xl" style={{ backgroundColor: brandColor, borderColor: brandColor }}>
            Tambah Stok
          </SafeButton>
        </div>
      </div>
    </Modal>
  )
}

// ─── Modal: Catat Order ─────────────────────────────────────────────────────────

function OrderModal({ visit, products, brandColor, onSubmit, onClose }: {
  visit: CanvasserVisit
  products: ProductOption[]
  brandColor: string
  onSubmit: (payload: { session_id: string; visit_id: string; contact_id: string; payment_method: PaymentMethod; items: { product_id: string; qty: number; unit_price: number }[] }) => Promise<{ error?: string }>
  onClose: () => void
}) {
  const [items, setItems] = useState<{ product_id: string; qty: number; unit_price: number }[]>([])
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('TUNAI')
  const [error, setError] = useState<string | null>(null)

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

  async function handleSubmit() {
    setError(null)
    if (items.length === 0) { setError('Tambahkan minimal 1 item.'); throw new Error('validation') }
    if (blockedForCredit) { setError('Customer ini diblokir. Hanya transaksi TUNAI atau TRANSFER yang diizinkan.'); throw new Error('validation') }
    const res = await onSubmit({
      session_id: visit.sessionId,
      visit_id: visit.id,
      contact_id: visit.contactId || '',
      payment_method: paymentMethod,
      items,
    })
    if (res.error) { setError(res.error); throw new Error(res.error) }
    onClose()
  }

  return (
    <Modal title={`Catat Order — ${visit.contactName}`} onClose={onClose}>
      <div className="space-y-4">
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
              <button type="button" onClick={() => removeItem(idx)} className="text-slate-300 hover:text-rose-500 transition-colors duration-150 cursor-pointer">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button type="button" onClick={addItemRow} disabled={products.length === 0}
            style={{ color: brandColor }}
            className="flex items-center gap-1.5 text-xs font-bold hover:underline disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
            <Plus size={14} /> Tambah Produk
          </button>
        </div>

        <FormRow label="Metode Bayar">
          <div className="flex gap-2">
            {(['TUNAI', 'TRANSFER', 'KREDIT'] as PaymentMethod[]).map(m => (
              <button key={m} type="button"
                onClick={() => setPaymentMethod(m)}
                style={paymentMethod === m ? { backgroundColor: brandColor, borderColor: brandColor } : undefined}
                className={`px-4 py-1.5 text-xs font-semibold rounded-xl border transition-colors duration-150 cursor-pointer ${
                  paymentMethod === m ? 'text-white' : 'bg-white text-slate-500 border-slate-200'
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
          <span className="text-lg font-bold tabular-nums" style={{ color: brandColor }}>{formatRupiah(total)}</span>
        </div>

        {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 cursor-pointer">Batal</button>
          <SafeButton onClick={handleSubmit} disabled={items.length === 0 || blockedForCredit} loadingText="Memproses..." className="!rounded-xl" style={{ backgroundColor: brandColor, borderColor: brandColor }}>
            Konfirmasi Order
          </SafeButton>
        </div>
      </div>
    </Modal>
  )
}

// ─── Modal: Tagih AR ────────────────────────────────────────────────────────────

function ArCollectionModal({ visit, brandColor, onSubmit, onClose }: {
  visit: CanvasserVisit
  brandColor: string
  onSubmit: (payload: { session_id: string; visit_id: string; contact_id: string; amount: number; payment_method: PaymentMethod; reference_no?: string }) => Promise<{ error?: string }>
  onClose: () => void
}) {
  const [amount, setAmount] = useState(0)
  const [method, setMethod] = useState<'TUNAI' | 'TRANSFER'>('TUNAI')
  const [refNo, setRefNo] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setError(null)
    if (amount <= 0) { setError('Jumlah pembayaran harus lebih dari 0.'); throw new Error('validation') }
    const res = await onSubmit({
      session_id: visit.sessionId,
      visit_id: visit.id,
      contact_id: visit.contactId || '',
      amount,
      payment_method: method,
      reference_no: method === 'TRANSFER' ? refNo || undefined : undefined,
    })
    if (res.error) { setError(res.error); throw new Error(res.error) }
    onClose()
  }

  return (
    <Modal title={`Tagih AR — ${visit.contactName}`} onClose={onClose}>
      <div className="space-y-4">
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
                style={method === m ? { backgroundColor: brandColor, borderColor: brandColor } : undefined}
                className={`px-4 py-1.5 text-xs font-semibold rounded-xl border transition-colors duration-150 cursor-pointer ${
                  method === m ? 'text-white' : 'bg-white text-slate-500 border-slate-200'
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
        {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 cursor-pointer">Batal</button>
          <SafeButton onClick={handleSubmit} disabled={amount <= 0} loadingText="Memproses..." className="!rounded-xl" style={{ backgroundColor: brandColor, borderColor: brandColor }}>
            Catat Pembayaran
          </SafeButton>
        </div>
      </div>
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
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setError(null)
    const closingStock: StockItem[] = stockRows.map(r => ({
      product_id: r.product_id,
      product_name: r.product_name,
      qty_loaded: r.qty_loaded,
      qty_sold: r.sold,
      qty_return: returns[r.product_id] ?? r.remaining,
      unit: r.unit,
    }))
    const res = await closeSession(orgId, sessionId, { closing_stock: closingStock })
    if (res.error) { setError(res.error); throw new Error(res.error) }
    window.location.href = '/sales/co-sales'
  }

  return (
    <Modal title="Tutup Sesi" onClose={onClose}>
      <div className="space-y-4">
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
                className="w-24 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
          ))}
        </div>
        {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 cursor-pointer">Batal</button>
          <SafeButton onClick={handleSubmit} loadingText="Menutup..." variant="danger" className="!rounded-xl">
            Selesai & Tutup
          </SafeButton>
        </div>
      </div>
    </Modal>
  )
}

// ─── Modal: Assign Pelanggan ────────────────────────────────────────────────────

function AssignCustomerModal({ orgId, vanId, unassignedContacts, brandColor, onClose }: {
  orgId: string
  vanId: string
  unassignedContacts: UnassignedContact[]
  brandColor: string
  onClose: () => void
}) {
  const [contactId, setContactId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const options = unassignedContacts.map(c => ({ id: c.id, name: c.name, code: '' }))

  async function handleSubmit() {
    setError(null)
    if (!contactId) { setError('Pilih pelanggan terlebih dahulu.'); throw new Error('validation') }
    const res = await assignCustomerToVan(orgId, contactId, vanId)
    if (res.error) { setError(res.error); throw new Error(res.error) }
    window.location.reload()
  }

  return (
    <Modal title="Assign Pelanggan ke Van" onClose={onClose}>
      <div className="space-y-4">
        <FormRow label="Pelanggan" required>
          <SearchableSelect
            options={options}
            value={contactId}
            onChange={setContactId}
            placeholder="— Pilih pelanggan —"
            searchPlaceholder="Cari nama pelanggan..."
          />
          {unassignedContacts.length === 0 && (
            <p className="text-[10px] text-amber-600 font-semibold mt-1">Semua pelanggan sudah ter-assign ke salah satu van.</p>
          )}
        </FormRow>
        {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 cursor-pointer">Batal</button>
          <SafeButton onClick={handleSubmit} disabled={!contactId} loadingText="Menyimpan..." className="!rounded-xl" style={{ backgroundColor: brandColor, borderColor: brandColor }}>
            Assign
          </SafeButton>
        </div>
      </div>
    </Modal>
  )
}

// ─── Modal: Riwayat Transaksi Pelanggan (ledger) ───────────────────────────────

function CustomerLedgerModal({ orgId, contactId, contactName, onClose }: {
  orgId: string
  contactId: string
  contactName: string
  onClose: () => void
}) {
  const [ledger, setLedger] = useState<CanvasserCustomerLedger | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    getCustomerLedger(orgId, contactId).then(data => {
      if (active) { setLedger(data); setLoading(false) }
    })
    return () => { active = false }
  }, [orgId, contactId])

  return (
    <Modal title={`Riwayat Transaksi — ${contactName}`} onClose={onClose}>
      {loading || !ledger ? (
        <p className="text-sm text-slate-400 text-center py-10">Memuat riwayat...</p>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] text-slate-400 uppercase font-semibold">AR Outstanding</p>
              <p className="text-sm font-bold text-slate-900 tabular-nums mt-1">{formatRupiah(ledger.contact.outstandingTotal)}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Credit Limit</p>
              <p className="text-sm font-bold text-slate-900 tabular-nums mt-1">{formatRupiah(ledger.contact.creditLimit)}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Status AR</p>
              <StatusBadge label={AR_STATUS_LABEL[ledger.contact.arStatus]} variant={AR_STATUS_VARIANT[ledger.contact.arStatus]} />
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Order ({ledger.orders.length})</p>
            {ledger.orders.length === 0 ? (
              <p className="text-sm text-slate-400 italic">Belum ada order dari canvasser untuk outlet ini.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {ledger.orders.map(order => (
                  <div key={order.id} className="border border-slate-100 rounded-xl p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-500">{order.orderNumber}</span>
                      <span className="text-slate-400">{formatDate(order.createdAt)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[11px] font-semibold text-slate-500">{order.paymentMethod}</span>
                      <span className="text-sm font-bold text-slate-900 tabular-nums">{formatRupiah(order.total)}</span>
                    </div>
                    {order.items && order.items.length > 0 && (
                      <ul className="mt-2 pt-2 border-t border-slate-50 space-y-0.5">
                        {order.items.map(item => (
                          <li key={item.id} className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>{item.productName} · {item.qty} {item.unit}</span>
                            <span className="tabular-nums">{formatRupiah(item.subtotal)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Pembayaran AR ({ledger.arCollections.length})</p>
            {ledger.arCollections.length === 0 ? (
              <p className="text-sm text-slate-400 italic">Belum ada pembayaran piutang tercatat.</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {ledger.arCollections.map(c => (
                  <div key={c.id} className="flex items-center justify-between text-xs px-3 py-2 bg-emerald-50/50 rounded-lg">
                    <span className="text-slate-500">{formatDate(c.createdAt)} · {c.paymentMethod}</span>
                    <span className="font-bold text-emerald-700 tabular-nums">{formatRupiah(c.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
