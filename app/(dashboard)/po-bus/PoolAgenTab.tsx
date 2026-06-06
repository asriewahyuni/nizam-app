'use client'

import { useState, useTransition, useMemo, useCallback } from 'react'
import Link from 'next/link'
import {
  Store, Plus, Phone, Mail, MapPin, Edit2, Trash2, CheckCircle2,
  ArrowUpCircle, Receipt, Wallet, Users, Ticket, ChevronLeft,
  Building2, CreditCard, History, BadgeCheck, TrendingUp,
  Banknote, Package, Share2, ShoppingCart, BarChart3, Clock,
  Printer, MessageCircle, X, CheckCheck, Copy, Check, Truck, MoveRight,
  Box, Weight,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { PoolShortcutModal } from './PoolShortcutModal'
import { cn } from '@/lib/utils'
import { SafeButton, EmptyState, StatCard, useConfirm } from '@/components/ui/NizamUI'
import {
  createBusPool, updateBusPool, deleteBusPool,
  createBusPoolTopUp, createBusPoolSettlement, markSettlementPaid,
  createBusAgent, updateBusAgent, deleteBusAgent,
  createBusTicket,
} from '@/modules/po-bus/actions/po-bus.actions'
import { createCargoShipment, updateCargoStatus } from '@/modules/po-bus/actions/cargo.actions'
import type {
  BusPool, BusPoolTopUp, BusPoolSettlement, BusAgent,
  BusSchedule, BusRoute, BusTicket,
} from '@/modules/po-bus/lib/po-bus-types'
import type { FleetCargoShipment, CargoStatus, FleetTerminal } from '@/types/database.types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n)
}

function formatAngka(n: number) {
  return new Intl.NumberFormat('id-ID').format(n)
}

function formatDate(s?: string | null) {
  if (!s) return '-'
  return new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateTime(s: string) {
  return new Date(s).toLocaleString('id-ID', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatDateShort(s: string) {
  return new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white',
        'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400',
        'placeholder:text-slate-300 transition-colors',
        props.className,
      )}
    />
  )
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white',
        'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 cursor-pointer',
        props.className,
      )}
    />
  )
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={3}
      {...props}
      className={cn(
        'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white resize-none',
        'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400',
        'placeholder:text-slate-300 transition-colors',
        props.className,
      )}
    />
  )
}

// ─── Type configs ──────────────────────────────────────────────────────────────

