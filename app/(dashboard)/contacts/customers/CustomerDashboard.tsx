'use client'

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart2,
  Calendar,
  Clock,
  CreditCard,
  Minus,
  RefreshCw,
  ShieldAlert,
  Star,
  TrendingUp,
  UserCheck,
  UserMinus,
  Users,
} from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import type { CustomerDashboardData } from '@/modules/contacts/actions/contact.analytics'

const RFM_META: Record<string, { color: string; bg: string; desc: string }> = {
  Champions:  { color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200',   desc: 'Beli sering, baru, nilai tinggi' },
  Loyal:      { color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',     desc: 'Beli rutin, nilai konsisten' },
  Potential:  { color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200', desc: 'Baru bergabung, potensi besar' },
  'At Risk':  { color: 'text-rose-700',   bg: 'bg-rose-50 border-rose-200',     desc: 'Dulu aktif, mulai jarang' },
  Lost:       { color: 'text-slate-500',  bg: 'bg-slate-50 border-slate-200',   desc: 'Tidak beli > 6 bulan' },
  Others:     { color: 'text-slate-600',  bg: 'bg-slate-50 border-slate-200',   desc: 'Belum terkategori' },
}

function GrowthBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) return <span className="flex items-center gap-0.5 text-[10px] font-bold text-slate-400"><Minus size={10} />0%</span>
  return pct > 0
    ? <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-600"><ArrowUp size={10} />{pct}%</span>
    : <span className="flex items-center gap-0.5 text-[10px] font-bold text-rose-500"><ArrowDown size={10} />{Math.abs(pct)}%</span>
}

function MiniBar({ value, max, color = 'bg-blue-500' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.max((value / max) * 100, 2) : 2
  return (
    <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function SectionTitle({ icon: Icon, title, subtitle, color = 'text-blue-600' }: {
  icon: React.ElementType; title: string; subtitle?: string; color?: string
}) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className={`w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={15} />
      </div>
      <div>
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

export default function CustomerDashboard({ data }: { data: CustomerDashboardData }) {
  const { hero, monthlyGrowth, retention, rfm, ar } = data

  const maxRevenue = Math.max(...monthlyGrowth.map(m => m.revenue), 1)
  const maxNewCust = Math.max(...monthlyGrowth.map(m => m.new_customers), 1)
  const maxRepeat   = Math.max(...retention.repeatBuyersByMonth.map(m => m.repeat_buyers + m.new_buyers), 1)
  const maxAov      = Math.max(...retention.aovByMonth.map(m => m.aov), 1)

  const rfmCounts = rfm.reduce<Record<string, number>>((acc, c) => {
    acc[c.segment] = (acc[c.segment] ?? 0) + 1
    return acc
  }, {})

  const maxArBucket = Math.max(...ar.buckets.map(b => b.total), 1)

  return (
    <div className="space-y-6">

      {/* ── HERO STATS ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          {
            label: 'Total Customer', value: hero.totalCustomers, icon: Users,
            sub: <GrowthBadge current={hero.newThisMonth} previous={hero.newLastMonth} />,
            color: 'bg-blue-600', light: 'bg-blue-50 text-blue-600',
          },
          {
            label: 'Customer Baru Bulan Ini', value: hero.newThisMonth, icon: UserCheck,
            sub: <span className="text-[10px] text-slate-400">vs {hero.newLastMonth} bln lalu</span>,
            color: 'bg-indigo-600', light: 'bg-indigo-50 text-indigo-600',
          },
          {
            label: 'Revenue Bulan Ini', value: formatRupiah(hero.revenueThisMonth), icon: TrendingUp,
            sub: <GrowthBadge current={hero.revenueThisMonth} previous={hero.revenueLastMonth} />,
            color: 'bg-emerald-600', light: 'bg-emerald-50 text-emerald-600',
          },
          {
            label: 'Repeat Buyer Rate', value: `${hero.repeatBuyerRate}%`, icon: RefreshCw,
            sub: <span className="text-[10px] text-slate-400">{hero.repeatBuyerCount} pelanggan loyal</span>,
            color: 'bg-amber-500', light: 'bg-amber-50 text-amber-600',
          },
          {
            label: 'AR Outstanding', value: formatRupiah(hero.totalArOutstanding), icon: CreditCard,
            sub: <span className="text-[10px] text-slate-400">DSO avg {hero.avgDso} hari</span>,
            color: 'bg-rose-600', light: 'bg-rose-50 text-rose-600',
          },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-slate-100 p-4 flex flex-col gap-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide leading-tight">{card.label}</span>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${card.light}`}>
                <card.icon size={13} />
              </div>
            </div>
            <p className="text-lg font-bold text-slate-800 leading-tight truncate">{card.value}</p>
            <div>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* ── PERTUMBUHAN REVENUE + CUSTOMER BARU ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Revenue per bulan */}
        <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
          <SectionTitle icon={TrendingUp} title="Revenue per Bulan" subtitle="12 bulan terakhir + growth MoM" color="text-emerald-600" />
          <div className="space-y-2">
            {monthlyGrowth.map(m => (
              <div key={m.month} className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-slate-400 w-14 shrink-0">{m.month_label}</span>
                <MiniBar value={m.revenue} max={maxRevenue} color="bg-emerald-400" />
                <div className="shrink-0 flex items-center gap-1.5 min-w-[130px] justify-end">
                  <span className="text-[11px] font-bold text-slate-700">{formatRupiah(m.revenue)}</span>
                  {m.prev_revenue !== null && (
                    <GrowthBadge current={m.revenue} previous={m.prev_revenue} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Customer baru per bulan */}
        <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
          <SectionTitle icon={UserCheck} title="Customer Baru per Bulan" subtitle="Akuisisi pelanggan 12 bulan terakhir" color="text-blue-600" />
          <div className="space-y-2">
            {monthlyGrowth.map(m => (
              <div key={m.month} className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-slate-400 w-14 shrink-0">{m.month_label}</span>
                <MiniBar value={m.new_customers} max={maxNewCust} color="bg-blue-400" />
                <div className="shrink-0 flex items-center gap-2 min-w-[80px] justify-end">
                  <span className="text-[11px] font-bold text-slate-700">{m.new_customers} baru</span>
                  <span className="text-[10px] text-slate-400">{m.unique_buyers} aktif</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RETENSI & LOYALITAS ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* New vs Repeat per bulan */}
        <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
          <SectionTitle icon={RefreshCw} title="New vs Repeat Buyer" subtitle="6 bulan terakhir" color="text-indigo-600" />
          {retention.repeatBuyersByMonth.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Belum ada data.</p>
          ) : (
            <div className="space-y-3">
              {retention.repeatBuyersByMonth.map(m => {
                const total = m.new_buyers + m.repeat_buyers
                const newPct = total > 0 ? (m.new_buyers / total) * 100 : 0
                const repPct = total > 0 ? (m.repeat_buyers / total) * 100 : 0
                return (
                  <div key={m.month}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-semibold text-slate-500">{m.month_label}</span>
                      <div className="flex gap-3 text-[10px] font-semibold">
                        <span className="text-blue-600">{m.new_buyers} baru</span>
                        <span className="text-indigo-600">{m.repeat_buyers} repeat</span>
                      </div>
                    </div>
                    <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
                      <div className="bg-blue-400 rounded-full transition-all" style={{ width: `${newPct}%` }} />
                      <div className="bg-indigo-500 rounded-full transition-all" style={{ width: `${repPct}%` }} />
                    </div>
                  </div>
                )
              })}
              <div className="flex gap-4 pt-1">
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-400" /><span className="text-[10px] text-slate-500">Baru</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-indigo-500" /><span className="text-[10px] text-slate-500">Repeat</span></div>
              </div>
            </div>
          )}
        </div>

        {/* AOV per bulan */}
        <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
          <SectionTitle icon={BarChart2} title="Average Order Value (AOV)" subtitle="Tren nilai rata-rata per transaksi" color="text-amber-600" />
          {retention.aovByMonth.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Belum ada data.</p>
          ) : (
            <div className="space-y-2">
              {retention.aovByMonth.map(m => (
                <div key={m.month} className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-slate-400 w-14 shrink-0">{m.month_label}</span>
                  <MiniBar value={m.aov} max={maxAov} color="bg-amber-400" />
                  <span className="text-[11px] font-bold text-slate-700 shrink-0 w-28 text-right">{formatRupiah(m.aov)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── CUSTOMER AT RISK ────────────────────────────────────────────── */}
      {retention.atRiskCustomers.length > 0 && (
        <div className="bg-white rounded-xl border border-rose-100 p-6 shadow-sm">
          <SectionTitle icon={AlertTriangle} title="Customer Berisiko Hilang" subtitle="Tidak ada transaksi ≥ 60 hari — segera follow up" color="text-rose-600" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {retention.atRiskCustomers.map(c => (
              <div key={c.id} className="rounded-xl border border-rose-100 bg-rose-50 p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <UserMinus size={13} className="text-rose-500 shrink-0" />
                  <span className="text-[11px] font-bold text-slate-700 truncate">{c.name}</span>
                </div>
                <div className="text-[10px] text-slate-500">
                  Terakhir: <span className="font-semibold text-slate-700">
                    {new Date(c.last_purchase).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <div className={`text-[11px] font-bold px-2 py-1 rounded-lg w-fit ${c.days_since > 120 ? 'bg-rose-600 text-white' : 'bg-rose-100 text-rose-700'}`}>
                  {c.days_since} hari lalu
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── RFM SEGMENTATION ────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
        <SectionTitle icon={Star} title="Segmentasi RFM Pelanggan" subtitle="Recency · Frequency · Monetary — klasifikasi otomatis" color="text-amber-600" />

        {/* Segment summary chips */}
        <div className="flex flex-wrap gap-2 mb-5">
          {Object.entries(rfmCounts).sort((a, b) => b[1] - a[1]).map(([seg, count]) => {
            const meta = RFM_META[seg] ?? RFM_META['Others']
            return (
              <div key={seg} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] font-semibold ${meta.bg} ${meta.color}`}>
                <span>{seg}</span>
                <span className="font-bold">{count}</span>
              </div>
            )
          })}
        </div>

        {/* RFM Table */}
        {rfm.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Pelanggan', 'Segmen', 'Recency', 'Frekuensi', 'Monetary', 'R', 'F', 'M'].map(h => (
                    <th key={h} className="text-left py-2 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rfm.map((c, i) => {
                  const meta = RFM_META[c.segment] ?? RFM_META['Others']
                  return (
                    <tr key={c.id} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                      <td className="py-2.5 px-3 font-semibold text-slate-700 truncate max-w-[140px]">{c.name}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-md border text-[9px] font-bold uppercase tracking-wide ${meta.bg} ${meta.color}`}>
                          {c.segment}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{c.recency_days >= 999 ? '—' : `${c.recency_days}h`}</td>
                      <td className="py-2.5 px-3 text-slate-600">{c.frequency}x</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-700">{formatRupiah(c.monetary)}</td>
                      <td className="py-2.5 px-3"><ScoreDot score={c.r_score} /></td>
                      <td className="py-2.5 px-3"><ScoreDot score={c.f_score} /></td>
                      <td className="py-2.5 px-3"><ScoreDot score={c.m_score} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">Belum ada data transaksi untuk RFM.</p>
        )}
      </div>

      {/* ── AR AGING ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
        <SectionTitle icon={Clock} title="Piutang & AR Aging" subtitle={`Total outstanding ${formatRupiah(ar.totalOutstanding)} · DSO rata-rata ${ar.dso} hari`} color="text-rose-600" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Aging buckets */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-3">Distribusi Umur Piutang</p>
            {ar.buckets.length === 0 ? (
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
                <ShieldAlert size={15} /> Tidak ada piutang outstanding
              </div>
            ) : (
              <div className="space-y-3">
                {ar.buckets.map(b => (
                  <div key={b.label}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[11px] font-semibold text-slate-600">{b.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400">{b.count} invoice</span>
                        <span className="text-[11px] font-bold text-slate-700">{formatRupiah(b.total)}</span>
                      </div>
                    </div>
                    <MiniBar value={b.total} max={maxArBucket}
                      color={b.label.startsWith('>') ? 'bg-rose-500' : b.label.startsWith('30') ? 'bg-amber-400' : 'bg-blue-400'} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top debtors */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-3">Customer Piutang Terbesar</p>
            {ar.topDebtors.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Tidak ada piutang.</p>
            ) : (
              <div className="space-y-2">
                {ar.topDebtors.map((d, i) => (
                  <div key={`${d.name}-${i}`} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                    <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 text-[9px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <span className="flex-1 text-[11px] font-semibold text-slate-700 truncate">{d.name}</span>
                    <span className="text-[10px] text-slate-400 shrink-0">{d.oldest_days}h</span>
                    <span className="text-[11px] font-bold text-rose-600 shrink-0">{formatRupiah(d.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}

function ScoreDot({ score }: { score: number }) {
  const colors = ['bg-slate-200', 'bg-slate-300', 'bg-amber-300', 'bg-emerald-400', 'bg-blue-500']
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <div key={n} className={`w-1.5 h-1.5 rounded-full ${n <= score ? colors[score - 1] : 'bg-slate-100'}`} />
      ))}
    </div>
  )
}
