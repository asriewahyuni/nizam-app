'use client'

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart2,
  Building2,
  CheckCircle2,
  Clock,
  Minus,
  Package,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Truck,
  XCircle,
} from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import type { VendorDashboardData } from '@/modules/contacts/actions/contact.analytics'

function GrowthBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) return <span className="flex items-center gap-0.5 text-[10px] font-bold text-slate-400"><Minus size={10} />0%</span>
  return pct > 0
    ? <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-600"><ArrowUp size={10} />{pct}%</span>
    : <span className="flex items-center gap-0.5 text-[10px] font-bold text-rose-500"><ArrowDown size={10} />{Math.abs(pct)}%</span>
}

function MiniBar({ value, max, color = 'bg-emerald-500' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.max((value / max) * 100, 2) : 2
  return (
    <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function SectionTitle({ icon: Icon, title, subtitle, color = 'text-emerald-600' }: {
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

// Warna untuk concentration risk chart
const CONCENTRATION_COLORS = [
  'bg-emerald-500', 'bg-teal-400', 'bg-cyan-400', 'bg-blue-400',
  'bg-indigo-400', 'bg-violet-400', 'bg-slate-300', 'bg-slate-200',
]

export default function VendorDashboard({ data }: { data: VendorDashboardData }) {
  const { hero, monthlyGrowth, concentration, apAging, spendCategories, topVendors, dpoStats } = data

  const maxSpend   = Math.max(...monthlyGrowth.map(m => m.total_spend), 1)
  const maxNewV    = Math.max(...monthlyGrowth.map(m => m.new_vendors), 1)
  const maxTopV    = Math.max(...topVendors.map(v => v.total), 1)
  const maxSpendCat = Math.max(...spendCategories.map(s => s.total_spend), 1)
  const totalConc  = concentration.reduce((s, v) => s + v.spend, 0) || 1

  return (
    <div className="space-y-6">

      {/* ── HERO STATS ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          {
            label: 'Total Vendor Aktif', value: hero.totalVendors, icon: Building2,
            sub: <span className="text-[10px] text-slate-400">+{hero.newThisMonth} bulan ini</span>,
            light: 'bg-emerald-50 text-emerald-600',
          },
          {
            label: 'Pembelian Bulan Ini', value: formatRupiah(hero.totalPurchasesThisMonth), icon: ShoppingCart,
            sub: <GrowthBadge current={hero.totalPurchasesThisMonth} previous={hero.totalPurchasesLastMonth} />,
            light: 'bg-teal-50 text-teal-600',
          },
          {
            label: 'AP Outstanding', value: formatRupiah(hero.totalApOutstanding), icon: TrendingDown,
            sub: <span className="text-[10px] text-slate-400">DPO rata-rata {dpoStats.avg_dpo} hari</span>,
            light: 'bg-rose-50 text-rose-600',
          },
          {
            label: 'PO Aktif', value: `${hero.totalActivePo} PO`, icon: Truck,
            sub: <span className="text-[10px] text-slate-400">Sedang berjalan</span>,
            light: 'bg-blue-50 text-blue-600',
          },
          {
            label: 'On-Time Payment', value: `${hero.onTimePaymentRate}%`, icon: CheckCircle2,
            sub: <span className={`text-[10px] font-semibold ${hero.overdueCount > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
              {hero.overdueCount > 0 ? `${hero.overdueCount} overdue` : 'Semua tepat waktu'}
            </span>,
            light: hero.onTimePaymentRate >= 80 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600',
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

      {/* ── PERTUMBUHAN SPEND + VENDOR BARU ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Total spend per bulan */}
        <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
          <SectionTitle icon={TrendingUp} title="Total Pembelian per Bulan" subtitle="12 bulan terakhir + growth MoM" />
          <div className="space-y-2">
            {monthlyGrowth.map(m => (
              <div key={m.month} className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-slate-400 w-14 shrink-0">{m.month_label}</span>
                <MiniBar value={m.total_spend} max={maxSpend} />
                <div className="shrink-0 flex items-center gap-1.5 min-w-[140px] justify-end">
                  <span className="text-[11px] font-bold text-slate-700">{formatRupiah(m.total_spend)}</span>
                  {m.prev_spend !== null && <GrowthBadge current={m.total_spend} previous={m.prev_spend} />}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Vendor baru per bulan */}
        <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
          <SectionTitle icon={Building2} title="Vendor Baru per Bulan" subtitle="12 bulan terakhir" />
          <div className="space-y-2">
            {monthlyGrowth.map(m => (
              <div key={m.month} className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-slate-400 w-14 shrink-0">{m.month_label}</span>
                <MiniBar value={m.new_vendors} max={maxNewV} color="bg-teal-400" />
                <div className="shrink-0 flex items-center gap-2 min-w-[100px] justify-end">
                  <span className="text-[11px] font-bold text-slate-700">{m.new_vendors} vendor</span>
                  <span className="text-[10px] text-slate-400">{m.po_count} PO</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── EFISIENSI: CONCENTRATION RISK + DPO ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Vendor Concentration Risk */}
        <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
          <SectionTitle icon={AlertTriangle} title="Konsentrasi Vendor (Risiko)" subtitle="% total spend per vendor — >30% = risiko ketergantungan" color="text-amber-600" />
          {concentration.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Belum ada data pembelian.</p>
          ) : (
            <>
              {/* Stacked bar */}
              <div className="flex h-6 rounded-xl overflow-hidden mb-4 gap-0.5">
                {concentration.map((v, i) => (
                  <div
                    key={`${v.name}-${i}`}
                    className={`${CONCENTRATION_COLORS[i] ?? 'bg-slate-200'} h-full transition-all`}
                    style={{ width: `${(v.spend / totalConc) * 100}%` }}
                    title={`${v.name}: ${v.pct}%`}
                  />
                ))}
              </div>
              <div className="space-y-2">
                {concentration.map((v, i) => (
                  <div key={`${v.name}-row-${i}`} className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${CONCENTRATION_COLORS[i] ?? 'bg-slate-200'}`} />
                    <span className="flex-1 text-[11px] font-semibold text-slate-700 truncate">{v.name}</span>
                    <span className={`text-[11px] font-bold shrink-0 ${v.pct >= 30 ? 'text-rose-600' : 'text-slate-600'}`}>{v.pct}%</span>
                    <span className="text-[10px] text-slate-400 shrink-0 w-28 text-right">{formatRupiah(v.spend)}</span>
                  </div>
                ))}
              </div>
              {concentration[0]?.pct >= 30 && (
                <div className="mt-4 flex items-center gap-2 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  <AlertTriangle size={12} /> {concentration[0].name} mendominasi {concentration[0].pct}% pembelian
                </div>
              )}
            </>
          )}
        </div>

        {/* DPO + On-time */}
        <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
          <SectionTitle icon={Clock} title="Efisiensi Pembayaran Vendor" subtitle="DPO, on-time rate, dan invoice overdue" color="text-blue-600" />
          <div className="grid grid-cols-2 gap-3 mb-5">
            {[
              { label: 'DPO Rata-rata', value: `${dpoStats.avg_dpo} hari`, sub: 'Jangka kredit rata-rata', color: 'bg-blue-50 text-blue-700' },
              { label: 'Median Jangka Kredit', value: `${dpoStats.median_credit_days} hari`, sub: 'Median dari semua PO', color: 'bg-indigo-50 text-indigo-700' },
              {
                label: 'On-Time Payment Rate', value: `${hero.onTimePaymentRate}%`, sub: '6 bulan terakhir',
                color: hero.onTimePaymentRate >= 80 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              },
              {
                label: 'Total Overdue', value: formatRupiah(hero.overdueAmount), sub: `${hero.overdueCount} invoice terlambat`,
                color: hero.overdueCount > 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
              },
            ].map(s => (
              <div key={s.label} className={`rounded-xl p-4 ${s.color}`}>
                <p className="text-[9px] font-bold uppercase tracking-wider opacity-60 mb-1">{s.label}</p>
                <p className="text-base font-bold">{s.value}</p>
                <p className="text-[9px] opacity-60 mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* On-time gauge */}
          <div>
            <div className="flex justify-between text-[10px] font-semibold text-slate-500 mb-1">
              <span>Tingkat Pembayaran Tepat Waktu</span>
              <span>{hero.onTimePaymentRate}%</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${hero.onTimePaymentRate >= 80 ? 'bg-emerald-500' : hero.onTimePaymentRate >= 50 ? 'bg-amber-400' : 'bg-rose-500'}`}
                style={{ width: `${hero.onTimePaymentRate}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-slate-400 mt-1">
              <span>Buruk</span><span>Cukup</span><span>Baik</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── AP AGING ────────────────────────────────────────────────────── */}
      {apAging.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
          <SectionTitle icon={Clock} title="AP Aging per Vendor" subtitle="Hutang outstanding dibagi per umur tagihan" color="text-rose-600" />
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Vendor', '0–30 hari', '30–60 hari', '>60 hari', 'Total Outstanding'].map(h => (
                    <th key={h} className="text-left py-2 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {apAging.map((row, i) => (
                  <tr key={`${row.vendor_name}-${i}`} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-700 truncate max-w-[160px]">{row.vendor_name}</td>
                    <td className="py-2.5 px-3 text-blue-600">{row.bucket_0_30 > 0 ? formatRupiah(row.bucket_0_30) : '—'}</td>
                    <td className="py-2.5 px-3 text-amber-600">{row.bucket_30_60 > 0 ? formatRupiah(row.bucket_30_60) : '—'}</td>
                    <td className="py-2.5 px-3 text-rose-600 font-bold">{row.bucket_over_60 > 0 ? formatRupiah(row.bucket_over_60) : '—'}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-800">{formatRupiah(row.total_outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TOP VENDORS + SPEND CATEGORIES ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Top vendors */}
        <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
          <SectionTitle icon={Building2} title="Top Vendor by Spend" subtitle="Nilai total pembelian tertinggi" />
          {topVendors.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Belum ada data.</p>
          ) : (
            <div className="space-y-2.5">
              {topVendors.map((v, i) => (
                <div key={`${v.name}-${i}`} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold text-slate-700 truncate">{v.name}</span>
                      <div className="flex gap-2 shrink-0 ml-2">
                        <span className="text-[10px] text-slate-400">{v.po_count}x PO</span>
                        <span className="text-[10px] text-slate-400">avg {formatRupiah(v.avg_po)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <MiniBar value={v.total} max={maxTopV} />
                      <span className="text-[11px] font-bold text-emerald-600 shrink-0">{formatRupiah(v.total)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Spend categories */}
        <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
          <SectionTitle icon={Package} title="Kategori Pembelian Terbesar" subtitle="Berdasarkan deskripsi item dari purchase orders" color="text-indigo-600" />
          {spendCategories.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Belum ada item pembelian.</p>
          ) : (
            <div className="space-y-2.5">
              {spendCategories.map((s, i) => (
                <div key={`${s.description}-${i}`} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[9px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold text-slate-700 truncate">{s.description}</span>
                      <span className="text-[10px] text-slate-400 shrink-0 ml-2">{s.order_count}x order</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MiniBar value={s.total_spend} max={maxSpendCat} color="bg-indigo-400" />
                      <span className="text-[11px] font-bold text-indigo-600 shrink-0">{formatRupiah(s.total_spend)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── OVERDUE WARNING ─────────────────────────────────────────────── */}
      {hero.overdueCount > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
            <XCircle size={18} />
          </div>
          <div>
            <p className="text-sm font-bold text-rose-800">Perhatian: {hero.overdueCount} PO Melewati Jatuh Tempo</p>
            <p className="text-[11px] text-rose-600 mt-1">
              Total hutang overdue senilai <span className="font-bold">{formatRupiah(hero.overdueAmount)}</span>. Segera lakukan pembayaran untuk menjaga kepercayaan vendor.
            </p>
          </div>
        </div>
      )}

    </div>
  )
}
