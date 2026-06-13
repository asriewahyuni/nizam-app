'use client'

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart2,
  Clock,
  CreditCard,
  RefreshCw,
  ShieldCheck,
  Star,
  TrendingUp,
  UserCheck,
  UserMinus,
  Users,
  Zap,
} from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import type { CustomerDashboardData } from '@/modules/contacts/actions/contact.analytics'
import LineChart from '../_components/LineChart'

const RFM_META: Record<string, { badge: string; dot: string; desc: string }> = {
  Champions: { badge: 'bg-amber-100 text-amber-800 border-amber-200',   dot: 'bg-amber-500',   desc: 'Beli sering, baru, nilai tinggi' },
  Loyal:     { badge: 'bg-blue-100 text-blue-800 border-blue-200',      dot: 'bg-blue-500',    desc: 'Beli rutin, nilai konsisten' },
  Potential: { badge: 'bg-violet-100 text-violet-800 border-violet-200',dot: 'bg-violet-500',  desc: 'Potensi besar, perlu nurturing' },
  'At Risk': { badge: 'bg-rose-100 text-rose-800 border-rose-200',      dot: 'bg-rose-500',    desc: 'Mulai menjauh, perlu follow-up' },
  Lost:      { badge: 'bg-slate-100 text-slate-500 border-slate-200',   dot: 'bg-slate-400',   desc: 'Tidak aktif > 6 bulan' },
  Others:    { badge: 'bg-slate-100 text-slate-600 border-slate-200',   dot: 'bg-slate-300',   desc: 'Belum terkategori' },
}

function pct(val: number, prev: number) {
  if (prev === 0) return 0
  return Math.round(((val - prev) / prev) * 100)
}

function Delta({ current, previous, invert = false }: { current: number; previous: number; invert?: boolean }) {
  const p = pct(current, previous)
  if (p === 0 || previous === 0) return <span className="text-[11px] text-slate-400 font-medium">—</span>
  const positive = invert ? p < 0 : p > 0
  return positive
    ? <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-600"><ArrowUp size={10}/>{Math.abs(p)}%</span>
    : <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-rose-500"><ArrowDown size={10}/>{Math.abs(p)}%</span>
}

