'use client'

/**
 * Interactive course catalog table with search, filter by status, sort,
 * and quick actions: set-draft, archive, and unarchive.
 */
import React, { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'
import {
  Search,
  ArrowUpDown,
  Filter,
  BookOpen,
  Users,
  FileText,
  FileSpreadsheet,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Archive,
  FileEdit,
  MoreVertical,
  CheckCircle2,
  Loader2,
  ExternalLink,
} from 'lucide-react'
import { setLmsCourseStatus } from '@/modules/edu/actions/lms-commercial.actions'

interface CourseCatalogRow {
  id: string
  slug: string
  orgSlug?: string
  title: string
  isActive: boolean
  isArchived: boolean
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
type StatusFilter = 'ALL' | 'PUBLISHED' | 'DRAFT' | 'ARCHIVED'

// ── Status Pill ──────────────────────────────────────────────────────────────

function StatusPill({ isActive, isArchived }: { isActive: boolean; isArchived: boolean }) {
  if (isArchived)
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset bg-amber-50 text-amber-700 ring-amber-500/20">
        Archived
      </span>
    )
  if (isActive)
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset bg-emerald-50 text-emerald-700 ring-emerald-600/20">
        Published
      </span>
    )
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset bg-slate-50 text-slate-600 ring-slate-500/20">
      Draft
    </span>
  )
}

// ── Quick Status Action Menu ─────────────────────────────────────────────────

function StatusActionMenu({ course }: { course: CourseCatalogRow }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<string | null>(null)

  function handleAction(status: 'published' | 'draft' | 'archived') {
    setOpen(false)
    startTransition(async () => {
      const res = await setLmsCourseStatus(course.id, status)
      if (res?.error) {
        setFeedback('❌ ' + res.error)
        setTimeout(() => setFeedback(null), 3000)
      } else {
        setFeedback('✓ Tersimpan')
        setTimeout(() => setFeedback(null), 2000)
      }
    })
  }

  return (
    <div className="relative inline-block">
      {feedback && (
        <span className="absolute -top-7 right-0 whitespace-nowrap rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-white shadow z-10">
          {feedback}
        </span>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer disabled:opacity-50"
        title="Set Status"
        id={`status-action-${course.id}`}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <MoreVertical className="h-4 w-4" />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 min-w-[180px] rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg ring-1 ring-slate-900/5">
            {/* Buka di Portal Member */}
            <Link
              href={`/lms/${course.orgSlug || 'coreisec'}/course/${course.slug}`}
              target="_blank"
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Buka di Portal Member
            </Link>

            <div className="my-1 border-t border-slate-100" />

            {/* Published */}
            <button
              onClick={() => handleAction('published')}
              disabled={course.isActive && !course.isArchived}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Set Published
            </button>

            {/* Draft */}
            <button
              onClick={() => handleAction('draft')}
              disabled={!course.isActive && !course.isArchived}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FileEdit className="h-3.5 w-3.5" />
              Set Draft
            </button>

            <div className="my-1 border-t border-slate-100" />

            {/* Archive / Unarchive */}
            {course.isArchived ? (
              <button
                onClick={() => handleAction('draft')}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 transition-colors cursor-pointer"
              >
                <Archive className="h-3.5 w-3.5" />
                Unarchive (→ Draft)
              </button>
            ) : (
              <button
                onClick={() => handleAction('archived')}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer"
              >
                <Archive className="h-3.5 w-3.5" />
                Archive
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function CatalogAdminClient({ courses, totalCount, activeCount }: CatalogAdminClientProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
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

    // Status filter — ALL default excludes archived
    if (statusFilter === 'ALL') result = result.filter((c) => !c.isArchived)
    if (statusFilter === 'PUBLISHED') result = result.filter((c) => c.isActive && !c.isArchived)
    if (statusFilter === 'DRAFT') result = result.filter((c) => !c.isActive && !c.isArchived)
    if (statusFilter === 'ARCHIVED') result = result.filter((c) => c.isArchived)

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

  const archivedCount = courses.filter((c) => c.isArchived).length
  const visibleTotal = statusFilter === 'ARCHIVED'
    ? archivedCount
    : courses.filter((c) => !c.isArchived).length

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
            {archivedCount > 0 && (
              <button
                onClick={() => setStatusFilter('ARCHIVED')}
                className="ml-2 cursor-pointer text-amber-600 hover:text-amber-700 font-semibold transition-colors"
              >
                · {archivedCount} archived
              </button>
            )}
          </p>
        </div>
        <div className="flex gap-3">
          <a
            href="/api/lms/export?type=courses"
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Export XLSX
          </a>
          <Link
            href="/lms/admin/course/new"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-indigo-700"
          >
            <BookOpen className="h-4 w-4" />
            + New Course
          </Link>
        </div>
      </div>

      {/* Toolbar */}
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
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs font-semibold text-slate-700 focus:border-indigo-500 focus:outline-none cursor-pointer"
          >
            <option value="ALL">Semua (Aktif)</option>
            <option value="PUBLISHED">Published Only</option>
            <option value="DRAFT">Draft Only</option>
            <option value="ARCHIVED">Archived</option>
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
            className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs font-semibold text-slate-700 focus:border-indigo-500 focus:outline-none cursor-pointer"
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
          {filtered.length} of {visibleTotal} courses
        </span>
      </div>

      {/* Archived notice */}
      {statusFilter === 'ARCHIVED' && (
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
          <Archive className="h-4 w-4 shrink-0 text-amber-600" />
          Kursus yang diarsipkan <strong className="mx-1">tidak muncul</strong> di halaman LMS maupun katalog publik. Gunakan menu ⋮ untuk unarchive.
        </div>
      )}

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
                <tr
                  key={c.id}
                  className={`group transition-colors hover:bg-slate-50/70 ${c.isArchived ? 'opacity-60' : ''}`}
                >
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
                    {c.isArchived && (
                      <span className="ml-2 text-[10px] font-semibold text-amber-600 uppercase tracking-wide">
                        (archived)
                      </span>
                    )}
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
                    <Link
                      href={`/lms/admin/course/${c.slug}/participants`}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700 hover:text-indigo-600 transition-colors cursor-pointer group"
                      title="Kelola peserta"
                    >
                      <Users className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                      {c.enrolled}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-center">
                    <StatusPill isActive={c.isActive} isArchived={c.isArchived} />
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link
                        href={`/lms/${c.orgSlug || 'coreisec'}/course/${c.slug}`}
                        target="_blank"
                        title="Buka di Portal Member (As Admin)"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition-all hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 focus:outline-none"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Portal Member
                      </Link>
                      {!c.isArchived && (
                        <Link
                          href={`/lms/admin/course/${c.slug}`}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none"
                        >
                          Manage
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      )}
                      <StatusActionMenu course={c} />
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-14 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50">
                      {statusFilter === 'ARCHIVED' ? (
                        <Archive className="h-5 w-5 text-amber-400" />
                      ) : (
                        <BookOpen className="h-5 w-5 text-indigo-400" />
                      )}
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-600">
                      {statusFilter === 'ARCHIVED'
                        ? 'Tidak ada kursus yang diarsipkan'
                        : 'No courses match your search'}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {statusFilter === 'ARCHIVED'
                        ? 'Arsipkan kursus dengan menu ⋮ di setiap baris'
                        : 'Try adjusting the search or filter'}
                    </p>
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

