'use client'

import { useMemo, useState } from 'react'
import {
  Activity,
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
  Factory,
  FileText,
  GitBranch,
  HandCoins,
  History,
  Landmark,
  Layers,
  LifeBuoy,
  LineChart,
  Lock,
  MapPin,
  Megaphone,
  Package,
  PieChart,
  ShieldCheck,
  ShoppingCart,
  Store,
  Target,
  Ticket,
  TrendingUp,
  Truck,
  Upload,
  Users,
  Wallet,
  Warehouse,
  Zap,
  Search,
  type LucideIcon,
} from 'lucide-react'

type ExplorerItem = {
  href: string
  label: string
  icon: LucideIcon
  group: string
}

type ExplorerTone = 'blue' | 'emerald' | 'amber' | 'slate'

type ExplorerPreview =
  | {
      kind: 'list'
      label: string
      hint: string
      rows: Array<{ title: string; meta: string; value: string }>
      focusLabel: string
      focusTitle: string
      focusDescription: string
      focusItems: string[]
    }
  | {
      kind: 'board'
      label: string
      hint: string
      columns: Array<{ title: string; items: string[] }>
      focusLabel: string
      focusTitle: string
      focusDescription: string
      focusItems: string[]
    }
  | {
      kind: 'settings'
      label: string
      hint: string
      sections: Array<{ title: string; items: string[] }>
      focusLabel: string
      focusTitle: string
      focusDescription: string
      focusItems: string[]
    }

type ExplorerPanel = {
  eyebrow: string
  title: string
  description: string
  tone: ExplorerTone
  snapshotBars?: number[]
  metrics: Array<{ label: string; value: string }>
  notes?: string[]
  preview?: ExplorerPreview
}

function getToneStyles(tone: ExplorerTone) {
  if (tone === 'blue') {
    return {
      pill: 'border-blue-100 bg-blue-50 text-blue-700',
      icon: 'border-blue-100 bg-blue-50 text-blue-700',
      gradient: 'from-blue-500 to-cyan-400',
    }
  }

  if (tone === 'emerald') {
    return {
      pill: 'border-emerald-100 bg-emerald-50 text-emerald-700',
      icon: 'border-emerald-100 bg-emerald-50 text-emerald-700',
      gradient: 'from-emerald-500 to-teal-400',
    }
  }

  if (tone === 'amber') {
    return {
      pill: 'border-amber-100 bg-amber-50 text-amber-700',
      icon: 'border-amber-100 bg-amber-50 text-amber-700',
      gradient: 'from-amber-500 to-orange-400',
    }
  }

  return {
    pill: 'border-slate-200 bg-slate-100 text-slate-600',
    icon: 'border-slate-200 bg-slate-100 text-slate-700',
    gradient: 'from-slate-700 to-slate-400',
  }
}

function ExplorerMetricCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: ExplorerTone
}) {
  const styles = getToneStyles(tone)

  return (
    <article className="rounded-[30px] border border-slate-100 bg-white p-5 shadow-[0_10px_30px_-5px_rgba(0,0,0,0.03)] transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border ${styles.icon}`}>
          <div className={`h-2.5 w-2.5 rounded-full bg-gradient-to-br ${styles.gradient}`} />
        </div>
        <div className="text-right text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</div>
      </div>
      <div className="mt-8 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">{value}</div>
    </article>
  )
}

