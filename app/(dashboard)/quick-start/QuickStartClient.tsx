'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  LayoutDashboard, ShoppingCart, Package, Wallet, Store,
  BarChart3, Users, Settings, BookOpen, CheckCircle2,
  Circle, ChevronRight, AlertTriangle, Info, Sparkles,
  ArrowRight, X, Rocket, BookMarked,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { QuickStartData } from '@/modules/onboarding/actions/quick-start.actions'

// ─── Module Encyclopedia Data ─────────────────────────────────────────────────

const MODULES = [
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    label: 'Dashboard',
    color: 'text-slate-600',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    tagline: 'Pantau kondisi bisnis sekilas pandang',
    useWhen: 'Kamu mau lihat ringkasan cepat: omzet hari ini, stok, dan tagihan yang belum lunas.',
    autoHappen: ['Grafik penjualan terupdate otomatis', 'Saldo kas tersinkron real-time', 'Notifikasi jika ada yang perlu perhatian'],
    flow: ['Buka Dashboard', 'Baca ringkasan', 'Klik area yang butuh tindakan'],
    href: '/dashboard',
    preview: <DashboardPreview />,
  },
  {
    id: 'sales',
    icon: ShoppingCart,
    label: 'Penjualan',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    tagline: 'Catat penjualan dan kirim tagihan ke pelanggan',
    useWhen: 'Ada transaksi jual ke pelanggan — tunai maupun kredit.',
    autoHappen: ['Tagihan (invoice) otomatis terbuat', 'Piutang pelanggan tercatat', 'Laporan keuangan ikut terupdate'],
    flow: ['Buat Invoice', 'Kirim ke Pelanggan', 'Catat Pembayaran'],
    href: '/sales',
    preview: <SalesPreview />,
  },
  {
    id: 'purchasing',
    icon: Package,
    label: 'Pembelian',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    tagline: 'Catat belanja dari supplier dan pantau tagihan',
    useWhen: 'Kamu beli barang atau jasa dari supplier dan perlu catat pengeluarannya.',
    autoHappen: ['Hutang ke supplier tercatat', 'Stok bertambah saat barang diterima', 'Laporan pengeluaran terupdate'],
    flow: ['Buat Purchase Order', 'Terima Barang', 'Bayar Supplier'],
    href: '/purchasing',
    preview: <PurchasingPreview />,
  },
  {
    id: 'inventory',
    icon: Package,
    label: 'Stok & Gudang',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    tagline: 'Pantau barang masuk, keluar, dan sisa stok',
    useWhen: 'Kamu jual barang fisik dan perlu tahu berapa yang tersisa di gudang.',
    autoHappen: ['Stok berkurang otomatis saat ada penjualan', 'Stok bertambah saat terima barang', 'Alert jika stok hampir habis'],
    flow: ['Lihat Stok', 'Cek Kartu Stok', 'Sesuaikan jika perlu'],
    href: '/inventory',
    preview: <InventoryPreview />,
  },
  {
    id: 'pos',
    icon: Store,
    label: 'Kasir (POS)',
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    tagline: 'Transaksi langsung di tempat tanpa ribet',
    useWhen: 'Ada pelanggan yang beli langsung di toko atau konter, bayar tunai atau transfer.',
    autoHappen: ['Struk otomatis bisa dicetak', 'Stok berkurang real-time', 'Rekap shift tersimpan otomatis'],
    flow: ['Buka Shift', 'Input Transaksi', 'Tutup Shift'],
    href: '/pos',
    preview: <PosPreview />,
  },
  {
    id: 'cash',
    icon: Wallet,
    label: 'Kas & Bank',
    color: 'text-teal-600',
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    tagline: 'Catat semua uang masuk dan keluar dari rekening',
    useWhen: 'Kamu terima transfer, tarik tunai, atau pindahkan uang antar rekening.',
    autoHappen: ['Saldo rekening terupdate', 'Arus kas terlacak', 'Bisa rekonsiliasi dengan mutasi bank'],
    flow: ['Pilih Rekening', 'Catat Transaksi', 'Cek Saldo'],
    href: '/cash',
    preview: <CashPreview />,
  },
  {
    id: 'hr',
    icon: Users,
    label: 'HR & Gaji',
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    tagline: 'Kelola karyawan, absensi, dan penggajian',
    useWhen: 'Kamu punya karyawan dan perlu hitung gaji, catat absensi, atau kelola data SDM.',
    autoHappen: ['Slip gaji otomatis terhitung', 'Absensi tersinkron ke payroll', 'Jurnal gaji otomatis terbuat'],
    flow: ['Data Karyawan', 'Input Absensi', 'Proses Gaji'],
    href: '/hris',
    preview: <HrPreview />,
  },
  {
    id: 'reports',
    icon: BarChart3,
    label: 'Laporan',
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    tagline: 'Lihat untung-rugi dan kesehatan keuangan bisnis',
    useWhen: 'Kamu mau tahu bisnis untung atau rugi, berapa aset yang dimiliki, atau uang mengalir ke mana.',
    autoHappen: ['Laporan Laba Rugi otomatis dari transaksi', 'Neraca terupdate real-time', 'Aging piutang & hutang terlacak'],
    flow: ['Pilih Laporan', 'Atur Periode', 'Analisis & Unduh'],
    href: '/reports',
    preview: <ReportsPreview />,
  },
  {
    id: 'settings',
    icon: Settings,
    label: 'Pengaturan',
    color: 'text-slate-600',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    tagline: 'Setup awal, tim, dan konfigurasi sistem',
    useWhen: 'Kamu perlu ubah profil bisnis, tambah anggota tim, atau import data dari sistem lama.',
    autoHappen: ['Perubahan profil langsung tampil di invoice', 'Hak akses tim langsung aktif', 'Import data masuk ke semua modul'],
    flow: ['Buka Pengaturan', 'Pilih Kategori', 'Simpan Perubahan'],
    href: '/settings/business',
    preview: <SettingsPreview />,
  },
]