export default function CustomerDashboard({ data }: { data: CustomerDashboardData }) {
  const { hero, monthlyGrowth, retention, rfm, ar } = data

  const maxAr = Math.max(...ar.buckets.map(b => b.total), 1)

  const rfmGroups = rfm.reduce<Record<string, number>>((acc, c) => {
    acc[c.segment] = (acc[c.segment] ?? 0) + 1
    return acc
  }, {})

  const growthLabels  = monthlyGrowth.map(m => m.month_label)
  const recentLabels  = monthlyGrowth.slice(-6).map(m => m.month_label)
  const aovLabels     = retention.aovByMonth.map(m => m.month_label)
  const rvmLabels     = retention.repeatBuyersByMonth.map(m => m.month_label)

  return (
    <div className="space-y-5">

      {/* ── HERO BANNER ───────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f172a] via-[#1e3a8a] to-[#1d4ed8] p-6 md:p-8 text-white shadow-lg shadow-blue-900/20">
        <div className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-indigo-400/20 blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-white/10 backdrop-blur flex items-center justify-center">
              <Users size={15} className="text-blue-200" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-blue-200">Analitik Pelanggan</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Total Customer', value: hero.totalCustomers.toLocaleString('id'), sub: `+${hero.newThisMonth} bulan ini`, icon: Users, accent: 'text-blue-300' },
              { label: 'Revenue Bulan Ini', value: formatRupiah(hero.revenueThisMonth), sub: <Delta current={hero.revenueThisMonth} previous={hero.revenueLastMonth} />, icon: TrendingUp, accent: 'text-emerald-300' },
              { label: 'Repeat Buyer Rate', value: `${hero.repeatBuyerRate}%`, sub: `${hero.repeatBuyerCount} pelanggan loyal`, icon: RefreshCw, accent: 'text-amber-300' },
              { label: 'Avg Order Value', value: formatRupiah(hero.avgOrderValue), sub: 'Bulan berjalan', icon: BarChart2, accent: 'text-violet-300' },
              { label: 'AR Outstanding', value: formatRupiah(hero.totalArOutstanding), sub: `DSO ${hero.avgDso} hari`, icon: CreditCard, accent: hero.totalArOutstanding > 0 ? 'text-rose-300' : 'text-emerald-300' },
            ].map(card => (
              <div key={card.label} className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5">
                  <card.icon size={12} className={card.accent} />
                  <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wide">{card.label}</span>
                </div>
                <p className="text-xl md:text-2xl font-bold text-white leading-tight tracking-tight">{card.value}</p>
                <div className="text-[10px] text-white/50">{card.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── GROWTH CHARTS ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Revenue per bulan */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Revenue per Bulan</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">12 bulan terakhir</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
              <TrendingUp size={16} className="text-emerald-600" />
            </div>
          </div>
          <LineChart
            labels={growthLabels}
            series={[{ key: 'revenue', label: 'Revenue', color: '#10b981', values: monthlyGrowth.map(m => m.revenue) }]}
            height={160}
            formatValue={formatRupiah}
          />
        </div>

        {/* Customer baru + AOV */}
        <div className="flex flex-col gap-5">

          {/* Customer baru */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow flex-1">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Customer Baru</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Akuisisi 6 bulan terakhir</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                <UserCheck size={16} className="text-blue-600" />
              </div>
            </div>
            <LineChart
              labels={recentLabels}
              series={[{ key: 'new', label: 'Customer Baru', color: '#3b82f6', values: monthlyGrowth.slice(-6).map(m => m.new_customers) }]}
              height={100}
              formatValue={(v) => `${v} baru`}
            />
          </div>

          {/* AOV */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow flex-1">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Avg Order Value</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Tren 6 bulan terakhir</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                <BarChart2 size={16} className="text-amber-600" />
              </div>
            </div>
            <LineChart
              labels={aovLabels}
              series={[{ key: 'aov', label: 'AOV', color: '#f59e0b', values: retention.aovByMonth.map(m => m.aov) }]}
              height={100}
              formatValue={formatRupiah}
            />
          </div>
        </div>
      </div>

      {/* ── NEW vs REPEAT + AT RISK ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* New vs Repeat — span 2 */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-slate-800">New vs Repeat Buyer</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Tren pembeli baru vs kembali — 6 bulan terakhir</p>
            </div>
            <div className="flex gap-3 text-[10px] font-semibold">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block"/>Baru</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block"/>Repeat</span>
            </div>
          </div>
          {retention.repeatBuyersByMonth.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Belum ada data.</p>
          ) : (
            <LineChart
              labels={rvmLabels}
              series={[
                { key: 'new',    label: 'Baru',   color: '#60a5fa', values: retention.repeatBuyersByMonth.map(m => m.new_buyers) },
                { key: 'repeat', label: 'Repeat', color: '#4f46e5', values: retention.repeatBuyersByMonth.map(m => m.repeat_buyers) },
              ]}
              height={160}
              formatValue={(v) => `${v} pembeli`}
            />
          )}
        </div>

        {/* At Risk */}
        <div className="bg-white rounded-2xl border border-rose-100 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Customer Berisiko</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Tidak beli ≥ 60 hari</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center">
              <AlertTriangle size={16} className="text-rose-500" />
            </div>
          </div>
          {retention.atRiskCustomers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <ShieldCheck size={28} className="text-emerald-400" />
              <p className="text-[11px] text-slate-400 font-medium text-center">Semua customer masih aktif</p>
            </div>
          ) : (
            <div className="space-y-2">
              {retention.atRiskCustomers.slice(0, 5).map(c => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <UserMinus size={12} className="text-rose-400 shrink-0" />
                    <span className="text-[11px] font-semibold text-slate-700 truncate">{c.name}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-2 ${c.days_since > 120 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                    {c.days_since}h
                  </span>
                </div>
              ))}
              {retention.atRiskCustomers.length > 5 && (
                <p className="text-[10px] text-slate-400 pt-1">+{retention.atRiskCustomers.length - 5} lainnya</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── RFM SEGMENTATION ────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Segmentasi RFM</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Recency · Frequency · Monetary — klasifikasi otomatis per pelanggan</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
            <Zap size={16} className="text-amber-600" />
          </div>
        </div>

        {/* Segment chips */}
        <div className="flex flex-wrap gap-2 mb-6">
          {Object.entries(rfmGroups).sort((a, b) => b[1] - a[1]).map(([seg, count]) => {
            const m = RFM_META[seg] ?? RFM_META['Others']
            return (
              <div key={seg} className={`flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-full border text-[11px] font-semibold ${m.badge}`}>
                <div className={`w-2 h-2 rounded-full ${m.dot}`} />
                <span>{seg}</span>
                <span className="font-bold opacity-60">({count})</span>
              </div>
            )
          })}
        </div>

        {rfm.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  {['#', 'Pelanggan', 'Segmen', 'Recency', 'Frekuensi', 'Monetary', 'Skor R·F·M'].map(h => (
                    <th key={h} className="text-left py-2.5 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rfm.map((c, i) => {
                  const m = RFM_META[c.segment] ?? RFM_META['Others']
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/60 transition-colors group">
                      <td className="py-3 px-4 text-[10px] font-bold text-slate-300">{i + 1}</td>
                      <td className="py-3 px-4 text-[12px] font-semibold text-slate-800 max-w-[160px] truncate">{c.name}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold ${m.badge}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />{c.segment}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[12px] text-slate-600">{c.recency_days >= 999 ? '—' : `${c.recency_days} hari`}</td>
                      <td className="py-3 px-4 text-[12px] text-slate-600">{c.frequency}×</td>
                      <td className="py-3 px-4 text-[12px] font-bold text-slate-800">{formatRupiah(c.monetary)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-0.5">
                          {[c.r_score, c.f_score, c.m_score].map((score, si) => (
                            <div key={si} className="flex gap-0.5 mr-1.5">
                              {[1,2,3,4,5].map(n => (
                                <div key={n} className={`w-1.5 h-1.5 rounded-full ${n <= score
                                  ? si === 0 ? 'bg-blue-500' : si === 1 ? 'bg-emerald-500' : 'bg-amber-500'
                                  : 'bg-slate-200'}`} />
                              ))}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic text-center py-8">Belum ada data transaksi untuk RFM.</p>
        )}
      </div>

      {/* ── AR AGING ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Aging buckets */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-slate-800">AR Aging</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Distribusi umur piutang · DSO rata-rata {ar.dso} hari</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center">
              <Clock size={16} className="text-rose-600" />
            </div>
          </div>

          {/* Total badge */}
          <div className="mb-5 flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Total Outstanding</p>
              <p className="text-xl font-bold text-slate-800">{formatRupiah(ar.totalOutstanding)}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Jumlah Invoice</p>
              <p className="text-xl font-bold text-slate-800">{ar.invoiceCount}</p>
            </div>
          </div>

          {ar.buckets.length === 0 ? (
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600 py-4">
              <Star size={16} /> Tidak ada piutang outstanding
            </div>
          ) : (
            <div className="space-y-3">
              {ar.buckets.map(b => {
                const color = b.label.startsWith('>') ? 'from-rose-500 to-rose-600'
                  : b.label.startsWith('30') ? 'from-amber-400 to-amber-500'
                  : 'from-blue-400 to-blue-500'
                const textColor = b.label.startsWith('>') ? 'text-rose-600'
                  : b.label.startsWith('30') ? 'text-amber-600' : 'text-blue-600'
                return (
                  <div key={b.label}>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className={`text-[11px] font-bold ${textColor}`}>{b.label}</span>
                      <div className="flex gap-3 text-[11px]">
                        <span className="text-slate-400">{b.count} invoice</span>
                        <span className="font-bold text-slate-700">{formatRupiah(b.total)}</span>
                      </div>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700`}
                        style={{ width: `${Math.max((b.total / maxAr) * 100, 3)}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Top debtors */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Piutang Terbesar</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Customer dengan saldo AR tertinggi</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center">
              <CreditCard size={16} className="text-slate-500" />
            </div>
          </div>
          {ar.topDebtors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <ShieldCheck size={28} className="text-emerald-400" />
              <p className="text-[11px] text-slate-400 font-medium">Tidak ada piutang outstanding</p>
            </div>
          ) : (
            <div className="space-y-1">
              {ar.topDebtors.map((d, i) => (
                <div key={`${d.name}-${i}`} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0 group hover:bg-slate-50 -mx-2 px-2 rounded-lg transition-colors">
                  <span className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${i === 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>{i + 1}</span>
                  <span className="flex-1 text-[12px] font-semibold text-slate-700 truncate">{d.name}</span>
                  <span className="text-[10px] text-slate-400 shrink-0">{d.oldest_days} hari</span>
                  <span className="text-[12px] font-bold text-rose-600 shrink-0">{formatRupiah(d.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
