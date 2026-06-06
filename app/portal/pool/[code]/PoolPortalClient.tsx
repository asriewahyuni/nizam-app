'use client'

import { useState, useMemo, useTransition } from 'react'
import {
  Store, Ticket, Receipt, Users, TrendingUp,
  CheckCircle2, Clock, ArrowUpCircle, Phone, Mail, MapPin,
  AlertTriangle, Building2, Package, X, Loader2, MoveRight, Printer,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as ReTooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { cn } from '@/lib/utils'
import { StatCard, SectionCard, SectionHeader, EmptyState, StatusBadge } from '@/components/ui/NizamUI'
import type { BusPool, BusPoolTopUp, BusPoolSettlement, BusTicket, BusAgent, BusSchedule } from '@/modules/po-bus/lib/po-bus-types'
import type { FleetTerminal } from '@/types/database.types'
import { createBusTicket } from '@/modules/po-bus/actions/po-bus.actions'
import { createCargoShipment } from '@/modules/po-bus/actions/cargo.actions'

// ─── Helpers ──────────────────────────────────────────────────────────────────

// pg returns numeric cols as strings — coerce everywhere
function n(v: unknown): number {
  const x = Number(v)
  return isNaN(x) ? 0 : x
}
function formatRupiah(v: unknown) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n(v))
}
function formatAngka(v: unknown) {
  return new Intl.NumberFormat('id-ID').format(n(v))
}
function formatDate(s?: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}
function formatDateTime(s: string) {
  return new Date(s).toLocaleString('id-ID', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}
function formatMonth(s: string) {
  return new Date(s).toLocaleDateString('id-ID', { month: 'short', year: '2-digit' })
}

// ─── Config ───────────────────────────────────────────────────────────────────

const POOL_TYPE_CFG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  POOL_UTAMA: { label: 'Pool Utama', bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200'    },
  AGEN_RESMI: { label: 'Agen Resmi', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  SUB_AGEN:   { label: 'Sub-Agen',   bg: 'bg-slate-100',  text: 'text-slate-600',   border: 'border-slate-200'   },
}

const STATUS_CFG: Record<string, { label: string; badge: 'success' | 'info' | 'error' | 'neutral' | 'warning' }> = {
  DIPESAN:   { label: 'Dipesan',  badge: 'neutral'  },
  DIBAYAR:   { label: 'Dibayar', badge: 'info'     },
  DIGUNAKAN: { label: 'Terpakai', badge: 'success'  },
  BATAL:     { label: 'Batal',    badge: 'error'    },
}

type Tab = 'RINGKASAN' | 'TIKET' | 'SETTLEMENT' | 'TOPUP' | 'AGEN'

type PortalSchedule = BusSchedule & { route_name?: string; origin?: string; destination?: string; base_price?: number; plate_number?: string; model?: string }

interface Props {
  pool: BusPool
  agents: BusAgent[]
  topUps: BusPoolTopUp[]
  settlements: BusPoolSettlement[]
  tickets: (BusTicket & { departure_time?: string; origin?: string; destination?: string })[]
  schedules?: PortalSchedule[]
  terminals?: FleetTerminal[]
}

// ─── Revenue Chart ────────────────────────────────────────────────────────────

function RevenueChart({ settlements, topUps }: { settlements: BusPoolSettlement[]; topUps: BusPoolTopUp[] }) {
  const data = useMemo(() => {
    const map: Record<string, { bulan: string; pendapatan: number; komisi: number; topup: number }> = {}
    settlements.forEach(s => {
      const key = formatMonth(s.period_end)
      if (!map[key]) map[key] = { bulan: key, pendapatan: 0, komisi: 0, topup: 0 }
      map[key].pendapatan += n(s.total_revenue)
      map[key].komisi    += n(s.commission_amount)
    })
    topUps.forEach(t => {
      const key = formatMonth(t.created_at)
      if (!map[key]) map[key] = { bulan: key, pendapatan: 0, komisi: 0, topup: 0 }
      map[key].topup += n(t.amount)
    })
    return Object.values(map).slice(-8)
  }, [settlements, topUps])

  if (data.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center h-36 gap-2 text-slate-300">
        <TrendingUp className="w-8 h-8" />
        <p className="text-xs">Butuh minimal 2 periode data</p>
      </div>
    )
  }

  const fmt = (v: number) =>
    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}jt`
    : v >= 1_000   ? `${(v / 1_000).toFixed(0)}rb`
    : String(v)

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.18} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}    />
          </linearGradient>
          <linearGradient id="gK" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#10b981" stopOpacity={0.18} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0}    />
          </linearGradient>
          <linearGradient id="gT" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}    />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="bulan" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={fmt} width={40} />
        <ReTooltip
          formatter={((v: number, name: string) => [
            formatRupiah(v),
            name === 'pendapatan' ? 'Pendapatan' : name === 'komisi' ? 'Komisi' : 'Top-up',
          ]) as any} // eslint-disable-line @typescript-eslint/no-explicit-any
          contentStyle={{
            fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0',
            boxShadow: '0 4px 12px rgba(0,0,0,.06)', padding: '8px 12px',
          }}
          cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }}
        />
        <Area type="monotone" dataKey="pendapatan" stroke="#3b82f6" strokeWidth={2}
          fill="url(#gP)" dot={false} activeDot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
          animationDuration={1200} animationEasing="ease-out" />
        <Area type="monotone" dataKey="komisi" stroke="#10b981" strokeWidth={2}
          fill="url(#gK)" dot={false} activeDot={{ r: 4, fill: '#10b981', strokeWidth: 0 }}
          animationDuration={1400} animationEasing="ease-out" />
        <Area type="monotone" dataKey="topup" stroke="#f59e0b" strokeWidth={2}
          fill="url(#gT)" dot={false} activeDot={{ r: 4, fill: '#f59e0b', strokeWidth: 0 }}
          animationDuration={1600} animationEasing="ease-out" />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function PoolPortalClient({ pool, agents, topUps, settlements, tickets, schedules = [], terminals = [] }: Props) {
  const [tab, setTab] = useState<Tab>('RINGKASAN')
  const [showTicketModal, setShowTicketModal] = useState(false)
  const [showCargoModal, setShowCargoModal] = useState(false)

  const cfg = POOL_TYPE_CFG[pool.pool_type] ?? POOL_TYPE_CFG.AGEN_RESMI

  const depositBalance     = n(pool.deposit_balance)
  const creditLimit        = n(pool.credit_limit)
  const commissionPct      = n(pool.commission_pct)
  const balancePct         = creditLimit > 0 ? Math.min((depositBalance / creditLimit) * 100, 100) : 0
  const balanceColor       = balancePct > 50 ? 'bg-emerald-500' : balancePct > 20 ? 'bg-amber-400' : 'bg-rose-500'

  const activeTickets      = tickets.filter(t => t.status !== 'BATAL')
  const totalRevenue       = activeTickets.reduce((s, t) => s + n(t.price), 0)
  const totalTopUp         = topUps.reduce((s, t) => s + n(t.amount), 0)
  const earnedCommission   = totalRevenue * (commissionPct / 100)
  const paidSettlements    = settlements.filter(s => s.status === 'DIBAYAR')
  const pendingSettlements = settlements.filter(s => s.status === 'PENDING')
  const paidCommission     = paidSettlements.reduce((s, x) => s + n(x.commission_amount), 0)
  const pendingCommission  = pendingSettlements.reduce((s, x) => s + n(x.commission_amount), 0)

  const TABS: { id: Tab; label: string; badge?: number }[] = [
    { id: 'RINGKASAN',  label: 'Ringkasan' },
    { id: 'TIKET',      label: 'Tiket',      badge: tickets.length },
    { id: 'SETTLEMENT', label: 'Settlement', badge: pendingSettlements.length || undefined },
    { id: 'TOPUP',      label: 'Top-up',     badge: topUps.length },
    { id: 'AGEN',       label: 'Agen',       badge: agents.length },
  ]

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 space-y-5">

        {/* ── Header ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-start gap-5">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
              <Store className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-xl font-bold text-slate-900">{pool.name}</h1>
                <span className={cn('text-xs font-semibold px-2.5 py-0.5 rounded-full border', cfg.bg, cfg.text, cfg.border)}>
                  {cfg.label}
                </span>
                {!pool.is_active && (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500">Nonaktif</span>
                )}
              </div>
              <p className="text-xs font-mono text-slate-400 mb-2">{pool.code}</p>
              <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                {pool.city  && <span className="flex items-center gap-1"><MapPin  className="w-3.5 h-3.5" />{pool.city}{pool.province ? `, ${pool.province}` : ''}</span>}
                {pool.phone && <span className="flex items-center gap-1"><Phone   className="w-3.5 h-3.5" />{pool.phone}</span>}
                {pool.email && <span className="flex items-center gap-1"><Mail    className="w-3.5 h-3.5" />{pool.email}</span>}
              </div>
            </div>

            {/* Balance block */}
            <div className="text-right shrink-0">
              <p className="text-xs text-slate-400 mb-0.5">Saldo Deposit</p>
              <p className={cn('text-2xl font-bold', depositBalance > 0 ? 'text-emerald-600' : 'text-slate-400')}>
                {formatRupiah(depositBalance)}
              </p>
              {creditLimit > 0 && (
                <div className="mt-2 w-40 ml-auto">
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                    <span>Limit {formatRupiah(creditLimit)}</span>
                    <span>{Math.round(balancePct)}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all', balanceColor)} style={{ width: `${balancePct}%` }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {pendingSettlements.length > 0 && (
            <div className="mt-4 flex items-center gap-2 bg-amber-50 rounded-lg border border-amber-100 px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-700">
                <strong>{pendingSettlements.length} settlement</strong> belum dibayarkan — {formatRupiah(pendingCommission)}
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => setShowTicketModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-sm font-bold text-white hover:bg-blue-700 active:scale-95 transition-all cursor-pointer shadow-sm shadow-blue-200 shrink-0"
            >
              <Ticket className="w-4 h-4" />
              Jual Tiket
            </button>
            <button
              onClick={() => setShowCargoModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-sm font-bold text-white hover:bg-indigo-700 active:scale-95 transition-all cursor-pointer shadow-sm shadow-indigo-200 shrink-0"
            >
              <Package className="w-4 h-4" />
              Buat Kargo
            </button>
            <a
              href={`/print/manifest/${pool.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer shrink-0"
            >
              <Printer className="w-4 h-4" />
              Manifest Kargo
            </a>
          </div>
        </div>

        {/* ── Modal: Jual Tiket ── */}
        {showTicketModal && (
          <TicketModal
            pool={pool}
            schedules={schedules}
            agents={agents}
            onClose={() => setShowTicketModal(false)}
          />
        )}

        {/* ── Modal: Buat Kargo ── */}
        {showCargoModal && (
          <CargoModal
            pool={pool}
            terminals={terminals}
            onClose={() => setShowCargoModal(false)}
          />
        )}

        {/* ── KPI strip ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Tiket"    value={formatAngka(tickets.length)}   icon={Ticket}       color="blue"    sub={`${activeTickets.length} aktif`} />
          <StatCard label="Revenue Pool"   value={formatRupiah(totalRevenue)}     icon={TrendingUp}   color="emerald" sub={`${commissionPct}% komisi`} />
          <StatCard label="Komisi Earned"  value={formatRupiah(earnedCommission)} icon={Receipt}      color="amber"   sub={`Dibayar ${formatRupiah(paidCommission)}`} />
          <StatCard label="Total Top-up"   value={formatRupiah(totalTopUp)}       icon={ArrowUpCircle} color="indigo" sub={`${topUps.length} transaksi`} />
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer whitespace-nowrap',
                tab === t.id
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50',
              )}
            >
              {t.label}
              {t.badge !== undefined && (
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-semibold',
                  tab === t.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500',
                )}>{t.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── RINGKASAN ── */}
        {tab === 'RINGKASAN' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              {/* Info pool */}
              <SectionCard>
                <SectionHeader title="Informasi Pool" icon={Building2} />
                <div className="p-5 space-y-2.5 text-sm">
                  {([
                    ['Pemilik',    pool.owner_name],
                    ['PIC',        pool.pic_name],
                    ['WhatsApp',   pool.whatsapp],
                    ['Alamat',     pool.address],
                    ['Komisi',     commissionPct > 0 ? `${commissionPct}%` : null],
                  ] as [string, string | null | undefined][]).filter(([, v]) => v).map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <span className="text-slate-400 w-24 shrink-0">{k}</span>
                      <span className={cn('text-slate-700 font-medium', k === 'Komisi' && 'text-emerald-600')}>{v}</span>
                    </div>
                  ))}
                  {pool.bank_name && (
                    <div className="pt-3 mt-1 border-t border-slate-100">
                      <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Rekening</p>
                      <p className="text-slate-700 font-medium">{pool.bank_name} — {pool.bank_account}</p>
                      {pool.bank_account_name && <p className="text-xs text-slate-400 mt-0.5">{pool.bank_account_name}</p>}
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* Komisi ringkasan */}
              <SectionCard>
                <SectionHeader title="Ringkasan Komisi" icon={Receipt} />
                <div className="p-5">
                  <div className="space-y-1">
                    {[
                      { label: 'Total Revenue',            val: formatRupiah(totalRevenue),      cls: 'text-slate-700' },
                      { label: `Komisi ${commissionPct}%`, val: formatRupiah(earnedCommission),  cls: 'text-amber-600' },
                      { label: 'Sudah Dibayar',            val: formatRupiah(paidCommission),    cls: 'text-emerald-600' },
                      { label: 'Tertunggak',               val: formatRupiah(pendingCommission), cls: pendingCommission > 0 ? 'text-rose-600' : 'text-slate-400' },
                    ].map(row => (
                      <div key={row.label} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                        <span className="text-sm text-slate-500">{row.label}</span>
                        <span className={cn('text-sm font-bold', row.cls)}>{row.val}</span>
                      </div>
                    ))}
                  </div>
                  {pendingSettlements.length > 0 && (
                    <div className="mt-3 flex items-center gap-2 bg-amber-50 rounded-lg px-3 py-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <p className="text-xs text-amber-700">{pendingSettlements.length} settlement belum dibayarkan</p>
                    </div>
                  )}
                </div>
              </SectionCard>
            </div>

            {/* Revenue trend chart */}
            <SectionCard>
              <SectionHeader
                title="Tren Revenue"
                subtitle="Pendapatan, komisi & top-up per bulan"
                icon={TrendingUp}
                actions={
                  <div className="flex items-center gap-4 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1.5"><span className="w-6 h-0.5 rounded-full bg-blue-500 inline-block" />Pendapatan</span>
                    <span className="flex items-center gap-1.5"><span className="w-6 h-0.5 rounded-full bg-emerald-500 inline-block" />Komisi</span>
                    <span className="flex items-center gap-1.5"><span className="w-6 h-0.5 rounded-full bg-amber-500 inline-block" />Top-up</span>
                  </div>
                }
              />
              <div className="p-5">
                <RevenueChart settlements={settlements} topUps={topUps} />
              </div>
            </SectionCard>

            {/* Recent tickets */}
            <SectionCard>
              <SectionHeader title="Tiket Terbaru" icon={Ticket} subtitle={`${tickets.length} tiket terjual`} />
              {tickets.length === 0 ? (
                <div className="p-5">
                  <EmptyState icon={Ticket} title="Belum ada tiket" description="Tiket yang terjual melalui pool ini akan muncul di sini." />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 pl-5">Penumpang</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400">Kursi</th>
                        <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400">Harga</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400">Status</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 pr-5">Tanggal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tickets.slice(0, 8).map(t => {
                        const sc = STATUS_CFG[t.status] ?? STATUS_CFG.DIPESAN
                        return (
                          <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors duration-100">
                            <td className="py-3 px-4 pl-5">
                              <p className="font-medium text-slate-700">{t.passenger_name}</p>
                              {t.origin && t.destination && (
                                <p className="text-[11px] text-slate-400 mt-0.5">{t.origin} → {t.destination}</p>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-600">{t.seat_number}</td>
                            <td className="py-3 px-4 text-right font-semibold text-slate-700">{formatRupiah(t.price)}</td>
                            <td className="py-3 px-4">
                              <StatusBadge label={sc.label} variant={sc.badge} />
                            </td>
                            <td className="py-3 px-4 pr-5 text-xs text-slate-400">{formatDate(t.created_at)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {tickets.length > 8 && (
                    <p className="text-xs text-slate-400 text-center py-3">
                      Menampilkan 8 dari {tickets.length} tiket — buka tab Tiket untuk selengkapnya
                    </p>
                  )}
                </div>
              )}
            </SectionCard>
          </div>
        )}

        {/* ── TIKET ── */}
        {tab === 'TIKET' && (
          <SectionCard>
            <SectionHeader title="Tiket Terjual via Pool" icon={Ticket} subtitle={`${tickets.length} tiket`} />
            {tickets.length === 0 ? (
              <div className="p-5">
                <EmptyState icon={Ticket} title="Belum ada tiket" description="Belum ada tiket yang terjual melalui pool ini." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {['Penumpang', 'Rute', 'Kursi', 'Harga', 'Tanggal', 'Status', ''].map((h, i) => (
                        <th key={i} className={cn(
                          'py-3 px-4 text-xs font-semibold text-slate-400',
                          i === 0 ? 'text-left pl-5' : i === 3 ? 'text-right' : 'text-left',
                          i === 5 ? '' : i === 6 ? 'pr-5 w-8' : '',
                        )}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.slice(0, 100).map(t => {
                      const sc = STATUS_CFG[t.status] ?? STATUS_CFG.DIPESAN
                      return (
                        <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors duration-100">
                          <td className="py-3 px-4 pl-5">
                            <p className="font-medium text-slate-700">{t.passenger_name}</p>
                            {t.passenger_phone && <p className="text-[11px] text-slate-400 mt-0.5">{t.passenger_phone}</p>}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-500">
                            {t.origin && t.destination ? `${t.origin} → ${t.destination}` : '—'}
                          </td>
                          <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-600">{t.seat_number}</td>
                          <td className="py-3 px-4 text-right font-semibold text-slate-700">{formatRupiah(t.price)}</td>
                          <td className="py-3 px-4 text-xs text-slate-400">{formatDate(t.created_at)}</td>
                          <td className="py-3 px-4">
                            <StatusBadge label={sc.label} variant={sc.badge} />
                          </td>
                          <td className="py-3 px-4 pr-5">
                            <a
                              href={`/print/ticket/${t.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Cetak Tiket"
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-300 transition-colors cursor-pointer inline-flex items-center"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </a>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {tickets.length > 100 && (
                  <p className="text-xs text-slate-400 text-center py-3">Menampilkan 100 dari {tickets.length} tiket</p>
                )}
              </div>
            )}
          </SectionCard>
        )}

        {/* ── SETTLEMENT ── */}
        {tab === 'SETTLEMENT' && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Total Settlement"  value={settlements.length}         icon={Receipt}      color="slate"   sub={`${paidSettlements.length} lunas`} />
              <StatCard label="Komisi Dibayar"    value={formatRupiah(paidCommission)}    icon={CheckCircle2} color="emerald" />
              <StatCard label="Pending"           value={formatRupiah(pendingCommission)} icon={Clock}        color={pendingCommission > 0 ? 'amber' : 'slate'} alert={pendingCommission > 0} />
            </div>

            <SectionCard>
              <SectionHeader title="Riwayat Settlement Komisi" icon={Receipt} subtitle={`${settlements.length} periode`} />
              {settlements.length === 0 ? (
                <div className="p-5">
                  <EmptyState icon={Receipt} title="Belum ada settlement" description="Settlement komisi akan muncul setelah periode pertama selesai." />
                </div>
              ) : (
                <div className="p-5 space-y-2">
                  {settlements.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl hover:border-slate-200 transition-colors">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">
                          {formatDate(s.period_start)} – {formatDate(s.period_end)}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {formatAngka(n(s.total_tickets))} tiket · Revenue {formatRupiah(s.total_revenue)} · Komisi {n(s.commission_pct)}%
                        </p>
                        {s.paid_at && (
                          <p className="text-[11px] text-emerald-500 mt-1">Dibayar {formatDateTime(s.paid_at)}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-800 mb-1">{formatRupiah(s.commission_amount)}</p>
                        <StatusBadge
                          label={s.status === 'DIBAYAR' ? 'Lunas' : 'Pending'}
                          variant={s.status === 'DIBAYAR' ? 'success' : 'warning'}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        )}

        {/* ── TOPUP ── */}
        {tab === 'TOPUP' && (
          <SectionCard>
            <SectionHeader
              title="Riwayat Top-up Saldo"
              icon={ArrowUpCircle}
              subtitle={`Total: ${formatRupiah(totalTopUp)}`}
            />
            {topUps.length === 0 ? (
              <div className="p-5">
                <EmptyState icon={ArrowUpCircle} title="Belum ada top-up" description="Riwayat pengisian saldo deposit akan muncul di sini." />
              </div>
            ) : (
              <div className="p-5 space-y-2">
                {topUps.map(tu => (
                  <div key={tu.id} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl hover:bg-slate-100/70 transition-colors">
                    <div>
                      <p className="text-sm font-semibold text-emerald-600">+{formatRupiah(tu.amount)}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {tu.payment_method} · {formatDateTime(tu.created_at)}
                        {tu.reference_no ? ` · Ref: ${tu.reference_no}` : ''}
                      </p>
                    </div>
                    {tu.notes && <p className="text-xs text-slate-400 max-w-[160px] text-right">{tu.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        )}

        {/* ── AGEN ── */}
        {tab === 'AGEN' && (
          <SectionCard>
            <SectionHeader title="Agen dalam Pool" icon={Users} subtitle={`${agents.length} agen terdaftar`} />
            {agents.length === 0 ? (
              <div className="p-5">
                <EmptyState icon={Users} title="Belum ada agen" description="Agen yang terdaftar di pool ini akan tampil di sini." />
              </div>
            ) : (
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                {agents.map(a => (
                  <div key={a.id} className={cn(
                    'flex items-center gap-3 p-3.5 bg-slate-50 rounded-xl hover:bg-slate-100/70 transition-colors',
                    !a.is_active && 'opacity-50',
                  )}>
                    <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-blue-700 font-bold text-xs">{a.name.slice(0, 2).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 text-sm truncate">{a.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {a.city ?? '—'} · Komisi {n(a.commission_pct)}%{a.phone ? ` · ${a.phone}` : ''}
                      </p>
                    </div>
                    {!a.is_active && (
                      <span className="text-[10px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full shrink-0 font-semibold">Nonaktif</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        )}

        <p className="text-center text-xs text-slate-300 pb-4">{pool.name} · {pool.code}</p>
      </div>
    </div>
  )
}

// ─── Ticket Modal ─────────────────────────────────────────────────────────────

function TicketModal({ pool, schedules, agents, onClose }: {
  pool: BusPool
  schedules: PortalSchedule[]
  agents: BusAgent[]
  onClose: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [lastTicketId, setLastTicketId] = useState<string | null>(null)
  const [form, setForm] = useState({
    schedule_id: schedules[0]?.id ?? '',
    passenger_name: '',
    passenger_phone: '',
    seat_number: '',
    price: schedules[0]?.base_price ? String(n(schedules[0].base_price)) : '',
    agent_id: '',
    notes: '',
  })

  const selectedSched = schedules.find(s => s.id === form.schedule_id)

  function handleScheduleChange(id: string) {
    const s = schedules.find(x => x.id === id)
    setForm(f => ({
      ...f,
      schedule_id: id,
      price: s?.base_price ? String(n(s.base_price)) : f.price,
    }))
  }

  function handleSubmit() {
    if (!form.schedule_id || !form.passenger_name.trim() || !form.seat_number.trim()) {
      setError('Jadwal, nama penumpang, dan nomor kursi wajib diisi.')
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await createBusTicket(pool.org_id, {
        schedule_id: form.schedule_id,
        passenger_name: form.passenger_name.trim(),
        passenger_phone: form.passenger_phone.trim() || undefined,
        seat_number: form.seat_number.trim(),
        price: n(form.price),
        agent_id: form.agent_id || undefined,
        pool_id: pool.id,
        notes: form.notes.trim() || undefined,
      })
      if (res.error) {
        setError(res.error)
      } else {
        setSuccess(`Tiket berhasil dibuat untuk ${form.passenger_name}!`)
        setLastTicketId(res.data?.id ?? null)
        setForm(f => ({ ...f, passenger_name: '', passenger_phone: '', seat_number: '', notes: '' }))
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Ticket className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-slate-800 text-sm">Jual Tiket</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {success && (
            <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-emerald-700 font-medium">{success}</p>
                {lastTicketId && (
                  <a
                    href={`/print/ticket/${lastTicketId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 font-semibold mt-1 underline cursor-pointer"
                  >
                    <Printer className="w-3 h-3" />
                    Cetak Tiket
                  </a>
                )}
              </div>
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <p className="text-sm text-rose-700">{error}</p>
            </div>
          )}

          {/* Jadwal */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Jadwal Keberangkatan</label>
            {schedules.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">Tidak ada jadwal tersedia.</p>
            ) : (
              <select
                value={form.schedule_id}
                onChange={e => handleScheduleChange(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 cursor-pointer"
              >
                {schedules.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.origin ?? s.route_name ?? '—'} → {s.destination ?? '—'} · {new Date(s.departure_time).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {s.plate_number ? ` (${s.plate_number})` : ''}
                  </option>
                ))}
              </select>
            )}
            {selectedSched && (
              <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                <MoveRight className="w-3 h-3" />
                {selectedSched.route_name ?? `${selectedSched.origin} - ${selectedSched.destination}`}
                {selectedSched.base_price ? ` · Base: ${formatRupiah(selectedSched.base_price)}` : ''}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Nama Penumpang *</label>
              <input value={form.passenger_name} onChange={e => setForm(f => ({ ...f, passenger_name: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                placeholder="Nama lengkap" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">No. HP</label>
              <input value={form.passenger_phone} onChange={e => setForm(f => ({ ...f, passenger_phone: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                placeholder="08xx..." />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">No. Kursi *</label>
              <input value={form.seat_number} onChange={e => setForm(f => ({ ...f, seat_number: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                placeholder="A1, 12, dsb" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Harga (Rp)</label>
              <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                placeholder="0" />
            </div>
          </div>

          {agents.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Agen (opsional)</label>
              <select value={form.agent_id} onChange={e => setForm(f => ({ ...f, agent_id: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer">
                <option value="">— Tanpa agen —</option>
                {agents.filter(a => a.is_active).map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Catatan</label>
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              placeholder="Opsional..." />
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors">
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60 cursor-pointer transition-colors flex items-center justify-center gap-2"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {isPending ? 'Menyimpan...' : 'Jual Tiket'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Cargo Modal ──────────────────────────────────────────────────────────────

function CargoModal({ pool, terminals, onClose }: {
  pool: BusPool
  terminals: FleetTerminal[]
  onClose: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [lastCargoId, setLastCargoId] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    fd.set('bus_pool_id', pool.id)
    startTransition(async () => {
      const res = await createCargoShipment(pool.org_id, fd)
      if (res.error) {
        setError(res.error)
      } else {
        setSuccess(`Resi kargo ${res.trackingNumber} berhasil dibuat!`)
        setLastCargoId(res.id ?? null)
        ;(e.target as HTMLFormElement).reset()
      }
    })
  }

  const inputCls = 'w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400'
  const labelCls = 'block text-xs font-semibold text-slate-500 mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-slate-800 text-sm">Buat Resi Kargo</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="p-5 space-y-3">
            {success && (
              <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-emerald-700 font-medium">{success}</p>
                  {lastCargoId && (
                    <a
                      href={`/print/manifest/${pool.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 font-semibold mt-1 underline cursor-pointer"
                    >
                      <Printer className="w-3 h-3" />
                      Cetak Manifest Pool
                    </a>
                  )}
                </div>
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                <p className="text-sm text-rose-700">{error}</p>
              </div>
            )}

            {/* Pengirim & Penerima */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Nama Pengirim *</label>
                <input name="sender_name" required className={inputCls} placeholder="Nama lengkap" />
              </div>
              <div>
                <label className={labelCls}>HP Pengirim</label>
                <input name="sender_phone" className={inputCls} placeholder="08xx..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Nama Penerima *</label>
                <input name="receiver_name" required className={inputCls} placeholder="Nama lengkap" />
              </div>
              <div>
                <label className={labelCls}>HP Penerima</label>
                <input name="receiver_phone" className={inputCls} placeholder="08xx..." />
              </div>
            </div>

            {/* Terminal */}
            {terminals.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Terminal Asal</label>
                  <select name="origin_terminal_id" className={cn(inputCls, 'bg-white cursor-pointer')}>
                    <option value="">— Pilih —</option>
                    {terminals.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Terminal Tujuan</label>
                  <select name="destination_terminal_id" className={cn(inputCls, 'bg-white cursor-pointer')}>
                    <option value="">— Pilih —</option>
                    {terminals.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Kota Asal</label>
                  <input name="origin_terminal_id" className={inputCls} placeholder="Contoh: Jakarta" />
                </div>
                <div>
                  <label className={labelCls}>Kota Tujuan</label>
                  <input name="destination_terminal_id" className={inputCls} placeholder="Contoh: Surabaya" />
                </div>
              </div>
            )}

            {/* Barang */}
            <div>
              <label className={labelCls}>Deskripsi Barang *</label>
              <input name="item_description" required className={inputCls} placeholder="Cth: Elektronik, Pakaian..." />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Berat (kg)</label>
                <input name="weight_kg" type="number" step="0.1" min="0" className={inputCls} placeholder="0" defaultValue="1" />
              </div>
              <div>
                <label className={labelCls}>Koli</label>
                <input name="koli_count" type="number" min="1" className={inputCls} placeholder="1" defaultValue="1" />
              </div>
              <div>
                <label className={labelCls}>Volume (m³)</label>
                <input name="volume_m3" type="number" step="0.01" min="0" className={inputCls} placeholder="0" defaultValue="0" />
              </div>
            </div>

            {/* Biaya */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Ongkos Kirim (Rp)</label>
                <input name="shipping_cost" type="number" min="0" className={inputCls} placeholder="0" defaultValue="0" />
              </div>
              <div>
                <label className={labelCls}>Biaya Handling</label>
                <input name="handling_fee" type="number" min="0" className={inputCls} placeholder="0" defaultValue="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Total (Rp)</label>
                <input name="grand_total" type="number" min="0" className={inputCls} placeholder="0" defaultValue="0" />
              </div>
              <div>
                <label className={labelCls}>Status Bayar</label>
                <select name="payment_status" className={cn(inputCls, 'bg-white cursor-pointer')}>
                  <option value="UNPAID">Belum Bayar</option>
                  <option value="PAID">Sudah Bayar</option>
                </select>
              </div>
            </div>
          </div>

          <div className="px-5 pb-5 flex gap-2 shrink-0">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors">
              Batal
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60 cursor-pointer transition-colors flex items-center justify-center gap-2"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {isPending ? 'Menyimpan...' : 'Buat Resi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