// ─── Mini Visual Previews ─────────────────────────────────────────────────────

function PreviewShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden text-[10px] select-none pointer-events-none">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-100 bg-slate-50">
        <div className="w-2 h-2 rounded-full bg-red-300" />
        <div className="w-2 h-2 rounded-full bg-amber-300" />
        <div className="w-2 h-2 rounded-full bg-emerald-300" />
      </div>
      <div className="p-3">{children}</div>
    </div>
  )
}

function PreviewRow({ label, value, badge, badgeColor }: { label: string; value: string; badge?: string; badgeColor?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
      <span className="text-slate-500">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-semibold text-slate-700">{value}</span>
        {badge && <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-semibold', badgeColor)}>{badge}</span>}
      </div>
    </div>
  )
}

function DashboardPreview() {
  return (
    <PreviewShell>
      <div className="grid grid-cols-2 gap-1.5 mb-2">
        {[
          { label: 'Omzet Bulan Ini', value: 'Rp 12,4 jt', color: 'bg-blue-50 text-blue-700' },
          { label: 'Laba Bersih', value: 'Rp 3,1 jt', color: 'bg-emerald-50 text-emerald-700' },
          { label: 'Piutang', value: 'Rp 5,2 jt', color: 'bg-amber-50 text-amber-700' },
          { label: 'Saldo Kas', value: 'Rp 8,7 jt', color: 'bg-slate-50 text-slate-700' },
        ].map(c => (
          <div key={c.label} className={cn('rounded p-2', c.color)}>
            <div className="text-[9px] opacity-70 mb-0.5">{c.label}</div>
            <div className="font-semibold">{c.value}</div>
          </div>
        ))}
      </div>
      <div className="rounded bg-slate-50 p-2">
        <div className="text-[9px] text-slate-400 mb-1">Penjualan 7 hari</div>
        <div className="flex items-end gap-0.5 h-8">
          {[3, 5, 4, 7, 6, 8, 5].map((h, i) => (
            <div key={i} className="flex-1 bg-blue-200 rounded-sm" style={{ height: `${h * 10}%` }} />
          ))}
        </div>
      </div>
    </PreviewShell>
  )
}

function SalesPreview() {
  return (
    <PreviewShell>
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-slate-700">Daftar Invoice</span>
        <span className="px-2 py-0.5 rounded bg-blue-600 text-white text-[9px]">+ Buat Baru</span>
      </div>
      {[
        { no: 'INV-001', nama: 'Toko Maju', total: 'Rp 1,2 jt', status: 'LUNAS', sc: 'bg-emerald-100 text-emerald-700' },
        { no: 'INV-002', nama: 'CV Sejahtera', total: 'Rp 3,5 jt', status: 'BELUM', sc: 'bg-amber-100 text-amber-700' },
        { no: 'INV-003', nama: 'PT Merdeka', total: 'Rp 800 rb', status: 'BELUM', sc: 'bg-amber-100 text-amber-700' },
      ].map(r => (
        <div key={r.no} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
          <div>
            <div className="font-semibold text-slate-700">{r.no}</div>
            <div className="text-slate-400">{r.nama}</div>
          </div>
          <div className="text-right">
            <div className="font-semibold text-slate-700">{r.total}</div>
            <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-semibold', r.sc)}>{r.status}</span>
          </div>
        </div>
      ))}
    </PreviewShell>
  )
}

function PurchasingPreview() {
  return (
    <PreviewShell>
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-slate-700">Purchase Order</span>
        <span className="px-2 py-0.5 rounded bg-orange-600 text-white text-[9px]">+ PO Baru</span>
      </div>
      {[
        { no: 'PO-001', vendor: 'Supplier A', status: 'Diterima', sc: 'bg-emerald-100 text-emerald-700' },
        { no: 'PO-002', vendor: 'Supplier B', status: 'Dipesan', sc: 'bg-blue-100 text-blue-700' },
        { no: 'PO-003', vendor: 'Supplier C', status: 'Draft', sc: 'bg-slate-100 text-slate-500' },
      ].map(r => (
        <div key={r.no} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
          <div>
            <div className="font-semibold text-slate-700">{r.no}</div>
            <div className="text-slate-400">{r.vendor}</div>
          </div>
          <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-semibold', r.sc)}>{r.status}</span>
        </div>
      ))}
    </PreviewShell>
  )
}

function InventoryPreview() {
  return (
    <PreviewShell>
      <div className="text-slate-500 mb-1.5">Stok Produk</div>
      {[
        { nama: 'Buku Tulis A5', stok: 142, status: 'Aman', sc: 'bg-emerald-100 text-emerald-700' },
        { nama: 'Pulpen Merah', stok: 8, status: 'Hampir Habis', sc: 'bg-amber-100 text-amber-700' },
        { nama: 'Map Plastik', stok: 0, status: 'Habis', sc: 'bg-red-100 text-red-700' },
      ].map(r => (
        <div key={r.nama} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
          <div>
            <div className="font-semibold text-slate-700">{r.nama}</div>
            <div className="text-slate-400">{r.stok} pcs</div>
          </div>
          <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-semibold', r.sc)}>{r.status}</span>
        </div>
      ))}
    </PreviewShell>
  )
}

function PosPreview() {
  return (
    <PreviewShell>
      <div className="text-center mb-2">
        <div className="text-slate-500 mb-0.5">Total Transaksi</div>
        <div className="text-lg font-bold text-violet-700">Rp 85.000</div>
      </div>
      <div className="space-y-1 mb-2">
        {[
          { item: 'Buku Tulis × 2', harga: 'Rp 30.000' },
          { item: 'Pulpen × 5', harga: 'Rp 25.000' },
          { item: 'Penggaris', harga: 'Rp 15.000' },
        ].map(r => (
          <div key={r.item} className="flex justify-between">
            <span className="text-slate-500">{r.item}</span>
            <span className="font-semibold text-slate-700">{r.harga}</span>
          </div>
        ))}
      </div>
      <div className="rounded bg-violet-600 text-white text-center py-1.5 font-semibold text-[10px]">
        Bayar Sekarang
      </div>
    </PreviewShell>
  )
}

function CashPreview() {
  return (
    <PreviewShell>
      <div className="flex justify-between items-center mb-2">
        <span className="text-slate-500">Bank BRI</span>
        <span className="font-bold text-teal-700">Rp 8.750.000</span>
      </div>
      <PreviewRow label="Transfer masuk" value="Rp 2.500.000" badge="Masuk" badgeColor="bg-emerald-100 text-emerald-700" />
      <PreviewRow label="Bayar supplier" value="Rp 1.200.000" badge="Keluar" badgeColor="bg-red-100 text-red-600" />
      <PreviewRow label="Gaji karyawan" value="Rp 3.000.000" badge="Keluar" badgeColor="bg-red-100 text-red-600" />
    </PreviewShell>
  )
}

function HrPreview() {
  return (
    <PreviewShell>
      <div className="text-slate-500 mb-1.5">Payroll Bulan Ini</div>
      {[
        { nama: 'Ahmad S.', jabatan: 'Manajer', gaji: 'Rp 5 jt', status: 'Sudah Bayar' },
        { nama: 'Siti R.', jabatan: 'Staff', gaji: 'Rp 3 jt', status: 'Sudah Bayar' },
        { nama: 'Budi W.', jabatan: 'Driver', gaji: 'Rp 2,5 jt', status: 'Belum' },
      ].map(r => (
        <div key={r.nama} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
          <div>
            <div className="font-semibold text-slate-700">{r.nama}</div>
            <div className="text-slate-400">{r.jabatan} · {r.gaji}</div>
          </div>
          <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-semibold',
            r.status === 'Sudah Bayar' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
          )}>{r.status}</span>
        </div>
      ))}
    </PreviewShell>
  )
}

