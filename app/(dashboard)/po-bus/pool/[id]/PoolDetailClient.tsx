'use client'

import { useState } from 'react'
import {
  Store, Wallet, Users, Ticket, Package, TrendingUp,
  MapPin, Phone, Mail, Building2, CreditCard,
  ArrowUpCircle, Receipt, CheckCircle2, Clock, AlertTriangle,
  Share2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SafeButton, StatCard, SectionCard, SectionHeader } from '@/components/ui/NizamUI'
import { PoolShortcutModal } from '../../PoolShortcutModal'
import type {
  BusPool, BusAgent, BusPoolTopUp, BusPoolSettlement, BusTicket,
} from '@/modules/po-bus/lib/po-bus-types'

function formatRupiah(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID')
}
function formatDate(s: string) {
  return new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

const POOL_TYPE_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  POOL_UTAMA: { label: 'Pool Utama', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  AGEN_RESMI: { label: 'Agen Resmi', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  SUB_AGEN:   { label: 'Sub-Agen', bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
}

type Tab = 'RINGKASAN' | 'AGEN' | 'TOPUP' | 'SETTLEMENT' | 'TIKET'

interface Props {
  pool: BusPool
  agents: BusAgent[]
  topUps: BusPoolTopUp[]
  settlements: BusPoolSettlement[]
  tickets: BusTicket[]
  cargoCount: number
  orgId: string
}

export function PoolDetailClient({ pool, agents, topUps, settlements, tickets, cargoCount }: Props) {
  const [tab, setTab] = useState<Tab>('RINGKASAN')
  const [showShortcut, setShowShortcut] = useState(false)

  const cfg = POOL_TYPE_CONFIG[pool.pool_type] ?? POOL_TYPE_CONFIG.AGEN_RESMI

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalTopUp = topUps.reduce((s, t) => s + t.amount, 0)
  const totalRevenue = tickets.reduce((s, t) => s + t.price, 0)
  const earnedCommission = totalRevenue * (pool.commission_pct / 100)
  const paidSettlements = settlements.filter(s => s.status === 'DIBAYAR')
  const pendingSettlements = settlements.filter(s => s.status === 'PENDING')
  const paidCommission = paidSettlements.reduce((s, x) => s + x.commission_amount, 0)
  const pendingCommission = pendingSettlements.reduce((s, x) => s + x.commission_amount, 0)

  // balance bar
  const balancePct = pool.credit_limit > 0 ? Math.min((pool.deposit_balance / pool.credit_limit) * 100, 100) : 0
  const balanceColor = balancePct > 50 ? 'bg-emerald-500' : balancePct > 20 ? 'bg-amber-400' : 'bg-rose-500'

  const TABS: { id: Tab; label: string; badge?: number }[] = [
    { id: 'RINGKASAN', label: 'Ringkasan' },
    { id: 'AGEN', label: 'Agen', badge: agents.length },
    { id: 'TOPUP', label: 'Top-up', badge: topUps.length },
    { id: 'SETTLEMENT', label: 'Settlement', badge: pendingSettlements.length || undefined },
    { id: 'TIKET', label: 'Tiket', badge: tickets.length },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* ── Header card ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-xl font-bold text-slate-800 truncate">{pool.name}</h1>
              <span className={cn('text-xs font-semibold px-2.5 py-0.5 rounded-full border', cfg.bg, cfg.text, cfg.border)}>
                {cfg.label}
              </span>
              {!pool.is_active && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500">Nonaktif</span>
              )}
            </div>
            <p className="text-sm font-mono text-slate-400 mb-3">{pool.code}</p>
            <div className="flex flex-wrap gap-4 text-sm text-slate-500">
              {pool.city && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{pool.city}{pool.province ? `, ${pool.province}` : ''}</span>}
              {pool.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{pool.phone}</span>}
              {pool.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{pool.email}</span>}
            </div>
          </div>

          <div className="flex flex-col items-end gap-3 shrink-0">
            {/* Shortcut button */}
            <button
              onClick={() => setShowShortcut(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-all cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              QR / Shortcut
            </button>
            {/* Balance block */}
            <div className="text-right">
              <p className="text-xs text-slate-400 mb-0.5">Saldo Deposit</p>
              <p className={cn('text-2xl font-bold', pool.deposit_balance > 0 ? 'text-emerald-600' : 'text-slate-500')}>
                {formatRupiah(pool.deposit_balance)}
              </p>
              {pool.credit_limit > 0 && (
                <div className="mt-2 w-44">
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                    <span>dari limit {formatRupiah(pool.credit_limit)}</span>
                    <span>{Math.round(balancePct)}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all', balanceColor)} style={{ width: `${balancePct}%` }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total Tiket" value={tickets.length} icon={Ticket} color="blue" />
        <StatCard label="Revenue Pool" value={formatRupiah(totalRevenue)} icon={TrendingUp} color="emerald" />
        <StatCard label="Komisi Earned" value={formatRupiah(earnedCommission)} icon={Receipt} color="amber" />
        <StatCard label="Kargo" value={cargoCount} icon={Package} color="indigo" />
        <StatCard label="Total Top-up" value={formatRupiah(totalTopUp)} icon={ArrowUpCircle} color="slate" />
      </div>

      {/* Portal link */}
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

      {/* ── Tab content ── */}
      {tab === 'RINGKASAN' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Info */}
          <SectionCard>
            <SectionHeader title="Informasi Pool" icon={Building2} />
            <div className="mt-4 space-y-3 text-sm">
              {[
                ['Pemilik', pool.owner_name],
                ['PIC', pool.pic_name],
                ['WhatsApp', pool.whatsapp],
                ['Alamat', pool.address],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k as string} className="flex gap-2">
                  <span className="text-slate-400 w-24 shrink-0">{k as string}</span>
                  <span className="text-slate-700">{v as string}</span>
                </div>
              ))}
              {pool.commission_pct > 0 && (
                <div className="flex gap-2">
                  <span className="text-slate-400 w-24 shrink-0">Komisi</span>
                  <span className="font-semibold text-emerald-600">{pool.commission_pct}%</span>
                </div>
              )}
              {pool.bank_name && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-400 mb-2">Rekening</p>
                  <p className="text-slate-700">{pool.bank_name} — {pool.bank_account}</p>
                  {pool.bank_account_name && <p className="text-xs text-slate-400">{pool.bank_account_name}</p>}
                </div>
              )}
            </div>
          </SectionCard>

          {/* Settlement summary */}
          <SectionCard>
            <SectionHeader title="Ringkasan Komisi" icon={Receipt} />
            <div className="mt-4 space-y-3">
              {[
                { label: 'Total Revenue', val: formatRupiah(totalRevenue), color: 'text-slate-700' },
                { label: `Komisi ${pool.commission_pct}%`, val: formatRupiah(earnedCommission), color: 'text-amber-600' },
                { label: 'Sudah Dibayar', val: formatRupiah(paidCommission), color: 'text-emerald-600' },
                { label: 'Tertunggak', val: formatRupiah(pendingCommission), color: pendingCommission > 0 ? 'text-rose-600' : 'text-slate-400' },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <span className="text-sm text-slate-500">{row.label}</span>
                  <span className={cn('text-sm font-bold', row.color)}>{row.val}</span>
                </div>
              ))}
            </div>
            {pendingSettlements.length > 0 && (
              <div className="mt-3 flex items-center gap-2 bg-amber-50 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <p className="text-xs text-amber-700">{pendingSettlements.length} settlement belum dibayarkan</p>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {tab === 'AGEN' && (
        <SectionCard>
          <SectionHeader title="Agen dalam Pool" icon={Users} subtitle={`${agents.length} agen terdaftar`} />
          {agents.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Belum ada agen terdaftar di pool ini.</p>
          ) : (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {agents.map(a => (
                <div key={a.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-blue-700 font-bold text-xs">{a.name.slice(0, 2).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 text-sm">{a.name}</p>
                    <p className="text-xs text-slate-400">
                      {a.city || 'Tanpa kota'} · Komisi {a.commission_pct}%
                      {a.phone && ` · ${a.phone}`}
                    </p>
                  </div>
                  {!a.is_active && <span className="text-[10px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full shrink-0">Nonaktif</span>}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {tab === 'TOPUP' && (
        <SectionCard>
          <SectionHeader title="Riwayat Top-up Saldo" icon={ArrowUpCircle} subtitle={`Total: ${formatRupiah(totalTopUp)}`} />
          {topUps.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Belum ada top-up.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {topUps.map(tu => (
                <div key={tu.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div>
                    <p className="text-sm font-semibold text-emerald-600">+{formatRupiah(tu.amount)}</p>
                    <p className="text-xs text-slate-400">{tu.payment_method} · {formatDate(tu.created_at)}</p>
                    {tu.reference_no && <p className="text-xs font-mono text-slate-300">{tu.reference_no}</p>}
                  </div>
                  {tu.notes && <p className="text-xs text-slate-400 max-w-[180px] text-right">{tu.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {tab === 'SETTLEMENT' && (
        <SectionCard>
          <SectionHeader title="Riwayat Settlement Komisi" icon={Receipt} />
          {settlements.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Belum ada settlement komisi.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {settlements.map(s => (
                <div key={s.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{formatDate(s.period_start)} – {formatDate(s.period_end)}</p>
                    <p className="text-xs text-slate-400">{s.total_tickets} tiket · Revenue {formatRupiah(s.total_revenue)} · {s.commission_pct}%</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-800">{formatRupiah(s.commission_amount)}</p>
                    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full',
                      s.status === 'DIBAYAR' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700',
                    )}>
                      {s.status === 'DIBAYAR' ? (
                        <span className="flex items-center gap-1"><CheckCircle2 className="w-2.5 h-2.5" />Dibayar</span>
                      ) : (
                        <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" />Pending</span>
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {tab === 'TIKET' && (
        <SectionCard>
          <SectionHeader title="Tiket Terjual via Pool" icon={Ticket} subtitle={`${tickets.length} tiket`} />
          {tickets.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Belum ada tiket terjual melalui pool ini.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-400">Penumpang</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-400">Kursi</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-slate-400">Harga</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-400">Status</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-400">Tanggal</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.slice(0, 50).map(t => (
                    <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3 font-medium text-slate-700">{t.passenger_name}</td>
                      <td className="py-2 px-3 text-slate-500 font-mono text-xs">{t.seat_number}</td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-700">{formatRupiah(t.price)}</td>
                      <td className="py-2 px-3">
                        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full',
                          t.status === 'DIGUNAKAN' ? 'bg-emerald-50 text-emerald-700' :
                          t.status === 'DIBAYAR' ? 'bg-blue-50 text-blue-700' :
                          t.status === 'BATAL' ? 'bg-red-50 text-red-600' :
                          'bg-slate-100 text-slate-500',
                        )}>{t.status}</span>
                      </td>
                      <td className="py-2 px-3 text-xs text-slate-400">{formatDate(t.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {tickets.length > 50 && (
                <p className="text-xs text-slate-400 text-center mt-3">Menampilkan 50 dari {tickets.length} tiket</p>
              )}
            </div>
          )}
        </SectionCard>
      )}

      {showShortcut && <PoolShortcutModal pool={pool} onClose={() => setShowShortcut(false)} />}
    </div>
  )
}
