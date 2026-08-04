'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Search,
  Filter,
  AlertTriangle,
  Paperclip,
  FileText,
  PlayCircle,
  Video,
  ExternalLink,
  X,
  Edit2,
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  Layers,
  List,
} from 'lucide-react'
import LessonActions from '../../LessonActions'

type LessonItem = {
  id: string
  slug: string
  title: string
  lesson_type: string
  sort_order: number
  is_required: boolean
  embed_url?: string | null
  media_items?: Array<{ type?: string; url?: string; name?: string }>
  content_md?: string | null
  content_html?: string | null
  created_at?: string
  section_id?: string | null
  [key: string]: unknown
}

type SectionItem = {
  id: string
  title: string
  sort_order: number
  description?: string | null
  [key: string]: unknown
}

type AdminLessonListProps = {
  lessons: LessonItem[]
  sections?: SectionItem[]
  courseSlug: string
  courseId: string
  orgSlug: string
}

export default function AdminLessonList({
  lessons,
  sections = [],
  courseSlug,
  courseId,
  orgSlug,
}: AdminLessonListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [sortBy, setSortBy] = useState<string>('CURRICULUM')

  // View mode switcher: Default to GROUPED if sections exist, otherwise FLAT
  const [viewMode, setViewMode] = useState<'FLAT' | 'GROUPED'>(
    sections.length > 0 ? 'GROUPED' : 'FLAT'
  )

  // Accordion open/close state for sections (all open by default)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    sections.forEach((s) => {
      init[s.id] = true
    })
    init['UNASSIGNED'] = true
    return init
  })

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }))
  }

  const expandAllSections = () => {
    const next: Record<string, boolean> = {}
    sections.forEach((s) => {
      next[s.id] = true
    })
    next['UNASSIGNED'] = true
    setExpandedSections(next)
  }

  const collapseAllSections = () => {
    const next: Record<string, boolean> = {}
    sections.forEach((s) => {
      next[s.id] = false
    })
    next['UNASSIGNED'] = false
    setExpandedSections(next)
  }

  // Pre-annotate original index so admin always knows chronological order #
  const annotatedLessons = useMemo(() => {
    return lessons.map((lesson, idx) => ({
      ...lesson,
      originalIndex: idx + 1,
    }))
  }, [lessons])

  // Statistics for completeness bar
  const stats = useMemo(() => {
    const total = lessons.length
    let videoCount = 0
    let videoReady = 0
    let videoMissing = 0
    let hasAttachments = 0
    let hasDescription = 0

    lessons.forEach((l) => {
      const isVideo = l.lesson_type === 'VIDEO'
      const hasVidUrl = Boolean(
        l.embed_url || (Array.isArray(l.media_items) && l.media_items.some((m) => m.type === 'video'))
      )
      const nonVideoAtts = Array.isArray(l.media_items)
        ? l.media_items.filter((m) => m.type !== 'video')
        : []
      const hasText = Boolean(
        (l.content_md && l.content_md.trim().length > 0) ||
          (l.content_html && l.content_html.trim().length > 0)
      )

      if (isVideo) {
        videoCount++
        if (hasVidUrl) videoReady++
        else videoMissing++
      }
      if (nonVideoAtts.length > 0) hasAttachments++
      if (hasText) hasDescription++
    })

    return { total, videoCount, videoReady, videoMissing, hasAttachments, hasDescription }
  }, [lessons])

  // Filter and sort lessons
  const filteredLessons = useMemo(() => {
    return annotatedLessons
      .filter((lesson) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase()
          const matchesTitle = lesson.title.toLowerCase().includes(q)
          const matchesIndex =
            `materi ${lesson.originalIndex}`.includes(q) ||
            `pertemuan ${lesson.originalIndex}`.includes(q)
          if (!matchesTitle && !matchesIndex) return false
        }

        // Type filter
        if (typeFilter !== 'ALL' && lesson.lesson_type !== typeFilter) {
          return false
        }

        // Completeness status filter
        if (statusFilter !== 'ALL') {
          const isVideo = lesson.lesson_type === 'VIDEO'
          const hasVidUrl = Boolean(
            lesson.embed_url ||
              (Array.isArray(lesson.media_items) && lesson.media_items.some((m) => m.type === 'video'))
          )
          const nonVideoAtts = Array.isArray(lesson.media_items)
            ? lesson.media_items.filter((m) => m.type !== 'video')
            : []
          const hasText = Boolean(
            (lesson.content_md && lesson.content_md.trim().length > 0) ||
              (lesson.content_html && lesson.content_html.trim().length > 0)
          )

          if (statusFilter === 'VIDEO_READY' && (!isVideo || !hasVidUrl)) return false
          if (statusFilter === 'VIDEO_MISSING' && (!isVideo || hasVidUrl)) return false
          if (statusFilter === 'HAS_ATTACHMENT' && nonVideoAtts.length === 0) return false
          if (statusFilter === 'HAS_DESCRIPTION' && !hasText) return false
        }

        return true
      })
      .sort((a, b) => {
        if (sortBy === 'TITLE_ASC') {
          return a.title.localeCompare(b.title)
        }
        if (sortBy === 'TITLE_DESC') {
          return b.title.localeCompare(a.title)
        }
        if (sortBy === 'NEWEST') {
          const timeA = a.created_at ? new Date(a.created_at).getTime() : 0
          const timeB = b.created_at ? new Date(b.created_at).getTime() : 0
          return timeB - timeA
        }
        if (sortBy === 'OLDEST') {
          const timeA = a.created_at ? new Date(a.created_at).getTime() : 0
          const timeB = b.created_at ? new Date(b.created_at).getTime() : 0
          return timeA - timeB
        }
        // Default: CURRICULUM
        return a.originalIndex - b.originalIndex
      })
  }, [annotatedLessons, searchQuery, typeFilter, statusFilter, sortBy])

  // Grouping logic for GROUPED mode
  const groupedData = useMemo(() => {
    const map: Record<string, typeof filteredLessons> = {}
    const unassigned: typeof filteredLessons = []

    sections.forEach((s) => {
      map[s.id] = []
    })

    filteredLessons.forEach((l) => {
      if (l.section_id && map[l.section_id]) {
        map[l.section_id].push(l)
      } else {
        unassigned.push(l)
      }
    })

    return { map, unassigned }
  }, [filteredLessons, sections])

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    typeFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    sortBy !== 'CURRICULUM'

  const resetFilters = () => {
    setSearchQuery('')
    setTypeFilter('ALL')
    setStatusFilter('ALL')
    setSortBy('CURRICULUM')
  }

  // Render a single lesson card (reusable across flat & grouped modes)
  const renderLessonCard = (l: (typeof annotatedLessons)[number]) => {
    const isVideo = l.lesson_type === 'VIDEO'
    const hasVidUrl = Boolean(
      l.embed_url || (Array.isArray(l.media_items) && l.media_items.some((m) => m.type === 'video'))
    )
    const nonVideoAtts = Array.isArray(l.media_items)
      ? l.media_items.filter((m) => m.type !== 'video')
      : []
    const hasText = Boolean(
      (l.content_md && l.content_md.trim().length > 0) ||
        (l.content_html && l.content_html.trim().length > 0)
    )

    return (
      <div
        key={l.id}
        className="group relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition-all hover:border-indigo-300 hover:shadow-md"
      >
        <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
          {/* Icon Tipe Materi */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500 border border-slate-200/80 font-semibold group-hover:bg-indigo-50 group-hover:text-indigo-600 group-hover:border-indigo-200 transition-all">
            {isVideo ? (
              <PlayCircle className="h-5 w-5" />
            ) : (
              <FileText className="h-5 w-5" />
            )}
          </div>

          {/* Title */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-slate-400">
                #{l.originalIndex} •
              </span>
              <h4 className="font-bold text-slate-900 truncate max-w-full text-sm">
                {l.title}
              </h4>
              {l.is_required && (
                <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-rose-600 border border-rose-100">
                  Wajib
                </span>
              )}
            </div>

            {/* Nyala & Mati Icon Indicators Row */}
            <div className="mt-2.5 flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                {l.lesson_type}
              </span>

              <span className="text-slate-300 text-xs">•</span>

              {/* 1. Video Status Icon */}
              {isVideo ? (
                hasVidUrl ? (
                  <div
                    title="Video: Sudah Terisi (Ready)"
                    className="flex items-center justify-center size-6 rounded-full bg-emerald-100 text-emerald-600 ring-2 ring-emerald-400/40 shadow-xs transition-transform group-hover:scale-105"
                  >
                    <Video className="h-3.5 w-3.5 fill-emerald-600/20" />
                  </div>
                ) : (
                  <div
                    title="⚠️ Peringatan: Video Belum Diisi (Kosong)!"
                    className="flex items-center justify-center size-6 rounded-full bg-rose-100 text-rose-600 ring-2 ring-rose-500 animate-pulse shadow-xs"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                  </div>
                )
              ) : (
                <div
                  title="Bukan materi Video"
                  className="flex items-center justify-center size-6 rounded-full bg-slate-100 text-slate-300 opacity-60"
                >
                  <Video className="h-3 w-3" />
                </div>
              )}

              {/* 2. Deskripsi Teks Icon */}
              {hasText ? (
                <div
                  title="Deskripsi Teks: Ada"
                  className="flex items-center justify-center size-6 rounded-full bg-blue-100 text-blue-600 ring-2 ring-blue-400/40 shadow-xs transition-transform group-hover:scale-105"
                >
                  <FileText className="h-3.5 w-3.5 fill-blue-600/20" />
                </div>
              ) : (
                <div
                  title="Deskripsi Teks: Kosong"
                  className="flex items-center justify-center size-6 rounded-full bg-slate-100 text-slate-300 opacity-60"
                >
                  <FileText className="h-3.5 w-3.5" />
                </div>
              )}

              {/* 3. Aset / Lampiran Icon */}
              {nonVideoAtts.length > 0 ? (
                <div
                  title={`Aset / Lampiran: ${nonVideoAtts.length} file/link`}
                  className="relative flex items-center justify-center size-6 rounded-full bg-purple-100 text-purple-600 ring-2 ring-purple-400/40 shadow-xs transition-transform group-hover:scale-105"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  {nonVideoAtts.length > 1 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-purple-600 text-[8px] font-extrabold text-white">
                      {nonVideoAtts.length}
                    </span>
                  )}
                </div>
              ) : (
                <div
                  title="Aset / Lampiran: Kosong"
                  className="flex items-center justify-center size-6 rounded-full bg-slate-100 text-slate-300 opacity-60"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
          <Link
            href={`/lms/admin/course/${courseSlug}/lesson/${l.id}/edit`}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 shadow-xs transition-all cursor-pointer"
            title="Edit Materi"
          >
            <Edit2 className="h-3.5 w-3.5" />
            <span>Edit</span>
          </Link>
          <LessonActions lessonId={l.id} courseId={courseId} />
          <Link
            href={`/lms/${orgSlug}/learn/${courseSlug}/${l.slug}`}
            target="_blank"
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 shadow-xs transition-all flex items-center gap-1 cursor-pointer"
          >
            <span>Player</span>
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Completeness Overview Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Total Materi
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">{stats.total}</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
            Video Ready
          </div>
          <div className="text-2xl font-extrabold text-emerald-800 mt-1">
            {stats.videoReady}{' '}
            <span className="text-xs font-normal text-emerald-600">/ {stats.videoCount}</span>
          </div>
        </div>
        <div
          className={`rounded-xl border p-3.5 shadow-xs transition-colors ${
            stats.videoMissing > 0
              ? 'border-red-300 bg-red-50/90'
              : 'border-slate-200 bg-white'
          }`}
        >
          <div
            className={`text-[11px] font-bold uppercase tracking-wider ${
              stats.videoMissing > 0 ? 'text-red-700 font-extrabold' : 'text-slate-500'
            }`}
          >
            Video Kosong
          </div>
          <div
            className={`text-2xl font-extrabold mt-1 ${
              stats.videoMissing > 0 ? 'text-red-800' : 'text-slate-900'
            }`}
          >
            {stats.videoMissing}
          </div>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3.5 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
            Ada Lampiran / Aset
          </div>
          <div className="text-2xl font-extrabold text-indigo-900 mt-1">{stats.hasAttachments}</div>
        </div>
      </div>

      {/* 2. Search, Filter & View Mode Switcher Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-xs">
        {/* Top bar: View Mode switch buttons + Sort */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between pb-3 border-b border-slate-200/60">
          {/* Grouping / View Mode Switcher */}
          <div className="flex items-center gap-1.5 rounded-lg bg-slate-200/70 p-1 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('GROUPED')}
              disabled={sections.length === 0}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'GROUPED'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
              title={
                sections.length === 0
                  ? 'Belum ada seksi / bab di kelas ini'
                  : `Kelompokkan materi berdasarkan ${sections.length} Bab/Modul`
              }
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Kelompokkan Bab ({sections.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('FLAT')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'FLAT'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Tampilkan daftar berurutan datar"
            >
              <List className="h-3.5 w-3.5" />
              <span>Daftar Materi</span>
            </button>
          </div>

          {/* Expand / Collapse All buttons (only in GROUPED mode) */}
          {viewMode === 'GROUPED' && (
            <div className="flex items-center gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={expandAllSections}
                className="text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer"
              >
                Buka Semua Bab
              </button>
              <span className="text-slate-300">•</span>
              <button
                type="button"
                onClick={collapseAllSections}
                className="text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer"
              >
                Tutup Semua Bab
              </button>
            </div>
          )}
        </div>

        {/* Search & Sort */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari materi berdasar judul (mis. Pertemuan 27)..."
              className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-8 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-semibold text-slate-500 hidden md:inline">Urutan:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="CURRICULUM">Urutan Kurikulum (Default)</option>
              <option value="TITLE_ASC">Judul (A - Z)</option>
              <option value="TITLE_DESC">Judul (Z - A)</option>
              <option value="NEWEST">Terbaru Ditambahkan</option>
              <option value="OLDEST">Terlama Ditambahkan</option>
            </select>
          </div>
        </div>

        {/* Filters & Legend Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/60">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-600 mr-1 flex items-center gap-1">
              <Filter className="h-3.5 w-3.5" /> Filter:
            </span>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 focus:border-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Semua Tipe</option>
              <option value="VIDEO">Video</option>
              <option value="TEXT">Artikel / Teks</option>
              <option value="QUIZ">Kuis</option>
              <option value="ASSIGNMENT">Tugas</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 focus:border-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Semua Kelengkapan</option>
              <option value="VIDEO_READY">✅ Video Ready</option>
              <option value="VIDEO_MISSING">⚠️ Video Kosong</option>
              <option value="HAS_ATTACHMENT">📎 Ada Lampiran / Aset</option>
              <option value="HAS_DESCRIPTION">📝 Ada Deskripsi Teks</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline transition-colors cursor-pointer"
            >
              Reset Filter ({filteredLessons.length} dari {lessons.length})
            </button>
          )}
        </div>

        {/* Legend / Keterangan Ikon Nyala vs Mati */}
        <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-200/40 text-[11px] text-slate-500">
          <span className="font-bold text-slate-600">Keterangan Ikon Kelengkapan:</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="flex items-center justify-center size-5 rounded-full bg-emerald-100 text-emerald-600 ring-1 ring-emerald-400/50">
              <Video className="size-2.5" />
            </span>
            <span>Video Siap (Nyala)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="flex items-center justify-center size-5 rounded-full bg-blue-100 text-blue-600 ring-1 ring-blue-400/50">
              <FileText className="size-2.5" />
            </span>
            <span>Deskripsi Ada (Nyala)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="flex items-center justify-center size-5 rounded-full bg-purple-100 text-purple-600 ring-1 ring-purple-400/50">
              <Paperclip className="size-2.5" />
            </span>
            <span>Aset / Link Ada (Nyala)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="flex items-center justify-center size-5 rounded-full bg-slate-100 text-slate-300">
              <Video className="size-2.5" />
            </span>
            <span>Kosong / Mati</span>
          </span>
        </div>
      </div>

      {/* 3. Lesson List Rendering (Flat vs Grouped by Section) */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">
            Menampilkan {filteredLessons.length} dari {lessons.length} Materi
          </h3>
        </div>

        {filteredLessons.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm font-semibold text-slate-600">
              Tidak ada materi yang cocok dengan filter atau pencarian saat ini.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-3 inline-flex items-center rounded-md bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 cursor-pointer"
            >
              Reset Semua Filter
            </button>
          </div>
        ) : viewMode === 'FLAT' ? (
          /* ============= FLAT MODE ============= */
          <div className="flex flex-col gap-3">
            {filteredLessons.map(renderLessonCard)}
          </div>
        ) : (
          /* ============= GROUPED BY SECTION MODE ============= */
          <div className="flex flex-col gap-5">
            {sections.map((sec, secIdx) => {
              const secLessons = groupedData.map[sec.id] || []
              if (secLessons.length === 0 && hasActiveFilters) {
                return null // hide empty section when filtering
              }
              const isExpanded = expandedSections[sec.id] !== false

              // Count completeness for this section
              let secVidReady = 0
              let secVidMissing = 0
              secLessons.forEach((l) => {
                if (l.lesson_type === 'VIDEO') {
                  const ready = Boolean(
                    l.embed_url ||
                      (Array.isArray(l.media_items) && l.media_items.some((m) => m.type === 'video'))
                  )
                  if (ready) secVidReady++
                  else secVidMissing++
                }
              })

              return (
                <div
                  key={sec.id}
                  className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden transition-all"
                >
                  {/* Section Header */}
                  <div
                    onClick={() => toggleSection(sec.id)}
                    className="flex items-center justify-between gap-4 bg-slate-50/90 px-5 py-3.5 border-b border-slate-200/70 hover:bg-slate-100/70 transition-colors cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
                        {isExpanded ? (
                          <FolderOpen className="size-4" />
                        ) : (
                          <Folder className="size-4" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                            BAB / MODUL #{secIdx + 1}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="text-xs font-extrabold text-slate-700">
                            {secLessons.length} Materi
                          </span>
                        </div>
                        <h4 className="font-extrabold text-slate-900 text-base truncate">
                          {sec.title}
                        </h4>
                      </div>
                    </div>

                    {/* Section right badge & caret */}
                    <div className="flex items-center gap-3 shrink-0">
                      {secVidMissing > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 text-rose-700 px-2.5 py-0.5 text-[10px] font-bold border border-rose-300">
                          ⚠️ {secVidMissing} Video Kosong
                        </span>
                      ) : (
                        <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-0.5 text-[10px] font-bold border border-emerald-200">
                          ✅ {secVidReady} Video Ready
                        </span>
                      )}

                      <div className="flex size-7 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-500 shadow-2xs">
                        {isExpanded ? (
                          <ChevronUp className="size-4" />
                        ) : (
                          <ChevronDown className="size-4" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Section Body (Lessons inside this section) */}
                  {isExpanded && (
                    <div className="p-3 bg-slate-50/40">
                      {secLessons.length === 0 ? (
                        <div className="py-6 text-center text-xs font-semibold text-slate-400">
                          Belum ada materi di bab ini.
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2.5">
                          {secLessons.map(renderLessonCard)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Unassigned lessons (if any) */}
            {groupedData.unassigned.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
                <div
                  onClick={() => toggleSection('UNASSIGNED')}
                  className="flex items-center justify-between gap-4 bg-amber-50/80 px-5 py-3.5 border-b border-amber-200 hover:bg-amber-100/70 transition-colors cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-600 text-white shadow-xs">
                      <Folder className="size-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
                        Tanpa Seksi / Bab
                      </span>
                      <h4 className="font-extrabold text-slate-900 text-base">
                        Materi Belum Dikelompokkan ({groupedData.unassigned.length})
                      </h4>
                    </div>
                  </div>

                  <div className="flex size-7 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-500 shadow-2xs">
                    {expandedSections['UNASSIGNED'] !== false ? (
                      <ChevronUp className="size-4" />
                    ) : (
                      <ChevronDown className="size-4" />
                    )}
                  </div>
                </div>

                {expandedSections['UNASSIGNED'] !== false && (
                  <div className="p-3 bg-slate-50/40 flex flex-col gap-2.5">
                    {groupedData.unassigned.map(renderLessonCard)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