function ReportsPreview() {
  return (
    <PreviewShell>
      <div className="text-slate-500 mb-2">Laba Rugi — Mei 2026</div>
      <PreviewRow label="Total Pendapatan" value="Rp 28,4 jt" />
      <PreviewRow label="HPP & Beban" value="Rp 19,1 jt" />
      <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between">
        <span className="font-semibold text-slate-700">Laba Bersih</span>
        <span className="font-bold text-emerald-600">Rp 9,3 jt</span>
      </div>
      <div className="mt-2 rounded bg-emerald-50 p-1.5 text-center text-[9px] text-emerald-700 font-semibold">
        Margin 32,7% — Lebih baik dari bulan lalu ↑
      </div>
    </PreviewShell>
  )
}

function SettingsPreview() {
  return (
    <PreviewShell>
      <div className="space-y-2">
        {[
          { label: 'Nama Bisnis', value: 'CV Maju Bersama' },
          { label: 'Alamat', value: 'Jl. Sudirman No. 12' },
          { label: 'NPWP', value: '01.234.567.8-901.000' },
        ].map(f => (
          <div key={f.label}>
            <div className="text-slate-400 mb-0.5">{f.label}</div>
            <div className="rounded border border-slate-200 px-2 py-1 text-slate-700 bg-slate-50">{f.value}</div>
          </div>
        ))}
        <div className="rounded bg-slate-800 text-white text-center py-1.5 text-[10px] font-semibold">
          Simpan Perubahan
        </div>
      </div>
    </PreviewShell>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function QuickStartClient({ data }: { data: QuickStartData }) {
  const [activeModule, setActiveModule] = useState(MODULES[0].id)
  const [dismissed, setDismissed] = useState(false)

  // Baca dismissed state dari localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('nizam_quickstart_dismissed')
      if (saved === 'true') setDismissed(true)
    } catch {}
  }, [])

  const handleDismiss = () => {
    try { localStorage.setItem('nizam_quickstart_dismissed', 'true') } catch {}
    setDismissed(true)
  }

  const activeModuleData = MODULES.find(m => m.id === activeModule) || MODULES[0]
  const doneCount = data.steps.filter(s => s.done).length
  const totalSteps = data.steps.length
  const progressPct = Math.round((doneCount / totalSteps) * 100)

  if (dismissed) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        {/* Minimal mode — hanya ensiklopedia */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
              <BookMarked size={20} className="text-indigo-600" />
              Panduan Modul
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Referensi cepat semua fitur Nizam ERP</p>
          </div>
          <button type="button"
            onClick={() => setDismissed(false)}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
          >
            <Rocket size={14} />
            Tampilkan Panduan Setup
          </button>
        </div>
        <EncyclopediaSection activeModule={activeModule} setActiveModule={setActiveModule} activeModuleData={activeModuleData} />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">

      {/* ── Zona 1: Sapaan Dinamis ────────────────────────────────────────── */}
      <div className="relative rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
        <button type="button"
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          title="Tutup panduan (bisa dibuka lagi dari sidebar)"
        >
          <X size={16} />
        </button>

        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
            <Rocket size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900">
              Hai, {data.userName}! 👋
            </h1>
            <p className="text-sm text-slate-500">
              {data.allDone
                ? `${data.orgName} sudah siap penuh. Gunakan panduan modul di bawah kapan saja.`
                : `Ini panduan memulai untuk ${data.orgName} — ${doneCount} dari ${totalSteps} langkah selesai.`
              }
            </p>
          </div>
        </div>

        {/* Alerts */}
        {data.alerts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {data.alerts.map((alert, i) => (
              <Link
                key={i}
                href={alert.href}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors',
                  alert.type === 'warning' && 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100',
                  alert.type === 'info' && 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100',
                  alert.type === 'success' && 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100',
                )}
              >
                {alert.type === 'warning' && <AlertTriangle size={14} />}
                {alert.type === 'info' && <Info size={14} />}
                {alert.type === 'success' && <Sparkles size={14} />}
                <span>{alert.message}</span>
                <span className="text-xs opacity-70">→ {alert.cta}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Zona 2 + 3: Setup Steps + Encyclopedia ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">

        {/* Zona 2: Langkah Setup */}
        {!data.allDone && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-slate-700">Langkah Setup</h2>
                <span className="text-xs text-slate-500 font-medium">{doneCount}/{totalSteps}</span>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            <div className="divide-y divide-slate-50">
              {data.steps.map((step, idx) => (
                <div key={step.id} className="flex items-start gap-3 p-3.5 hover:bg-slate-50 transition-colors group">
                  <div className="shrink-0 mt-0.5">
                    {step.done
                      ? <CheckCircle2 size={18} className="text-emerald-500" />
                      : <Circle size={18} className="text-slate-300 group-hover:text-slate-400" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      'text-sm font-medium leading-snug',
                      step.done ? 'text-slate-400 line-through' : 'text-slate-700'
                    )}>
                      {idx + 1}. {step.label}
                    </div>
                    {!step.done && (
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{step.description}</p>
                    )}
                  </div>
                  {!step.done && (
                    <Link
                      href={step.href}
                      className="shrink-0 flex items-center gap-1 text-xs text-indigo-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity hover:text-indigo-700"
                    >
                      Mulai <ChevronRight size={12} />
                    </Link>
                  )}
                </div>
              ))}
            </div>

            {/* Next step CTA */}
            {(() => {
              const nextStep = data.steps.find(s => !s.done)
              if (!nextStep) return null
              return (
                <div className="p-3 border-t border-slate-100">
                  <Link
                    href={nextStep.href}
                    className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
                  >
                    Lanjutkan <ArrowRight size={14} />
                  </Link>
                </div>
              )
            })()}
          </div>
        )}

        {/* Selesai semua */}
        {data.allDone && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex flex-col items-center justify-center text-center gap-2">
            <CheckCircle2 size={32} className="text-emerald-500" />
            <p className="font-semibold text-emerald-800">Setup Selesai! 🎉</p>
            <p className="text-xs text-emerald-600">Semua langkah awal sudah dilakukan. Bisnis kamu siap berjalan penuh.</p>
          </div>
        )}

        {/* Zona 3: Encyclopedia */}
        <EncyclopediaSection
          activeModule={activeModule}
          setActiveModule={setActiveModule}
          activeModuleData={activeModuleData}
        />
      </div>

      {/* Beta badge */}
      <div className="flex items-center justify-center">
        <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-600 font-semibold text-[10px]">BETA</span>
          Fitur ini masih dikembangkan. Konten akan terus diperbarui.
        </span>
      </div>
    </div>
  )
}

