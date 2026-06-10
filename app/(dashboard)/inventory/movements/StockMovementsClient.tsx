'use client'

import React, { useState, useTransition, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowLeftRight,
  History,
  Search,
  X,
  Filter,
  TrendingUp,
  TrendingDown,
  Package,
  ChevronLeft,
  ChevronRight,
  Download,
} from 'lucide-react'
import { PageHeader, StatCard, SectionCard, SectionHeader, SafeButton } from '@/components/ui/NizamUI'
import type { StockMovementsPageResult, StockMovementPageRow } from '@/modules/inventory/actions/inventory.actions'
import type { ProductWithStock } from '@/modules/inventory/actions/inventory.actions'
import { formatDate, formatRupiah } from '@/lib/utils'
import { cn } from '@/lib/utils'

const REFERENCE_TYPE_OPTIONS = [
  { value: '', label: 'Semua Jenis' },
  { value: 'SALE', label: 'Penjualan' },
  { value: 'PURCHASE', label: 'Pembelian' },
  { value: 'ADJUSTMENT', label: 'Adjustment' },
  { value: 'TRANSFER', label: 'Transfer' },
  { value: 'PURCHASE_RETURN', label: 'Retur Pembelian' },
  { value: 'SALES_RETURN', label: 'Retur Penjualan' },
  { value: 'WRITE_OFF', label: 'Write-off' },
  { value: 'PRODUCTION', label: 'Produksi' },
]

function getReferenceTypeMeta(type: string) {
  switch (type) {
    case 'PURCHASE':
      return { label: 'Pembelian', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' }
    case 'PURCHASE_RETURN':
      return { label: 'Retur Beli', cls: 'border-orange-200 bg-orange-50 text-orange-700' }
    case 'SALE':
      return { label: 'Penjualan', cls: 'border-rose-200 bg-rose-50 text-rose-700' }
    case 'SALES_RETURN':
      return { label: 'Retur Jual', cls: 'border-cyan-200 bg-cyan-50 text-cyan-700' }
    case 'ADJUSTMENT':
      return { label: 'Adjustment', cls: 'border-violet-200 bg-violet-50 text-violet-700' }
    case 'WRITE_OFF':
      return { label: 'Write-off', cls: 'border-slate-200 bg-slate-100 text-slate-600' }
    case 'TRANSFER':
      return { label: 'Transfer', cls: 'border-blue-200 bg-blue-50 text-blue-700' }
    case 'PRODUCTION':
      return { label: 'Produksi', cls: 'border-amber-200 bg-amber-50 text-amber-700' }
    default:
      return { label: type || 'Manual', cls: 'border-slate-200 bg-slate-100 text-slate-600' }
  }
}

function formatQty(qty: number) {
  const abs = Math.abs(qty)
  const hasFraction = Math.abs(abs - Math.trunc(abs)) > 0.0001
  const fmt = new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  })
  return `${qty > 0 ? '+' : qty < 0 ? '-' : ''}${fmt.format(abs)}`
}

