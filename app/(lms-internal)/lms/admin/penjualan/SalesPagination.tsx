/**
 * Pagination sederhana yang mempertahankan semua filter di URL.
 */
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type SalesPaginationProps = {
  pathname: string
  currentPage: number
  totalPages: number
  query: Record<string, string | undefined>
}

function pageHref(
  pathname: string,
  query: SalesPaginationProps['query'],
  page: number,
) {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })
  if (page > 1) params.set('page', String(page))
  return `${pathname}${params.size > 0 ? `?${params.toString()}` : ''}`
}

export default function SalesPagination({
  pathname,
  currentPage,
  totalPages,
  query,
}: SalesPaginationProps) {
  if (totalPages <= 1) return null

  return (
    <nav
      aria-label="Navigasi halaman"
      className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm font-medium text-slate-600">
        Halaman <span className="font-bold text-slate-950">{currentPage}</span> dari {totalPages}
      </p>
      <div className="flex gap-2">
        <Link
          href={pageHref(pathname, query, Math.max(1, currentPage - 1))}
          aria-disabled={currentPage <= 1}
          className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 text-sm font-bold transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100 ${
            currentPage <= 1
              ? 'pointer-events-none border-slate-200 bg-slate-50 text-slate-400'
              : 'border-slate-300 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700'
          }`}
        >
          <ChevronLeft aria-hidden="true" size={16} />
          Sebelumnya
        </Link>
        <Link
          href={pageHref(pathname, query, Math.min(totalPages, currentPage + 1))}
          aria-disabled={currentPage >= totalPages}
          className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 text-sm font-bold transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100 ${
            currentPage >= totalPages
              ? 'pointer-events-none border-slate-200 bg-slate-50 text-slate-400'
              : 'border-slate-300 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700'
          }`}
        >
          Berikutnya
          <ChevronRight aria-hidden="true" size={16} />
        </Link>
      </div>
    </nav>
  )
}