// ─── Encyclopedia Section ─────────────────────────────────────────────────────

function EncyclopediaSection({
  activeModule,
  setActiveModule,
  activeModuleData,
}: {
  activeModule: string
  setActiveModule: (id: string) => void
  activeModuleData: typeof MODULES[0]
}) {
  const Icon = activeModuleData.icon

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Module tab nav */}
      <div className="border-b border-slate-100 p-3">
        <p className="text-xs text-slate-500 font-medium mb-2">Panduan Modul</p>
        <div className="flex flex-wrap gap-1.5">
          {MODULES.map(m => {
            const MIcon = m.icon
            return (
              <button type="button"
                key={m.id}
                onClick={() => setActiveModule(m.id)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                  activeModule === m.id
                    ? `${m.bg} ${m.color} ${m.border}`
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700'
                )}
              >
                <MIcon size={12} />
                {m.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Module detail */}
      <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Left: info */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center border', activeModuleData.bg, activeModuleData.border)}>
              <Icon size={20} className={activeModuleData.color} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">{activeModuleData.label}</h2>
              <p className="text-xs text-slate-500">{activeModuleData.tagline}</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Gunakan ini kalau...</p>
            <p className="text-sm text-slate-700 leading-relaxed">{activeModuleData.useWhen}</p>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Yang terjadi otomatis</p>
            <ul className="space-y-1">
              {activeModuleData.autoHappen.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                  <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Alur singkat</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {activeModuleData.flow.map((step, i) => (
                <React.Fragment key={i}>
                  <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium">{step}</span>
                  {i < activeModuleData.flow.length - 1 && (
                    <ChevronRight size={12} className="text-slate-400 shrink-0" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          <Link
            href={activeModuleData.href}
            className={cn(
              'flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-colors',
              activeModule === 'dashboard' || activeModule === 'settings' ? 'bg-slate-700 hover:bg-slate-800' : '',
              activeModule === 'sales' ? 'bg-blue-600 hover:bg-blue-700' : '',
              activeModule === 'purchasing' ? 'bg-orange-600 hover:bg-orange-700' : '',
              activeModule === 'inventory' ? 'bg-emerald-600 hover:bg-emerald-700' : '',
              activeModule === 'pos' ? 'bg-violet-600 hover:bg-violet-700' : '',
              activeModule === 'cash' ? 'bg-teal-600 hover:bg-teal-700' : '',
              activeModule === 'hr' ? 'bg-rose-600 hover:bg-rose-700' : '',
              activeModule === 'reports' ? 'bg-indigo-600 hover:bg-indigo-700' : '',
            )}
          >
            Buka {activeModuleData.label}
            <ArrowRight size={14} />
          </Link>
        </div>

        {/* Right: visual preview */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Preview Tampilan</p>
          {activeModuleData.preview}
        </div>
      </div>
    </div>
  )
}
