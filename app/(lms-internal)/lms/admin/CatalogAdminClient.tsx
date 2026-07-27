'use client'

/**
 * Interactive course catalog table with search, filter by status, and sort.
 */
import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Search,
  ArrowUpDown,
  Filter,
  BookOpen,
  Users,
  FileText,
  ChevronRight,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'

interface CourseCatalogRow {
  id: string
  slug: string
  title: string
  isActive: boolean
  chapterCount: number
  lessonCount: number
  relatedProducts: string
  enrolled: number
  shortId: string
}

interface CatalogAdminClientProps {
  courses: CourseCatalogRow[]
  totalCount: number
  activeCount: number
}

type SortKey = 'title' | 'lessonCount' | 'enrolled' | 'status'
type SortDir = 'asc' | 'desc'

export function CatalogAdminClient({ courses, totalCount, activeCount }: CatalogAdminClientProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PUBLISHED' | 'DRAFT'>('ALL')
  const [sortKey, setSortKey] = useState<SortKey>('enrolled')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3.5 w-3.5 text-slate-300" />
    return sortDir === 'asc'
      ? <ArrowUp className="h-3.5 w-3.5 text-indigo-600" />
      : <ArrowDown className="h-3.5 w-3.5 text-indigo-600" />
  }

  const filtered = useMemo(() => {
    let result = [...courses]

    // Search by title
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((c) => c.title.toLowerCase().includes(q))
    }

    // Status filter
    if (statusFilter === 'PUBLISHED') result = result.filter((c) => c.isActive)
    if (statusFilter === 'DRAFT') result = result.filter((c) => !c.isActive)

    // Sort
    result.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'title':
          cmp = a.title.localeCompare(b.title)
          break
        case 'lessonCount':
          cmp = a.lessonCount - b.lessonCount
          break
        case 'enrolled':
          cmp = a.enrolled - b.enrolled
          break
        case 'status':
          cmp = Number(b.isActive) - Number(a.isActive)
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return result
  }, [courses, search, statusFilter, sortKey, sortDir])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
            /lms/admin · Catalog
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Course Catalog</h1>
          <p className="mt-1 text-sm text-slate-500">
            {totalCount} courses registered · {activeCount} published
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/lms/admin/course/new"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-indigo-700"
          >
            <BookOpen className="h-4 w-4" />
            + New Course
          </Link>
        </div>
      </div>

      {/* Toolbar: Search + Filter + Sort */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by course title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-10 pr-4 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs font-semibold text-slate-700 focus:border-indigo-500 focus:outline-none"
          >
            <option value="ALL">All Status</option>
            <option value="PUBLISHED">Published Only</option>
            <option value="DRAFT">Draft Only</option>
          </select>
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-1.5">
          <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
          <select
            value={`${sortKey}_${sortDir}`}
            onChange={(e) => {
              const [k, d] = e.target.value.split('_') as [SortKey, SortDir]
              setSortKey(k)
              setSortDir(d)
            }}
            className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs font-semibold text-slate-700 focus:border-indigo-500 focus:outline-none"
          >
            <option value="enrolled_desc">Most Participants</option>
            <option value="enrolled_asc">Fewest Participants</option>
            <option value="title_asc">Title (A – Z)</option>
            <option value="title_desc">Title (Z – A)</option>
            <option value="lessonCount_desc">Most Lessons</option>
            <option value="lessonCount_asc">Fewest Lessons</option>
            <option value="status_desc">Published First</option>
          </select>
        </div>

        {/* Results count */}
        <span className="ml-auto text-xs font-semibold text-slate-400">
          {filtered.length} of {totalCount} courses
        </span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">
                  <button
                    onClick={() => toggleSort('title')}
                    className="inline-flex items-center gap-1.5 cursor-pointer hover:text-slate-800 transition-colors"
                  >
                    Course Title <SortIcon col="title" />
                  </button>
                </th>
                <th className="px-4 py-4 text-center">
                  <button
                    onClick={() => toggleSort('lessonCount')}
                    className="inline-flex items-center gap-1.5 cursor-pointer hover:text-slate-800 transition-colors"
                  >
                    Lessons <SortIcon col="lessonCount" />
                  </button>
                </th>
                <th className="px-4 py-4">Related Products</th>
                <th className="px-4 py-4 text-center">
                  <button
                    onClick={() => toggleSort('enrolled')}
                    className="inline-flex items-center gap-1.5 cursor-pointer hover:text-slate-800 transition-colors"
                  >
                    Participants <SortIcon col="enrolled" />
                  </button>
                </th>
                <th className="px-4 py-4 text-center">
                  <button
                    onClick={() => toggleSort('status')}
                    className="inline-flex items-center gap-1.5 cursor-pointer hover:text-slate-800 transition-colors"
                  >
                    Status <SortIcon col="status" />
                  </button>
                </th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <tr key={c.id} className="group transition-colors hover:bg-slate-50/70">
                  <td className="whitespace-nowrap px-6 py-4 font-mono text-xs font-semibold text-slate-400">
                    {c.shortId}
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/lms/admin/course/${c.slug}`}
                      className="font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      {c.title}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-center">
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700">
                      <FileText className="h-3.5 w-3.5 text-slate-400" />
                      {c.lessonCount}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-xs text-slate-500 max-w-[180px] truncate">
                    {c.relatedProducts}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-center">
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700">
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      {c.enrolled}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-center">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset ${
                        c.isActive
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                          : 'bg-slate-50 text-slate-600 ring-slate-500/20'
                      }`}
                    >
                      {c.isActive ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <Link
                      href={`/lms/admin/course/${c.slug}`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none"
                    >
                      Manage
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-14 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50">
                      <BookOpen className="h-5 w-5 text-indigo-400" />
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-600">No courses match your search</p>
                    <p className="mt-1 text-xs text-slate-400">Try adjusting the search or filter</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
