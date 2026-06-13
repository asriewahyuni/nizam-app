'use client'

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Building2,
  CheckCircle2,
  Clock,
  Minus,
  Package,
  ShieldCheck,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Truck,
  XCircle,
} from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import type { VendorDashboardData } from '@/modules/contacts/actions/contact.analytics'

const CONC_COLORS = [
  { bar: 'bg-emerald-500', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  { bar: 'bg-teal-500',    dot: 'bg-teal-400',    text: 'text-teal-700'    },
  { bar: 'bg-cyan-500',    dot: 'bg-cyan-400',     text: 'text-cyan-700'    },
  { bar: 'bg-blue-500',    dot: 'bg-blue-400',     text: 'text-blue-700'    },
  { bar: 'bg-indigo-500',  dot: 'bg-indigo-400',   text: 'text-indigo-700'  },
  { bar: 'bg-violet-500',  dot: 'bg-violet-400',   text: 'text-violet-700'  },
  { bar: 'bg-slate-400',   dot: 'bg-slate-400',    text: 'text-slate-600'   },
  { bar: 'bg-slate-300',   dot: 'bg-slate-300',    text: 'text-slate-500'   },
]

function Delta({ current, previous, invert = false }: { current: number; previous: number; invert?: boolean }) {
  if (previous === 0) return <span className="text-[11px] text-slate-400 font-medium">—</span>
  const p = Math.round(((current - previous) / previous) * 100)
  if (p === 0) return <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-slate-400"><Minus size={10}/>0%</span>
  const positive = invert ? p < 0 : p > 0
  return positive
    ? <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-600"><ArrowUp size={10}/>{Math.abs(p)}%</span>
    : <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-rose-500"><ArrowDown size={10}/>{Math.abs(p)}%</span>
}

function Bar({ value, max, className = 'bg-emerald-500' }: { value: number; max: number; className?: string }) {
  const w = max > 0 ? Math.max((value / max) * 100, 2) : 2
  return (
    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${className} transition-all duration-500`} style={{ width: `${w}%` }} />
    </div>
  )
}

export default function VendorDashboard({ data }: { data: VendorDashboardData }) {
  const { hero, monthlyGrowth, concentration, apAging, spendCategories, topVendors, dpoStats } = data

  const maxSpend   = Math.max(...monthlyGrowth.map(m => m.total_spend), 1)
  const maxNewV    = Math.max(...monthlyGrowth.map(m => m.new_vendors), 1)
  const maxTopV    = Math.max(...topVendors.map(v => v.total), 1)
  const maxCatSpend = Math.max(...spendCategories.map(s => s.total_spend), 1)
  const totalConc  = concentration.reduce((s, v) => s + v.spend, 0) || 1

  return (
    <div className="space-y-5">

      {/* ── HERO BANNER ───────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#052e16] via-[#065f46] to-[#059669] p-6 md:p-8 text-white shadow-lg shadow-emerald-900/20">
        <div className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-teal-300/20 blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-white/10 backdrop-blur flex items-center justify-center">
              <Building2 size={15} className="text-emerald-200" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-emerald-200">Analitik Vendor</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Total Vendor', value: hero.totalVendors.toLocaleString('id'), sub: `+${hero.newThisMonth} bulan ini`, icon: Building2, accent: 'text-emerald-300' },
              { label: 'Pembelian Bulan Ini', value: formatRupiah(hero.totalPurchasesThisMonth), sub: <Delta current={hero.totalPurchasesThisMonth} previous={hero.totalPurchasesLastMonth} />, icon: ShoppingCart, accent: 'text-teal-300' },
              { label: 'AP Outstanding', value: formatRupiah(hero.totalApOutstanding), sub: `DPO ${dpoStats.avg_dpo} hari`, icon: TrendingDown, accent: hero.totalApOutstanding > 0 ? 'text-rose-300' : 'text-emerald-300' },
              { label: 'PO Aktif', value: `${hero.totalActivePo}`, sub: 'Purchase order berjalan', icon: Truck, accent: 'text-cyan-300' },
              { label: 'On-Time Payment', value: `${hero.onTimePaymentRate}%`, sub: hero.overdueCount > 0 ? `${hero.overdueCount} overdue` : 'Semua tepat waktu', icon: CheckCircle2, accent: hero.onTimePaymentRate >= 80 ? 'text-emerald-300' : 'text-amber-300' },
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

        {/* Spend per bulan */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Total Pembelian per Bulan</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">12 bulan terakhir</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
              <TrendingUp size={16} className="text-emerald-600" />
            </div>
          </div>
          <div className="space-y-2.5">
            {monthlyGrowth.map(m => (
              <div key={m.month} className="flex items-center gap-3">
                <span className="text-[10px] font-semibold text-slate-400 w-12 shrink-0">{m.month_label}</span>
                <Bar value={m.total_spend} max={maxSpend} className="bg-gradient-to-r from-emerald-400 to-teal-500" />
                <div className="flex items-center gap-2 shrink-0 min-w-[140px] justify-end">
                  <span className="text-[11px] font-bold text-slate-700">{formatRupiah(m.total_spend)}</span>
                  {m.prev_spend !== null && <Delta current={m.total_spend} previous={m.prev_spend} />}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Vendor baru + PO count */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Vendor Baru &amp; Volume PO</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">12 bulan terakhir</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center">
              <Building2 size={16} className="text-teal-600" />
            </div>
          </div>
          <div className="space-y-2.5">
            {monthlyGrowth.map(m => (
              <div key={m.month} className="flex items-center gap-3">
                <span className="text-[10px] font-semibold text-slate-400 w-12 shrink-0">{m.month_label}</span>
                <Bar value={m.new_vendors} max={maxNewV} className="bg-gradient-to-r from-teal-400 to-cyan-500" />
                <div className="flex items-center gap-2 shrink-0 min-w-[110px] justify-end">
                  <span className="text-[11px] font-bold text-slate-700">{m.new_vendors} vendor</span>
                  <span className="text-[10px] text-slate-400">{m.po_count} PO</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CONCENTRATION RISK + EFFICIENCY ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Concentration Risk */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Konsentrasi Vendor</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">% total spend — &gt;30% = risiko ketergantungan</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
              <AlertTriangle size={16} className="text-amber-600" />
            </div>
          </div>
          {concentration.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Belum ada data pembelian.</p>
          ) : (
            <>
              {/* Stacked bar */}
              <div className="flex h-5 rounded-full overflow-hidden mb-4 gap-px">
                {concentration.map((v, i) => {
                  const c = CONC_COLORS[i] ?? CONC_COLORS[CONC_COLORS.length - 1]
                  return (
                    <div key={`${v.name}-bar`} className={`${c.bar} h-full transition-all`}
                      style={{ width: `${(v.spend / totalConc) * 100}%` }}
                      title={`${v.name}: ${v.pct}%`} />
                  )
                })}
              </div>

              <div className="space-y-2.5">
                {concentration.map((v, i) => {
                  const c = CONC_COLORS[i] ?? CONC_COLORS[CONC_COLORS.length - 1]
                  return (
                    <div key={`${v.name}-row`} className="flex items-center gap-3 group">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${c.dot}`} />
                      <span className="flex-1 text-[12px] font-semibold text-slate-700 truncate">{v.name}</span>
                      <span className={`text-[12px] font-bold shrink-0 ${v.pct >= 30 ? 'text-rose-600' : c.text}`}>{v.pct}%</span>
                      <span className="text-[11px] text-slate-400 shrink-0 w-28 text-right">{formatRupiah(v.spend)}</span>
                    </div>
                  )
                })}
              </div>

              {concentration[0]?.pct >= 30 && (
                <div className="mt-4 flex items-center gap-2 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5">
                  <AlertTriangle size={13} className="shrink-0 text-amber-600" />
                  <span><strong>{concentration[0].name}</strong> mendominasi {concentration[0].pct}% dari total spend</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Payment Efficiency */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Efisiensi Pembayaran</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">DPO, on-time rate, dan overdue</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <Clock size={16} className="text-blue-600" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-5">
            {[
              { label: 'DPO Rata-rata', value: `${dpoStats.avg_dpo} hari`, bg: 'bg-blue-50 text-blue-800' },
              { label: 'Median Kredit', value: `${dpoStats.median_credit_days} hari`, bg: 'bg-indigo-50 text-indigo-800' },
              { label: 'On-Time Rate', value: `${hero.onTimePaymentRate}%`, bg: hero.onTimePaymentRate >= 80 ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800' },
              { label: 'Total Overdue', value: formatRupiah(hero.overdueAmount), bg: hero.overdueCount > 0 ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800' },
            ].map(s => (
              <div key={s.label} className={`rounded-xl px-4 py-3 ${s.bg}`}>
                <p className="text-[9px] font-bold uppercase tracking-widest opacity-50 mb-1">{s.label}</p>
                <p className="text-base font-bold leading-tight">{s.value}</p>
              </div>
            ))}
          </div>

          {/* On-time gauge */}
          <div>
            <div className="flex justify-between text-[10px] font-semibold text-slate-500 mb-2">
              <span>On-Time Payment Rate (6 bulan)</span>
              <span className="font-bold">{hero.onTimePaymentRate}%</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${hero.onTimePaymentRate >= 80 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : hero.onTimePaymentRate >= 50 ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-rose-400 to-rose-500'}`}
                style={{ width: `${hero.onTimePaymentRate}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-slate-300 mt-1 px-0.5">
              <span>0%</span><span>50%</span><span>100%</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── AP AGING TABLE ──────────────────────────────────────────────── */}
      {apAging.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-slate-800">AP Aging per Vendor</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Hutang outstanding dibagi berdasarkan umur tagihan</p>
            </div>
            <div className="flex gap-3 text-[10px] font-semibold">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block"/>0–30h</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"/>30–60h</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block"/>&gt;60h</span>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  {['Vendor', '0–30 hari', '30–60 hari', '>60 hari', 'Total'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {apAging.map((row, i) => (
                  <tr key={`${row.vendor_name}-${i}`} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 text-[12px] font-semibold text-slate-800 max-w-[180px] truncate">{row.vendor_name}</td>
                    <td className="py-3 px-4 text-[12px] text-blue-600 font-medium">{row.bucket_0_30 > 0 ? formatRupiah(row.bucket_0_30) : <span className="text-slate-300">—</span>}</td>
                    <td className="py-3 px-4 text-[12px] text-amber-600 font-medium">{row.bucket_30_60 > 0 ? formatRupiah(row.bucket_30_60) : <span className="text-slate-300">—</span>}</td>
                    <td className="py-3 px-4 text-[12px] text-rose-600 font-bold">{row.bucket_over_60 > 0 ? formatRupiah(row.bucket_over_60) : <span className="text-slate-300">—</span>}</td>
                    <td className="py-3 px-4 text-[12px] font-bold text-slate-800">{formatRupiah(row.total_outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TOP VENDORS + SPEND CATEGORIES ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Top Vendors */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Top Vendor by Spend</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Nilai pembelian + frekuensi PO</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Building2 size={16} className="text-emerald-600" />
            </div>
          </div>
          {topVendors.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Belum ada data.</p>
          ) : (
            <div className="space-y-3">
              {topVendors.map((v, i) => (
                <div key={`${v.name}-${i}`} className="group">
                  <div className="flex items-center gap-3 mb-1.5">
                    <span className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${i === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{i + 1}</span>
                    <span className="flex-1 text-[12px] font-semibold text-slate-700 truncate">{v.name}</span>
                    <div className="text-right shrink-0">
                      <span className="text-[12px] font-bold text-emerald-600">{formatRupiah(v.total)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pl-9">
                    <Bar value={v.total} max={maxTopV} className="bg-gradient-to-r from-emerald-400 to-teal-500" />
                    <div className="flex gap-2 text-[10px] text-slate-400 shrink-0">
                      <span>{v.po_count}× PO</span>
                      <span>avg {formatRupiah(v.avg_po)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Spend Categories */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Kategori Pembelian</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Item terbesar dari purchase orders</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Package size={16} className="text-indigo-600" />
            </div>
          </div>
          {spendCategories.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Belum ada item pembelian.</p>
          ) : (
            <div className="space-y-3">
              {spendCategories.map((s, i) => (
                <div key={`${s.description}-${i}`} className="group">
                  <div className="flex items-center gap-3 mb-1.5">
                    <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <span className="flex-1 text-[12px] font-semibold text-slate-700 truncate">{s.description}</span>
                    <span className="text-[12px] font-bold text-indigo-600 shrink-0">{formatRupiah(s.total_spend)}</span>
                  </div>
                  <div className="flex items-center gap-3 pl-9">
                    <Bar value={s.total_spend} max={maxCatSpend} className="bg-gradient-to-r from-indigo-400 to-violet-500" />
                    <span className="text-[10px] text-slate-400 shrink-0">{s.order_count}× order</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── OVERDUE ALERT ───────────────────────────────────────────────── */}
      {hero.overdueCount > 0 && (
        <div className="flex items-start gap-4 rounded-2xl border border-rose-200 bg-rose-50 p-5">
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
            <XCircle size={18} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-rose-800">{hero.overdueCount} Purchase Order Melewati Jatuh Tempo</p>
            <p className="text-[11px] text-rose-600 mt-1">
              Total hutang overdue: <strong>{formatRupiah(hero.overdueAmount)}</strong>. Segera lakukan pembayaran untuk menjaga reputasi dan kepercayaan vendor.
            </p>
          </div>
          <ShieldCheck size={16} className="text-rose-300 shrink-0 mt-0.5" />
        </div>
      )}

    </div>
  )
}