function ExplorerSnapshot({
  title,
  bars,
  tone,
}: {
  title: string
  bars: number[]
  tone: ExplorerTone
}) {
  const styles = getToneStyles(tone)
  const chartId = title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const width = 560
  const height = 220
  const paddingX = 28
  const paddingY = 22
  const max = Math.max(...bars)
  const min = Math.min(...bars)
  const range = Math.max(max - min, 1)

  const createPoint = (value: number, index: number, factor = 1) => {
    const x = paddingX + index * ((width - paddingX * 2) / Math.max(bars.length - 1, 1))
    const adjustedValue = min + (value - min) * factor
    const y = height - paddingY - ((adjustedValue - min) / range) * (height - paddingY * 2)

    return `${x},${y}`
  }

  const primaryPoints = bars.map((value, index) => createPoint(value, index)).join(' ')
  const secondaryPoints = bars.map((value, index) => createPoint(value - range * 0.42, index, 0.82)).join(' ')
  const areaPath = `M ${primaryPoints.split(' ').join(' L ')} L ${width - paddingX},${height - paddingY} L ${paddingX},${height - paddingY} Z`

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 px-2">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-700">Financial Performance</div>
          <div className="mt-1 text-[10px] font-bold italic tracking-tight text-slate-400">Moving average preview for {title.toLowerCase()}</div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2">
            <div className={`h-2.5 w-2.5 rounded-full bg-gradient-to-r ${styles.gradient}`} />
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Trend</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-blue-700" />
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Insight</span>
          </div>
        </div>
      </div>

      <div className="rounded-[40px] border border-slate-100 bg-white p-8 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.04)]">
        <svg viewBox={`0 0 ${width} ${height + 28}`} className="h-[280px] w-full">
          <defs>
            <linearGradient id={`${chartId}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={tone === 'emerald' ? '#10b981' : tone === 'amber' ? '#f59e0b' : tone === 'blue' ? '#22c55e' : '#94a3b8'} stopOpacity="0.16" />
              <stop offset="95%" stopColor={tone === 'emerald' ? '#10b981' : tone === 'amber' ? '#f59e0b' : tone === 'blue' ? '#22c55e' : '#94a3b8'} stopOpacity="0" />
            </linearGradient>
          </defs>

          {[0, 1, 2, 3].map((line) => {
            const y = paddingY + line * 48

            return <line key={line} x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="#e2e8f0" strokeDasharray="4 6" />
          })}

          <path d={areaPath} fill={`url(#${chartId}-fill)`} />
          <polyline fill="none" stroke={tone === 'emerald' ? '#10b981' : tone === 'amber' ? '#f59e0b' : tone === 'blue' ? '#22c55e' : '#64748b'} strokeWidth="5" points={primaryPoints} />
          <polyline fill="none" stroke="#2563eb" strokeWidth="4" strokeDasharray="10 10" points={secondaryPoints} />

          {bars.map((_, index) => {
            const x = paddingX + index * ((width - paddingX * 2) / Math.max(bars.length - 1, 1))

            return (
              <text
                key={`label-${index}`}
                x={x}
                y={height + 18}
                textAnchor="middle"
                className="fill-slate-400 text-[10px] font-black uppercase tracking-[0.12em]"
              >
                P{index + 1}
              </text>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

function ExplorerImpactCard({
  title,
  eyebrow,
  notes,
  description,
}: {
  title: string
  eyebrow: string
  notes: string[]
  description?: string
}) {
  return (
    <div className="rounded-[42px] bg-slate-900 p-8 text-white shadow-[0_30px_60px_-15px_rgba(15,23,42,0.3)]">
      <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/15 px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-amber-300">
        {eyebrow} Focus
      </div>

      <h4 className="mt-6 text-3xl font-black tracking-tight text-white">{title}</h4>
      <p className="mt-4 text-sm font-medium leading-7 text-slate-300">{description ?? notes[0] ?? 'Gunakan area ini untuk membaca fokus utama modul.'}</p>

      <div className="mt-8 space-y-3">
        {notes.slice(1).map((note, index) => (
          <div key={note} className="flex items-start gap-3 rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">
            <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[10px] font-black text-slate-200">
              #{index + 1}
            </div>
            <div className="text-sm font-medium leading-6 text-slate-200">{note}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ExplorerListPreview({
  preview,
}: {
  preview: Extract<ExplorerPreview, { kind: 'list' }>
}) {
  return (
    <div className="grid grid-cols-[1.25fr_0.75fr] gap-8">
      <div className="space-y-5">
        <div className="px-2">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-700">{preview.label}</div>
          <div className="mt-1 text-[10px] font-bold italic tracking-tight text-slate-400">{preview.hint}</div>
        </div>

        <div className="rounded-[40px] border border-slate-100 bg-white p-6 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.04)]">
          <div className="space-y-3">
            {preview.rows.map((row) => (
              <div key={`${row.title}-${row.value}`} className="flex items-center justify-between gap-4 rounded-[24px] border border-slate-100 bg-slate-50 px-4 py-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-black tracking-tight text-slate-900">{row.title}</div>
                  <div className="mt-1 text-[11px] font-medium text-slate-500">{row.meta}</div>
                </div>
                <div className="shrink-0 text-right text-sm font-black text-slate-700">{row.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ExplorerImpactCard
        title={preview.focusTitle}
        eyebrow={preview.focusLabel}
        notes={['', ...preview.focusItems]}
        description={preview.focusDescription}
      />
    </div>
  )
}

function ExplorerBoardPreview({
  preview,
}: {
  preview: Extract<ExplorerPreview, { kind: 'board' }>
}) {
  return (
    <div className="grid grid-cols-[1.25fr_0.75fr] gap-8">
      <div className="space-y-5">
        <div className="px-2">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-700">{preview.label}</div>
          <div className="mt-1 text-[10px] font-bold italic tracking-tight text-slate-400">{preview.hint}</div>
        </div>

        <div className="rounded-[40px] border border-slate-100 bg-white p-6 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.04)]">
          <div className="grid grid-cols-3 gap-4">
            {preview.columns.map((column) => (
              <div key={column.title} className="rounded-[28px] border border-slate-100 bg-slate-50 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{column.title}</div>
                <div className="mt-4 space-y-3">
                  {column.items.map((item) => (
                    <div key={item} className="rounded-2xl border border-slate-100 bg-white px-3 py-3 text-sm font-medium leading-6 text-slate-700">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ExplorerImpactCard
        title={preview.focusTitle}
        eyebrow={preview.focusLabel}
        notes={['', ...preview.focusItems]}
        description={preview.focusDescription}
      />
    </div>
  )
}

function ExplorerSettingsPreview({
  preview,
}: {
  preview: Extract<ExplorerPreview, { kind: 'settings' }>
}) {
  return (
    <div className="grid grid-cols-[1.25fr_0.75fr] gap-8">
      <div className="space-y-5">
        <div className="px-2">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-700">{preview.label}</div>
          <div className="mt-1 text-[10px] font-bold italic tracking-tight text-slate-400">{preview.hint}</div>
        </div>

        <div className="rounded-[40px] border border-slate-100 bg-white p-6 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.04)]">
          <div className="grid grid-cols-2 gap-4">
            {preview.sections.map((section) => (
              <div key={section.title} className="rounded-[28px] border border-slate-100 bg-slate-50 p-4">
                <div className="text-sm font-black tracking-tight text-slate-900">{section.title}</div>
                <div className="mt-4 space-y-2">
                  {section.items.map((item) => (
                    <div key={item} className="rounded-2xl border border-slate-100 bg-white px-3 py-3 text-sm font-medium leading-6 text-slate-700">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ExplorerImpactCard
        title={preview.focusTitle}
        eyebrow={preview.focusLabel}
        notes={['', ...preview.focusItems]}
        description={preview.focusDescription}
      />
    </div>
  )
}

const MENU_GROUPS: Array<{ group: string; items: ExplorerItem[] }> = [
  {
    group: 'Utama',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: BarChart3, group: 'Utama' },
      { label: 'Audit Integritas', href: '/accounting/audit', icon: ShieldCheck, group: 'Utama' },
    ],
  },
  {
    group: 'Finance',
    items: [
      { label: 'Akun (CoA)', href: '/settings/accounts', icon: Layers, group: 'Finance' },
      { label: 'Kas & Bank', href: '/cash', icon: Wallet, group: 'Finance' },
      { label: 'Buku Besar', href: '/accounting/journal', icon: BookOpen, group: 'Finance' },
      { label: 'Aging (AR/AP)', href: '/accounting/aging', icon: History, group: 'Finance' },
      { label: 'Manajemen Zakat', href: '/accounting/zakat', icon: HandCoins, group: 'Finance' },
      { label: 'Manajemen Pajak', href: '/accounting/tax', icon: ShieldCheck, group: 'Finance' },
      { label: 'Reimbursement', href: '/accounting/reimburse', icon: FileText, group: 'Finance' },
      { label: 'Penutupan Buku', href: '/accounting/closing', icon: Lock, group: 'Finance' },
      { label: 'Aset Tetap', href: '/accounting/assets', icon: Landmark, group: 'Finance' },
      { label: 'Anggaran', href: '/accounting/budgets', icon: Target, group: 'Finance' },
    ],
  },
  {
    group: 'Operasional',
    items: [
      { label: 'Pembelian', href: '/purchasing', icon: ShoppingCart, group: 'Operasional' },
      { label: 'Inventori', href: '/inventory', icon: Package, group: 'Operasional' },
      { label: 'Gudang (WMS)', href: '/inventory/warehouses', icon: Warehouse, group: 'Operasional' },
      { label: 'Manufaktur (BoM)', href: '/factory', icon: Factory, group: 'Operasional' },
      { label: 'Fleet & Rental', href: '/fleet', icon: Truck, group: 'Operasional' },
      { label: 'Job Order (Jasa)', href: '/services', icon: Briefcase, group: 'Operasional' },
    ],
  },
  {
    group: 'Marketing & Sales',
    items: [
      { label: 'Pelanggan (CRM)', href: '/contacts', icon: Users, group: 'Marketing & Sales' },
      { label: 'POS (Kasir)', href: '/pos', icon: Store, group: 'Marketing & Sales' },
      { label: 'Penawaran (Quotation)', href: '/sales/quotations', icon: FileText, group: 'Marketing & Sales' },
      { label: 'Penjualan', href: '/sales', icon: TrendingUp, group: 'Marketing & Sales' },
      { label: 'Sales Pipeline', href: '/sales/pipeline', icon: Activity, group: 'Marketing & Sales' },
      { label: 'Target & Komisi', href: '/sales/commission', icon: Target, group: 'Marketing & Sales' },
      { label: 'Promo & Reward', href: '/sales/promos', icon: Zap, group: 'Marketing & Sales' },
      { label: 'Sales Page', href: '/sales/pages', icon: Megaphone, group: 'Marketing & Sales' },
    ],
  },
  {
    group: 'HRIS',
    items: [
      { label: 'Karyawan (HRIS)', href: '/hris', icon: Users, group: 'HRIS' },
      { label: 'Absensi & Cuti', href: '/hris?tab=attendance', icon: Ticket, group: 'HRIS' },
      { label: 'Payroll Components', href: '/hris?tab=payroll', icon: FileText, group: 'HRIS' },
      { label: 'Proses Penggajian', href: '/hris?tab=runs', icon: Wallet, group: 'HRIS' },
      { label: 'Akses & Jabatan', href: '/settings/roles', icon: ShieldCheck, group: 'HRIS' },
    ],
  },
  {
    group: 'Insight',
    items: [
      { label: 'Laporan', href: '/reports', icon: BarChart3, group: 'Insight' },
      { label: 'Strategi (BSC)', href: '/reports/bsc', icon: PieChart, group: 'Insight' },
      { label: 'Proyeksi Kas', href: '/accounting/forecast', icon: LineChart, group: 'Insight' },
    ],
  },
  {
    group: 'Config',
    items: [
      { label: 'Audit Trail', href: '/settings/audit', icon: ShieldCheck, group: 'Config' },
      { label: 'Anak Perusahaan', href: '/settings/sub-orgs', icon: GitBranch, group: 'Config' },
      { label: 'Cabang', href: '/settings/branches', icon: MapPin, group: 'Config' },
      { label: 'Pengaturan Bisnis', href: '/settings/business', icon: Building2, group: 'Config' },
      { label: 'Migrasi Data', href: '/settings/business/migration', icon: Upload, group: 'Config' },
      { label: 'Support Ticket', href: '/settings/ticketing', icon: LifeBuoy, group: 'Config' },
    ],
  },
]

const PANELS: Record<string, ExplorerPanel> = {
  '/dashboard': {
    eyebrow: 'Dashboard',
    title: 'Overview bisnis lintas modul',
    description: 'Di sini Anda melihat ritme dashboard NIZAM: metrik utama, performa keuangan, produk pareto, dan strategi cepat.',
    tone: 'blue',
    snapshotBars: [48, 62, 58, 76, 72, 84],
    metrics: [
      { label: 'Kas & Bank', value: 'Rp248 jt' },
      { label: 'OCF', value: '+Rp38 jt' },
      { label: 'Runway', value: 'Aman' },
    ],
    notes: [
      'Setelah login, Anda biasanya memantau kondisi bisnis dari area ini.',
      'Startup wizard dan insight cepat terasa paling jelas di dashboard.',
      'Cocok jika Anda ingin membaca kondisi bisnis secara ringkas.',
    ],
  },
  '/accounting/zakat': {
    eyebrow: 'Manajemen Zakat',
    title: 'Haul, nishab, dan estimasi zakat',
    description: 'Anda dapat memantau zakat perdagangan di area tersendiri, tanpa mencampurnya dengan laporan operasional biasa.',
    tone: 'emerald',
    metrics: [
      { label: 'Haul', value: 'Aktif' },
      { label: 'Nishab', value: 'Terpenuhi' },
      { label: 'Estimasi', value: 'Rp12,4 jt' },
    ],
    preview: {
      kind: 'list',
      label: 'Ringkasan Haul',
      hint: 'Nishab, basis aset zakat, dan estimasi periode berjalan.',
      rows: [
        { title: 'Haul 1447 H', meta: 'Periode aktif', value: 'Berjalan' },
        { title: 'Basis Aset Lancar', meta: 'Kas, stok, piutang bersih', value: 'Rp496 jt' },
        { title: 'Nishab Referensi', meta: 'Setara emas', value: 'Terpenuhi' },
        { title: 'Estimasi Zakat', meta: 'Kalkulasi perdagangan', value: 'Rp12,4 jt' },
      ],
      focusLabel: 'Zakat',
      focusTitle: 'Pantau kewajiban tanpa mencampur laporan operasional.',
      focusDescription: 'Preview ini dibuat mengikuti kebutuhan modul zakat: lebih dekat ke haul, basis aset, dan estimasi kewajiban.',
      focusItems: [
        'Membantu owner membaca konteks zakat perdagangan lebih cepat.',
        'Cocok untuk bisnis yang ingin pencatatannya lebih tertib.',
      ],
    },
  },
  '/reports/bsc': {
    eyebrow: 'Strategi (BSC)',
    title: 'Balanced Scorecard untuk target yang tidak berhenti di slide',
    description: 'Di sini Anda dapat meninjau perspektif strategi dan KPI agar perencanaan lebih mudah dipantau ulang.',
    tone: 'amber',
    metrics: [
      { label: 'KPI Aktif', value: '14' },
      { label: 'Score', value: '82/100' },
      { label: 'Review', value: 'Bulanan' },
    ],
    preview: {
      kind: 'board',
      label: 'Perspektif Scorecard',
      hint: 'Cuplikan susunan perspektif dan target yang biasa dibaca di BSC.',
      columns: [
        { title: 'Finansial', items: ['Jaga OCF positif', 'Naikkan margin inti', 'Pantau efisiensi kas'] },
        { title: 'Pelanggan', items: ['Retensi akun besar', 'Lead time respon', 'Kepuasan pengiriman'] },
        { title: 'Internal & Learning', items: ['Closing lebih cepat', 'Disiplin approval', 'KPI tim aktif'] },
      ],
      focusLabel: 'BSC',
      focusTitle: 'Strategi yang lebih mudah dibawa ke review bulanan.',
      focusDescription: 'Alih-alih hanya melihat angka historis, modul ini membantu Anda membaca arah, target, dan disiplin eksekusi.',
      focusItems: [
        'Nyaman dipakai untuk review lintas tim.',
        'Selaras dengan laporan dan forecast di area insight.',
      ],
    },
  },
  '/sales': {
    eyebrow: 'Penjualan',
    title: 'Sales order, invoice, dan dokumen turunan',
    description: 'Dari sini Anda dapat menghubungkan quotation, order, invoice, surat jalan, dan pengiriman dalam satu alur.',
    tone: 'blue',
    metrics: [
      { label: 'Invoice Paid', value: 'Rp164 jt' },
      { label: 'Draft', value: '8 dokumen' },
      { label: 'Komisi', value: 'Rp8,2 jt' },
    ],
    preview: {
      kind: 'list',
      label: 'Dokumen Penjualan',
      hint: 'Cuplikan invoice, status, dan hubungan ke pengiriman.',
      rows: [
        { title: 'INV-2026-0412', meta: 'PT Samudra Retail • Termin 30 hari', value: 'PAID' },
        { title: 'INV-2026-0415', meta: 'UD Amanah Mart • Menunggu kirim', value: 'OPEN' },
        { title: 'INV-2026-0418', meta: 'CV Tunas Pangan • Draft invoice', value: 'DRAFT' },
        { title: 'SJ-2026-0111', meta: 'Surat jalan terkait invoice aktif', value: 'READY' },
      ],
      focusLabel: 'Sales',
      focusTitle: 'Dokumen penjualan terasa nyambung dari quotation sampai invoice.',
      focusDescription: 'Isi preview penjualan saya arahkan ke dokumen dan statusnya, karena itu yang paling terasa saat modul ini dipakai.',
      focusItems: [
        'Tetap nyambung ke stok dan kas.',
        'Komisi reseller bisa dipantau tanpa mengubah invoice customer.',
      ],
    },
  },
  '/inventory': {
    eyebrow: 'Inventori',
    title: 'Produk, stok, dan kesehatan gudang',
    description: 'Inventori membantu Anda melihat hubungan antara SKU, kartu stok, gudang, dan mutasi barang.',
    tone: 'slate',
    metrics: [
      { label: 'SKU', value: '248' },
      { label: 'Gudang', value: '2 aktif' },
      { label: 'Health', value: '92%' },
    ],
    preview: {
      kind: 'list',
      label: 'Stok & Kartu Produk',
      hint: 'Contoh daftar produk, stok, dan sinyal kesehatan inventori.',
      rows: [
        { title: 'Beras Premium 25kg', meta: 'SKU BRS-25 • Gudang Utama', value: '124 qty' },
        { title: 'Minyak Goreng 2L', meta: 'SKU MNY-2L • Reorder point dekat', value: '31 qty' },
        { title: 'Gula Kristal 1kg', meta: 'SKU GLA-1K • Mutasi minggu ini', value: '+18' },
        { title: 'Kartu Stok', meta: 'Write-off, transfer, penyesuaian', value: 'Aktif' },
      ],
      focusLabel: 'Stock',
      focusTitle: 'Lihat kesehatan stok tanpa lepas dari mutasi dan gudang.',
      focusDescription: 'Untuk inventori, preview saya arahkan ke SKU, stok, dan sinyal operasional yang biasanya dicari tim.',
      focusItems: [
        'Nyambung ke pembelian dan penjualan.',
        'Cocok untuk dagang, distribusi, dan retail.',
      ],
    },
  },
  '/cash': {
    eyebrow: 'Kas & Bank',
    title: 'Rekening, saldo, dan arus kas operasional',
    description: 'Modul ini membantu Anda menata transaksi masuk, keluar, dan saldo kas sejak awal operasional.',
    tone: 'blue',
    metrics: [
      { label: 'Rekening', value: '5 aktif' },
      { label: 'Saldo', value: 'Rp248 jt' },
      { label: 'Transaksi', value: '214' },
    ],
    preview: {
      kind: 'list',
      label: 'Rekening & Mutasi',
      hint: 'Ringkasan rekening aktif dan mutasi kas yang paling sering dipantau.',
      rows: [
        { title: 'Kas Utama', meta: 'Operasional harian', value: 'Rp82 jt' },
        { title: 'Bank Mandiri', meta: 'Pembayaran customer', value: 'Rp104 jt' },
        { title: 'Kas Kecil Cabang', meta: 'Pengeluaran cepat', value: 'Rp8,4 jt' },
        { title: 'Modal Awal', meta: 'Jurnal setoran modal', value: 'Posted' },
      ],
      focusLabel: 'Cash',
      focusTitle: 'Rapi sejak modal awal sampai transaksi harian.',
      focusDescription: 'Untuk kas dan bank, yang paling kuat biasanya daftar rekening, saldo, dan mutasi yang terlihat jelas.',
      focusItems: [
        'Sering menjadi setup awal setelah onboarding.',
        'Penting untuk owner maupun tim finance.',
      ],
    },
  },
  '/hris': {
    eyebrow: 'HRIS',
    title: 'Karyawan, absensi, dan payroll',
    description: 'Bagian ini membantu Anda memusatkan data tim agar struktur organisasi, kehadiran, dan proses gaji lebih tertata.',
    tone: 'emerald',
    metrics: [
      { label: 'Karyawan', value: '42' },
      { label: 'Absensi', value: 'Realtime' },
      { label: 'Payroll', value: 'Siap proses' },
    ],
    preview: {
      kind: 'list',
      label: 'Data Tim',
      hint: 'Cuplikan data karyawan, kehadiran, dan kesiapan payroll.',
      rows: [
        { title: 'Aisyah Rahma', meta: 'Finance • Tetap', value: 'Hadir' },
        { title: 'Fikri Maulana', meta: 'Warehouse • Shift pagi', value: 'On duty' },
        { title: 'Payroll April', meta: 'Run bulanan', value: 'Ready' },
        { title: 'Cuti Disetujui', meta: 'Approval HRIS aktif', value: '6 request' },
      ],
      focusLabel: 'HRIS',
      focusTitle: 'SDM tetap terhubung dengan struktur organisasi dan approval.',
      focusDescription: 'Untuk HRIS, preview saya buat lebih terasa sebagai area kerja tim: data orang, kehadiran, dan proses payroll.',
      focusItems: [
        'Role dan permission tetap mengikuti struktur organisasi.',
        'Cocok jika Anda ingin data SDM tidak terpisah dari operasional.',
      ],
    },
  },
  '/hris?tab=attendance': {
    eyebrow: 'Absensi & Cuti',
    title: 'Kehadiran, cuti, dan ritme kerja harian',
    description: 'Tab ini membantu Anda membaca kehadiran tim, jadwal, dan request cuti secara lebih operasional.',
    tone: 'emerald',
    metrics: [
      { label: 'Hadir', value: '36' },
      { label: 'Cuti', value: '3 request' },
      { label: 'Shift', value: '2 aktif' },
    ],
    preview: {
      kind: 'list',
      label: 'Attendance Feed',
      hint: 'Cuplikan data kehadiran dan request cuti yang biasanya dipantau.',
      rows: [
        { title: 'Shift Pagi Gudang', meta: '08.00 - 16.00', value: 'Lengkap' },
        { title: 'Aisyah Rahma', meta: 'Check in 07:54', value: 'Hadir' },
        { title: 'Cuti Tahunan', meta: '2 request menunggu review', value: 'Pending' },
        { title: 'Rekap Harian', meta: 'Sinkron ke payroll', value: 'Aktif' },
      ],
      focusLabel: 'Attendance',
      focusTitle: 'Absensi dan cuti terasa seperti area kerja harian tim.',
      focusDescription: 'Untuk tab attendance, preview saya arahkan ke kehadiran, shift, dan request cuti.',
      focusItems: [
        'Membantu HR dan atasan memantau disiplin kehadiran.',
        'Tetap terhubung ke struktur organisasi dan payroll.',
      ],
    },
  },
  '/hris?tab=payroll': {
    eyebrow: 'Payroll Components',
    title: 'Komponen gaji, tunjangan, dan potongan',
    description: 'Tab ini membantu Anda menjaga struktur komponen payroll agar proses gaji lebih tertata.',
    tone: 'emerald',
    metrics: [
      { label: 'Komponen', value: '14' },
      { label: 'Tunjangan', value: '6' },
      { label: 'Potongan', value: '4' },
    ],
    preview: {
      kind: 'settings',
      label: 'Struktur Payroll',
      hint: 'Cuplikan komponen gaji yang biasanya diatur di tab ini.',
      sections: [
        { title: 'Gaji Pokok', items: ['Staff', 'Supervisor', 'Manager'] },
        { title: 'Tunjangan', items: ['Transport', 'Makan', 'Jabatan'] },
        { title: 'Potongan', items: ['BPJS', 'Pinjaman', 'Absensi'] },
        { title: 'Pengaturan', items: ['Formula', 'Periodisitas', 'Status aktif'] },
      ],
      focusLabel: 'Payroll',
      focusTitle: 'Komponen gaji lebih rapi sebelum run payroll dilakukan.',
      focusDescription: 'Tab payroll components lebih cocok dipreview sebagai struktur komponen dan aturan yang menopang penggajian.',
      focusItems: [
        'Membantu HR menjaga formula payroll tetap konsisten.',
        'Menjadi fondasi untuk proses penggajian bulanan.',
      ],
    },
  },
  '/hris?tab=runs': {
    eyebrow: 'Payroll Runs',
    title: 'Proses penggajian dan status run',
    description: 'Tab ini berfokus pada siklus payroll bulanan, kesiapan data, dan status proses gaji.',
    tone: 'emerald',
    metrics: [
      { label: 'Run Aktif', value: '1' },
      { label: 'Siap Bayar', value: '38' },
      { label: 'Status', value: 'Review' },
    ],
    preview: {
      kind: 'list',
      label: 'Payroll Run',
      hint: 'Cuplikan batch penggajian dan status prosesnya.',
      rows: [
        { title: 'Payroll April 2026', meta: '42 karyawan • Branch consolidated', value: 'Review' },
        { title: 'Komponen Final', meta: 'Tunjangan & potongan sinkron', value: 'Ready' },
        { title: 'Approval Finance', meta: 'Menunggu final check', value: 'Pending' },
        { title: 'Pembayaran', meta: 'Transfer bank / cash', value: 'Prepare' },
      ],
      focusLabel: 'Payroll Run',
      focusTitle: 'Penggajian terasa sebagai batch kerja yang jelas statusnya.',
      focusDescription: 'Untuk payroll runs, preview paling pas memang daftar batch dan status prosesnya.',
      focusItems: [
        'Membantu HR dan finance review sebelum pembayaran.',
        'Nyambung ke absensi, komponen, dan approval.',
      ],
    },
  },
  '/purchasing': {
    eyebrow: 'Purchasing',
    title: 'Purchase order, vendor, dan penerimaan barang',
    description: 'Area ini berfokus pada dokumen pembelian, status PO, dan progres penerimaan.',
    tone: 'blue',
    metrics: [
      { label: 'PO Aktif', value: '12' },
      { label: 'Vendor', value: '38' },
      { label: 'Inbound', value: '7 siap' },
    ],
    preview: {
      kind: 'list',
      label: 'Purchase Order',
      hint: 'Contoh dokumen pembelian dan status inbound yang biasa dicek.',
      rows: [
        { title: 'PO-2026-0081', meta: 'CV Bahan Berkah • Termin 14 hari', value: 'Approved' },
        { title: 'PO-2026-0084', meta: 'PT Pangan Jaya • Menunggu kirim', value: 'Open' },
        { title: 'Inbound-042', meta: 'Penerimaan gudang utama', value: 'Ready' },
        { title: 'Tagihan Vendor', meta: 'Sinkron ke hutang usaha', value: '2 due' },
      ],
      focusLabel: 'PO',
      focusTitle: 'Pembelian lebih rapi dari vendor sampai barang diterima.',
      focusDescription: 'Preview pembelian saya arahkan ke PO dan penerimaan barang karena itu alur utamanya.',
      focusItems: [
        'Vendor, stok, dan jurnal tetap saling terhubung.',
        'Nyaman dipakai untuk tim pembelian dan gudang.',
      ],
    },
  },
  '/contacts': {
    eyebrow: 'CRM',
    title: 'Pelanggan, pemasok, dan relasi bisnis',
    description: 'CRM membantu Anda menyimpan relasi bisnis agar bisa dipakai ulang di sales, purchasing, dan penagihan.',
    tone: 'blue',
    metrics: [
      { label: 'Customer', value: '164' },
      { label: 'Supplier', value: '38' },
      { label: 'Kontak', value: '229' },
    ],
    preview: {
      kind: 'list',
      label: 'Master Relasi',
      hint: 'Daftar relasi yang biasanya menjadi basis transaksi lintas modul.',
      rows: [
        { title: 'PT Samudra Retail', meta: 'Customer • Termin 30 hari', value: 'Aktif' },
        { title: 'CV Bahan Berkah', meta: 'Supplier • Bahan baku', value: 'Aktif' },
        { title: 'Koperasi Bina Usaha', meta: 'Customer • Wholesale', value: 'VIP' },
        { title: 'Kontak PIC', meta: 'Email, phone, NPWP, alamat', value: 'Lengkap' },
      ],
      focusLabel: 'CRM',
      focusTitle: 'Master relasi yang siap dipakai ulang di banyak modul.',
      focusDescription: 'Di CRM, yang paling penting adalah menjaga data relasi tetap rapi dan mudah dipakai kembali.',
      focusItems: [
        'Dipakai ulang di sales, purchasing, dan penagihan.',
        'Membantu tim mengurangi input data berulang.',
      ],
    },
  },
  '/pos': {
    eyebrow: 'POS',
    title: 'Kasir cepat untuk transaksi langsung',
    description: 'POS membantu kasir menyelesaikan transaksi lebih cepat tanpa memutus pencatatan stok dan pembayaran.',
    tone: 'amber',
    metrics: [
      { label: 'Keranjang', value: '6 item' },
      { label: 'Shift', value: 'Aktif' },
      { label: 'Promo', value: '2 tersedia' },
    ],
    preview: {
      kind: 'list',
      label: 'Keranjang Kasir',
      hint: 'Contoh item transaksi cepat di area POS.',
      rows: [
        { title: 'Beras Premium 5kg', meta: '2 x Rp74.000', value: 'Rp148.000' },
        { title: 'Minyak Goreng 2L', meta: '1 x Rp31.000', value: 'Rp31.000' },
        { title: 'Promo Bundling', meta: 'Diskon otomatis', value: '-Rp7.500' },
        { title: 'Pembayaran', meta: 'QRIS / Tunai / Transfer', value: 'Ready' },
      ],
      focusLabel: 'POS',
      focusTitle: 'Transaksi cepat, tapi stok dan kas tetap rapi.',
      focusDescription: 'Preview POS saya arahkan ke keranjang dan pembayaran karena itu permukaan yang paling terasa di kasir.',
      focusItems: [
        'Cocok untuk toko, counter, dan retail cepat.',
        'Tetap sinkron ke stok dan rekening terkait.',
      ],
    },
  },
  '/sales/quotations': {
    eyebrow: 'Quotation',
    title: 'Penawaran resmi sebelum order berjalan',
    description: 'Quotation membantu tim sales menjaga proposal harga tetap rapi dan siap dikonversi.',
    tone: 'blue',
    metrics: [
      { label: 'Quote Aktif', value: '18' },
      { label: 'Conversion', value: '42%' },
      { label: 'Follow Up', value: '7' },
    ],
    preview: {
      kind: 'list',
      label: 'Daftar Penawaran',
      hint: 'Cuplikan dokumen quotation dan progres follow up.',
      rows: [
        { title: 'QT-2026-0021', meta: 'PT Samudra Retail • 14 item', value: 'Sent' },
        { title: 'QT-2026-0024', meta: 'Koperasi Bina Usaha • Revisi harga', value: 'Revision' },
        { title: 'QT-2026-0025', meta: 'CV Tunas Pangan • Potensi order', value: 'Negotiation' },
        { title: 'Konversi', meta: 'Lanjut ke sales order / invoice', value: 'Ready' },
      ],
      focusLabel: 'Quote',
      focusTitle: 'Penawaran lebih siap dikonversi menjadi transaksi.',
      focusDescription: 'Quotation saya tampilkan sebagai daftar dokumen, karena yang biasanya dicari adalah status, revisi, dan follow up.',
      focusItems: [
        'Memudahkan sales menjaga histori penawaran.',
        'Nyambung ke order dan invoice setelah disetujui.',
      ],
    },
  },
  '/sales/pipeline': {
    eyebrow: 'Pipeline',
    title: 'Kanban peluang penjualan',
    description: 'Pipeline membantu Anda memantau prospek dari tahap awal sampai closing.',
    tone: 'amber',
    metrics: [
      { label: 'Lead Aktif', value: '26' },
      { label: 'Open Value', value: 'Rp418 jt' },
      { label: 'Win Rate', value: '34%' },
    ],
    preview: {
      kind: 'board',
      label: 'Tahap Pipeline',
      hint: 'Kanban singkat yang terasa lebih dekat ke modul pipeline.',
      columns: [
        { title: 'Prospek', items: ['Hotel Amanah • Retail pack', 'Klinik Sehat • Office supply'] },
        { title: 'Negosiasi', items: ['PT Samudra Retail • Volume pricing', 'UD Amanah Mart • Termin baru'] },
        { title: 'Closing', items: ['CV Tunas Pangan • Draft invoice', 'Koperasi Bina Usaha • Menunggu PO'] },
      ],
      focusLabel: 'Pipeline',
      focusTitle: 'Peluang bisnis lebih mudah dipantau tahap demi tahap.',
      focusDescription: 'Untuk pipeline, pola preview yang paling cocok memang kanban, bukan daftar angka datar.',
      focusItems: [
        'Enak dipakai untuk daily review tim sales.',
        'Membantu owner melihat progres peluang secara cepat.',
      ],
    },
  },
  '/sales/commission': {
    eyebrow: 'Komisi',
    title: 'Target reseller dan estimasi komisi',
    description: 'Area ini membantu Anda memantau channel partner tanpa mengubah invoice ke customer.',
    tone: 'emerald',
    metrics: [
      { label: 'Reseller', value: '12' },
      { label: 'Target', value: 'Rp980 jt' },
      { label: 'Estimasi', value: 'Rp18 jt' },
    ],
    preview: {
      kind: 'list',
      label: 'Reseller Aktif',
      hint: 'Target, skema komisi, dan estimasi per invoice.',
      rows: [
        { title: 'Amanah Partner', meta: 'PERCENT • 2.5%', value: 'Rp6,4 jt' },
        { title: 'Sahabat Retail', meta: 'FIXED • Rp75.000/inv', value: 'Rp2,1 jt' },
        { title: 'Komisi Berjalan', meta: 'Snapshot per invoice', value: 'Aktif' },
        { title: 'Target Bulanan', meta: 'Gabungan channel partner', value: '78%' },
      ],
      focusLabel: 'Komisi',
      focusTitle: 'Channel partner bisa dipantau tanpa mengubah nilai invoice.',
      focusDescription: 'Preview komisi saya arahkan ke reseller, target, dan estimasi karena itu konteks utamanya.',
      focusItems: [
        'Tetap jujur ke nilai invoice customer.',
        'Cocok untuk skema persen maupun nominal tetap.',
      ],
    },
  },
  '/sales/promos': {
    eyebrow: 'Promo',
    title: 'Promo dan reward yang siap dipakai',
    description: 'Gunakan area ini untuk melihat promo aktif, syaratnya, dan dampaknya ke transaksi.',
    tone: 'amber',
    metrics: [
      { label: 'Promo Aktif', value: '4' },
      { label: 'Reward', value: '2 skema' },
      { label: 'Impact', value: '+12%' },
    ],
    preview: {
      kind: 'list',
      label: 'Program Promo',
      hint: 'Cuplikan promo aktif dan konteks pemakaiannya.',
      rows: [
        { title: 'Bundling Ramadan', meta: 'Min. 3 item tertentu', value: 'Active' },
        { title: 'Voucher Reseller', meta: 'Partner channel saja', value: 'Targeted' },
        { title: 'Reward Repeat Order', meta: 'Customer loyal', value: 'On' },
        { title: 'POS Sync', meta: 'Promo muncul di kasir', value: 'Ready' },
      ],
      focusLabel: 'Promo',
      focusTitle: 'Program promo bisa dipantau tanpa membuat penjualan berantakan.',
      focusDescription: 'Preview promo lebih cocok sebagai daftar program aktif dan syaratnya, bukan sebagai grafik generik.',
      focusItems: [
        'Nyambung ke POS dan penjualan.',
        'Membantu tim sales menjaga program tetap terukur.',
      ],
    },
  },
  '/sales/pages': {
    eyebrow: 'Sales Page',
    title: 'Landing page penjualan untuk tenant',
    description: 'Area ini membantu Anda mengelola halaman publik, draft, dan status publish.',
    tone: 'blue',
    metrics: [
      { label: 'Published', value: '3' },
      { label: 'Draft', value: '2' },
      { label: 'CTA', value: 'Aktif' },
    ],
    preview: {
      kind: 'settings',
      label: 'Halaman Publik',
      hint: 'Cuplikan pengaturan draft, publish, dan call-to-action.',
      sections: [
        { title: 'Status Halaman', items: ['Draft', 'Published', 'Archived'] },
        { title: 'Konten Utama', items: ['Hero', 'Benefit', 'Produk', 'CTA'] },
        { title: 'Distribusi', items: ['Slug publik', 'Link share', 'CTA WhatsApp'] },
        { title: 'Monitoring', items: ['Lead masuk', 'Form capture', 'Konversi'] },
      ],
      focusLabel: 'Sales Page',
      focusTitle: 'Kelola halaman publik tanpa keluar dari ritme operasional.',
      focusDescription: 'Sales page lebih cocok dipreview sebagai workspace publish dan struktur konten.',
      focusItems: [
        'Berbeda dari landing page NIZAM utama.',
        'Dipakai tenant untuk kebutuhan promosi mereka sendiri.',
      ],
    },
  },
  '/inventory/warehouses': {
    eyebrow: 'Gudang',
    title: 'Lokasi gudang, kapasitas, dan mutasi',
    description: 'Gudang membantu Anda membaca lokasi stok dan perpindahannya secara lebih operasional.',
    tone: 'slate',
    metrics: [
      { label: 'Gudang', value: '2 aktif' },
      { label: 'Bin', value: '18' },
      { label: 'Transfer', value: '6 open' },
    ],
    preview: {
      kind: 'settings',
      label: 'Struktur Gudang',
      hint: 'Cuplikan lokasi gudang dan elemen pengelolaannya.',
      sections: [
        { title: 'Gudang Utama', items: ['Receiving', 'Staging', 'Picking'] },
        { title: 'Cabang Timur', items: ['Retail rack', 'Fast moving', 'Return area'] },
        { title: 'Operasional', items: ['Transfer antar gudang', 'Stock opname', 'Write-off'] },
        { title: 'Pelacakan', items: ['Kartu stok', 'Mutasi', 'Riwayat penyesuaian'] },
      ],
      focusLabel: 'WMS',
      focusTitle: 'Baca lokasi dan aliran stok, bukan hanya angka totalnya.',
      focusDescription: 'Gudang saya buat lebih terasa sebagai struktur lokasi dan perpindahan, karena itu inti WMS.',
      focusItems: [
        'Cocok untuk bisnis dengan lebih dari satu area penyimpanan.',
        'Tetap nyambung ke inventori dan pembelian.',
      ],
    },
  },
  '/factory': {
    eyebrow: 'Manufaktur',
    title: 'BoM, work order, dan progres produksi',
    description: 'Area manufaktur berfokus pada resep produksi, tahapan proses, dan keterkaitannya ke stok.',
    tone: 'amber',
    metrics: [
      { label: 'BoM', value: '14' },
      { label: 'WO Aktif', value: '6' },
      { label: 'Yield', value: '94%' },
    ],
    preview: {
      kind: 'board',
      label: 'Tahap Produksi',
      hint: 'Kanban singkat untuk menunjukkan ritme order produksi.',
      columns: [
        { title: 'Planning', items: ['WO Sirup Kurma', 'WO Madu Pack'] },
        { title: 'In Process', items: ['Mixing batch #12', 'Packing batch #09'] },
        { title: 'Finished', items: ['Kurma Pack 250ml', 'Madu Hutan 500ml'] },
      ],
      focusLabel: 'Factory',
      focusTitle: 'Produksi terasa sebagai alur kerja, bukan sekadar daftar bahan.',
      focusDescription: 'Untuk manufaktur, preview yang paling jujur adalah tahapan work order dan progresnya.',
      focusItems: [
        'BoM, stok bahan, dan output tetap saling terkait.',
        'Membantu tim produksi membaca status dengan cepat.',
      ],
    },
  },
  '/fleet': {
    eyebrow: 'Fleet',
    title: 'Aset armada, jadwal, dan tiket operasional',
    description: 'Fleet & Rental membantu Anda memantau unit, penggunaan, dan aktivitas lapangan.',
    tone: 'slate',
    metrics: [
      { label: 'Unit', value: '9' },
      { label: 'Jadwal', value: '13' },
      { label: 'Tiket', value: '4 open' },
    ],
    preview: {
      kind: 'list',
      label: 'Aktivitas Armada',
      hint: 'Cuplikan unit, jadwal, dan tiket yang biasa dipantau.',
      rows: [
        { title: 'B-9123-NZM', meta: 'Pickup logistik • Unit aktif', value: 'On route' },
        { title: 'Maintenance Van 02', meta: 'Jadwal servis', value: 'Due' },
        { title: 'Rental MPV', meta: 'Booking pelanggan', value: 'Booked' },
        { title: 'Fleet Ticket', meta: 'Keluhan operasional', value: '4 open' },
      ],
      focusLabel: 'Fleet',
      focusTitle: 'Armada, jadwal, dan tiket operasional terasa dalam satu area.',
      focusDescription: 'Preview fleet saya arahkan ke unit dan aktivitas lapangan karena itu yang paling terasa di modul ini.',
      focusItems: [
        'Cocok untuk operasional distribusi maupun rental.',
        'Memudahkan pembacaan status unit secara cepat.',
      ],
    },
  },
  '/services': {
    eyebrow: 'Job Order',
    title: 'Pekerjaan jasa dari permintaan sampai selesai',
    description: 'Job order membantu Anda melihat permintaan, progres kerja, dan penyelesaian layanan.',
    tone: 'blue',
    metrics: [
      { label: 'JO Aktif', value: '11' },
      { label: 'SLA', value: '87%' },
      { label: 'Ready Bill', value: '5' },
    ],
    preview: {
      kind: 'board',
      label: 'Tahap Job Order',
      hint: 'Board singkat untuk menunjukkan alur kerja jasa.',
      columns: [
        { title: 'Masuk', items: ['Service mesin pack', 'Instalasi outlet baru'] },
        { title: 'Dikerjakan', items: ['Kalibrasi alat timbang', 'Preventive AC cabang'] },
        { title: 'Selesai', items: ['Survey lokasi retail', 'Maintenance kendaraan'] },
      ],
      focusLabel: 'Service',
      focusTitle: 'Pekerjaan jasa lebih mudah dibaca per tahap pengerjaan.',
      focusDescription: 'Untuk job order, kanban terasa lebih jujur daripada grafik generik, karena proses kerjanya memang bertahap.',
      focusItems: [
        'Membantu tim layanan membaca prioritas.',
        'Tagihan akhir bisa disiapkan lebih rapi.',
      ],
    },
  },
  '/reports': {
    eyebrow: 'Laporan',
    title: 'Laporan keuangan dan insight utama',
    description: 'Laporan menjadi tempat membaca hasil dari transaksi yang sudah berjalan di modul-modul lain.',
    tone: 'blue',
    metrics: [
      { label: 'P&L', value: 'Ready' },
      { label: 'Neraca', value: 'Ready' },
      { label: 'Arus Kas', value: 'Ready' },
    ],
    preview: {
      kind: 'settings',
      label: 'Area Insight',
      hint: 'Cuplikan kelompok laporan yang paling sering dibuka owner.',
      sections: [
        { title: 'Keuangan', items: ['Laba Rugi', 'Neraca', 'Arus Kas'] },
        { title: 'Perputaran', items: ['Aging AR/AP', 'Forecast', 'Pareto'] },
        { title: 'Strategi', items: ['BSC', 'KPI', 'Review score'] },
        { title: 'Pendukung', items: ['Zakat', 'Pajak', 'Audit'] },
      ],
      focusLabel: 'Reports',
      focusTitle: 'Semua transaksi akhirnya bermuara ke area baca ini.',
      focusDescription: 'Laporan saya tampilkan sebagai kelompok insight, karena user biasanya masuk lewat kategori laporan, bukan satu grafik saja.',
      focusItems: [
        'Cocok untuk owner dan finance review.',
        'Membantu membaca angka dari sumber data yang sama.',
      ],
    },
  },
  '/accounting/forecast': {
    eyebrow: 'Forecast',
    title: 'Proyeksi kas dan arah likuiditas',
    description: 'Forecast membantu Anda membaca pergerakan kas ke depan berdasarkan data yang sudah berjalan.',
    tone: 'amber',
    metrics: [
      { label: 'Runway', value: '7,4 bulan' },
      { label: 'Net Change', value: '+Rp16 jt' },
      { label: 'Alert', value: '1' },
    ],
    snapshotBars: [38, 44, 49, 58, 64, 71],
    notes: [
      'Forecast biasanya dibaca bersama cash flow dan budget.',
      'Membantu owner mengantisipasi tekanan likuiditas.',
      'Cocok untuk review bulanan atau mingguan.',
    ],
  },
  '/accounting/aging': {
    eyebrow: 'Aging',
    title: 'Jatuh tempo piutang dan hutang',
    description: 'Aging membantu Anda membaca akun mana yang menahan kas dan mana yang perlu segera ditindak.',
    tone: 'slate',
    metrics: [
      { label: 'AR', value: 'Rp48 jt' },
      { label: 'AP', value: 'Rp74 jt' },
      { label: 'Due', value: '11 akun' },
    ],
    preview: {
      kind: 'list',
      label: 'Bucket Aging',
      hint: 'Daftar akun dan bucket umur tagihan yang biasa dicek finance.',
      rows: [
        { title: 'PT Samudra Retail', meta: 'Piutang 31-60 hari', value: 'Rp14 jt' },
        { title: 'CV Bahan Berkah', meta: 'Hutang 1-30 hari', value: 'Rp18 jt' },
        { title: 'UD Amanah Mart', meta: 'Piutang current', value: 'Rp9,2 jt' },
        { title: 'Overdue Alert', meta: 'Akun perlu follow up', value: '4' },
      ],
      focusLabel: 'Aging',
      focusTitle: 'Baca tekanan kas dari umur piutang dan hutang.',
      focusDescription: 'Aging lebih pas dipreview sebagai daftar akun dan bucket umur, bukan sekadar tren.',
      focusItems: [
        'Membantu follow up penagihan lebih disiplin.',
        'Berguna untuk finance dan owner review.',
      ],
    },
  },
  '/settings/accounts': {
    eyebrow: 'CoA',
    title: 'Struktur akun dan pengelompokan pencatatan',
    description: 'Chart of Accounts menjadi fondasi agar modul lain bisa mencatat ke akun yang benar.',
    tone: 'blue',
    metrics: [
      { label: 'Akun', value: '146' },
      { label: 'PSAK', value: 'Aktif' },
      { label: 'Request', value: '2' },
    ],
    preview: {
      kind: 'settings',
      label: 'Kelompok Akun',
      hint: 'Cuplikan struktur akun inti untuk modul keuangan.',
      sections: [
        { title: 'Aset', items: ['Kas & Bank', 'Piutang', 'Persediaan'] },
        { title: 'Liabilitas', items: ['Hutang usaha', 'Pajak', 'Akrual'] },
        { title: 'Ekuitas', items: ['Modal', 'Laba ditahan', 'Prive'] },
        { title: 'P&L', items: ['Pendapatan', 'HPP', 'Beban operasional'] },
      ],
      focusLabel: 'CoA',
      focusTitle: 'Fondasi pencatatan yang dipakai lintas modul.',
      focusDescription: 'Untuk CoA, preview yang paling jujur adalah struktur kelompok akun, bukan daftar transaksi.',
      focusItems: [
        'Menjadi fondasi finance, sales, inventory, dan purchasing.',
        'Penting diaktifkan di tahap awal implementasi.',
      ],
    },
  },
  '/settings/roles': {
    eyebrow: 'Roles',
    title: 'Hak akses dan jabatan tim',
    description: 'Atur siapa melihat apa, agar modul yang muncul sesuai tanggung jawab tiap orang.',
    tone: 'slate',
    metrics: [
      { label: 'Role', value: '9' },
      { label: 'Permission', value: 'Terkelola' },
      { label: 'Aktivasi', value: 'Link siap' },
    ],
    preview: {
      kind: 'settings',
      label: 'Matriks Akses',
      hint: 'Cuplikan pengaturan role dan permission lintas modul.',
      sections: [
        { title: 'Owner / Admin', items: ['Full dashboard', 'Approval', 'Reports'] },
        { title: 'Finance', items: ['Kas & Bank', 'Journal', 'Aging'] },
        { title: 'Sales', items: ['Quotation', 'Penjualan', 'Pipeline'] },
        { title: 'HRIS / Ops', items: ['HRIS', 'Inventori', 'Gudang'] },
      ],
      focusLabel: 'Access',
      focusTitle: 'Tiap orang melihat modul sesuai tanggung jawabnya.',
      focusDescription: 'Role lebih cocok dipreview sebagai matriks akses dan kelompok permission.',
      focusItems: [
        'Memudahkan implementasi tim multi-peran.',
        'Penting untuk menjaga kontrol internal.',
      ],
    },
  },
  '/settings/branches': {
    eyebrow: 'Cabang',
    title: 'Unit bisnis dan cabang aktif',
    description: 'Cabang membantu Anda memisahkan konteks transaksi tanpa memecah sistem.',
    tone: 'blue',
    metrics: [
      { label: 'Cabang', value: '3' },
      { label: 'Aktif', value: '2' },
      { label: 'Unit', value: 'Ready' },
    ],
    preview: {
      kind: 'settings',
      label: 'Struktur Cabang',
      hint: 'Cuplikan entitas unit dan konteks transaksi aktif.',
      sections: [
        { title: 'Unit Utama', items: ['MAIN', 'Kas utama', 'Gudang utama'] },
        { title: 'Cabang Timur', items: ['Retail', 'Kas kecil', 'Stok cabang'] },
        { title: 'Penggunaan', items: ['Filter transaksi', 'Approval', 'Ringkasan agregat'] },
        { title: 'Kontrol', items: ['Aktif / nonaktif', 'PIC cabang', 'Alamat'] },
      ],
      focusLabel: 'Branch',
      focusTitle: 'Multi-cabang tanpa kehilangan konteks unit aktif.',
      focusDescription: 'Cabang saya tampilkan sebagai struktur unit karena itu yang biasanya dibaca sebelum transaksi berjalan.',
      focusItems: [
        'Penting untuk bisnis dengan lebih dari satu lokasi.',
        'Tetap bisa dibaca agregat dari level owner.',
      ],
    },
  },
  '/settings/business': {
    eyebrow: 'Profil Bisnis',
    title: 'Identitas brand dan data usaha',
    description: 'Lengkapi identitas bisnis agar dokumen resmi dan tampilan sistem terasa konsisten.',
    tone: 'blue',
    metrics: [
      { label: 'Brand', value: 'Siap' },
      { label: 'Slug', value: 'Aktif' },
      { label: 'Dokumen', value: 'Terhubung' },
    ],
    preview: {
      kind: 'settings',
      label: 'Identitas Bisnis',
      hint: 'Elemen utama yang biasanya diatur di profil bisnis.',
      sections: [
        { title: 'Brand', items: ['Nama usaha', 'Logo', 'Slug publik'] },
        { title: 'Legal', items: ['Alamat', 'NPWP', 'Kontak resmi'] },
        { title: 'Dokumen', items: ['Invoice header', 'Surat jalan', 'Footer info'] },
        { title: 'Tampilan', items: ['Brand name', 'Signature', 'Kontak admin'] },
      ],
      focusLabel: 'Business',
      focusTitle: 'Identitas usaha yang konsisten di seluruh dokumen.',
      focusDescription: 'Profil bisnis lebih pas dipreview sebagai pengaturan identitas dan dokumen.',
      focusItems: [
        'Biasanya diisi di tahap setup awal.',
        'Membantu invoice dan surat jalan terasa lebih rapi.',
      ],
    },
  },
  '/settings/business/migration': {
    eyebrow: 'Migrasi Data',
    title: 'Pusat onboarding client pindahan',
    description: 'Semua panduan migrasi, cut-off, checklist, dan template Excel dikumpulkan di satu tempat agar onboarding lebih konsisten.',
    tone: 'blue',
    metrics: [
      { label: 'Template', value: '12 sheet' },
      { label: 'Default', value: 'Saldo Awal' },
      { label: 'Go-Live', value: 'Terkontrol' },
    ],
    preview: {
      kind: 'settings',
      label: 'Pusat Migrasi',
      hint: 'Yang biasanya dibutuhkan tim sebelum client mulai live di NIZAM.',
      sections: [
        { title: 'Cut-off', items: ['Tanggal akhir sistem lama', 'Tanggal mulai NIZAM', 'Status periode'] },
        { title: 'Data Wajib', items: ['Neraca', 'Stok', 'AR/AP', 'Master produk'] },
        { title: 'Template', items: ['Workbook Excel', 'Opening stock', 'BoM', 'Cash bank'] },
        { title: 'Validasi', items: ['Neraca balance', 'Stok cocok', 'Go-live checklist'] },
      ],
      focusLabel: 'Migration',
      focusTitle: 'Onboarding lebih rapi saat semua resource migrasi ada di satu halaman.',
      focusDescription: 'Halaman ini sengaja dirancang sebagai pusat koordinasi tim onboarding dan client.',
      focusItems: [
        'Cocok untuk user pindahan dari Excel atau aplikasi lain.',
        'Mempercepat persiapan file sebelum import dan rekonsiliasi.',
      ],
    },
  },
  '/settings/audit': {
    eyebrow: 'Audit Trail',
    title: 'Riwayat perubahan data',
    description: 'Audit trail membantu admin melacak perubahan penting dan jejak aktivitas sistem.',
    tone: 'slate',
    metrics: [
      { label: 'Log Hari Ini', value: '38' },
      { label: 'User', value: '9 aktif' },
      { label: 'Alert', value: '0' },
    ],
    preview: {
      kind: 'list',
      label: 'Riwayat Aktivitas',
      hint: 'Cuplikan log perubahan yang biasa dilihat admin.',
      rows: [
        { title: 'Invoice diperbarui', meta: 'oleh Admin Sales • 10:12', value: 'Sales' },
        { title: 'PO disetujui', meta: 'oleh Finance • 09:41', value: 'Purchasing' },
        { title: 'Role user diubah', meta: 'oleh Owner • 08:55', value: 'Settings' },
        { title: 'Penyesuaian stok', meta: 'oleh Warehouse • 08:11', value: 'Inventory' },
      ],
      focusLabel: 'Audit',
      focusTitle: 'Jejak perubahan lebih mudah dibaca dan dipertanggungjawabkan.',
      focusDescription: 'Untuk audit trail, daftar log jauh lebih mewakili isi modul daripada grafik generik.',
      focusItems: [
        'Membantu admin memeriksa perubahan data.',
        'Berguna untuk kontrol internal dan investigasi ringan.',
      ],
    },
  },
  '/accounting/audit': {
    eyebrow: 'Audit Integritas',
    title: 'Kesehatan transaksi dan konsistensi data',
    description: 'Area ini membantu Anda melihat sinyal integritas data dan transaksi yang perlu diperiksa.',
    tone: 'amber',
    metrics: [
      { label: 'Check', value: '12' },
      { label: 'Warning', value: '2' },
      { label: 'Status', value: 'Mayoritas sehat' },
    ],
    preview: {
      kind: 'list',
      label: 'Integrity Checks',
      hint: 'Cuplikan hasil pemeriksaan dan warning yang perlu ditinjau.',
      rows: [
        { title: 'Invoice tanpa payment mapping', meta: 'Penjualan', value: '1 warning' },
        { title: 'Stock movement mismatch', meta: 'Inventory', value: '0' },
        { title: 'Approval pending terlalu lama', meta: 'Approval', value: '1 warning' },
        { title: 'Journal completeness', meta: 'Finance', value: 'OK' },
      ],
      focusLabel: 'Integrity',
      focusTitle: 'Audit integritas membantu Anda memeriksa kesehatan data bisnis.',
      focusDescription: 'Modul ini lebih cocok dipreview sebagai hasil check dan warning yang memang perlu ditindak.',
      focusItems: [
        'Membantu admin memeriksa transaksi yang ganjil.',
        'Berguna sebelum closing atau review rutin.',
      ],
    },
  },
  '/settings/sub-orgs': {
    eyebrow: 'Sub Org',
    title: 'Anak perusahaan dan struktur entitas',
    description: 'Kelola entitas turunan tanpa kehilangan konteks organisasi utama.',
    tone: 'slate',
    metrics: [
      { label: 'Entitas', value: '2' },
      { label: 'Konsolidasi', value: 'Siap' },
      { label: 'Status', value: 'Aktif' },
    ],
    preview: {
      kind: 'settings',
      label: 'Struktur Entitas',
      hint: 'Cuplikan pengelompokan org utama dan turunan.',
      sections: [
        { title: 'Holding', items: ['NIZAM Demo Group', 'Owner access', 'Global review'] },
        { title: 'Entitas Turunan', items: ['Retail Unit', 'Distribusi Unit'] },
        { title: 'Kontrol', items: ['Aktif/nonaktif', 'Member access', 'Pemilihan org'] },
        { title: 'Konsolidasi', items: ['Ringkasan laporan', 'Pemilihan org', 'Audit'] },
      ],
      focusLabel: 'Org',
      focusTitle: 'Struktur entitas tetap rapi saat bisnis bertambah.',
      focusDescription: 'Sub-org saya preview sebagai struktur entitas karena itu konteks utamanya.',
      focusItems: [
        'Cocok untuk bisnis dengan beberapa unit usaha.',
        'Tetap menjaga isolasi data per organisasi.',
      ],
    },
  },
  '/settings/ticketing': {
    eyebrow: 'Support Ticket',
    title: 'Permintaan bantuan dan tindak lanjut',
    description: 'Support ticket membantu tim Anda mencatat isu, permintaan, dan progres penanganannya.',
    tone: 'blue',
    metrics: [
      { label: 'Open', value: '4' },
      { label: 'In Progress', value: '3' },
      { label: 'Resolved', value: '12' },
    ],
    preview: {
      kind: 'board',
      label: 'Alur Support Ticket',
      hint: 'Board singkat untuk memperlihatkan progres permintaan bantuan.',
      columns: [
        { title: 'Open', items: ['Perbaiki akses user', 'Update template invoice'] },
        { title: 'Progress', items: ['Sync approval role', 'Bug stock adjustment'] },
        { title: 'Resolved', items: ['Reset cabang utama', 'Update payroll code'] },
      ],
      focusLabel: 'Support Ticket',
      focusTitle: 'Permintaan bantuan lebih mudah ditindak per tahap.',
      focusDescription: 'Support ticket saya tampilkan seperti board status karena itu bentuk kerjanya sehari-hari.',
      focusItems: [
        'Membantu tim support atau admin internal.',
        'Mudah dibaca untuk follow up dan prioritas.',
      ],
    },
  },
  '/accounting/journal': {
    eyebrow: 'Journal',
    title: 'Buku besar dan pencatatan jurnal',
    description: 'Jurnal membantu Anda membaca catatan keuangan inti yang menopang laporan.',
    tone: 'slate',
    metrics: [
      { label: 'Entry', value: '214' },
      { label: 'Posted', value: '206' },
      { label: 'Draft', value: '8' },
    ],
    preview: {
      kind: 'list',
      label: 'Jurnal Terkini',
      hint: 'Cuplikan entri jurnal dan status posting.',
      rows: [
        { title: 'JE-2026-0104', meta: 'Setoran modal awal', value: 'POSTED' },
        { title: 'JE-2026-0112', meta: 'Pembelian bahan baku', value: 'POSTED' },
        { title: 'JE-2026-0118', meta: 'Reklas piutang', value: 'DRAFT' },
        { title: 'Ledger Sync', meta: 'Terhubung ke laporan', value: 'OK' },
      ],
      focusLabel: 'Journal',
      focusTitle: 'Catatan keuangan inti tetap mudah ditinjau.',
      focusDescription: 'Buku besar lebih pas dipreview sebagai daftar entry dan status posting.',
      focusItems: [
        'Penting untuk finance review.',
        'Menjadi dasar laba rugi dan neraca.',
      ],
    },
  },
  '/accounting/tax': {
    eyebrow: 'Tax',
    title: 'Pajak dan pemantauan kewajiban terkait',
    description: 'Area ini membantu Anda menandai konteks pajak tanpa memutus alur akuntansi.',
    tone: 'amber',
    metrics: [
      { label: 'Output Tax', value: 'Rp18 jt' },
      { label: 'Input Tax', value: 'Rp11 jt' },
      { label: 'Due', value: '1 periode' },
    ],
    preview: {
      kind: 'list',
      label: 'Ringkasan Pajak',
      hint: 'Cuplikan area yang biasanya dibaca saat review pajak.',
      rows: [
        { title: 'PPN Keluaran', meta: 'Dari penjualan', value: 'Rp18 jt' },
        { title: 'PPN Masukan', meta: 'Dari pembelian', value: 'Rp11 jt' },
        { title: 'Periode April', meta: 'Siap review', value: 'Open' },
        { title: 'Dokumen Pendukung', meta: 'Invoice & jurnal', value: 'Linked' },
      ],
      focusLabel: 'Tax',
      focusTitle: 'Pajak dibaca dalam konteks transaksi yang sudah terjadi.',
      focusDescription: 'Pajak saya preview sebagai ringkasan kewajiban dan sumber transaksinya.',
      focusItems: [
        'Membantu finance menjaga review lebih tertib.',
        'Tetap terhubung ke invoice dan pembelian.',
      ],
    },
  },
  '/accounting/reimburse': {
    eyebrow: 'Reimbursement',
    title: 'Pengajuan dan penggantian biaya',
    description: 'Kelola reimburse agar pengajuan, approval, dan pencatatannya tidak tercecer.',
    tone: 'blue',
    metrics: [
      { label: 'Request', value: '9' },
      { label: 'Approved', value: '6' },
      { label: 'Due', value: '2' },
    ],
    preview: {
      kind: 'list',
      label: 'Reimburse Aktif',
      hint: 'Cuplikan pengajuan biaya dan status persetujuannya.',
      rows: [
        { title: 'Transport sales visit', meta: 'Aisyah • Bukti lengkap', value: 'Approved' },
        { title: 'Pembelian alat tulis', meta: 'Fikri • Menunggu review', value: 'Pending' },
        { title: 'Klaim bensin operasional', meta: 'Armada 02', value: 'Ready pay' },
        { title: 'Pencatatan', meta: 'Sinkron ke finance', value: 'Linked' },
      ],
      focusLabel: 'Reimburse',
      focusTitle: 'Penggantian biaya lebih tertib dari request sampai pembayaran.',
      focusDescription: 'Reimburse saya preview sebagai daftar pengajuan dan status approval, karena itu yang paling sering dibaca.',
      focusItems: [
        'Cocok untuk tim lapangan dan admin.',
        'Tetap nyambung ke approval dan finance.',
      ],
    },
  },
  '/accounting/closing': {
    eyebrow: 'Closing',
    title: 'Penutupan buku dan checklist akhir periode',
    description: 'Closing membantu Anda menyiapkan review akhir periode dengan urutan yang lebih tertib.',
    tone: 'amber',
    metrics: [
      { label: 'Periode', value: 'Apr 2026' },
      { label: 'Checklist', value: '8 item' },
      { label: 'Ready', value: '75%' },
    ],
    preview: {
      kind: 'settings',
      label: 'Checklist Closing',
      hint: 'Cuplikan hal-hal yang biasa dicek sebelum buku ditutup.',
      sections: [
        { title: 'Finance', items: ['Jurnal posted', 'Kas cocok', 'Aging review'] },
        { title: 'Inventory', items: ['Mutasi selesai', 'Write-off clear', 'Stock opname'] },
        { title: 'Sales & Purchasing', items: ['Invoice final', 'PO selesai', 'Retur review'] },
        { title: 'Output', items: ['P&L', 'Neraca', 'Approval final'] },
      ],
      focusLabel: 'Closing',
      focusTitle: 'Penutupan buku lebih terasa sebagai checklist kerja yang runtut.',
      focusDescription: 'Closing saya tampilkan sebagai checklist lintas area, karena itulah inti modul ini.',
      focusItems: [
        'Membantu owner dan finance review periodik.',
        'Nyaman dipakai sebelum laporan final dibaca.',
      ],
    },
  },
  '/accounting/assets': {
    eyebrow: 'Assets',
    title: 'Aset tetap dan penyusutan',
    description: 'Kelola aset, nilai buku, dan status penyusutannya di satu area.',
    tone: 'slate',
    metrics: [
      { label: 'Aset', value: '18' },
      { label: 'Nilai Buku', value: 'Rp684 jt' },
      { label: 'Depresiasi', value: 'Aktif' },
    ],
    preview: {
      kind: 'list',
      label: 'Daftar Aset',
      hint: 'Contoh aset, kategori, dan konteks penyusutannya.',
      rows: [
        { title: 'Mesin Packing 01', meta: 'Mesin • 5 tahun', value: 'Aktif' },
        { title: 'Mobil Operasional', meta: 'Kendaraan • 8 tahun', value: 'Aktif' },
        { title: 'Komputer Admin', meta: 'Peralatan kantor', value: '12 unit' },
        { title: 'Penyusutan Bulanan', meta: 'Posting periodik', value: 'Ready' },
      ],
      focusLabel: 'Assets',
      focusTitle: 'Aset tetap dibaca sebagai daftar objek dan siklus penyusutannya.',
      focusDescription: 'Modul aset saya preview sebagai daftar aset karena itu konteks utamanya.',
      focusItems: [
        'Membantu finance menjaga nilai buku lebih rapi.',
        'Cocok untuk bisnis dengan aset operasional cukup banyak.',
      ],
    },
  },
  '/accounting/budgets': {
    eyebrow: 'Budget',
    title: 'Anggaran dan disiplin realisasi',
    description: 'Anggaran membantu Anda membaca rencana pengeluaran dan realisasinya secara lebih terstruktur.',
    tone: 'amber',
    metrics: [
      { label: 'Budget Line', value: '24' },
      { label: 'Used', value: '61%' },
      { label: 'Variance', value: '+4%' },
    ],
    preview: {
      kind: 'settings',
      label: 'Struktur Anggaran',
      hint: 'Kelompok anggaran yang biasanya dipantau per periode.',
      sections: [
        { title: 'Operasional', items: ['Logistik', 'Gaji', 'Sewa'] },
        { title: 'Sales & Marketing', items: ['Promosi', 'Komisi', 'Event'] },
        { title: 'Capex / Investasi', items: ['Peralatan', 'Renovasi', 'Armada'] },
        { title: 'Review', items: ['Budget vs actual', 'Variance', 'Alert limit'] },
      ],
      focusLabel: 'Budget',
      focusTitle: 'Rencana pengeluaran lebih mudah dijaga saat ada struktur yang jelas.',
      focusDescription: 'Budget lebih cocok dipreview sebagai kelompok anggaran dan area review-nya.',
      focusItems: [
        'Sering dibaca bersama forecast.',
        'Membantu owner dan finance menjaga disiplin biaya.',
      ],
    },
  },
}

function getFallbackPanel(item: ExplorerItem): ExplorerPanel {
  if (item.group === 'Config') {
    return {
      eyebrow: item.group,
      title: item.label,
      description: 'Menu ini membantu Anda mengatur struktur, kontrol, dan detail operasional bisnis sesuai kebutuhan.',
      tone: 'slate',
      metrics: [
        { label: 'Mode', value: 'Read Only' },
        { label: 'Group', value: item.group },
        { label: 'Akses', value: 'Sesuai role' },
      ],
      preview: {
        kind: 'settings',
        label: 'Workspace Pengaturan',
        hint: 'Cuplikan kategori pengaturan yang biasanya muncul di area ini.',
        sections: [
          { title: 'Struktur', items: ['Entitas', 'Cabang', 'Pengguna'] },
          { title: 'Kontrol', items: ['Permission', 'Audit', 'Approval'] },
          { title: 'Identitas', items: ['Profil bisnis', 'Dokumen', 'Brand'] },
          { title: 'Dukungan', items: ['Support Ticket', 'Aktivasi', 'Monitoring'] },
        ],
        focusLabel: 'Config',
        focusTitle: `${item.label} terasa seperti area pengaturan, bukan dashboard generik.`,
        focusDescription: 'Untuk menu konfigurasi, preview saya arahkan ke struktur workspace pengaturan agar konteksnya tetap pas.',
        focusItems: [
          'Membantu Anda mengenali letak pengaturan inti.',
          'Tampilan final tetap mengikuti role dan paket modul aktif.',
        ],
      },
    }
  }

  if (item.group === 'Marketing & Sales') {
    return {
      eyebrow: item.group,
      title: item.label,
      description: 'Menu ini membantu tim komersial menjaga alur penawaran, penjualan, promosi, atau eksekusi customer journey.',
      tone: 'blue',
      metrics: [
        { label: 'Mode', value: 'Read Only' },
        { label: 'Group', value: item.group },
        { label: 'Akses', value: 'Sesuai role' },
      ],
      preview: {
        kind: 'list',
        label: 'Aktivitas Komersial',
        hint: 'Cuplikan aktivitas yang terasa dekat dengan area sales.',
        rows: [
          { title: item.label, meta: 'Area aktif untuk tim sales', value: 'Preview' },
          { title: 'Dokumen & status', meta: 'Lead, quote, invoice, promo', value: 'Tersedia' },
          { title: 'Customer context', meta: 'Tetap terhubung ke CRM', value: 'Aktif' },
          { title: 'Sync operasional', meta: 'Stok, kas, approval', value: 'Linked' },
        ],
        focusLabel: 'Sales',
        focusTitle: `${item.label} tetap terasa sebagai area kerja komersial.`,
        focusDescription: 'Fallback sales saya buat berbasis dokumen dan aktivitas komersial agar tidak terasa generik.',
        focusItems: [
          'Nyambung ke customer dan transaksi.',
          'Lebih cocok untuk owner maupun tim sales.',
        ],
      },
    }
  }

  if (item.group === 'Operasional') {
    return {
      eyebrow: item.group,
      title: item.label,
      description: 'Menu ini berada di area operasional, jadi preview-nya saya arahkan ke alur kerja lapangan dan status proses.',
      tone: 'slate',
      metrics: [
        { label: 'Mode', value: 'Read Only' },
        { label: 'Group', value: item.group },
        { label: 'Akses', value: 'Sesuai role' },
      ],
      preview: {
        kind: 'board',
        label: 'Tahap Operasional',
        hint: 'Cuplikan progres kerja yang lebih dekat dengan area operasional.',
        columns: [
          { title: 'Masuk', items: ['Permintaan baru', 'Dokumen awal'] },
          { title: 'Berjalan', items: ['Proses utama', 'Koordinasi tim'] },
          { title: 'Selesai', items: ['Output siap', 'Review akhir'] },
        ],
        focusLabel: 'Ops',
        focusTitle: `${item.label} terasa sebagai alur proses, bukan sekadar angka.`,
        focusDescription: 'Fallback operasional saya buat seperti board karena banyak modul operasional memang dibaca lewat status kerja.',
        focusItems: [
          'Cocok untuk gudang, jasa, manufaktur, atau armada.',
          'Tetap nyambung ke transaksi inti bisnis.',
        ],
      },
    }
  }

  if (item.group === 'HRIS') {
    return {
      eyebrow: item.group,
      title: item.label,
      description: 'Menu ini berada di area pengelolaan tim, sehingga preview-nya saya arahkan ke data orang, status, dan proses SDM.',
      tone: 'emerald',
      metrics: [
        { label: 'Mode', value: 'Read Only' },
        { label: 'Group', value: item.group },
        { label: 'Akses', value: 'Sesuai role' },
      ],
      preview: {
        kind: 'list',
        label: 'Aktivitas SDM',
        hint: 'Cuplikan data dan proses yang biasanya dibaca di area HRIS.',
        rows: [
          { title: item.label, meta: 'Modul aktif', value: 'Preview' },
          { title: 'Data tim', meta: 'Karyawan, status, role', value: 'Tersedia' },
          { title: 'Approval', meta: 'Cuti, expense, payroll', value: 'Linked' },
          { title: 'Organisasi', meta: 'Cabang dan jabatan', value: 'Aktif' },
        ],
        focusLabel: 'HRIS',
        focusTitle: `${item.label} tetap terasa sebagai area kerja SDM.`,
        focusDescription: 'Fallback HRIS saya buat berbasis orang dan proses, agar lebih jujur ke konteks modulnya.',
        focusItems: [
          'Cocok untuk admin HR maupun owner.',
          'Tetap mengikuti role dan permission.',
        ],
      },
    }
  }

  return {
    eyebrow: item.group,
    title: item.label,
    description: 'Menu ini tersedia dalam struktur NIZAM dan dapat Anda akses sesuai permission role serta paket modul yang aktif.',
    tone: 'slate',
    metrics: [
      { label: 'Mode', value: 'Read Only' },
      { label: 'Group', value: item.group },
      { label: 'Akses', value: 'Sesuai role' },
    ],
    snapshotBars: [28, 34, 40, 45, 49, 54],
    notes: [
      'Area ini membantu Anda mengenali susunan menu utama.',
      'Tampilan modul aslinya akan mengikuti izin akses setelah login.',
      'Arahnya tetap dibuat terasa seperti permukaan produk, bukan daftar keterangan.',
    ],
  }
}

export function NizamMenuExplorer() {
  const [activeHref, setActiveHref] = useState('/dashboard')

  const activeItem = useMemo(
    () => MENU_GROUPS.flatMap((group) => group.items).find((item) => item.href === activeHref) || MENU_GROUPS[0].items[0],
    [activeHref],
  )

  const panel = PANELS[activeItem.href] || getFallbackPanel(activeItem)
  const ActiveIcon = activeItem.icon
  const styles = getToneStyles(panel.tone)
  const previewMetrics = [...panel.metrics, { label: 'Akses', value: 'Sesuai role' }].slice(0, 4)

  return (
    <div className="overflow-x-auto lg:overflow-visible [scrollbar-width:thin]">
      <div className="min-w-[1220px] overflow-hidden rounded-[34px] border border-slate-200 bg-white shadow-[0_24px_70px_-42px_rgba(15,23,42,0.3)] lg:min-w-0">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Explorer Menu</div>
          <div className={`rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] ${styles.pill}`}>
            Preview Modul
          </div>
        </div>

        <div className="grid grid-cols-[320px_1fr]">
          <aside className="border-r border-slate-200 bg-slate-950 p-4 text-white">
            <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Susunan Menu</div>
              <p className="mt-2 text-sm font-medium leading-6 text-slate-300">
                Gunakan area ini untuk mengenali struktur modul utama sambil tetap melihat hasil klik yang terasa seperti preview produk.
              </p>
            </div>

            <div className="mt-4 max-h-[620px] space-y-4 overflow-y-auto pr-1">
              {MENU_GROUPS.map((group) => (
                <div key={group.group} className="space-y-2">
                  <div className="px-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{group.group}</div>
                  <div className="space-y-1.5">
                    {group.items.map((item) => {
                      const Icon = item.icon
                      const isActive = item.href === activeHref

                      return (
                        <button
                          key={item.href}
                          type="button"
                          onClick={() => setActiveHref(item.href)}
                          className={`flex w-full items-center gap-3 rounded-[18px] px-3 py-3 text-left transition ${
                            isActive ? 'bg-white text-slate-950 shadow-sm' : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <div className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl ${isActive ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-slate-300'}`}>
                            <Icon size={17} />
                          </div>
                          <div className="min-w-0 truncate text-sm font-black tracking-tight">{item.label}</div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <section className="bg-[#f8fafc] p-6">
            <div className="overflow-hidden rounded-[34px] border border-slate-200 bg-white shadow-[0_32px_90px_-45px_rgba(15,23,42,0.32)]">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Cuplikan {activeItem.label}</div>
              </div>

              <div className="bg-[#f8fafc] p-8">
                <div className="space-y-8">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-2">
                      <h3 className="flex items-center gap-4 text-4xl font-black tracking-tighter text-slate-950">
                        <div className="rounded-2xl bg-[#0f3d79] p-3 text-white shadow-lg shadow-blue-100">
                          <ActiveIcon size={26} />
                        </div>
                        Overview
                      </h3>
                      <div className="flex items-center gap-3 pl-1">
                        <p className="text-sm font-medium tracking-tight text-slate-400">
                          Ringkasan area <span className="font-bold text-slate-900">{activeItem.label}</span> untuk membantu Anda mengenali ritme modul.
                        </p>
                        <div className="h-1 w-1 rounded-full bg-slate-300" />
                        <p className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-600">
                          {panel.eyebrow}
                        </p>
                      </div>
                    </div>

                    <button type="button" className="w-fit rounded-2xl border border-slate-200 bg-white p-3 text-slate-400 shadow-sm" aria-label="Preview search">
                      <Search size={18} />
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-5">
                    {previewMetrics.map((metric) => (
                      <ExplorerMetricCard key={metric.label} label={metric.label} value={metric.value} tone={panel.tone} />
                    ))}
                  </div>

                  {panel.preview?.kind === 'list' ? (
                    <ExplorerListPreview preview={panel.preview} />
                  ) : panel.preview?.kind === 'board' ? (
                    <ExplorerBoardPreview preview={panel.preview} />
                  ) : panel.preview?.kind === 'settings' ? (
                    <ExplorerSettingsPreview preview={panel.preview} />
                  ) : (
                    <div className="grid grid-cols-[1.25fr_0.75fr] gap-8">
                      <ExplorerSnapshot title={panel.title} bars={panel.snapshotBars ?? [32, 40, 46, 54, 61, 68]} tone={panel.tone} />
                      <ExplorerImpactCard title={activeItem.label} eyebrow={panel.eyebrow} notes={panel.notes ?? []} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