const POOL_TYPE_CONFIG = {
  POOL_UTAMA: { label: 'Pool Utama',  color: 'bg-blue-50 text-blue-700 border-blue-200',    dot: 'bg-blue-500'   },
  AGEN_RESMI: { label: 'Agen Resmi',  color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  SUB_AGEN:   { label: 'Sub-Agen',    color: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400'  },
} as const

type PoolDetailTab = 'INFO' | 'HISTORY' | 'AGEN' | 'TOPUP' | 'SETTLEMENT' | 'KARGO'

// ─── Revenue Chart ────────────────────────────────────────────────────────────

function RevenueChart({ settlements, topUps }: { settlements: BusPoolSettlement[]; topUps: BusPoolTopUp[] }) {
  const data = useMemo(() => {
    const map: Record<string, { bulan: string; pendapatan: number; komisi: number; topup: number }> = {}

    settlements.forEach(s => {
      const key = new Date(s.period_end).toLocaleDateString('id-ID', { month: 'short', year: '2-digit' })
      if (!map[key]) map[key] = { bulan: key, pendapatan: 0, komisi: 0, topup: 0 }
      map[key].pendapatan += s.total_revenue
      map[key].komisi    += s.commission_amount
    })
    topUps.forEach(t => {
      const key = new Date(t.created_at).toLocaleDateString('id-ID', { month: 'short', year: '2-digit' })
      if (!map[key]) map[key] = { bulan: key, pendapatan: 0, komisi: 0, topup: 0 }
      map[key].topup += t.amount
    })

    return Object.values(map).slice(-6)
  }, [settlements, topUps])

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-36 gap-2 text-slate-300">
        <BarChart3 className="w-8 h-8" />
        <p className="text-xs">Belum ada data settlement / top-up</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 4 }} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="bulan" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
          tickFormatter={(v: number) =>
            v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}jt`
            : v >= 1_000   ? `${(v / 1_000).toFixed(0)}rb`
            : String(v)
          }
        />
        <ReTooltip
          formatter={((value: number, name: string) => [
            formatRupiah(value),
            name === 'pendapatan' ? 'Pendapatan Tiket' : name === 'komisi' ? 'Komisi Earned' : 'Top-up Deposit',
          ]) as any} // eslint-disable-line @typescript-eslint/no-explicit-any
          contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}
        />
        <Legend iconType="circle" iconSize={8}
          formatter={(value: string) => (
            <span style={{ fontSize: 10, color: '#64748b' }}>
              {value === 'pendapatan' ? 'Pendapatan' : value === 'komisi' ? 'Komisi' : 'Top-up'}
            </span>
          )}
        />
        <Bar dataKey="pendapatan" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={28} />
        <Bar dataKey="komisi"     fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={28} />
        <Bar dataKey="topup"      fill="#a78bfa" radius={[3, 3, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Ticket Receipt Modal ─────────────────────────────────────────────────────

function TicketReceiptModal({
  ticket, pool, schedule, onClose,
}: {
  ticket: BusTicket
  pool: BusPool
  schedule?: BusSchedule | null
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const ticketId = ticket.id.slice(0, 8).toUpperCase()
  const route = schedule?.route
  const origin      = route?.origin      ?? '-'
  const destination = route?.destination ?? '-'
  const departure   = schedule?.departure_time ? formatDateTime(schedule.departure_time) : '-'

  const whatsappText = encodeURIComponent(
    `✅ *TIKET BUS — ${pool.name}*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🎫 No. Tiket : *${ticketId}*\n` +
    `👤 Penumpang : ${ticket.passenger_name}\n` +
    `📞 Telepon   : ${ticket.passenger_phone ?? '-'}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🗺️  Rute      : ${origin} → ${destination}\n` +
    `🕐 Berangkat : ${departure}\n` +
    `💺 Kursi     : ${ticket.seat_number}\n` +
    `💰 Harga     : ${formatRupiah(ticket.price)}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Status: ✅ TIKET VALID\n` +
    `Terima kasih telah menggunakan layanan kami.`
  )

  const handleCopyId = useCallback(() => {
    navigator.clipboard.writeText(ticketId).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [ticketId])

  const handlePrint = useCallback(() => {
    const win = window.open('', '_blank', 'width=480,height=720')
    if (!win) return
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Tiket Bus — ${ticketId}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,sans-serif;background:#fff;padding:24px;color:#1e293b}
    .wrap{max-width:380px;margin:0 auto;border:2px solid #e2e8f0;border-radius:16px;overflow:hidden}
    .head{background:linear-gradient(135deg,#1e3a5f,#2563eb);color:#fff;padding:20px 24px}
    .head h1{font-size:15px;font-weight:700;letter-spacing:.5px}
    .head p{font-size:11px;opacity:.8;margin-top:2px}
    .body{padding:20px 24px;space-y:12px}
    .row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f1f5f9}
    .row:last-child{border-bottom:none}
    .row label{font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px}
    .row value{font-size:13px;font-weight:600;color:#1e293b;text-align:right;max-width:200px}
    .route{background:#f8fafc;border-radius:12px;padding:16px;text-align:center;margin:16px 0}
    .route .from,.route .to{font-size:16px;font-weight:700;color:#1e293b}
    .route .arrow{font-size:20px;color:#94a3b8;margin:0 12px}
    .price-badge{background:#10b981;color:#fff;font-size:18px;font-weight:700;
      padding:10px 20px;border-radius:12px;text-align:center;margin:12px 0}
    .ticket-id{font-family:monospace;font-size:13px;color:#475569;background:#f8fafc;
      border-radius:8px;padding:8px 12px;text-align:center;letter-spacing:2px}
    .qr-wrap{display:flex;justify-content:center;margin:16px 0}
    .footer{background:#f8fafc;padding:12px 24px;text-align:center;font-size:10px;color:#94a3b8}
    .status{display:inline-flex;align-items:center;gap:4px;background:#dcfce7;color:#16a34a;
      font-size:11px;font-weight:700;padding:4px 12px;border-radius:99px}
    @media print{body{padding:0}.wrap{border:2px solid #ccc;page-break-inside:avoid}}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="head">
      <h1>${pool.name}</h1>
      <p>${pool.pool_type === 'POOL_UTAMA' ? 'Pool Utama' : pool.pool_type === 'AGEN_RESMI' ? 'Agen Resmi' : 'Sub-Agen'} · ${pool.code}</p>
    </div>
    <div class="body">
      <div class="route">
        <span class="from">${origin}</span>
        <span class="arrow">→</span>
        <span class="to">${destination}</span>
      </div>
      <div class="row"><label>Penumpang</label><value>${ticket.passenger_name}</value></div>
      ${ticket.passenger_phone ? `<div class="row"><label>Telepon</label><value>${ticket.passenger_phone}</value></div>` : ''}
      <div class="row"><label>Keberangkatan</label><value>${departure}</value></div>
      <div class="row"><label>No. Kursi</label><value>${ticket.seat_number}</value></div>
      <div class="price-badge">${formatRupiah(ticket.price)}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span class="status">✓ TIKET VALID</span>
        <span style="font-size:10px;color:#94a3b8">${formatDateShort(ticket.created_at)}</span>
      </div>
      <div class="ticket-id">NO. ${ticketId}</div>
      <div class="qr-wrap">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(ticket.id)}" width="140" height="140"/>
      </div>
    </div>
    <div class="footer">Tunjukkan tiket ini kepada petugas bus. Tidak dapat dipindahtangankan.</div>
  </div>
  <script>setTimeout(()=>{window.print();window.close()},500)</script>
</body>
</html>`)
    win.document.close()
  }, [ticket, pool, origin, destination, departure, ticketId])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CheckCheck className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-white text-sm">Tiket Berhasil Dibuat</h3>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">{pool.name}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 cursor-pointer transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Ticket body */}
        <div className="p-5 space-y-4">
          {/* Route */}
          <div className="bg-slate-50 rounded-2xl p-4 text-center">
            <div className="flex items-center justify-center gap-3">
              <span className="text-lg font-bold text-slate-800">{origin}</span>
              <span className="text-slate-300 text-xl">→</span>
              <span className="text-lg font-bold text-slate-800">{destination}</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">{departure}</p>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] text-slate-400 mb-0.5">Penumpang</p>
              <p className="text-sm font-semibold text-slate-800 truncate">{ticket.passenger_name}</p>
              {ticket.passenger_phone && <p className="text-[10px] text-slate-400">{ticket.passenger_phone}</p>}
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] text-slate-400 mb-0.5">No. Kursi</p>
              <p className="text-xl font-bold text-slate-800">{ticket.seat_number}</p>
            </div>
          </div>

          {/* Price + ticket ID */}
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-emerald-50 border border-emerald-100 rounded-xl p-3">
              <p className="text-[10px] text-emerald-600 mb-0.5">Harga</p>
              <p className="text-base font-bold text-emerald-700">{formatRupiah(ticket.price)}</p>
            </div>
            <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p className="text-[10px] text-slate-400 mb-0.5">No. Tiket</p>
              <div className="flex items-center gap-1">
                <p className="text-sm font-mono font-bold text-slate-700">{ticketId}</p>
                <button onClick={handleCopyId} className="p-0.5 rounded text-slate-300 hover:text-blue-500 cursor-pointer transition-colors">
                  {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>

          {/* QR */}
          <div className="flex justify-center py-1">
            <QRCodeSVG value={ticket.id} size={100} level="M" fgColor="#1e293b" includeMargin={false} />
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3 px-5 pb-5">
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Cetak PDF
          </button>
          {ticket.passenger_phone ? (
            <a
              href={`https://wa.me/${ticket.passenger_phone.replace(/[^0-9]/g, '').replace(/^0/, '62')}?text=${whatsappText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#25D366] text-sm font-semibold text-white hover:bg-[#22c55e] transition-all cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              Kirim WA
            </a>
          ) : (
            <button
              onClick={onClose}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 text-sm font-semibold text-white hover:bg-slate-700 transition-all cursor-pointer"
            >
              Selesai
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Ticket Sell Form ─────────────────────────────────────────────────────────

function TicketSellForm({
  orgId, pool, agents, schedules, onSaved, onClose,
}: {
  orgId: string
  pool: BusPool
  agents: BusAgent[]
  schedules: BusSchedule[]
  onSaved: (ticket: BusTicket, schedule: BusSchedule | undefined) => void
  onClose: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [selectedScheduleId, setSelectedScheduleId] = useState('')
  const [price, setPrice] = useState('')

  const availableSchedules = schedules.filter(s => s.status === 'TERJADWAL')
  const selectedSchedule   = availableSchedules.find(s => s.id === selectedScheduleId)

  function handleScheduleChange(id: string) {
    setSelectedScheduleId(id)
    const sched = availableSchedules.find(s => s.id === id)
    if (sched?.route?.base_price && !price) {
      setPrice(String(sched.route.base_price))
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await createBusTicket(orgId, {
        schedule_id:      fd.get('schedule_id') as string,
        passenger_name:   fd.get('passenger_name') as string,
        passenger_phone:  (fd.get('passenger_phone') as string) || undefined,
        seat_number:      fd.get('seat_number') as string,
        price:            Number(fd.get('price')),
        agent_id:         (fd.get('agent_id') as string) || undefined,
        pool_id:          pool.id,
        notes:            (fd.get('notes') as string) || undefined,
      })
      if (!('error' in res) && 'data' in res && res.data) {
        onSaved(res.data as BusTicket, selectedSchedule)
      } else if ('error' in res) {
        alert(res.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Pool info */}
      <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
        <Store className="w-4 h-4 text-blue-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-blue-800 truncate">{pool.name}</p>
          <p className="text-[10px] text-blue-500">{pool.code} · Komisi {pool.commission_pct}%</p>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white border border-blue-200 text-blue-600">
          {pool.deposit_balance > 0 ? `Deposit ${formatRupiah(pool.deposit_balance)}` : 'Deposit Habis'}
        </span>
      </div>

      <FormField label="Jadwal Keberangkatan *">
        <Select name="schedule_id" required value={selectedScheduleId} onChange={e => handleScheduleChange(e.target.value)}>
          <option value="">— Pilih Jadwal —</option>
          {availableSchedules.map(s => (
            <option key={s.id} value={s.id}>
              {s.route ? `${s.route.origin} → ${s.route.destination}` : 'Rute?'}
              {' '}· {s.bus?.plate_number ?? '?'}
              {' '}· {new Date(s.departure_time).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </option>
          ))}
        </Select>
        {availableSchedules.length === 0 && (
          <p className="text-[10px] text-amber-600 mt-1">Tidak ada jadwal aktif. Tambah jadwal di tab Operasional.</p>
        )}
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <FormField label="Nama Penumpang *">
            <Input name="passenger_name" placeholder="Budi Santoso" required />
          </FormField>
        </div>
        <FormField label="No. HP Penumpang">
          <Input name="passenger_phone" type="tel" placeholder="08123456789" />
        </FormField>
        <FormField label="No. Kursi *">
          <Input name="seat_number" placeholder="12A" required />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label={`Harga Tiket (Rp) *${selectedSchedule?.route?.base_price ? ` — harga dasar: ${formatRupiah(selectedSchedule.route.base_price)}` : ''}`}>
          <Input
            name="price" type="number" min="0" step="1000"
            placeholder="150000" required
            value={price}
            onChange={e => setPrice(e.target.value)}
          />
        </FormField>
        <FormField label="Agen (opsional)">
          <Select name="agent_id">
            <option value="">— Tanpa Agen —</option>
            {agents.filter(a => a.is_active).map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
        </FormField>
      </div>

      <FormField label="Catatan">
        <Input name="notes" placeholder="Opsional..." />
      </FormField>

      <div className="flex gap-3 justify-end pt-1 border-t border-slate-100">
        <SafeButton type="button" variant="ghost" onClick={onClose} disabled={pending}>Batal</SafeButton>
        <SafeButton type="submit" disabled={pending || !selectedScheduleId} icon={<Ticket className="w-4 h-4" />}>
          {pending ? 'Memproses...' : 'Buat Tiket'}
        </SafeButton>
      </div>
    </form>
  )
}

// ─── Cargo Create Form ────────────────────────────────────────────────────────

function CargoCreateForm({
  orgId, pool, terminals, onSaved, onClose,
}: {
  orgId: string
  pool: BusPool
  terminals: FleetTerminal[]
  onSaved: (s: FleetCargoShipment & { bus_pool_id?: string | null }) => void
  onClose: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('bus_pool_id', pool.id)
    startTransition(async () => {
      const res = await createCargoShipment(orgId, fd)
      if ('error' in res && res.error) { setError(res.error as string); return }
      onSaved({
        id: (res as any).id ?? '',
        org_id: orgId,
        branch_id: null,
        tracking_number: (res as any).trackingNumber ?? '',
        sender_name:   fd.get('sender_name')   as string,
        sender_phone:  fd.get('sender_phone')  as string,
        receiver_name: fd.get('receiver_name') as string,
        receiver_phone: fd.get('receiver_phone') as string,
        origin_terminal_id:      fd.get('origin_terminal_id')      as string,
        destination_terminal_id: fd.get('destination_terminal_id') as string,
        item_description: fd.get('item_description') as string,
        weight_kg:    Number(fd.get('weight_kg'))    || 0,
        volume_m3:    Number(fd.get('volume_m3'))    || 0,
        shipping_cost: Number(fd.get('shipping_cost')) || 0,
        handling_fee:  Number(fd.get('handling_fee'))  || 0,
        grand_total:   Number(fd.get('grand_total'))   || 0,
        payment_status: (fd.get('payment_status') as any) || 'UNPAID',
        payment_method: fd.get('payment_method') as string,
        schedule_id: null,
        status: 'DRAFT',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        bus_pool_id: pool.id,
      })
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Pengirim *">
          <Input name="sender_name" required placeholder="Nama pengirim" />
        </FormField>
        <FormField label="No. HP Pengirim">
          <Input name="sender_phone" placeholder="08xxx" />
        </FormField>
        <FormField label="Penerima *">
          <Input name="receiver_name" required placeholder="Nama penerima" />
        </FormField>
        <FormField label="No. HP Penerima">
          <Input name="receiver_phone" placeholder="08xxx" />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Terminal Asal *">
          <Select name="origin_terminal_id" required defaultValue="">
            <option value="" disabled>Pilih terminal...</option>
            {terminals.map(t => (
              <option key={t.id} value={t.id}>{t.name}{t.location_name ? ` — ${t.location_name}` : ''}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Terminal Tujuan *">
          <Select name="destination_terminal_id" required defaultValue="">
            <option value="" disabled>Pilih terminal...</option>
            {terminals.map(t => (
              <option key={t.id} value={t.id}>{t.name}{t.location_name ? ` — ${t.location_name}` : ''}</option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <FormField label="Deskripsi Barang">
          <Input name="item_description" placeholder="Mis: Elektronik, Pakaian..." />
        </FormField>
        <FormField label="Berat (kg) *">
          <Input type="number" name="weight_kg" required min="0.1" step="0.1" defaultValue="1" />
        </FormField>
        <FormField label="Koli">
          <Input type="number" name="koli_count" defaultValue="1" min="1" />
        </FormField>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <FormField label="Ongkir (Rp)">
          <Input type="number" name="shipping_cost" defaultValue="0" min="0" />
        </FormField>
        <FormField label="Handling (Rp)">
          <Input type="number" name="handling_fee" defaultValue="0" min="0" />
        </FormField>
        <FormField label="Total (Rp) *">
          <Input type="number" name="grand_total" required defaultValue="0" min="0" />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Pembayaran">
          <Select name="payment_status" defaultValue="UNPAID">
            <option value="UNPAID">Belum Lunas</option>
            <option value="PAID">Lunas</option>
          </Select>
        </FormField>
        <FormField label="Metode Bayar">
          <Select name="payment_method" defaultValue="CASH">
            <option value="CASH">Cash</option>
            <option value="TRANSFER">Transfer</option>
            <option value="COD">COD</option>
          </Select>
        </FormField>
      </div>

      <div className="flex gap-2 pt-2">
        <SafeButton type="submit" isLoading={pending} icon={<Package className="w-4 h-4" />}>
          {pending ? 'Menyimpan...' : 'Buat Resi Kargo'}
        </SafeButton>
        <SafeButton type="button" variant="ghost" onClick={onClose}>Batal</SafeButton>
      </div>
    </form>
  )
}

// ─── Pool Card (sidebar item) ─────────────────────────────────────────────────

function PoolListItem({
  pool, agents, tickets, selected, onClick, onShortcut,
}: {
  pool: BusPool
  agents: BusAgent[]
  tickets: number
  selected: boolean
  onClick: () => void
  onShortcut: (p: BusPool) => void
}) {
  const cfg = POOL_TYPE_CONFIG[pool.pool_type] ?? POOL_TYPE_CONFIG.AGEN_RESMI
  const balancePct = pool.credit_limit > 0
    ? Math.min(100, (pool.deposit_balance / pool.credit_limit) * 100)
    : 0

  return (
    <div
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-3.5 border-b border-slate-100 transition-all duration-150 cursor-pointer',
        'hover:bg-slate-50',
        selected ? 'bg-blue-50/60 border-l-2 border-l-blue-500' : 'border-l-2 border-l-transparent',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-800 text-sm leading-tight truncate">{pool.name}</p>
          <p className="text-[10px] text-slate-400 font-mono mt-0.5">{pool.code}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-md border', cfg.color)}>
            {cfg.label}
          </span>
          <button
            onClick={e => { e.stopPropagation(); onShortcut(pool) }}
            className="p-1 rounded-lg text-slate-300 hover:text-blue-500 hover:bg-blue-50 cursor-pointer transition-colors"
            title="Shortcut / QR Code"
          >
            <Share2 className="w-3 h-3" />
          </button>
          <Link
            href={`/po-bus/pool/${pool.id}`}
            onClick={e => e.stopPropagation()}
            className="text-[10px] font-medium text-blue-500 hover:text-blue-700 transition-colors cursor-pointer"
            title="Lihat dashboard pool"
          >
            Detail →
          </Link>
        </div>
      </div>

      {pool.city && (
        <p className="text-[11px] text-slate-500 flex items-center gap-1 mb-2">
          <MapPin className="w-2.5 h-2.5" />
          {pool.city}
        </p>
      )}

      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-slate-400">Deposit</span>
          <span className={cn('font-semibold', pool.deposit_balance > 0 ? 'text-emerald-600' : 'text-slate-400')}>
            {formatRupiah(pool.deposit_balance)}
          </span>
        </div>
        <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all',
              balancePct > 50 ? 'bg-emerald-400' : balancePct > 20 ? 'bg-amber-400' : 'bg-rose-400'
            )}
            style={{ width: `${balancePct}%` }}
          />
        </div>
      </div>

      <div className="flex gap-3 mt-2 text-[10px] text-slate-400">
        <span className="flex items-center gap-0.5"><Users className="w-2.5 h-2.5" /> {agents.length} agen</span>
        <span className="flex items-center gap-0.5"><Ticket className="w-2.5 h-2.5" /> {formatAngka(tickets)} tiket</span>
      </div>
    </div>
  )
}

// ─── Pool Detail Panel ────────────────────────────────────────────────────────

function PoolDetail({
  orgId, pool, agents, topUps, settlements, ticketCount, cargoCount,
  schedules, initialCargoShipments, terminals, onBack, onUpdated, onDeleted,
}: {
  orgId: string
  pool: BusPool
  agents: BusAgent[]
  topUps: BusPoolTopUp[]
  settlements: BusPoolSettlement[]
  ticketCount: number
  cargoCount: number
  schedules: BusSchedule[]
  initialCargoShipments: (FleetCargoShipment & { bus_pool_id?: string | null })[]
  terminals: FleetTerminal[]
  onBack: () => void
  onUpdated: (p: BusPool) => void
  onDeleted: (id: string) => void
}) {
  const [detailTab, setDetailTab] = useState<PoolDetailTab>('INFO')
  const [showShortcut, setShowShortcut] = useState(false)
  const [showTopUpModal, setShowTopUpModal] = useState(false)
  const [showSettlementModal, setShowSettlementModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAgentModal, setShowAgentModal] = useState(false)
  const [showTicketModal, setShowTicketModal] = useState(false)
  const [newTicketData, setNewTicketData] = useState<{ ticket: BusTicket; schedule?: BusSchedule } | null>(null)
  const [editingAgent, setEditingAgent] = useState<BusAgent | null>(null)
  const [localAgents, setLocalAgents] = useState(agents)
  const [localTopUps, setLocalTopUps] = useState(topUps)
  const [localSettlements, setLocalSettlements] = useState(settlements)
  const [localCargo, setLocalCargo] = useState(initialCargoShipments)
  const [showCargoModal, setShowCargoModal] = useState(false)
  const [, startTransition] = useTransition()
  const { confirm, ConfirmUI } = useConfirm()

  const cfg = POOL_TYPE_CONFIG[pool.pool_type] ?? POOL_TYPE_CONFIG.AGEN_RESMI
  const pendingSettlements = localSettlements.filter(s => s.status === 'PENDING')
  const totalRevenue    = localSettlements.reduce((s, x) => s + x.total_revenue, 0)
  const totalCommission = localSettlements.reduce((s, x) => s + x.commission_amount, 0)

  type HistoryItem =
    | { kind: 'topup';      data: BusPoolTopUp;     date: string }
    | { kind: 'settlement'; data: BusPoolSettlement; date: string }

  const historyItems = useMemo<HistoryItem[]>(() => {
    const items: HistoryItem[] = [
      ...localTopUps.map(t => ({ kind: 'topup' as const, data: t, date: t.created_at })),
      ...localSettlements.map(s => ({ kind: 'settlement' as const, data: s, date: s.created_at })),
    ]
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [localTopUps, localSettlements])

  const DETAIL_TABS: { id: PoolDetailTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }[] = [
    { id: 'INFO',       label: 'Ringkasan',  icon: Building2 },
    { id: 'HISTORY',    label: 'Riwayat',    icon: History,       badge: historyItems.length || undefined },
    { id: 'AGEN',       label: 'Agen',       icon: Users,         badge: localAgents.length },
    { id: 'TOPUP',      label: 'Top-up',     icon: ArrowUpCircle, badge: localTopUps.length },
    { id: 'SETTLEMENT', label: 'Settlement', icon: Receipt,       badge: pendingSettlements.length || undefined },
    { id: 'KARGO',      label: 'Kargo',      icon: Package,       badge: localCargo.length || undefined },
  ]

  async function handleMarkPaid(s: BusPoolSettlement) {
    startTransition(async () => {
      const res = await markSettlementPaid(orgId, s.id)
      if (!('error' in res)) {
        setLocalSettlements(prev => prev.map(x => x.id === s.id ? { ...x, status: 'DIBAYAR' as const, paid_at: new Date().toISOString() } : x))
      }
    })
  }

  async function handleDeleteAgent(a: BusAgent) {
    const ok = await confirm({ title: `Hapus agen "${a.name}"?`, message: 'Data agen akan dihapus.' })
    if (!ok) return
    startTransition(async () => {
      const res = await deleteBusAgent(orgId, a.id)
      if (!('error' in res)) setLocalAgents(prev => prev.filter(x => x.id !== a.id))
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Detail Header — row 1: identity */}
      <div className="flex items-center gap-3 pt-1 pb-3">
        <button
          onClick={onBack}
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 cursor-pointer transition-colors shrink-0 md:hidden"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-bold text-slate-800 text-base leading-tight">{pool.name}</h2>
            <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', cfg.color)}>
              {cfg.label}
            </span>
            {!pool.is_active && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                Nonaktif
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            {pool.code}{pool.city ? ` · ${pool.city}` : ''}
          </p>
        </div>
        {/* icon-only secondary */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setShowShortcut(true)}
            className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-blue-500 hover:border-blue-300 transition-all cursor-pointer"
            title="QR Code & Shortcut"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowEditModal(true)}
            className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 hover:border-slate-300 transition-all cursor-pointer"
            title="Edit Pool"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Detail Header — row 2: action buttons (scrollable) */}
      <div className="flex items-center gap-2 pb-4 border-b border-slate-100 mb-4 overflow-x-auto">
        <button
          onClick={() => setShowTicketModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 text-xs font-bold text-white hover:bg-blue-700 active:scale-95 transition-all cursor-pointer shadow-sm shadow-blue-200 shrink-0"
        >
          <Ticket className="w-3.5 h-3.5" />
          Jual Tiket
        </button>
        <button
          onClick={() => { setDetailTab('KARGO'); setShowCargoModal(true) }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-700 active:scale-95 transition-all cursor-pointer shadow-sm shadow-indigo-200 shrink-0"
        >
          <Package className="w-3.5 h-3.5" />
          Buat Kargo
        </button>
        <button
          onClick={() => setShowTopUpModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-all cursor-pointer shrink-0"
        >
          <ArrowUpCircle className="w-3.5 h-3.5" />
          Top-up
        </button>
        <button
          onClick={() => setShowSettlementModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-all cursor-pointer shrink-0"
        >
          <Receipt className="w-3.5 h-3.5" />
          Settlement
        </button>
      </div>

      {/* KPI strip — 6 cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
        {/* Saldo deposit with progress bar */}
        <div className="col-span-2 bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 rounded-xl p-4">
          <div className="flex items-start justify-between mb-1">
            <div>
              <p className="text-[10px] font-semibold text-emerald-600">Saldo Deposit</p>
              <p className={cn('text-xl font-bold leading-none mt-0.5', pool.deposit_balance > 0 ? 'text-emerald-700' : 'text-slate-400')}>
                {formatRupiah(pool.deposit_balance)}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">Limit: {formatRupiah(pool.credit_limit)}</p>
            </div>
            <Wallet className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          </div>
          {pool.credit_limit > 0 && (
            <div className="mt-2">
              <div className="flex justify-between text-[9px] text-slate-400 mb-1">
                <span>Penggunaan</span>
                <span>{Math.round((pool.deposit_balance / pool.credit_limit) * 100)}%</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all',
                    (pool.deposit_balance / pool.credit_limit) > 0.5 ? 'bg-emerald-400'
                    : (pool.deposit_balance / pool.credit_limit) > 0.2 ? 'bg-amber-400' : 'bg-rose-400'
                  )}
                  style={{ width: `${Math.min(100, (pool.deposit_balance / pool.credit_limit) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[10px] font-medium text-slate-400 mb-1">Tiket Terjual</p>
          <p className="text-xl font-bold text-slate-800 leading-none">{formatAngka(ticketCount)}</p>
          <p className="text-[10px] text-slate-400 mt-1">Komisi {pool.commission_pct}%</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[10px] font-medium text-slate-400 mb-1">Total Pendapatan</p>
          <p className="text-base font-bold text-blue-700 leading-none">{formatRupiah(totalRevenue)}</p>
          <p className="text-[10px] text-slate-400 mt-1">{localSettlements.length} settlement</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[10px] font-medium text-slate-400 mb-1">Total Komisi</p>
          <p className="text-base font-bold text-emerald-700 leading-none">{formatRupiah(totalCommission)}</p>
          <p className="text-[10px] text-slate-400 mt-1">@ {pool.commission_pct}%</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-medium text-slate-400 mb-1">Pending Settlement</p>
              <p className={cn('text-xl font-bold leading-none', pendingSettlements.length > 0 ? 'text-amber-600' : 'text-slate-400')}>
                {formatAngka(pendingSettlements.length)}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                {formatRupiah(pendingSettlements.reduce((s, x) => s + x.commission_amount, 0))}
              </p>
            </div>
            {pendingSettlements.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0 mt-1" />
            )}
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-0 mb-4 border-b border-slate-100 pb-0 overflow-x-auto">
        {DETAIL_TABS.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setDetailTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-xs font-medium cursor-pointer transition-all whitespace-nowrap shrink-0',
                'border-b-2 -mb-px',
                detailTab === t.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span className={cn(
                  'text-[9px] font-bold px-1 py-0.5 rounded-full min-w-[16px] text-center',
                  t.id === 'SETTLEMENT' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600',
                )}>
                  {formatAngka(t.badge)}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">

        {/* RINGKASAN */}
        {detailTab === 'INFO' && (
          <div className="space-y-5">
            {/* Revenue chart */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  <h4 className="text-xs font-semibold text-slate-700">Grafik Revenue Pool</h4>
                </div>
                <span className="text-[10px] text-slate-400">6 bulan terakhir</span>
              </div>
              <RevenueChart settlements={localSettlements} topUps={localTopUps} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Kontak</h4>
                {[
                  { label: 'Pemilik', value: pool.owner_name },
                  { label: 'PIC', value: pool.pic_name },
                  { label: 'Telepon', value: pool.phone },
                  { label: 'WhatsApp', value: pool.whatsapp },
                  { label: 'Email', value: pool.email },
                ].map(row => row.value ? (
                  <div key={row.label} className="flex gap-3 text-sm">
                    <span className="text-slate-400 w-20 shrink-0 text-xs pt-0.5">{row.label}</span>
                    <span className="text-slate-700 break-all">{row.value}</span>
                  </div>
                ) : null)}
                {pool.address && (
                  <div className="flex gap-3 text-sm">
                    <span className="text-slate-400 w-20 shrink-0 text-xs pt-0.5">Alamat</span>
                    <span className="text-slate-700">{pool.address}{pool.city ? `, ${pool.city}` : ''}{pool.province ? `, ${pool.province}` : ''}</span>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Rekening Bank</h4>
                {pool.bank_name ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-slate-500" />
                      <span className="font-semibold text-slate-700 text-sm">{pool.bank_name}</span>
                    </div>
                    <p className="font-mono text-slate-800 text-sm tracking-wider">{pool.bank_account}</p>
                    {pool.bank_account_name && <p className="text-xs text-slate-500">{pool.bank_account_name}</p>}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Belum ada rekening bank terdaftar</p>
                )}
                <div className="mt-4 space-y-2">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Komisi & Limit</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-slate-400 mb-1">Komisi</p>
                      <p className="text-2xl font-bold text-slate-800">{pool.commission_pct}%</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-slate-400 mb-1">Credit Limit</p>
                      <p className="text-sm font-bold text-slate-800">{formatRupiah(pool.credit_limit)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* RIWAYAT */}
        {detailTab === 'HISTORY' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-700">Riwayat Transaksi</p>
                <p className="text-xs text-slate-400">{formatAngka(historyItems.length)} entri tercatat</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowTicketModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700 transition-all cursor-pointer"
                >
                  <Ticket className="w-3.5 h-3.5" />
                  Jual Tiket
                </button>
                <button
                  onClick={() => setShowTopUpModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-all cursor-pointer"
                >
                  <ArrowUpCircle className="w-3.5 h-3.5" />
                  Top-up
                </button>
              </div>
            </div>

            {historyItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-300">
                <History className="w-10 h-10" />
                <p className="text-sm">Belum ada riwayat transaksi</p>
              </div>
            ) : (
              <div className="space-y-2">
                {historyItems.map(item => {
                  if (item.kind === 'topup') {
                    const t = item.data
                    return (
                      <div key={`tu-${t.id}`} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-colors">
                        <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center shrink-0">
                          <ArrowUpCircle className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Top-up</span>
                            <p className="text-sm font-bold text-emerald-700">+{formatRupiah(t.amount)}</p>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {t.payment_method}{t.reference_no ? ` · ${t.reference_no}` : ''}
                          </p>
                        </div>
                        <p className="text-xs text-slate-400 shrink-0">{formatDate(t.created_at)}</p>
                      </div>
                    )
                  }
                  const s = item.data
                  return (
                    <div key={`st-${s.id}`} className={cn(
                      'flex items-center gap-3 p-3 rounded-xl border transition-colors',
                      s.status === 'PENDING' ? 'bg-amber-50/60 border-amber-200' : 'bg-white border-slate-200',
                    )}>
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                        s.status === 'PENDING' ? 'bg-amber-100' : 'bg-blue-50',
                      )}>
                        <Receipt className={cn('w-4 h-4', s.status === 'PENDING' ? 'text-amber-600' : 'text-blue-600')} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                            s.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700',
                          )}>
                            {s.status === 'PENDING' ? 'Settlement Pending' : 'Settlement Lunas'}
                          </span>
                          <p className="text-sm font-bold text-slate-800">{formatRupiah(s.commission_amount)}</p>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {formatAngka(s.total_tickets)} tiket · Rev {formatRupiah(s.total_revenue)} · {formatDate(s.period_start)}–{formatDate(s.period_end)}
                        </p>
                      </div>
                      {s.status === 'PENDING' && (
                        <SafeButton size="sm" variant="secondary" onClick={() => handleMarkPaid(s)} icon={<BadgeCheck className="w-3 h-3" />}>
                          Bayar
                        </SafeButton>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* AGEN */}
        {detailTab === 'AGEN' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">{formatAngka(localAgents.length)} agen terdaftar</p>
              <SafeButton
                size="sm"
                onClick={() => { setEditingAgent(null); setShowAgentModal(true) }}
                icon={<Plus className="w-3.5 h-3.5" />}
              >
                Tambah Agen
              </SafeButton>
            </div>

            {localAgents.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Belum ada agen"
                description="Tambahkan agen penjualan tiket untuk pool ini."
                action={<SafeButton onClick={() => { setEditingAgent(null); setShowAgentModal(true) }} icon={<Plus className="w-4 h-4" />}>Tambah Agen</SafeButton>}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {localAgents.map(a => (
                  <div key={a.id} className={cn('bg-white border rounded-xl p-4 transition-all', a.is_active ? 'border-slate-200' : 'border-slate-100 opacity-60')}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">{a.name}</p>
                        {a.city && <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1"><MapPin className="w-2.5 h-2.5" />{a.city}</p>}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setEditingAgent(a); setShowAgentModal(true) }}
                          className="p-1.5 rounded-lg text-slate-300 hover:text-blue-500 hover:bg-blue-50 cursor-pointer transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteAgent(a)}
                          className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-slate-500">
                      {a.phone && <p className="flex items-center gap-1"><Phone className="w-3 h-3" />{a.phone}</p>}
                      {a.email && <p className="flex items-center gap-1"><Mail className="w-3 h-3" />{a.email}</p>}
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
                      <span className="text-[10px] text-slate-400">Komisi Agen</span>
                      <span className="text-xs font-semibold text-slate-700">{a.commission_pct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TOP-UP */}
        {detailTab === 'TOPUP' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-700">Riwayat Top-up Deposit</p>
                <p className="text-xs text-slate-400">Total {formatAngka(localTopUps.length)} transaksi</p>
              </div>
              <SafeButton size="sm" onClick={() => setShowTopUpModal(true)} icon={<ArrowUpCircle className="w-3.5 h-3.5" />}>
                Top-up Sekarang
              </SafeButton>
            </div>

            {localTopUps.length === 0 ? (
              <EmptyState icon={ArrowUpCircle} title="Belum ada top-up" description="Lakukan top-up deposit untuk pool ini." />
            ) : (
              <div className="space-y-2">
                {localTopUps.map(t => (
                  <div key={t.id} className="flex items-center gap-4 p-3 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-colors">
                    <div className="p-2 bg-emerald-50 rounded-lg shrink-0">
                      <ArrowUpCircle className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-emerald-700">+{formatRupiah(t.amount)}</p>
                      <p className="text-xs text-slate-400">{t.payment_method}{t.reference_no ? ` · ${t.reference_no}` : ''}</p>
                    </div>
                    <p className="text-xs text-slate-400 shrink-0">{formatDate(t.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SETTLEMENT */}
        {detailTab === 'SETTLEMENT' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-700">Riwayat Settlement Komisi</p>
                {pendingSettlements.length > 0 && (
                  <p className="text-xs text-amber-600 mt-0.5">
                    {formatAngka(pendingSettlements.length)} settlement belum dibayar · {formatRupiah(pendingSettlements.reduce((s, x) => s + x.commission_amount, 0))}
                  </p>
                )}
              </div>
              <SafeButton size="sm" onClick={() => setShowSettlementModal(true)} icon={<Receipt className="w-3.5 h-3.5" />}>
                Buat Settlement
              </SafeButton>
            </div>

            {localSettlements.length === 0 ? (
              <EmptyState icon={Receipt} title="Belum ada settlement" description="Buat settlement komisi untuk pool ini." />
            ) : (
              <div className="space-y-2">
                {localSettlements.map(s => (
                  <div key={s.id} className={cn(
                    'p-4 rounded-xl border transition-colors',
                    s.status === 'PENDING' ? 'bg-amber-50/60 border-amber-200' : 'bg-white border-slate-200',
                  )}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-slate-800">
                            {formatDate(s.period_start)} — {formatDate(s.period_end)}
                          </p>
                          <span className={cn(
                            'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                            s.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700',
                          )}>
                            {s.status === 'PENDING' ? 'Belum Dibayar' : 'Sudah Dibayar'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {formatAngka(s.total_tickets)} tiket · Komisi {s.commission_pct}% · {formatRupiah(s.total_revenue)}
                        </p>
                        {s.paid_at && <p className="text-[10px] text-slate-400 mt-0.5">Dibayar: {formatDate(s.paid_at)}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-slate-800">{formatRupiah(s.commission_amount)}</p>
                        {s.status === 'PENDING' && (
                          <SafeButton
                            size="sm" variant="secondary" className="mt-2"
                            onClick={() => handleMarkPaid(s)} icon={<BadgeCheck className="w-3 h-3" />}
                          >
                            Bayar
                          </SafeButton>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── KARGO ── */}
        {detailTab === 'KARGO' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-700">Kargo Pool</p>
                <p className="text-xs text-slate-400 mt-0.5">Pengiriman & penerimaan barang via pool ini</p>
              </div>
              <SafeButton size="sm" onClick={() => setShowCargoModal(true)} icon={<Plus className="w-3.5 h-3.5" />}>
                Buat Pengiriman
              </SafeButton>
            </div>

            {/* Mini stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  label: 'Total Kargo',
                  val: localCargo.length,
                  cls: 'text-slate-800',
                },
                {
                  label: 'Dalam Proses',
                  val: localCargo.filter(c => ['DRAFT','MANIFESTED','IN_TRANSIT'].includes(c.status)).length,
                  cls: 'text-blue-600',
                },
                {
                  label: 'Terkirim',
                  val: localCargo.filter(c => c.status === 'DELIVERED').length,
                  cls: 'text-emerald-600',
                },
              ].map(item => (
                <div key={item.label} className="bg-white border border-slate-100 rounded-xl p-4 text-center shadow-sm">
                  <p className={cn('text-2xl font-bold', item.cls)}>{item.val}</p>
                  <p className="text-[10px] font-semibold text-slate-400 mt-1">{item.label}</p>
                </div>
              ))}
            </div>

            {localCargo.length === 0 ? (
              <EmptyState
                icon={Package}
                title="Belum ada kargo"
                description="Buat pengiriman kargo yang terhubung ke pool ini."
                action={
                  <SafeButton size="sm" onClick={() => setShowCargoModal(true)} icon={<Plus className="w-3.5 h-3.5" />}>
                    Buat Pengiriman
                  </SafeButton>
                }
              />
            ) : (
              <div className="space-y-2">
                {localCargo.map(cargo => {
                  const STATUS_CFG: Record<CargoStatus, { label: string; cls: string }> = {
                    DRAFT:      { label: 'Draft',       cls: 'bg-slate-100 text-slate-600'    },
                    MANIFESTED: { label: 'Dimanifes',   cls: 'bg-blue-50 text-blue-700'       },
                    IN_TRANSIT: { label: 'Dalam Jalan', cls: 'bg-amber-50 text-amber-700'     },
                    ARRIVED:    { label: 'Tiba',        cls: 'bg-indigo-50 text-indigo-700'   },
                    DELIVERED:  { label: 'Terkirim',    cls: 'bg-emerald-50 text-emerald-700' },
                    CANCELLED:  { label: 'Dibatal',     cls: 'bg-red-50 text-red-600'         },
                  }
                  const sc = STATUS_CFG[cargo.status]
                  const originName = (cargo as any).origin?.name ?? terminals.find(t => t.id === cargo.origin_terminal_id)?.name ?? '-'
                  const destName   = (cargo as any).destination?.name ?? terminals.find(t => t.id === cargo.destination_terminal_id)?.name ?? '-'

                  const NEXT_STATUS: Partial<Record<CargoStatus, CargoStatus>> = {
                    DRAFT:      'IN_TRANSIT',
                    IN_TRANSIT: 'ARRIVED',
                    ARRIVED:    'DELIVERED',
                  }
                  const nextStatus = NEXT_STATUS[cargo.status]
                  const NEXT_LABEL: Partial<Record<CargoStatus, string>> = {
                    DRAFT:      'Kirim',
                    IN_TRANSIT: 'Tandai Tiba',
                    ARRIVED:    'Tandai Terima',
                  }

                  return (
                    <div key={cargo.id} className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm hover:border-slate-200 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <span className="font-mono text-xs font-bold text-slate-700">{cargo.tracking_number}</span>
                            <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', sc.cls)}>
                              {sc.label}
                            </span>
                            <span className={cn(
                              'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                              cargo.payment_status === 'PAID' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600',
                            )}>
                              {cargo.payment_status === 'PAID' ? 'Lunas' : 'Belum Lunas'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                            <span className="font-medium">{originName}</span>
                            <MoveRight className="w-3 h-3 shrink-0 text-slate-300" />
                            <span className="font-medium">{destName}</span>
                          </div>

                          <p className="text-xs text-slate-500">
                            <span className="font-medium">{cargo.sender_name}</span>
                            <span className="text-slate-300 mx-1">→</span>
                            <span className="font-medium">{cargo.receiver_name}</span>
                          </p>

                          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
                            {cargo.item_description && <span className="flex items-center gap-1"><Box className="w-3 h-3" />{cargo.item_description}</span>}
                            <span className="flex items-center gap-1"><Weight className="w-3 h-3" />{cargo.weight_kg} kg</span>
                            <span>{formatDate(cargo.created_at)}</span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="font-bold text-slate-800 text-sm">{formatRupiah(cargo.grand_total)}</p>
                          {nextStatus && (
                            <SafeButton
                              size="sm" variant="secondary" className="mt-2"
                              icon={<Truck className="w-3 h-3" />}
                              onClick={async () => {
                                const ok = await confirm({
                                  title: `Update status kargo?`,
                                  message: `Ubah ke "${NEXT_LABEL[cargo.status]}"?`,
                                  confirmLabel: NEXT_LABEL[cargo.status],
                                  variant: 'primary',
                                })
                                if (!ok) return
                                startTransition(async () => {
                                  const res = await updateCargoStatus(orgId, cargo.id, nextStatus)
                                  if (!('error' in res)) {
                                    setLocalCargo(prev => prev.map(c => c.id === cargo.id ? { ...c, status: nextStatus } : c))
                                  }
                                })
                              }}
                            >
                              {NEXT_LABEL[cargo.status]}
                            </SafeButton>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modals ── */}

      {showCargoModal && (
        <QuickModal title={`Buat Pengiriman — ${pool.name}`} onClose={() => setShowCargoModal(false)} wide>
          <CargoCreateForm
            orgId={orgId}
            pool={pool}
            terminals={terminals}
            onSaved={(shipment) => {
              setLocalCargo(prev => [shipment, ...prev])
              setShowCargoModal(false)
            }}
            onClose={() => setShowCargoModal(false)}
          />
        </QuickModal>
      )}

      {showTicketModal && (
        <QuickModal title={`Jual Tiket — ${pool.name}`} onClose={() => setShowTicketModal(false)} wide>
          <TicketSellForm
            orgId={orgId}
            pool={pool}
            agents={localAgents}
            schedules={schedules}
            onSaved={(ticket, schedule) => {
              setShowTicketModal(false)
              setNewTicketData({ ticket, schedule })
            }}
            onClose={() => setShowTicketModal(false)}
          />
        </QuickModal>
      )}

      {newTicketData && (
        <TicketReceiptModal
          ticket={newTicketData.ticket}
          pool={pool}
          schedule={newTicketData.schedule}
          onClose={() => setNewTicketData(null)}
        />
      )}

      {showTopUpModal && (
        <QuickModal title={`Top-up Deposit — ${pool.name}`} onClose={() => setShowTopUpModal(false)}>
          <TopUpForm
            orgId={orgId} poolId={pool.id}
            onSaved={(t) => { setLocalTopUps(prev => [t, ...prev]); setShowTopUpModal(false) }}
            onClose={() => setShowTopUpModal(false)}
          />
        </QuickModal>
      )}

      {showSettlementModal && (
        <QuickModal title={`Settlement Komisi — ${pool.name}`} onClose={() => setShowSettlementModal(false)}>
          <SettlementForm
            orgId={orgId} pool={pool}
            onSaved={(s) => { setLocalSettlements(prev => [s, ...prev]); setShowSettlementModal(false) }}
            onClose={() => setShowSettlementModal(false)}
          />
        </QuickModal>
      )}

      {showEditModal && (
        <QuickModal title="Edit Pool" onClose={() => setShowEditModal(false)} wide>
          <PoolForm
            orgId={orgId} editing={pool}
            onSaved={(updated) => { onUpdated(updated); setShowEditModal(false) }}
            onClose={() => setShowEditModal(false)}
          />
        </QuickModal>
      )}

      {showAgentModal && (
        <QuickModal title={editingAgent ? 'Edit Agen' : 'Tambah Agen'} onClose={() => { setShowAgentModal(false); setEditingAgent(null) }}>
          <AgentForm
            orgId={orgId} poolId={pool.id} editing={editingAgent}
            onSaved={(a) => {
              if (editingAgent) setLocalAgents(prev => prev.map(x => x.id === a.id ? a : x))
              else setLocalAgents(prev => [...prev, a])
              setShowAgentModal(false)
              setEditingAgent(null)
            }}
            onClose={() => { setShowAgentModal(false); setEditingAgent(null) }}
          />
        </QuickModal>
      )}

      {ConfirmUI}
      {showShortcut && <PoolShortcutModal pool={pool} onClose={() => setShowShortcut(false)} />}
    </div>
  )
}

// ─── Quick Modal Wrapper ──────────────────────────────────────────────────────

function QuickModal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={cn('relative bg-white rounded-2xl shadow-2xl w-full max-h-[90vh] overflow-y-auto', wide ? 'max-w-2xl' : 'max-w-md')}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white">
          <h3 className="font-semibold text-slate-800 text-sm">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

// ─── Top-up Form ──────────────────────────────────────────────────────────────

function TopUpForm({ orgId, poolId, onSaved, onClose }: { orgId: string; poolId: string; onSaved: (t: BusPoolTopUp) => void; onClose: () => void }) {
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await createBusPoolTopUp(orgId, {
        pool_id: poolId,
        amount: Number(fd.get('amount')),
        payment_method: fd.get('payment_method') as string,
        reference_no: (fd.get('reference_no') as string) || undefined,
        notes: (fd.get('notes') as string) || undefined,
      })
      if (!('error' in res) && 'data' in res && res.data) onSaved(res.data as BusPoolTopUp)
      else onClose()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="Jumlah Top-up (Rp) *">
        <Input name="amount" type="number" min="1000" step="1000" placeholder="5.000.000" required />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Metode Pembayaran">
          <Select name="payment_method" defaultValue="transfer">
            <option value="transfer">Transfer Bank</option>
            <option value="cash">Tunai</option>
            <option value="qris">QRIS</option>
          </Select>
        </FormField>
        <FormField label="No. Referensi">
          <Input name="reference_no" placeholder="TF-20260601-001" />
        </FormField>
      </div>
      <FormField label="Catatan">
        <Textarea name="notes" placeholder="Opsional..." />
      </FormField>
      <div className="flex gap-3 justify-end">
        <SafeButton type="button" variant="ghost" onClick={onClose} disabled={pending}>Batal</SafeButton>
        <SafeButton type="submit" disabled={pending} icon={<ArrowUpCircle className="w-4 h-4" />}>
          {pending ? 'Memproses...' : 'Konfirmasi Top-up'}
        </SafeButton>
      </div>
    </form>
  )
}

// ─── Settlement Form ──────────────────────────────────────────────────────────

function SettlementForm({ orgId, pool, onSaved, onClose }: { orgId: string; pool: BusPool; onSaved: (s: BusPoolSettlement) => void; onClose: () => void }) {
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await createBusPoolSettlement(orgId, {
        pool_id:        pool.id,
        period_start:   fd.get('period_start') as string,
        period_end:     fd.get('period_end') as string,
        total_tickets:  Number(fd.get('total_tickets')),
        total_revenue:  Number(fd.get('total_revenue')),
        commission_pct: Number(fd.get('commission_pct')) || pool.commission_pct,
        payment_method: (fd.get('payment_method') as string) || undefined,
        reference_no:   (fd.get('reference_no') as string) || undefined,
        notes:          (fd.get('notes') as string) || undefined,
      })
      if (!('error' in res) && 'data' in res && res.data) onSaved(res.data as BusPoolSettlement)
      else onClose()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Periode Mulai *"><Input name="period_start" type="date" required /></FormField>
        <FormField label="Periode Akhir *"><Input name="period_end" type="date" required /></FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Jumlah Tiket"><Input name="total_tickets" type="number" min="0" placeholder="0" /></FormField>
        <FormField label="Total Pendapatan (Rp)"><Input name="total_revenue" type="number" min="0" step="1000" placeholder="0" /></FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label={`Komisi % (default ${pool.commission_pct}%)`}>
          <Input name="commission_pct" type="number" min="0" max="100" step="0.5" defaultValue={pool.commission_pct} />
        </FormField>
        <FormField label="Metode Bayar">
          <Select name="payment_method">
            <option value="transfer">Transfer Bank</option>
            <option value="cash">Tunai</option>
          </Select>
        </FormField>
      </div>
      <FormField label="No. Referensi"><Input name="reference_no" placeholder="STL-20260601-001" /></FormField>
      <div className="flex gap-3 justify-end">
        <SafeButton type="button" variant="ghost" onClick={onClose} disabled={pending}>Batal</SafeButton>
        <SafeButton type="submit" disabled={pending} icon={<Receipt className="w-4 h-4" />}>
          {pending ? 'Membuat...' : 'Buat Settlement'}
        </SafeButton>
      </div>
    </form>
  )
}

// ─── Pool Form ────────────────────────────────────────────────────────────────

function PoolForm({ orgId, editing, onSaved, onClose }: { orgId: string; editing: BusPool | null; onSaved: (p: BusPool) => void; onClose: () => void }) {
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const payload = {
        code:               fd.get('code') as string,
        name:               fd.get('name') as string,
        pool_type:          fd.get('pool_type') as BusPool['pool_type'],
        owner_name:         (fd.get('owner_name') as string) || undefined,
        pic_name:           (fd.get('pic_name') as string) || undefined,
        phone:              (fd.get('phone') as string) || undefined,
        whatsapp:           (fd.get('whatsapp') as string) || undefined,
        email:              (fd.get('email') as string) || undefined,
        address:            (fd.get('address') as string) || undefined,
        city:               (fd.get('city') as string) || undefined,
        province:           (fd.get('province') as string) || undefined,
        commission_pct:     Number(fd.get('commission_pct')) || 0,
        credit_limit:       Number(fd.get('credit_limit')) || 0,
        bank_name:          (fd.get('bank_name') as string) || undefined,
        bank_account:       (fd.get('bank_account') as string) || undefined,
        bank_account_name:  (fd.get('bank_account_name') as string) || undefined,
        is_active:          fd.get('is_active') !== 'false',
      }
      if (editing) {
        const res = await updateBusPool(orgId, editing.id, payload)
        if (!('error' in res)) onSaved({ ...editing, ...payload } as BusPool)
        else onClose()
      } else {
        const res = await createBusPool(orgId, payload)
        if (!('error' in res) && 'data' in res && res.data) onSaved(res.data as BusPool)
        else onClose()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Kode Pool *">
          <Input name="code" defaultValue={editing?.code ?? ''} placeholder="POOL-SBY" required />
        </FormField>
        <FormField label="Tipe Pool *">
          <Select name="pool_type" defaultValue={editing?.pool_type ?? 'AGEN_RESMI'}>
            {Object.entries(POOL_TYPE_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </Select>
        </FormField>
        <div className="col-span-2">
          <FormField label="Nama Pool *">
            <Input name="name" defaultValue={editing?.name ?? ''} placeholder="Pool Surabaya Purabaya" required />
          </FormField>
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-500 mb-3">Kontak</p>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Pemilik"><Input name="owner_name" defaultValue={editing?.owner_name ?? ''} /></FormField>
          <FormField label="PIC"><Input name="pic_name" defaultValue={editing?.pic_name ?? ''} /></FormField>
          <FormField label="Telepon"><Input name="phone" defaultValue={editing?.phone ?? ''} type="tel" /></FormField>
          <FormField label="WhatsApp"><Input name="whatsapp" defaultValue={editing?.whatsapp ?? ''} type="tel" /></FormField>
          <div className="col-span-2">
            <FormField label="Email"><Input name="email" defaultValue={editing?.email ?? ''} type="email" /></FormField>
          </div>
          <FormField label="Kota"><Input name="city" defaultValue={editing?.city ?? ''} /></FormField>
          <FormField label="Provinsi"><Input name="province" defaultValue={editing?.province ?? ''} /></FormField>
          <div className="col-span-2">
            <FormField label="Alamat"><Textarea name="address" defaultValue={editing?.address ?? ''} rows={2} /></FormField>
          </div>
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-500 mb-3">Keuangan</p>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Komisi (%)"><Input name="commission_pct" type="number" min="0" max="100" step="0.5" defaultValue={editing?.commission_pct ?? 5} /></FormField>
          <FormField label="Credit Limit (Rp)"><Input name="credit_limit" type="number" min="0" step="1000" defaultValue={editing?.credit_limit ?? 0} /></FormField>
          <FormField label="Bank"><Input name="bank_name" defaultValue={editing?.bank_name ?? ''} placeholder="Bank BCA" /></FormField>
          <FormField label="No. Rekening"><Input name="bank_account" defaultValue={editing?.bank_account ?? ''} placeholder="0123456789" /></FormField>
          <div className="col-span-2">
            <FormField label="Nama Pemilik Rekening"><Input name="bank_account_name" defaultValue={editing?.bank_account_name ?? ''} /></FormField>
          </div>
        </div>
      </div>
      <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
        <SafeButton type="button" variant="ghost" onClick={onClose} disabled={pending}>Batal</SafeButton>
        <SafeButton type="submit" disabled={pending} icon={<CheckCircle2 className="w-4 h-4" />}>
          {pending ? 'Menyimpan...' : 'Simpan Pool'}
        </SafeButton>
      </div>
    </form>
  )
}

// ─── Agent Form ───────────────────────────────────────────────────────────────

function AgentForm({ orgId, poolId, editing, onSaved, onClose }: { orgId: string; poolId: string; editing: BusAgent | null; onSaved: (a: BusAgent) => void; onClose: () => void }) {
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const payload = {
        name:           fd.get('name') as string,
        phone:          (fd.get('phone') as string) || undefined,
        email:          (fd.get('email') as string) || undefined,
        address:        (fd.get('address') as string) || undefined,
        city:           (fd.get('city') as string) || undefined,
        commission_pct: Number(fd.get('commission_pct')) || 0,
        pool_id:        poolId,
        is_active:      true,
      }
      if (editing) {
        const res = await updateBusAgent(orgId, editing.id, payload)
        if (!('error' in res)) onSaved({ ...editing, ...payload } as BusAgent)
        else onClose()
      } else {
        const res = await createBusAgent(orgId, payload)
        if (!('error' in res) && 'data' in res && res.data) onSaved(res.data as BusAgent)
        else onClose()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="Nama Agen *">
        <Input name="name" defaultValue={editing?.name ?? ''} placeholder="Sari Travel Surabaya" required />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="No. HP"><Input name="phone" defaultValue={editing?.phone ?? ''} type="tel" /></FormField>
        <FormField label="Email"><Input name="email" defaultValue={editing?.email ?? ''} type="email" /></FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Kota"><Input name="city" defaultValue={editing?.city ?? ''} /></FormField>
        <FormField label="Komisi (%)"><Input name="commission_pct" type="number" min="0" max="100" step="0.5" defaultValue={editing?.commission_pct ?? 3} /></FormField>
      </div>
      <FormField label="Alamat"><Textarea name="address" defaultValue={editing?.address ?? ''} rows={2} /></FormField>
      <div className="flex gap-3 justify-end">
        <SafeButton type="button" variant="ghost" onClick={onClose} disabled={pending}>Batal</SafeButton>
        <SafeButton type="submit" disabled={pending} icon={<CheckCircle2 className="w-4 h-4" />}>
          {pending ? 'Menyimpan...' : 'Simpan'}
        </SafeButton>
      </div>
    </form>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface PoolAgenTabProps {
  orgId: string
  initialPools: BusPool[]
  initialTopUps: BusPoolTopUp[]
  initialSettlements: BusPoolSettlement[]
  agents: BusAgent[]
  ticketsByPool: Record<string, number>
  cargoByPool?: Record<string, number>
  schedules?: BusSchedule[]
  routes?: BusRoute[]
  cargoShipments?: (FleetCargoShipment & { bus_pool_id?: string | null })[]
  terminals?: FleetTerminal[]
}

export function PoolAgenTab({
  orgId,
  initialPools,
  initialTopUps,
  initialSettlements,
  agents: initialAgents,
  ticketsByPool,
  cargoByPool = {},
  schedules = [],
  cargoShipments = [],
  terminals = [],
}: PoolAgenTabProps) {
  const [pools, setPools] = useState(initialPools)
  const [allTopUps, setAllTopUps] = useState(initialTopUps)
  const [allSettlements, setAllSettlements] = useState(initialSettlements)
  const [allAgents, setAllAgents] = useState(initialAgents)
  const [selectedPool, setSelectedPool] = useState<BusPool | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [shortcutPool, setShortcutPool] = useState<BusPool | null>(null)

  const activePools   = pools.filter(p => p.is_active)
  const totalBalance  = activePools.reduce((s, p) => s + p.deposit_balance, 0)
  const totalPending  = allSettlements.filter(s => s.status === 'PENDING').reduce((s, x) => s + x.commission_amount, 0)
  const activeAgents  = allAgents.filter(a => a.is_active)

  return (
    <div className="space-y-5">
      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Pool Aktif"        value={formatAngka(activePools.length)}  icon={Store}    color="blue" />
        <StatCard label="Total Deposit"     value={formatRupiah(totalBalance)}        icon={Wallet}   color="emerald" />
        <StatCard label="Komisi Tertunggak" value={formatRupiah(totalPending)}        icon={Banknote} color="amber" />
        <StatCard label="Total Agen Aktif"  value={formatAngka(activeAgents.length)}  icon={Users}    color="indigo" />
      </div>

      {/* Main: sidebar + detail */}
      <div className={cn(
        'bg-white border border-slate-200 rounded-2xl overflow-hidden flex',
        selectedPool ? 'flex-col md:flex-row' : 'flex-col',
      )}>
        {/* Left sidebar */}
        <div className={cn(
          'border-r border-slate-100',
          selectedPool ? 'hidden md:block md:w-72 lg:w-80 shrink-0' : 'w-full',
        )}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700">Daftar Pool & Agen</h3>
            <SafeButton size="sm" onClick={() => setShowCreateModal(true)} icon={<Plus className="w-3.5 h-3.5" />}>
              Baru
            </SafeButton>
          </div>

          {pools.length === 0 ? (
            <div className="p-8 text-center">
              <Store className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Belum ada pool terdaftar</p>
              <SafeButton className="mt-3" size="sm" onClick={() => setShowCreateModal(true)} icon={<Plus className="w-3.5 h-3.5" />}>
                Registrasi Pool
              </SafeButton>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[600px]">
              {pools.map(p => (
                <PoolListItem
                  key={p.id}
                  pool={p}
                  agents={allAgents.filter(a => a.pool_id === p.id && a.is_active)}
                  tickets={ticketsByPool[p.id] ?? 0}
                  selected={selectedPool?.id === p.id}
                  onClick={() => setSelectedPool(p)}
                  onShortcut={setShortcutPool}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right detail panel */}
        {selectedPool ? (
          <div className="flex-1 p-5 min-w-0">
            <PoolDetail
              orgId={orgId}
              pool={selectedPool}
              agents={allAgents.filter(a => a.pool_id === selectedPool.id)}
              topUps={allTopUps.filter(t => t.pool_id === selectedPool.id)}
              settlements={allSettlements.filter(s => s.pool_id === selectedPool.id)}
              ticketCount={ticketsByPool[selectedPool.id] ?? 0}
              cargoCount={cargoByPool[selectedPool.id] ?? cargoShipments.filter(c => c.bus_pool_id === selectedPool.id).length}
              schedules={schedules}
              initialCargoShipments={cargoShipments.filter(c => c.bus_pool_id === selectedPool.id)}
              terminals={terminals}
              onBack={() => setSelectedPool(null)}
              onUpdated={(updated) => {
                setPools(prev => prev.map(p => p.id === updated.id ? updated : p))
                setSelectedPool(updated)
              }}
              onDeleted={(id) => {
                setPools(prev => prev.filter(p => p.id !== id))
                setSelectedPool(null)
              }}
            />
          </div>
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center text-slate-300 p-12">
            <div className="text-center">
              <Store className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Pilih pool di sebelah kiri untuk melihat detail, grafik revenue, dan tombol transaksi</p>
            </div>
          </div>
        )}
      </div>

      {/* Create Pool Modal */}
      {showCreateModal && (
        <QuickModal title="Registrasi Pool Baru" onClose={() => setShowCreateModal(false)} wide>
          <PoolForm
            orgId={orgId} editing={null}
            onSaved={(p) => {
              setPools(prev => [...prev, p])
              setShowCreateModal(false)
              setSelectedPool(p)
            }}
            onClose={() => setShowCreateModal(false)}
          />
        </QuickModal>
      )}

      {shortcutPool && (
        <PoolShortcutModal pool={shortcutPool} onClose={() => setShortcutPool(null)} />
      )}
    </div>
  )
}