function exportToCsv(rows: StockMovementPageRow[]) {
  const header = ['Tanggal', 'Produk', 'SKU', 'Jenis', 'Arah', 'Qty', 'Satuan', 'HPP', 'Nilai', 'Ref ID', 'Catatan']
  const lines = rows.map((r) => [
    r.movement_date,
    `"${r.product_name.replace(/"/g, '""')}"`,
    r.product_sku ?? '',
    r.reference_type,
    r.quantity > 0 ? 'Masuk' : 'Keluar',
    r.quantity,
    r.product_unit ?? '',
    r.unit_price,
    Math.abs(r.quantity) * r.unit_price,
    r.reference_id,
    `"${(r.notes ?? '').replace(/"/g, '""')}"`,
  ].join(','))
  const csv = [header.join(','), ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `mutasi-stok-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

interface StockMovementsClientProps {
  orgId: string
  activeBranchId: string | null
  activeBranchName?: string | null
  initialResult: StockMovementsPageResult
  products: ProductWithStock[]
}

export default function StockMovementsClient({
  activeBranchName,
  initialResult,
  products,
}: StockMovementsClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const [refType, setRefType] = useState(searchParams.get('type') ?? '')
  const [direction, setDirection] = useState<'in' | 'out' | ''>(
    (searchParams.get('direction') as 'in' | 'out' | '') ?? ''
  )
  const [dateFrom, setDateFrom] = useState(searchParams.get('date_from') ?? '')
  const [dateTo, setDateTo] = useState(searchParams.get('date_to') ?? '')

  const result = initialResult

  const pushFilters = useCallback(
    (overrides: Record<string, string>) => {
      const params = new URLSearchParams()
      const merged = {
        search,
        type: refType,
        direction,
        date_from: dateFrom,
        date_to: dateTo,
        page: '1',
        ...overrides,
      }
      Object.entries(merged).forEach(([k, v]) => {
        if (v) params.set(k, v)
      })
      startTransition(() => router.push(`${pathname}?${params.toString()}`))
    },
    [search, refType, direction, dateFrom, dateTo, pathname, router]
  )

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    pushFilters({ search })
  }

  const handleFilterChange = (key: string, value: string) => {
    if (key === 'type') setRefType(value)
    if (key === 'direction') setDirection(value as 'in' | 'out' | '')
    if (key === 'date_from') setDateFrom(value)
    if (key === 'date_to') setDateTo(value)
    pushFilters({ [key]: value })
  }

  const handleClearFilters = () => {
    setSearch('')
    setRefType('')
    setDirection('')
    setDateFrom('')
    setDateTo('')
    startTransition(() => router.push(pathname))
  }

  const goToPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(p))
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  const totalPages = Math.ceil(result.total / result.limit)
  const hasFilters = search || refType || direction || dateFrom || dateTo

  const totalIn = result.rows.filter((r) => r.quantity > 0).reduce((s, r) => s + r.quantity, 0)
  const totalOut = result.rows.filter((r) => r.quantity < 0).reduce((s, r) => s + Math.abs(r.quantity), 0)
  const totalValueIn = result.rows.filter((r) => r.quantity > 0).reduce((s, r) => s + r.quantity * r.unit_price, 0)
  const totalValueOut = result.rows.filter((r) => r.quantity < 0).reduce((s, r) => s + Math.abs(r.quantity) * r.unit_price, 0)

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-24">
      <PageHeader
        icon={<ArrowLeftRight />}
        title="Mutasi Stok"
        subtitle={`Riwayat seluruh pergerakan stok masuk dan keluar${activeBranchName ? ` — Unit: ${activeBranchName}` : ''}.`}
        tag="Inventory Module"
        actions={
          <SafeButton
            variant="white"
            icon={<Download size={15} />}
            onClick={() => exportToCsv(result.rows)}
          >
            Export CSV
          </SafeButton>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="Total Mutasi (Halaman Ini)"
          value={`${result.total.toLocaleString('id-ID')} transaksi`}
          icon={ArrowLeftRight}
          color="indigo"
          sub="Sesuai filter aktif"
        />
        <StatCard
          label="Total Masuk (Halaman Ini)"
          value={formatQty(totalIn)}
          icon={TrendingUp}
          color="emerald"
          sub={formatRupiah(totalValueIn)}
        />
        <StatCard
          label="Total Keluar (Halaman Ini)"
          value={formatQty(-totalOut)}
          icon={TrendingDown}
          color="rose"
          sub={formatRupiah(totalValueOut)}
        />
        <StatCard
          label="Produk Terdaftar"
          value={`${products.length} SKU`}
          icon={Package}
          color="blue"
          sub="Katalog aktif"
          href="/inventory"
        />
      </div>

      <SectionCard>
        <SectionHeader
          title="Filter Mutasi Stok"
          subtitle="Gunakan filter di bawah untuk mempersempit pencarian data mutasi."
          actions={
            hasFilters ? (
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500 transition-colors hover:border-rose-200 hover:text-rose-600 cursor-pointer"
              >
                <X size={12} /> Hapus Filter
              </button>
            ) : null
          }
        />

        <div className="space-y-4">
          {/* Baris 1: Search + Jenis + Arah */}
          <div className="flex flex-wrap gap-3">
            <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 min-w-[200px]">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari produk, SKU, catatan..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-[11px] font-semibold outline-none transition-all focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <button
                type="submit"
                className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700 transition-colors hover:bg-blue-500 hover:text-white cursor-pointer"
              >
                Cari
              </button>
            </form>

            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <Filter size={13} className="text-slate-400 shrink-0" />
              <select
                value={refType}
                onChange={(e) => handleFilterChange('type', e.target.value)}
                className="bg-transparent text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600 outline-none cursor-pointer"
                aria-label="Filter jenis mutasi"
              >
                {REFERENCE_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <button
                type="button"
                onClick={() => handleFilterChange('direction', direction === 'in' ? '' : 'in')}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition-all cursor-pointer',
                  direction === 'in'
                    ? 'bg-emerald-500 text-white'
                    : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'
                )}
              >
                <ArrowUpCircle size={12} /> Masuk
              </button>
              <button
                type="button"
                onClick={() => handleFilterChange('direction', direction === 'out' ? '' : 'out')}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition-all cursor-pointer',
                  direction === 'out'
                    ? 'bg-rose-500 text-white'
                    : 'text-slate-500 hover:bg-rose-50 hover:text-rose-700'
                )}
              >
                <ArrowDownCircle size={12} /> Keluar
              </button>
            </div>
          </div>

          {/* Baris 2: Rentang Tanggal */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap">
                Dari
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => handleFilterChange('date_from', e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[11px] font-semibold outline-none transition-all focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap">
                Sampai
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => handleFilterChange('date_to', e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[11px] font-semibold outline-none transition-all focus:ring-2 focus:ring-blue-100"
              />
            </div>
            {(dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => {
                  setDateFrom('')
                  setDateTo('')
                  pushFilters({ date_from: '', date_to: '' })
                }}
                className="text-[10px] font-semibold text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
              >
                Reset tanggal
              </button>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard>
        <SectionHeader
          title="Daftar Mutasi"
          subtitle={`Menampilkan ${result.rows.length} dari ${result.total.toLocaleString('id-ID')} mutasi — halaman ${result.page} / ${totalPages || 1}.`}
          actions={
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2.5">
                <div className="text-[9px] font-semibold uppercase tracking-wide text-emerald-600">Masuk</div>
                <div className="text-sm font-semibold text-emerald-700">{formatQty(totalIn)}</div>
              </div>
              <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-2.5">
                <div className="text-[9px] font-semibold uppercase tracking-wide text-rose-600">Keluar</div>
                <div className="text-sm font-semibold text-rose-700">{formatQty(-totalOut)}</div>
              </div>
            </div>
          }
        />

        {isPending && (
          <div className="py-4 text-center text-xs font-semibold text-slate-400 animate-pulse">
            Memuat data...
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/60 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Tanggal</th>
                <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Produk</th>
                <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-wide text-center text-slate-400">Jenis</th>
                <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-wide text-right text-blue-600">Qty</th>
                <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-wide text-right text-slate-400">HPP / Unit</th>
                <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-wide text-right text-emerald-600">Nilai</th>
                <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-wide text-right text-slate-400">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {result.rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-24 text-center text-slate-400 font-bold text-xs uppercase italic">
                    Tidak ada mutasi stok yang cocok dengan filter saat ini.
                  </td>
                </tr>
              ) : (
                result.rows.map((row) => {
                  const typeMeta = getReferenceTypeMeta(row.reference_type)
                  const isIn = row.quantity > 0
                  const absQty = Math.abs(row.quantity)
                  const nilai = absQty * row.unit_price

                  return (
                    <tr key={row.id} className="group hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-slate-900">
                          {formatDate(row.movement_date, 'short')}
                        </div>
                        <div className="mt-1 text-[10px] font-mono font-bold text-slate-400 uppercase">
                          {row.reference_id.slice(0, 8)}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-slate-900">{row.product_name}</div>
                        <div className="mt-1 flex items-center gap-2 text-[10px] font-bold text-slate-400">
                          {row.product_sku && (
                            <span className="font-mono rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5">
                              {row.product_sku}
                            </span>
                          )}
                          {row.product_unit && (
                            <span className="uppercase tracking-wide">{row.product_unit}</span>
                          )}
                        </div>
                        {row.notes && (
                          <div className="mt-1.5 line-clamp-1 text-[11px] font-medium text-slate-500">
                            {row.notes}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex flex-col items-center gap-1.5">
                          <span className={cn(
                            'inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide',
                            typeMeta.cls
                          )}>
                            {typeMeta.label}
                          </span>
                          <span className={cn(
                            'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide',
                            isIn
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-rose-200 bg-rose-50 text-rose-700'
                          )}>
                            {isIn ? <ArrowUpCircle size={10} /> : <ArrowDownCircle size={10} />}
                            {isIn ? 'Masuk' : 'Keluar'}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className={cn(
                          'text-sm font-semibold font-mono',
                          isIn ? 'text-emerald-600' : 'text-rose-600'
                        )}>
                          {formatQty(row.quantity)}
                        </div>
                        <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          {row.product_unit || 'Unit'}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="text-sm font-semibold text-slate-700 font-mono">
                          {formatRupiah(row.unit_price)}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className={cn(
                          'text-sm font-semibold font-mono',
                          isIn ? 'text-emerald-700' : 'text-rose-700'
                        )}>
                          {isIn ? '+' : '-'}{formatRupiah(nilai)}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end">
                          <Link
                            href={`/inventory/ledger/${row.product_id}`}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-blue-700 transition-all hover:bg-blue-500 hover:text-white"
                            title="Lihat kartu stok produk ini"
                          >
                            <History size={13} />
                            Ledger
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5">
            <div className="text-[11px] font-semibold text-slate-400">
              Halaman {result.page} dari {totalPages} &nbsp;·&nbsp; {result.total.toLocaleString('id-ID')} total
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={result.page <= 1}
                onClick={() => goToPage(result.page - 1)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-600 transition-all hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft size={13} /> Sebelumnya
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(result.page - 2, totalPages - 4))
                const p = start + i
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => goToPage(p)}
                    className={cn(
                      'h-9 w-9 rounded-xl border text-[11px] font-semibold transition-all cursor-pointer',
                      p === result.page
                        ? 'border-blue-200 bg-blue-500 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-600'
                    )}
                  >
                    {p}
                  </button>
                )
              })}

              <button
                type="button"
                disabled={result.page >= totalPages}
                onClick={() => goToPage(result.page + 1)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-600 transition-all hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
              >
                Berikutnya <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
