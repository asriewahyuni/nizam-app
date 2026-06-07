'use client'

import { useState, useMemo, useCallback } from 'react'
import { Activity, AlertTriangle, CheckCircle2, MousePointerClick, Zap, Printer, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type BlockKey =
  | 'kepatuhan' | 'man' | 'resource' | 'rd' | 'produksi' | 'produk'
  | 'cr' | 'channel' | 'komplain' | 'sales' | 'money' | 'revenue'
  | 'muhasabah' | 'risiko'

type BlockStatus = 'ok' | 'warn' | 'bad' | 'na'

type BlockDef = {
  name: string
  layer: string
  desc: string
  kpis: { name: string }[]
  issues: { bad: string[]; warn: string[] }
  recs: { bad: string[]; warn: string[] }
}

type BlockState = {
  kpis: (number | null)[]
  override: 'ok' | 'warn' | 'bad' | null
}

export type NizamData = {
  financial: {
    currentRevenue: number; currentExpenses: number; netProfit: number
    profitMargin: number; revenueGrowth: number; lastRevenue: number
  }
  customer: { mtdSales: number; totalOrders: number; uniqueCustomers: number }
  internal: {
    pendingPurchases: number; pendingSales: number; totalAssets: number
    overdueDepreciation: number; processHealth: number
  }
  learning: { activeEmployees: number; payrollRunsCompleted: number; hrCompletionRate: number }
}

type AutoSource = { label: string; compute: (d: NizamData) => number | null }

type SvgBlockDef = {
  key: BlockKey
  shape: 'rect' | 'polygon'
  x?: number; y?: number; w?: number; h?: number
  points?: string
  labelX: number; labelY: number
  nameX: number; nameY: number
  indX: number; indY: number
  avgX: number; avgY: number
}

// ─── Block Definitions ────────────────────────────────────────────────────────

const ALL_KEYS: BlockKey[] = [
  'kepatuhan', 'man', 'resource', 'rd', 'produksi', 'produk',
  'cr', 'channel', 'komplain', 'sales', 'money', 'revenue',
  'muhasabah', 'risiko',
]

// SVG_KEYS = all blocks rendered inside the SVG (muhasabah/risiko are HTML below)
const SVG_KEYS: BlockKey[] = [
  'kepatuhan', 'man', 'rd', 'produk', 'cr', 'komplain',
  'resource', 'produksi', 'channel', 'sales', 'money', 'revenue',
]

const BLOCKS: Record<BlockKey, BlockDef> = {
  kepatuhan: {
    name: 'Kepatuhan Syariat', layer: 'FOUNDATION',
    desc: 'Landasan nilai yang memastikan setiap aktivitas bisnis sesuai prinsip syariat Islam.',
    kpis: [{ name: 'Transaksi bebas riba (%)' }, { name: 'Audit syariat dilakukan (%)' }, { name: 'Produk halal tersertifikasi (%)' }],
    issues: { bad: ['Terdapat transaksi mengandung riba', 'Audit syariat tidak rutin dilakukan'], warn: ['Beberapa produk belum bersertifikat halal', 'Dokumentasi kepatuhan belum lengkap'] },
    recs:   { bad: ['Lakukan audit syariat menyeluruh segera', 'Konsultasikan dengan dewan pengawas syariat'], warn: ['Jadwalkan audit syariat bulanan', 'Proses sertifikasi halal produk prioritas'] },
  },
  man: {
    name: 'Man', layer: 'PEOPLE',
    desc: 'Kapasitas dan kompetensi SDM sebagai penggerak utama bisnis.',
    kpis: [{ name: 'Retensi karyawan (%)' }, { name: 'Produktivitas per karyawan' }, { name: 'Pelatihan terpenuhi (%)' }],
    issues: { bad: ['Turnover karyawan sangat tinggi', 'Kekurangan tenaga ahli di posisi kritis'], warn: ['Program pelatihan belum optimal', 'Beberapa jabatan kunci kurang terisi'] },
    recs:   { bad: ['Exit interview dan identifikasi penyebab turnover', 'Rekrut segera untuk posisi kritis'], warn: ['Jadwalkan pelatihan berkala untuk semua tim', 'Review kompensasi agar kompetitif'] },
  },
  resource: {
    name: 'Resource', layer: 'ASSET',
    desc: 'Ketersediaan dan efisiensi penggunaan sumber daya fisik dan finansial.',
    kpis: [{ name: 'Utilisasi aset tetap (%)' }, { name: 'Efisiensi penggunaan modal (%)' }, { name: 'Kelancaran rantai pasok (%)' }],
    issues: { bad: ['Aset tidak digunakan optimal', 'Modal kerja tidak mencukupi operasional'], warn: ['Beberapa aset mendekati akhir masa pakai', 'Rantai pasok mengalami hambatan minor'] },
    recs:   { bad: ['Evaluasi dan optimalkan penggunaan aset', 'Cari tambahan sumber pembiayaan'], warn: ['Rencanakan penggantian aset tepat waktu', 'Diversifikasi pemasok untuk kurangi risiko'] },
  },
  rd: {
    name: 'R&D', layer: 'INNOVATION',
    desc: 'Inovasi dan pengembangan produk untuk menjaga relevansi bisnis di pasar.',
    kpis: [{ name: 'Produk baru per kuartal (unit)' }, { name: 'Investasi R&D/revenue (%)' }, { name: 'Adopsi produk baru (%)' }],
    issues: { bad: ['Tidak ada produk baru dalam 2 kuartal', 'Anggaran R&D sangat minim'], warn: ['Pipeline inovasi masih lemah', 'Adopsi produk baru di bawah ekspektasi'] },
    recs:   { bad: ['Alokasikan anggaran khusus R&D', 'Bentuk tim inovasi dedicated'], warn: ['Review roadmap produk dan percepat pengembangan', 'Riset pasar untuk memahami kebutuhan pelanggan'] },
  },
  produksi: {
    name: 'Produksi', layer: 'OPERATIONS',
    desc: 'Kapasitas dan efisiensi proses produksi atau operasional layanan.',
    kpis: [{ name: 'Kapasitas terpenuhi (%)' }, { name: 'Defect rate (%)' }, { name: 'On-time delivery (%)' }],
    issues: { bad: ['Kapasitas produksi jauh di bawah target', 'Tingkat cacat sangat tinggi'], warn: ['Keterlambatan pengiriman masih terjadi', 'Efisiensi produksi perlu ditingkatkan'] },
    recs:   { bad: ['Identifikasi bottleneck lini produksi', 'Implementasikan quality control ketat'], warn: ['Optimalkan jadwal produksi', 'Tingkatkan koordinasi dengan logistik'] },
  },
  produk: {
    name: 'Produk', layer: 'CORE',
    desc: 'Kualitas dan nilai produk atau layanan yang ditawarkan kepada pelanggan.',
    kpis: [{ name: 'Rating kepuasan produk' }, { name: 'Fitur vs kompetitor (%)' }, { name: 'Return/refund rate (%)' }],
    issues: { bad: ['Rating produk sangat rendah', 'Tingkat pengembalian produk tinggi'], warn: ['Fitur tertinggal dari kompetitor', 'Keluhan produk belum ditangani'] },
    recs:   { bad: ['Audit kualitas produk menyeluruh', 'Bentuk tim khusus penanganan keluhan'], warn: ['Prioritaskan fitur yang paling dibutuhkan', 'Percepat penanganan keluhan produk'] },
  },
  cr: {
    name: 'Customer Relationship', layer: 'RELATIONSHIP',
    desc: 'Kualitas hubungan dengan pelanggan sebagai fondasi pertumbuhan berkelanjutan.',
    kpis: [{ name: 'Net Promoter Score' }, { name: 'Customer retention (%)' }, { name: 'Waktu respons keluhan (jam)' }],
    issues: { bad: ['NPS negatif — banyak pelanggan tidak puas', 'Customer churn rate sangat tinggi'], warn: ['Waktu respons keluhan terlalu lama', 'Program loyalitas belum efektif'] },
    recs:   { bad: ['Survei kepuasan pelanggan segera', 'Terapkan program pemulihan pelanggan'], warn: ['Percepat waktu respons customer service', 'Redesign program loyalitas'] },
  },
  channel: {
    name: 'Channel', layer: 'DISTRIBUTION',
    desc: 'Efektivitas saluran distribusi dalam menjangkau dan melayani pelanggan target.',
    kpis: [{ name: 'Saluran distribusi aktif (unit)' }, { name: 'Konversi channel ke penjualan (%)' }, { name: 'Efisiensi biaya akuisisi' }],
    issues: { bad: ['Saluran distribusi utama tidak optimal', 'Konversi dari channel sangat rendah'], warn: ['Biaya akuisisi beberapa channel tinggi', 'Ada channel belum dioptimalkan'] },
    recs:   { bad: ['Audit semua channel distribusi', 'Fokus pada channel ROI tertinggi'], warn: ['Optimalkan konten di setiap channel', 'Kurangi biaya channel tidak efisien'] },
  },
  komplain: {
    name: 'Komplain', layer: 'SERVICE',
    desc: 'Sistem penanganan keluhan sebagai cermin kualitas dan komitmen layanan.',
    kpis: [{ name: 'Resolusi komplain (%)' }, { name: 'Waktu penyelesaian rata-rata (jam)' }, { name: 'Kepuasan pasca-resolusi (%)' }],
    issues: { bad: ['Banyak komplain tidak terselesaikan', 'Waktu penyelesaian sangat lama'], warn: ['Sistem tracking komplain belum optimal', 'Kepuasan pasca-resolusi di bawah standar'] },
    recs:   { bad: ['Tetapkan SLA komplain yang jelas', 'Bentuk tim dedicated penanganan komplain'], warn: ['Implementasikan sistem ticketing lebih baik', 'Pelatihan service recovery untuk tim'] },
  },
  sales: {
    name: 'Sales', layer: 'REVENUE',
    desc: 'Kinerja penjualan sebagai penggerak langsung pertumbuhan pendapatan.',
    kpis: [{ name: 'Pencapaian target penjualan (%)' }, { name: 'Konversi prospek (%)' }, { name: 'Rata-rata nilai transaksi' }],
    issues: { bad: ['Target penjualan jauh dari tercapai', 'Pipeline sales sangat tipis'], warn: ['Konversi prospek di bawah rata-rata industri', 'Nilai transaksi menurun'] },
    recs:   { bad: ['Review strategi penjualan dan target', 'Intensifkan aktivitas prospecting'], warn: ['Tingkatkan kualitas follow-up prospek', 'Fokus upselling ke pelanggan existing'] },
  },
  money: {
    name: 'Money (Cost)', layer: 'FINANCE',
    desc: 'Struktur biaya dan efisiensi pengeluaran untuk menjaga profitabilitas.',
    kpis: [{ name: 'Rasio biaya/revenue (%)' }, { name: 'Efisiensi vs anggaran (%)' }, { name: 'Penghematan terealisasi (%)' }],
    issues: { bad: ['Biaya operasional melebihi batas aman', 'Overspending di beberapa departemen'], warn: ['Beberapa pos anggaran terlampaui', 'Efisiensi biaya belum optimal'] },
    recs:   { bad: ['Cost-cutting di pos non-esensial', 'Review semua kontrak vendor'], warn: ['Tetapkan budget control lebih ketat', 'Identifikasi peluang efisiensi operasional'] },
  },
  revenue: {
    name: 'Revenue', layer: 'FINANCE',
    desc: 'Pertumbuhan pendapatan sebagai indikator utama keberhasilan bisnis.',
    kpis: [{ name: 'Pertumbuhan MoM (%)' }, { name: 'Diversifikasi sumber pendapatan (%)' }, { name: 'Recurring revenue/total (%)' }],
    issues: { bad: ['Revenue menurun signifikan', 'Ketergantungan berlebih satu sumber'], warn: ['Pertumbuhan melambat dari target', 'Recurring revenue masih rendah'] },
    recs:   { bad: ['Analisis penyebab penurunan revenue', 'Diversifikasi sumber pendapatan segera'], warn: ['Akselerasi program revenue growth', 'Kembangkan model subscription/recurring'] },
  },
  muhasabah: {
    name: 'Protokol Muhasabah', layer: 'GOVERNANCE',
    desc: 'Refleksi dan evaluasi berkala untuk perbaikan berkelanjutan bisnis.',
    kpis: [{ name: 'Muhasabah mingguan dilakukan (%)' }, { name: 'Action items terlaksana (%)' }, { name: 'Perbaikan terukur dari evaluasi (%)' }],
    issues: { bad: ['Muhasabah tidak dilakukan rutin', 'Action items evaluasi tidak ditindaklanjuti'], warn: ['Muhasabah tidak mendalam', 'Sebagian action items belum terlaksana'] },
    recs:   { bad: ['Jadwalkan muhasabah mingguan wajib', 'Tunjuk PIC setiap action item'], warn: ['Perbaiki kualitas muhasabah dengan panduan terstruktur', 'Review progress action items setiap minggu'] },
  },
  risiko: {
    name: 'Mitigasi Risiko', layer: 'GOVERNANCE',
    desc: 'Identifikasi dan pengelolaan risiko untuk menjaga keberlangsungan bisnis.',
    kpis: [{ name: 'Risk register terkini (%)' }, { name: 'Risiko kritis termitigasi (%)' }, { name: 'BCP tersedia (%)' }],
    issues: { bad: ['Risiko kritis tidak teridentifikasi', 'Tidak ada contingency plan'], warn: ['Risk register belum diupdate', 'Mitigasi beberapa risiko lemah'] },
    recs:   { bad: ['Risk assessment menyeluruh segera', 'Buat business continuity plan'], warn: ['Update risk register berkala', 'Perkuat mitigasi risiko prioritas'] },
  },
}

// Auto KPI sources mapped from Nizam ERP data
const AUTO_SOURCES: Partial<Record<BlockKey, (AutoSource | null)[]>> = {
  revenue: [
    { label: 'Pertumbuhan revenue MoM dari jurnal akuntansi', compute: (d) => Math.round(Math.min(100, Math.max(0, ((d.financial.revenueGrowth + 10) / 40) * 100))) },
    null, null,
  ],
  money: [
    {
      label: 'Rasio efisiensi biaya dari jurnal akuntansi',
      compute: (d) => {
        if (d.financial.currentRevenue <= 0) return null
        const ratio = (d.financial.currentExpenses / d.financial.currentRevenue) * 100
        return Math.round(Math.max(0, Math.min(100, 100 - ratio)))
      },
    },
    null, null,
  ],
  man:      [null, null, { label: 'HR payroll completion rate dari modul HRIS', compute: (d) => d.learning.hrCompletionRate }],
  sales:    [{ label: 'Proxy dari total orders bulan ini (modul Sales)', compute: (d) => Math.min(100, Math.round(d.customer.totalOrders * 2)) }, null, null],
  resource: [null, { label: 'Process health dari backlog purchases & sales', compute: (d) => d.internal.processHealth }, null],
  produksi: [{ label: 'Process health dari backlog purchases & sales', compute: (d) => d.internal.processHealth }, null, null],
  komplain: [null, { label: 'Backlog score dari pending orders', compute: (d) => Math.max(0, Math.round(100 - (d.internal.pendingPurchases + d.internal.pendingSales) * 5)) }, null],
}

// ─── SVG Canvas Block Definitions ─────────────────────────────────────────────
// viewBox: 0 0 1006 522
// kepatuhan: y=0–56 | main blocks: y=60–462 | money/revenue: y=466–522
// rd & cr are L-shaped polygons matching the original canvas layout exactly

const SVG_BLOCKS: SvgBlockDef[] = [
  { key: 'kepatuhan', shape: 'rect',    x: 0,   y: 0,   w: 1006, h: 56,  labelX: 14,  labelY: 17,  nameX: 14,  nameY: 34,  indX: 989, indY: 28,  avgX: 858, avgY: 36  },
  { key: 'man',       shape: 'rect',    x: 0,   y: 60,  w: 194,  h: 194, labelX: 14,  labelY: 77,  nameX: 14,  nameY: 94,  indX: 177, indY: 74,  avgX: 14,  avgY: 118 },
  { key: 'rd',        shape: 'polygon', points: '198,60 503,60 503,162 418,162 418,283 198,283',
                                                                          labelX: 212, labelY: 77,  nameX: 212, nameY: 94,  indX: 486, indY: 74,  avgX: 212, avgY: 125 },
  { key: 'produk',    shape: 'rect',    x: 422, y: 166, w: 162,  h: 294, labelX: 436, labelY: 183, nameX: 436, nameY: 200, indX: 567, indY: 180, avgX: 436, avgY: 228 },
  { key: 'cr',        shape: 'polygon', points: '503,60 808,60 808,283 588,283 588,162 503,162',
                                                                          labelX: 520, labelY: 77,  nameX: 520, nameY: 94,  indX: 791, indY: 74,  avgX: 520, avgY: 125 },
  { key: 'komplain',  shape: 'rect',    x: 812, y: 60,  w: 194,  h: 194, labelX: 826, labelY: 77,  nameX: 826, nameY: 94,  indX: 989, indY: 74,  avgX: 826, avgY: 118 },
  { key: 'resource',  shape: 'rect',    x: 0,   y: 258, w: 194,  h: 204, labelX: 14,  labelY: 275, nameX: 14,  nameY: 292, indX: 177, indY: 272, avgX: 14,  avgY: 318 },
  { key: 'produksi',  shape: 'rect',    x: 198, y: 287, w: 220,  h: 175, labelX: 212, labelY: 304, nameX: 212, nameY: 321, indX: 401, indY: 301, avgX: 212, avgY: 348 },
  { key: 'channel',   shape: 'rect',    x: 588, y: 287, w: 220,  h: 175, labelX: 602, labelY: 304, nameX: 602, nameY: 321, indX: 791, indY: 301, avgX: 602, avgY: 348 },
  { key: 'sales',     shape: 'rect',    x: 812, y: 258, w: 194,  h: 204, labelX: 826, labelY: 275, nameX: 826, nameY: 292, indX: 989, indY: 272, avgX: 826, avgY: 318 },
  { key: 'money',     shape: 'rect',    x: 0,   y: 466, w: 490,  h: 56,  labelX: 14,  labelY: 483, nameX: 14,  nameY: 500, indX: 473, indY: 480, avgX: 408, avgY: 500 },
  { key: 'revenue',   shape: 'rect',    x: 494, y: 466, w: 512,  h: 56,  labelX: 508, labelY: 483, nameX: 508, nameY: 500, indX: 989, indY: 480, avgX: 928, avgY: 500 },
]

// ─── Color / Status Helpers ───────────────────────────────────────────────────

// Layer-based card gradient (dark glass canvas — one tint per block regardless of status)
const LAYER_GRAD: Record<BlockKey, [string, string]> = {
  kepatuhan: ['rgba(167,139,250,0.22)', 'rgba(139,92,246,0.06)'],   // violet  — fondasi
  man:       ['rgba(251,146,60,0.20)',  'rgba(234,88,12,0.05)'],    // orange  — people
  resource:  ['rgba(56,189,248,0.20)',  'rgba(2,132,199,0.05)'],    // sky     — aset
  rd:        ['rgba(34,211,238,0.20)',  'rgba(6,182,212,0.05)'],    // cyan    — inovasi
  produksi:  ['rgba(251,191,36,0.20)',  'rgba(217,119,6,0.05)'],    // amber   — operasi
  produk:    ['rgba(129,140,248,0.22)', 'rgba(79,70,229,0.06)'],    // indigo  — core
  cr:        ['rgba(244,114,182,0.22)', 'rgba(219,39,119,0.06)'],   // pink    — relasi
  channel:   ['rgba(96,165,250,0.20)',  'rgba(37,99,235,0.05)'],    // blue    — distribusi
  komplain:  ['rgba(148,163,184,0.18)', 'rgba(100,116,139,0.04)'],  // slate   — servis
  sales:     ['rgba(52,211,153,0.22)',  'rgba(5,150,105,0.06)'],    // emerald — revenue
  money:     ['rgba(251,191,36,0.20)',  'rgba(180,83,9,0.05)'],     // gold    — cost
  revenue:   ['rgba(74,222,128,0.22)',  'rgba(21,128,61,0.06)'],    // green   — revenue
  muhasabah: ['rgba(196,181,253,0.20)', 'rgba(124,58,237,0.05)'],   // purple  — governance
  risiko:    ['rgba(148,163,184,0.18)', 'rgba(71,85,105,0.04)'],    // slate   — governance
}

function dotColor(s: BlockStatus): string {
  return { ok: '#34d399', warn: '#fbbf24', bad: '#f87171', na: 'rgba(255,255,255,0.25)' }[s]
}

function getLayerGrad(key: BlockKey): [string, string] {
  return LAYER_GRAD[key]
}

// Border color = status hue, opacity scaled by avg %
// bad  0→49  : opacity 0.85 (intense at 0%) → 0.28 (faint near threshold)
// warn 50→79 : opacity 0.28 (just above threshold) → 0.70 (approaching good)
// ok   80→100: opacity 0.30 (just reached good) → 0.92 (excellent)
// na          : subtle white
function getStatusStroke(st: BlockStatus, avg: number | null, isSel: boolean): string {
  const boost = isSel ? 0.18 : 0
  if (avg === null || st === 'na') {
    return isSel ? 'rgba(255,255,255,0.38)' : 'rgba(255,255,255,0.11)'
  }
  let opacity: number
  if (st === 'bad') {
    opacity = 0.85 - (avg / 49) * 0.57          // 0.85 at 0%  → 0.28 at 49%
    return `rgba(239,68,68,${Math.min(1, opacity + boost).toFixed(2)})`
  }
  if (st === 'warn') {
    opacity = 0.28 + ((avg - 50) / 29) * 0.42   // 0.28 at 50% → 0.70 at 79%
    return `rgba(245,158,11,${Math.min(1, opacity + boost).toFixed(2)})`
  }
  // ok
  opacity = 0.30 + ((avg - 80) / 20) * 0.62     // 0.30 at 80% → 0.92 at 100%
  return `rgba(16,185,129,${Math.min(1, opacity + boost).toFixed(2)})`
}

// Glow = same hue, fixed lower opacity for drop-shadow
function getStatusGlow(st: BlockStatus, avg: number | null): string {
  if (avg === null || st === 'na') return 'rgba(255,255,255,0.2)'
  const base = st === 'bad'
    ? 0.55 - (avg / 49) * 0.30                  // 0.55→0.25
    : st === 'warn'
    ? 0.25 + ((avg - 50) / 29) * 0.20           // 0.25→0.45
    : 0.25 + ((avg - 80) / 20) * 0.30           // 0.25→0.55
  if (st === 'bad')   return `rgba(239,68,68,${base.toFixed(2)})`
  if (st === 'warn')  return `rgba(245,158,11,${base.toFixed(2)})`
  return `rgba(16,185,129,${base.toFixed(2)})`
}

function getAvgColor(s: BlockStatus): string {
  // Bright on dark background
  return { ok: '#34d399', warn: '#fbbf24', bad: '#f87171', na: 'rgba(255,255,255,0.3)' }[s]
}

type StatusMeta = { badgeCls: string; avgColorCls: string; label: string; dotHex: string }

function getStatusMeta(s: BlockStatus): StatusMeta {
  switch (s) {
    case 'ok':   return { badgeCls: 'bg-emerald-50 text-emerald-600 border-emerald-100', avgColorCls: 'text-emerald-600', label: 'Sehat',           dotHex: '#34d399' }
    case 'warn': return { badgeCls: 'bg-amber-50 text-amber-600 border-amber-100',       avgColorCls: 'text-amber-600',   label: 'Perlu Perhatian', dotHex: '#fbbf24' }
    case 'bad':  return { badgeCls: 'bg-rose-50 text-rose-600 border-rose-100',          avgColorCls: 'text-rose-600',    label: 'Kritis',          dotHex: '#f87171' }
    default:     return { badgeCls: 'bg-slate-50 text-slate-500 border-slate-100',       avgColorCls: 'text-slate-400',   label: 'Belum Diisi',     dotHex: '#cbd5e1' }
  }
}

function barCls(val: number | null): string {
  if (val === null) return 'bg-slate-200'
  return val >= 80 ? 'bg-emerald-500' : val >= 50 ? 'bg-amber-400' : 'bg-rose-500'
}

// ─── Logic Helpers ────────────────────────────────────────────────────────────

function computeStatus(state: BlockState): BlockStatus {
  if (state.override) return state.override
  const vals = state.kpis.filter((v): v is number => v !== null)
  if (vals.length === 0) return 'na'
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length
  return avg >= 80 ? 'ok' : avg >= 50 ? 'warn' : 'bad'
}

function computeAvg(kpis: (number | null)[]): number | null {
  const vals = kpis.filter((v): v is number => v !== null)
  if (vals.length === 0) return null
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
}

function computeGlobalScore(states: Record<BlockKey, BlockState>): number | null {
  const scores: number[] = []
  for (const k of ALL_KEYS) {
    const avg = computeAvg(states[k].kpis)
    if (avg !== null) scores.push(avg)
  }
  if (scores.length === 0) return null
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
}

function suggestStatus(state: BlockState): BlockStatus {
  const avg = computeAvg(state.kpis)
  if (avg === null) return 'na'
  return avg >= 80 ? 'ok' : avg >= 50 ? 'warn' : 'bad'
}

function initStates(data?: NizamData): Record<BlockKey, BlockState> {
  return Object.fromEntries(
    ALL_KEYS.map((k) => {
      const kpis = BLOCKS[k].kpis.map((_, i) => {
        if (!data) return null
        const src = AUTO_SOURCES[k]?.[i]
        if (!src) return null
        const val = src.compute(data)
        return val === null ? null : Math.max(0, Math.min(100, Math.round(val)))
      })
      return [k, { kpis, override: null }]
    })
  ) as Record<BlockKey, BlockState>
}

// ─── Score Ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 52 }: { score: number | null; size?: number }) {
  const r = size / 2 - 5
  const circ = 2 * Math.PI * r
  const offset = score === null ? circ : circ * (1 - score / 100)
  const strokeColor = score === null ? '#e2e8f0' : score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444'
  const textFill    = score === null ? '#94a3b8' : score >= 80 ? '#059669' : score >= 50 ? '#d97706' : '#dc2626'
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth="4" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={strokeColor} strokeWidth="4" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dashoffset 0.45s ease' }} />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        fontSize={score !== null && score >= 100 ? 9 : 11} fontWeight="700" fill={textFill}
        fontFamily="Inter, system-ui, sans-serif">
        {score === null ? '—' : score}
      </text>
    </svg>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

type DotPopupState = { key: BlockKey; x: number; y: number } | null

export function NizametricsClient({ initialData }: { initialData?: NizamData }) {
  const [states, setStates]     = useState<Record<BlockKey, BlockState>>(() => initStates(initialData))
  const [sel, setSel]           = useState<BlockKey | null>(null)
  const [animKey, setAnimKey]   = useState(0)
  const [dotPopup, setDotPopup] = useState<DotPopupState>(null)

  const statuses = useMemo(
    () => Object.fromEntries(ALL_KEYS.map((k) => [k, computeStatus(states[k])])) as Record<BlockKey, BlockStatus>,
    [states]
  )

  const summary = useMemo(() => {
    let ok = 0, warn = 0, bad = 0, na = 0
    for (const k of ALL_KEYS) {
      const s = statuses[k]
      if (s === 'ok') ok++; else if (s === 'warn') warn++; else if (s === 'bad') bad++; else na++
    }
    return { ok, warn, bad, na }
  }, [statuses])

  const globalScore = useMemo(() => computeGlobalScore(states), [states])

  const bottlenecks = useMemo(() => ({
    bad:  ALL_KEYS.filter((k) => statuses[k] === 'bad').map((k) => BLOCKS[k].name),
    warn: ALL_KEYS.filter((k) => statuses[k] === 'warn').map((k) => BLOCKS[k].name),
  }), [statuses])

  const setKpi = useCallback((key: BlockKey, idx: number, val: number) => {
    setStates((prev) => {
      const kpis = [...prev[key].kpis]; kpis[idx] = val
      return { ...prev, [key]: { ...prev[key], kpis } }
    })
  }, [])

  const toggleOverride = useCallback((key: BlockKey, st: 'ok' | 'warn' | 'bad') => {
    setStates((prev) => ({ ...prev, [key]: { ...prev[key], override: prev[key].override === st ? null : st } }))
  }, [])

  const resetOverride = useCallback((key: BlockKey) => {
    setStates((prev) => ({ ...prev, [key]: { ...prev[key], override: null } }))
  }, [])

  const selectBlock = useCallback((key: BlockKey) => {
    setSel(key); setAnimKey((n) => n + 1)
  }, [])

  // Convert SVG coordinates → screen coordinates for the dot popup
  const handleSvgDotClick = useCallback((
    key: BlockKey, indX: number, indY: number, e: React.MouseEvent<SVGCircleElement>
  ) => {
    e.stopPropagation()
    if (dotPopup?.key === key) { setDotPopup(null); return }
    const svgEl = e.currentTarget.ownerSVGElement
    if (!svgEl) return
    const pt  = svgEl.createSVGPoint()
    pt.x = indX; pt.y = indY
    const ctm = svgEl.getScreenCTM()
    if (!ctm) return
    const sc  = pt.matrixTransform(ctm)
    const pw  = 180
    const x   = sc.x + 12 + pw > window.innerWidth ? sc.x - pw - 12 : sc.x + 12
    const y   = Math.min(sc.y - 12, window.innerHeight - 140)
    setDotPopup({ key, x, y })
  }, [dotPopup])

  const handleHtmlDotClick = useCallback((key: BlockKey, e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation()
    if (dotPopup?.key === key) { setDotPopup(null); return }
    const rect = e.currentTarget.getBoundingClientRect()
    const pw   = 180
    const x    = rect.right + 12 + pw > window.innerWidth ? rect.left - pw - 12 : rect.right + 12
    const y    = Math.min(rect.top - 12, window.innerHeight - 140)
    setDotPopup({ key, x, y })
  }, [dotPopup])

  const selStatus = sel ? statuses[sel] : null
  const selState  = sel ? states[sel]   : null
  const selBlock  = sel ? BLOCKS[sel]   : null
  const selMeta   = selStatus ? getStatusMeta(selStatus) : null

  const globalScoreCls   = globalScore === null ? 'text-slate-400' : globalScore >= 80 ? 'text-emerald-600' : globalScore >= 50 ? 'text-amber-600' : 'text-rose-600'
  const globalScoreLabel = globalScore === null ? '' : globalScore >= 80 ? 'Bisnis Sehat' : globalScore >= 50 ? 'Perlu Perhatian' : 'Kritis'

  return (
    <div className="space-y-6 pb-12" onClick={() => setDotPopup(null)}>

      <style>{`
        .nzm-blk { cursor: pointer; }
        .nzm-blk:hover > rect, .nzm-blk:hover > polygon { filter: brightness(0.96); }
        .nzm-dot  { cursor: pointer; transition: r 0.12s ease; }
        .nzm-dot:hover { r: 9.5 !important; }
        .nzm-html-blk { cursor: pointer; transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .nzm-html-blk:hover { transform: translateY(-1px); }
        @keyframes nzmFade    { from { opacity:0; transform:translateY(4px);   } to { opacity:1; transform:translateY(0);  } }
        @keyframes nzmSlideIn { from { transform:translateX(100%); opacity:0;  } to { transform:translateX(0); opacity:1;  } }
        @keyframes nzmPopIn   { from { opacity:0; transform:scale(0.92) translateY(-4px); } to { opacity:1; transform:scale(1) translateY(0); } }
        .nzm-fade   { animation: nzmFade   0.18s ease; }
        .nzm-pop-in { animation: nzmPopIn  0.15s ease; }
        input[type=range].nzm-range { -webkit-appearance:none; appearance:none; width:100%; height:18px; background:transparent; outline:none; cursor:pointer; }
        input[type=range].nzm-range::-webkit-slider-thumb { -webkit-appearance:none; width:14px; height:14px; border-radius:50%; background:#0f172a; cursor:pointer; margin-top:-5px; }
        input[type=range].nzm-range::-moz-range-thumb     { width:14px; height:14px; border-radius:50%; background:#0f172a; cursor:pointer; border:none; }
        input[type=range].nzm-range::-webkit-slider-runnable-track { height:4px; background:transparent; }
        @media print {
          body * { visibility: hidden !important; }
          #nzm-print-report, #nzm-print-report * { visibility: visible !important; }
          #nzm-print-report { position:fixed !important; inset:0 !important; width:100% !important; background:white !important; z-index:99999 !important; padding:28px 32px !important; }
        }
        @page { size: A4; margin: 15mm; }
      `}</style>

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="p-2.5 rounded-2xl bg-white border border-slate-100 shadow-xl shadow-slate-100 text-indigo-600 shrink-0">
            <Activity size={20} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900 tracking-tight leading-tight">Nizametrics</h1>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[1.5px]">Business Health Monitor</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5 pl-4 border-l border-slate-100">
            <div className="text-right">
              <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Global Score</div>
              <div className={cn('text-lg font-bold font-mono leading-none mt-0.5', globalScoreCls)}>
                {globalScore === null ? '—' : globalScore}
              </div>
              {globalScoreLabel && <div className="text-[9px] text-slate-400 mt-0.5">{globalScoreLabel}</div>}
            </div>
            <ScoreRing score={globalScore} size={52} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-100 rounded-full px-3 py-1 uppercase tracking-wider">v1.0</span>
            <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-100 rounded-full px-3 py-1 uppercase tracking-wider">Beta</span>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-600 bg-white border border-slate-100 hover:bg-slate-50 hover:border-slate-200 rounded-full px-3 py-1 cursor-pointer transition-colors shadow-sm"
            >
              <Printer size={11} /> Cetak Laporan
            </button>
          </div>
        </div>
      </div>

      {/* ── Summary Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Sehat',           count: summary.ok,   dotCls: 'bg-emerald-400', numCls: 'text-emerald-600', cardCls: 'bg-emerald-50 border-emerald-100' },
          { label: 'Perlu Perhatian', count: summary.warn, dotCls: 'bg-amber-400',   numCls: 'text-amber-600',   cardCls: 'bg-amber-50 border-amber-100' },
          { label: 'Kritis',          count: summary.bad,  dotCls: 'bg-rose-400',    numCls: 'text-rose-600',    cardCls: 'bg-rose-50 border-rose-100' },
          { label: 'Belum Diisi',     count: summary.na,   dotCls: 'bg-slate-300',   numCls: 'text-slate-400',   cardCls: 'bg-slate-50 border-slate-200' },
        ].map(({ label, count, dotCls, numCls, cardCls }) => (
          <div key={label} className={cn('rounded-xl border px-5 py-4 flex items-center gap-3', cardCls)}>
            <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', dotCls)} />
            <div>
              <div className={cn('text-2xl font-semibold font-mono leading-none', numCls)}>{count}</div>
              <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mt-1">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Canvas Card ── */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-[0_20px_40px_-10px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/40 flex items-center">
          <div className="ml-auto flex items-center gap-1.5 text-[10px] text-slate-400">
            <MousePointerClick size={11} />
            Klik blok untuk set KPI · klik titik untuk ubah status cepat
          </div>
        </div>

        {/* Bottleneck alert */}
        {(bottlenecks.bad.length > 0 || bottlenecks.warn.length > 0) && (
          <div className="mx-5 mt-4 rounded-xl bg-rose-50 border border-rose-100 px-5 py-3.5">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={13} className="text-rose-600 shrink-0" />
              <span className="text-xs font-semibold text-rose-700">Bottleneck Terdeteksi</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {bottlenecks.bad.map((name) => (
                <span key={name} className="bg-rose-600 text-white rounded-full px-2.5 py-0.5 text-[10px] font-semibold">{name}</span>
              ))}
              {bottlenecks.warn.map((name) => (
                <span key={name} className="bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2.5 py-0.5 text-[10px] font-semibold">{name}</span>
              ))}
            </div>
          </div>
        )}

        {/* ── SVG Canvas (glamorphosis gradients + glow) ── */}
        <div className="px-5 pt-4 pb-3">
          <svg
            viewBox="0 0 1006 522"
            width="100%"
            style={{
              display: 'block',
              background: 'linear-gradient(150deg, #0f172a 0%, #1a2744 45%, #0f1f3d 100%)',
              borderRadius: 12,
            }}
            onClick={(e) => { e.stopPropagation(); setDotPopup(null) }}
          >
            <defs>
              {/* Layer-based glass gradients — color per block category, not per status */}
              {SVG_KEYS.map((key) => {
                const [from, to] = getLayerGrad(key)
                return (
                  <linearGradient key={key} id={`g-${key}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={from} />
                    <stop offset="100%" stopColor={to} />
                  </linearGradient>
                )
              })}
            </defs>

            {SVG_BLOCKS.map((blk) => {
              const st     = statuses[blk.key]
              const isSel  = sel === blk.key
              const avg    = computeAvg(states[blk.key].kpis)
              const block  = BLOCKS[blk.key]
              const stroke = getStatusStroke(st, avg, isSel)
              const strokeW = isSel ? 2.5 : 1
              const avgCol  = getAvgColor(st)
              const dot     = dotColor(st)
              const hasAuto = initialData != null && AUTO_SOURCES[blk.key]?.some((s) => s !== null)
              const glow    = getStatusGlow(st, avg)
              const glowFilter = isSel
                ? `drop-shadow(0 0 10px ${glow}) drop-shadow(0 0 3px ${glow})`
                : 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))'

              return (
                <g
                  key={blk.key}
                  className="nzm-blk"
                  style={{ filter: glowFilter }}
                  onClick={(e) => { e.stopPropagation(); setDotPopup(null); selectBlock(blk.key) }}
                >
                  {blk.shape === 'rect' ? (
                    <rect
                      x={blk.x! + 2} y={blk.y! + 2}
                      width={blk.w! - 4} height={blk.h! - 4}
                      rx="8"
                      fill={`url(#g-${blk.key})`}
                      stroke={stroke} strokeWidth={strokeW}
                    />
                  ) : (
                    <polygon
                      points={blk.points}
                      fill={`url(#g-${blk.key})`}
                      stroke={stroke} strokeWidth={strokeW}
                    />
                  )}

                  {/* Layer label */}
                  <text
                    x={blk.labelX} y={blk.labelY}
                    fontSize="7" fontWeight="700" fill="rgba(255,255,255,0.38)" letterSpacing="1.4"
                    fontFamily="Inter, system-ui, sans-serif"
                  >
                    {block.layer}
                  </text>

                  {/* Block name */}
                  <text
                    x={blk.nameX} y={blk.nameY}
                    fontSize="11" fontWeight="700" fill="rgba(255,255,255,0.92)"
                    fontFamily="Inter, system-ui, sans-serif"
                  >
                    {block.name}
                  </text>

                  {/* Avg KPI */}
                  {avg !== null && (
                    <text
                      x={blk.avgX} y={blk.avgY}
                      fontSize="13" fontWeight="800" fill={avgCol}
                      fontFamily="Inter, system-ui, sans-serif"
                    >
                      {avg}%
                    </text>
                  )}

                  {/* Auto badge */}
                  {hasAuto && (
                    <text
                      x={blk.avgX} y={blk.avgY + 12}
                      fontSize="7" fontWeight="700" fill="rgba(167,139,250,0.9)"
                      fontFamily="Inter, system-ui, sans-serif"
                    >
                      Auto
                    </text>
                  )}

                  {/* Status indicator dot */}
                  <circle
                    className="nzm-dot"
                    cx={blk.indX} cy={blk.indY} r={8}
                    fill={dot}
                    onClick={(e) => handleSvgDotClick(blk.key, blk.indX, blk.indY, e)}
                  />
                </g>
              )
            })}
          </svg>
        </div>

        {/* ── Muhasabah & Risiko — HTML row below SVG, dark glass to match canvas ── */}
        <div className="px-5 pb-4 grid grid-cols-2 gap-3">
          {(['muhasabah', 'risiko'] as BlockKey[]).map((key) => {
            const st    = statuses[key]
            const isSel = sel === key
            const avg   = computeAvg(states[key].kpis)
            const block = BLOCKS[key]
            const m     = getStatusMeta(st)
            // HTML blocks sit on a white card — need fully-opaque base colors (SVG gradient is 20% opacity, only works on dark SVG bg)
            const htmlBg = key === 'muhasabah'
              ? 'linear-gradient(135deg, #1e1040 0%, #0f172a 100%)'   // dark violet-navy
              : 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'   // dark slate-navy
            return (
              <div
                key={key}
                className="nzm-html-blk rounded-xl px-5 py-4 flex items-center justify-between gap-3"
                style={{
                  background: htmlBg,
                  border: `${isSel ? 2 : 1}px solid ${getStatusStroke(st, avg, isSel)}`,
                  boxShadow: isSel
                    ? `0 0 12px ${getStatusGlow(st, avg)}, 0 4px 16px rgba(0,0,0,0.4)`
                    : '0 1px 3px rgba(0,0,0,0.4)',
                }}
                onClick={(e) => { e.stopPropagation(); setDotPopup(null); selectBlock(key) }}
              >
                <div>
                  <div className="text-[7px] font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.38)' }}>{block.layer}</div>
                  <div className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.92)' }}>{block.name}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {avg !== null && (
                    <span className="text-lg font-black tabular-nums" style={{ color: getAvgColor(st) }}>{avg}%</span>
                  )}
                  <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded-full border', m.badgeCls)}>{m.label}</span>
                  <div
                    className="w-2.5 h-2.5 rounded-full cursor-pointer transition-transform hover:scale-125"
                    style={{ background: m.dotHex }}
                    onClick={(e) => handleHtmlDotClick(key, e)}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center gap-4 flex-wrap">
          {[
            { dot: 'bg-emerald-400', label: 'Sehat' },
            { dot: 'bg-amber-400',   label: 'Perlu Perhatian' },
            { dot: 'bg-rose-400',    label: 'Kritis' },
            { dot: 'bg-slate-300',   label: 'Belum Diisi' },
          ].map(({ dot, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={cn('w-2 h-2 rounded-full', dot)} />
              <span className="text-[10px] text-slate-400 font-medium">{label}</span>
            </div>
          ))}
          {initialData && (
            <div className="ml-auto flex items-center gap-1.5 text-[10px] text-indigo-500 font-medium">
              <Zap size={10} /> Sebagian KPI terisi otomatis dari data Nizam
            </div>
          )}
        </div>
      </div>

      {/* ── Floating Dot Popup ── */}
      {dotPopup && (
        <>
          <div className="fixed inset-0 z-[35]" onClick={(e) => { e.stopPropagation(); setDotPopup(null) }} />
          <div
            className="nzm-pop-in fixed z-[36] bg-white border border-slate-100 rounded-2xl shadow-2xl p-4 w-48"
            style={{ left: dotPopup.x, top: dotPopup.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Ubah Status Cepat</div>
            {(() => {
              const suggested = suggestStatus(states[dotPopup.key])
              return suggested !== 'na' ? (
                <div className="text-[10px] text-slate-500 mb-2.5">
                  Saran:{' '}
                  <span className="font-bold" style={{ color: getStatusMeta(suggested).dotHex }}>
                    {getStatusMeta(suggested).label}
                  </span>
                </div>
              ) : null
            })()}
            <div className="flex gap-1.5 mb-1.5">
              {(['ok', 'warn', 'bad'] as const).map((s) => {
                const sm = getStatusMeta(s)
                const isActive = states[dotPopup.key].override === s
                return (
                  <button
                    key={s}
                    onClick={() => { toggleOverride(dotPopup.key, s); setDotPopup(null) }}
                    className={cn(
                      'flex-1 text-[9px] font-bold py-1.5 rounded-lg border cursor-pointer transition-all duration-150',
                      isActive ? `ring-1 ${sm.badgeCls}` : `${sm.badgeCls} opacity-80 hover:opacity-100`
                    )}
                  >
                    {s === 'ok' ? 'Sehat' : s === 'warn' ? 'Perlu' : 'Kritis'}
                  </button>
                )
              })}
            </div>
            {states[dotPopup.key].override && (
              <button
                onClick={() => { resetOverride(dotPopup.key); setDotPopup(null) }}
                className="w-full text-[9px] font-semibold py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100 cursor-pointer transition-colors"
              >
                Reset Override
              </button>
            )}
          </div>
        </>
      )}

      {/* ── Detail Drawer (fixed overlay, slides from right) ── */}
      {sel && (
        <div className="fixed inset-0 z-40 pointer-events-none">
          <div className="absolute inset-0 bg-black/20 pointer-events-auto" onClick={() => setSel(null)} />
          <div
            className="absolute right-0 top-0 h-full w-[360px] bg-white border-l border-slate-100 shadow-2xl flex flex-col pointer-events-auto"
            style={{ animation: 'nzmSlideIn .22s cubic-bezier(.16,1,.3,1)' }}
          >
            {selBlock && selState && selStatus && selMeta ? (
              <div key={animKey} className="nzm-fade flex-1 overflow-y-auto min-h-0">
                <div className="px-5 pt-5 pb-4 border-b border-slate-100">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-slate-900 leading-snug">{selBlock.name}</h3>
                    <span className={cn('shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full border', selMeta.badgeCls)}>
                      {selMeta.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{selBlock.desc}</p>
                </div>

                {(() => {
                  const avg = computeAvg(selState.kpis)
                  return avg !== null ? (
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Rata-rata KPI</span>
                      <span className={cn('text-2xl font-semibold font-mono', selMeta.avgColorCls)}>{avg}%</span>
                    </div>
                  ) : null
                })()}

                <div className="px-5 py-5 space-y-6">

                  {/* KPI sliders */}
                  <div className="space-y-5">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Parameter KPI</p>
                    {selBlock.kpis.map((kpi, i) => {
                      const val     = selState.kpis[i]
                      const disp    = val !== null ? val : 0
                      const hasAuto = initialData != null && AUTO_SOURCES[sel!]?.[i] != null
                      const autoSrc = AUTO_SOURCES[sel!]?.[i]
                      const tagCls  = val === null ? null : val >= 80 ? 'bg-emerald-50 text-emerald-700' : val >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
                      const tagLbl  = val === null ? null : val >= 80 ? 'Tercapai' : val >= 50 ? 'Hampir' : 'Belum'
                      return (
                        <div key={i} className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 flex items-start gap-1.5 flex-wrap">
                              <span className="text-[11px] text-slate-600 leading-tight">{kpi.name}</span>
                              {hasAuto && (
                                <span
                                  className="shrink-0 flex items-center gap-0.5 text-[8px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-full px-1.5 py-0.5"
                                  title={autoSrc?.label ?? 'Data otomatis dari Nizam'}
                                >
                                  <Zap size={7} />Auto
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[11px] font-semibold font-mono text-slate-700">{val !== null ? `${val}%` : '—'}</span>
                              {tagLbl && tagCls && <span className={cn('text-[9px] font-semibold rounded-full px-1.5 py-0.5', tagCls)}>{tagLbl}</span>}
                            </div>
                          </div>
                          <div className="relative h-4">
                            <div className="absolute top-[7px] left-0 right-0 h-1 rounded-full bg-slate-100 overflow-hidden pointer-events-none">
                              <div className={cn('h-full rounded-full transition-all duration-100', barCls(val))} style={{ width: `${disp}%` }} />
                            </div>
                            <input
                              type="range" min={0} max={100} value={disp}
                              onChange={(e) => setKpi(sel!, i, Number(e.target.value))}
                              className="nzm-range absolute top-0 left-0 w-full opacity-0"
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Override */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Override Status</p>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { st: 'ok'   as const, icon: <CheckCircle2 size={10} />, label: 'Sehat',  cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', act: 'bg-emerald-100 border-emerald-400 ring-1 ring-emerald-300' },
                        { st: 'warn' as const, icon: <AlertTriangle size={10} />, label: 'Perlu',  cls: 'bg-amber-50 text-amber-700 border-amber-200',     act: 'bg-amber-100 border-amber-400 ring-1 ring-amber-300' },
                        { st: 'bad'  as const, icon: <X size={10} />, label: 'Kritis', cls: 'bg-rose-50 text-rose-700 border-rose-200',       act: 'bg-rose-100 border-rose-400 ring-1 ring-rose-300' },
                      ]).map(({ st, icon, label, cls, act }) => (
                        <button
                          key={st}
                          onClick={() => toggleOverride(sel!, st)}
                          className={cn('flex items-center justify-center gap-1 text-[10px] font-semibold py-2 px-1 rounded-lg border cursor-pointer transition-all duration-150',
                            selState.override === st ? act : cn(cls, 'hover:opacity-80'))}
                        >
                          {icon}{label}
                        </button>
                      ))}
                    </div>
                    {selState.override && (
                      <button
                        onClick={() => resetOverride(sel!)}
                        className="w-full text-[10px] font-semibold py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 cursor-pointer transition-colors"
                      >
                        Reset Override
                      </button>
                    )}
                  </div>

                  {/* Issues */}
                  {(selStatus === 'bad' || selStatus === 'warn') && (
                    <div className="space-y-3">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Masalah Terdeteksi</p>
                      <div className="rounded-xl border border-rose-100 bg-rose-50/50 divide-y divide-rose-100 overflow-hidden">
                        {selBlock.issues[selStatus].map((issue, i) => (
                          <div key={i} className="flex items-start gap-3 px-4 py-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0 mt-1.5" />
                            <span className="text-[11px] text-slate-700 leading-relaxed">{issue}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {(selStatus === 'bad' || selStatus === 'warn') && (
                    <div className="space-y-3">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Rekomendasi</p>
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 divide-y divide-emerald-100 overflow-hidden">
                        {selBlock.recs[selStatus].map((rec, i) => (
                          <div key={i} className="flex items-start gap-3 px-4 py-3">
                            <CheckCircle2 size={12} className="text-emerald-500 shrink-0 mt-0.5" />
                            <span className="text-[11px] text-slate-700 leading-relaxed">{rec}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2 shrink-0">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                {sel ? BLOCKS[sel].layer : ''}
              </span>
              <button
                onClick={() => setSel(null)}
                className="text-[10px] text-slate-400 hover:text-slate-600 font-semibold cursor-pointer transition-colors"
              >
                Tutup ×
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Print Report (hidden on screen) ── */}
      <div id="nzm-print-report" style={{ display: 'none', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid #0f172a', paddingBottom: 12, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>Nizametrics</div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 2, textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 600 }}>Business Health Report</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { label: 'Sehat', count: summary.ok, color: '#16a34a' },
                { label: 'Perlu Perhatian', count: summary.warn, color: '#d97706' },
                { label: 'Kritis', count: summary.bad, color: '#dc2626' },
                { label: 'Belum Diisi', count: summary.na, color: '#94a3b8' },
              ].map(({ label, count, color }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color, lineHeight: 1 }}>{count}</div>
                  <div style={{ fontSize: 8, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center', borderLeft: '1px solid #e2e8f0', paddingLeft: 16 }}>
              <div style={{ fontSize: 8, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 2 }}>Global Score</div>
              <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1, fontFamily: 'monospace', color: globalScore === null ? '#94a3b8' : globalScore >= 80 ? '#16a34a' : globalScore >= 50 ? '#d97706' : '#dc2626' }}>
                {globalScore === null ? '—' : globalScore}
              </div>
              {globalScoreLabel && <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>{globalScoreLabel}</div>}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 16 }}>
          Dicetak pada {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          {initialData ? ' · Data KPI sebagian terisi otomatis dari modul Nizam ERP' : ''}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {ALL_KEYS.map((key) => {
            const st    = statuses[key]
            const state = states[key]
            const block = BLOCKS[key]
            const avg   = computeAvg(state.kpis)
            const borderColor = st === 'ok' ? '#86efac' : st === 'warn' ? '#fde68a' : st === 'bad' ? '#fecdd3' : '#e2e8f0'
            const bgColor     = st === 'ok' ? '#f0fdf4' : st === 'warn' ? '#fffbeb' : st === 'bad' ? '#fff1f2' : '#f8fafc'
            const labelColor  = st === 'ok' ? '#15803d' : st === 'warn' ? '#d97706' : st === 'bad' ? '#e11d48' : '#94a3b8'
            const statusLabel = st === 'ok' ? 'Sehat' : st === 'warn' ? 'Perlu Perhatian' : st === 'bad' ? 'Kritis' : 'Belum Diisi'
            return (
              <div key={key} style={{ border: `1px solid ${borderColor}`, borderRadius: 8, padding: '10px 12px', background: bgColor, breakInside: 'avoid' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 7.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>{block.layer}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginTop: 1 }}>{block.name}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                    <div style={{ fontSize: 8.5, fontWeight: 700, color: labelColor, background: 'white', border: `1px solid ${borderColor}`, borderRadius: 20, padding: '2px 7px' }}>{statusLabel}</div>
                    {avg !== null && <div style={{ fontSize: 17, fontWeight: 800, color: labelColor, fontFamily: 'monospace', lineHeight: 1 }}>{avg}%</div>}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: (st === 'bad' || st === 'warn') ? 8 : 0 }}>
                  {block.kpis.map((kpi, i) => {
                    const val      = state.kpis[i]
                    const barColor = val === null ? '#e2e8f0' : val >= 80 ? '#22c55e' : val >= 50 ? '#f59e0b' : '#f43f5e'
                    const hasAuto  = AUTO_SOURCES[key]?.[i] != null
                    return (
                      <div key={i}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 8.5, color: '#64748b' }}>{kpi.name}</span>
                            {hasAuto && initialData && <span style={{ fontSize: 7, fontWeight: 700, color: '#6366f1', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 10, padding: '1px 4px' }}>Auto</span>}
                          </div>
                          <span style={{ fontSize: 9, fontWeight: 700, color: '#374151', fontFamily: 'monospace' }}>{val !== null ? `${val}%` : '—'}</span>
                        </div>
                        <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${val ?? 0}%`, background: barColor, borderRadius: 2 }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
                {(st === 'bad' || st === 'warn') && (
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 7.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 3 }}>Masalah Terdeteksi</div>
                    {block.issues[st].map((issue, i) => (
                      <div key={i} style={{ fontSize: 8.5, color: '#374151', display: 'flex', gap: 5, marginBottom: 2 }}>
                        <span style={{ color: '#f43f5e', flexShrink: 0 }}>•</span><span>{issue}</span>
                      </div>
                    ))}
                  </div>
                )}
                {(st === 'bad' || st === 'warn') && (
                  <div>
                    <div style={{ fontSize: 7.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 3 }}>Rekomendasi</div>
                    {block.recs[st].map((rec, i) => (
                      <div key={i} style={{ fontSize: 8.5, color: '#374151', display: 'flex', gap: 5, marginBottom: 2 }}>
                        <span style={{ color: '#22c55e', flexShrink: 0 }}>✓</span><span>{rec}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div style={{ marginTop: 20, paddingTop: 10, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 8, color: '#cbd5e1' }}>Nizametrics v1.0 · Nizam ERP</div>
          <div style={{ fontSize: 8, color: '#cbd5e1' }}>Laporan ini bersifat internal dan rahasia</div>
        </div>
      </div>

    </div>
  )
}
