'use client'

import React, { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Search,
  Filter,
  ArrowUpDown,
  Award,
  Crown,
  BookOpen,
  Calendar,
  Settings,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Users,
  X,
  Check,
  Loader2,
  Shield,
  History,
  Phone,
  FileSpreadsheet,
  LogIn,
} from 'lucide-react'
import {
  MemberSummary,
  LmsGamificationSettings,
  updateLmsGamificationSettings,
} from '@/modules/edu/actions/lms-members.actions'
import { impersonateLmsMemberAction } from '@/modules/edu/actions/lms-member-impersonation.actions'
import { MemberTimelineModal } from './MemberTimelineModal'

interface MembersAdminClientProps {
  orgSlug: string
  initialMembers: MemberSummary[]
  initialSettings: LmsGamificationSettings
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}

export function MembersAdminClient({
  orgSlug,
  initialMembers,
  initialSettings,
  totalCount,
  page,
  pageSize,
  totalPages,
}: MembersAdminClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // URL state
  const currentSearch = searchParams.get('search') || ''
  const currentLevelFilter = searchParams.get('levelFilter') || 'ALL'
  const currentCourseFilter = searchParams.get('courseFilter') || 'ALL'
  const currentSortBy = searchParams.get('sortBy') || 'level_desc'

  const [search, setSearch] = useState(currentSearch)
  const [selectedMember, setSelectedMember] = useState<MemberSummary | null>(null)

  // Gamification Settings Modal State
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [levelNames, setLevelNames] = useState<string[]>(initialSettings.levelNames)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsMsg, setSettingsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  )

  // Impersonation ("Login sebagai Member")
  const [impersonatingUserId, setImpersonatingUserId] = useState<string | null>(null)
  const [impersonationError, setImpersonationError] = useState<string | null>(null)

  const handleImpersonate = async (member: MemberSummary) => {
    if (!window.confirm(
      `Login sebagai ${member.name}? Anda akan melihat member portal persis seperti akun ini sampai kembali ke sesi admin.`,
    )) {
      return
    }
    setImpersonationError(null)
    setImpersonatingUserId(member.userId)
    const result = await impersonateLmsMemberAction(orgSlug, member.userId)
    setImpersonatingUserId(null)
    if (result?.error) {
      setImpersonationError(result.error)
    }
    // Kalau sukses, action ini redirect() ke /member/{orgSlug} — tidak ada return.
  }

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'ALL' && value !== '') {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.delete('page')
    router.push(`/lms/admin/members?${params.toString()}`)
  }

  const handlePageChange = (nextPage: number) => {
    const params = new URLSearchParams(searchParams.toString())
    if (nextPage > 1) {
      params.set('page', String(nextPage))
    } else {
      params.delete('page')
    }
    router.push(`/lms/admin/members?${params.toString()}`)
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleFilterChange('search', search)
  }

  const handleSaveGamificationSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingSettings(true)
    setSettingsMsg(null)

    const res = await updateLmsGamificationSettings({
      ...initialSettings,
      levelNames,
    })

    setSavingSettings(false)
    if (res.error) {
      setSettingsMsg({ type: 'error', text: res.error })
    } else {
      setSettingsMsg({
        type: 'success',
        text: 'Gamification level names updated successfully!',
      })
      setTimeout(() => {
        setShowSettingsModal(false)
        router.refresh()
      }, 1200)
    }
  }

  return (
    <div className="space-y-6">
      {impersonationError && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          <span>{impersonationError}</span>
          <button
            type="button"
            onClick={() => setImpersonationError(null)}
            className="cursor-pointer text-xs underline"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
            /lms/admin · Member Directory
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Member Management & Gamification
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {totalCount} members registered · Track learning progress, levels, badges, and history timelines.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`/api/lms/export?type=members&search=${encodeURIComponent(currentSearch)}&levelFilter=${encodeURIComponent(currentLevelFilter)}&courseFilter=${encodeURIComponent(currentCourseFilter)}&sortBy=${encodeURIComponent(currentSortBy)}`}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <FileSpreadsheet className="h-4 w-4 text-slate-500" />
            Export XLSX
          </a>
          <button
            onClick={() => {
              setLevelNames([...initialSettings.levelNames])
              setShowSettingsModal(true)
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <Settings className="h-4 w-4 text-slate-500" />
            Customize Levels & Badges
          </button>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search members by name, email, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* Level Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={currentLevelFilter}
              onChange={(e) => handleFilterChange('levelFilter', e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-semibold text-slate-700 focus:border-indigo-500 focus:outline-none"
            >
              <option value="ALL">All Levels</option>
              <option value="0">Level 0: {initialSettings.levelNames[0]}</option>
              <option value="1">Level 1: {initialSettings.levelNames[1]}</option>
              <option value="2">Level 2: {initialSettings.levelNames[2]}</option>
              <option value="3">Level 3: {initialSettings.levelNames[3]}</option>
            </select>
          </div>

          {/* Course Progress Filter */}
          <select
            value={currentCourseFilter}
            onChange={(e) => handleFilterChange('courseFilter', e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-semibold text-slate-700 focus:border-indigo-500 focus:outline-none"
          >
            <option value="ALL">All Course Progress</option>
            <option value="ENROLLED">Enrolled in Courses</option>
            <option value="COMPLETED">Completed at least 1 Course</option>
            <option value="NOT_ENROLLED">Not Enrolled Yet</option>
          </select>

          {/* Sorting Option */}
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={currentSortBy}
              onChange={(e) => handleFilterChange('sortBy', e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-semibold text-slate-700 focus:border-indigo-500 focus:outline-none"
            >
              <option value="level_desc">Highest Gamification Level</option>
              <option value="joined_desc">Newest Members First</option>
              <option value="joined_asc">Oldest Members First</option>
              <option value="name_asc">Name (A – Z)</option>
              <option value="name_desc">Name (Z – A)</option>
              <option value="courses_desc">Most Courses Enrolled</option>
            </select>
          </div>

          <button
            type="submit"
            className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition"
          >
            Filter
          </button>
        </form>
      </div>

      {/* Members Directory Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50/70 uppercase text-slate-400 font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">Member</th>
                <th className="px-4 py-4">Role</th>
                <th className="px-4 py-4">Gamification Level</th>
                <th className="px-4 py-4 text-center">Badges</th>
                <th className="px-4 py-4 text-center">Courses (Enrolled / Completed)</th>
                <th className="px-4 py-4">Joined Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {initialMembers.map((member) => (
                <tr
                  key={member.userId}
                  className="group transition-colors hover:bg-slate-50/70 cursor-pointer"
                  onClick={() => setSelectedMember(member)}
                >
                  {/* Member Name & Email */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/10 font-bold text-indigo-700">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {member.name}
                        </div>
                        <div className="text-[11px] text-slate-400">{member.email}</div>
                        {member.phone && (
                          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
                            <Phone className="h-3 w-3" />
                            {member.phone}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Role */}
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-700">
                      <Shield className="h-3 w-3 text-slate-400" />
                      {member.role}
                    </span>
                  </td>

                  {/* Gamification Level */}
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/60 bg-amber-50/70 px-2.5 py-1 text-[11px] font-bold text-amber-800">
                      <Crown className="h-3.5 w-3.5 text-amber-500" />
                      Level {member.levelIndex}: {member.levelName}
                    </span>
                  </td>

                  {/* Badges */}
                  <td className="px-4 py-4 text-center">
                    <div className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-1 text-xs font-bold text-purple-700 border border-purple-200/50">
                      <Award className="h-3.5 w-3.5 text-purple-500" />
                      {member.badges.length}
                    </div>
                  </td>

                  {/* Courses */}
                  <td className="px-4 py-4 text-center">
                    <div className="flex items-center justify-center gap-2 font-semibold">
                      <span className="text-slate-900">{member.enrolledCount}</span>
                      <span className="text-slate-300">/</span>
                      <span className="text-emerald-600">{member.completedCount}</span>
                    </div>
                  </td>

                  {/* Joined Date */}
                  <td className="px-4 py-4 text-slate-500">
                    {new Date(member.joinedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleImpersonate(member)}
                        disabled={impersonatingUserId === member.userId}
                        title="Login sebagai member ini di member portal"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-600 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-wait disabled:opacity-50"
                      >
                        {impersonatingUserId === member.userId ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <LogIn className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => setSelectedMember(member)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-indigo-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
                      >
                        <History className="h-3.5 w-3.5" />
                        Timeline
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {initialMembers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-500">
                    No members match the selected search criteria or filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <nav
            aria-label="Navigasi halaman member"
            className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-xs font-medium text-slate-500">
              Halaman <span className="font-bold text-slate-900">{page}</span> dari {totalPages}
              {' · '}
              {totalCount} member total ({pageSize} per halaman)
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handlePageChange(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm transition-colors duration-150 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:hover:border-slate-200 disabled:hover:bg-slate-50 disabled:hover:text-slate-400"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Sebelumnya
              </button>
              <button
                type="button"
                onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm transition-colors duration-150 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:hover:border-slate-200 disabled:hover:bg-slate-50 disabled:hover:text-slate-400"
              >
                Berikutnya
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </nav>
        )}
      </div>

      {/* Gamification Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-white/40 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Customize Gamification Levels & Badges
                </h3>
                <p className="text-xs text-slate-500">
                  Default gamification names can be customized to match your organization&apos;s brand.
                </p>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGamificationSettings} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Level 0 Name (0 Courses Completed)
                </label>
                <input
                  type="text"
                  required
                  value={levelNames[0] || ''}
                  onChange={(e) => {
                    const newNames = [...levelNames]
                    newNames[0] = e.target.value
                    setLevelNames(newNames)
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-semibold text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none"
                  placeholder="e.g. Level 0"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Level 1 Name (1 – 2 Courses Completed)
                </label>
                <input
                  type="text"
                  required
                  value={levelNames[1] || ''}
                  onChange={(e) => {
                    const newNames = [...levelNames]
                    newNames[1] = e.target.value
                    setLevelNames(newNames)
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-semibold text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none"
                  placeholder="e.g. Level 1"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Level 2 Name (3 – 5 Courses Completed)
                </label>
                <input
                  type="text"
                  required
                  value={levelNames[2] || ''}
                  onChange={(e) => {
                    const newNames = [...levelNames]
                    newNames[2] = e.target.value
                    setLevelNames(newNames)
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-semibold text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none"
                  placeholder="e.g. Level 2"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Level 3 Name (6+ Courses Completed)
                </label>
                <input
                  type="text"
                  required
                  value={levelNames[3] || ''}
                  onChange={(e) => {
                    const newNames = [...levelNames]
                    newNames[3] = e.target.value
                    setLevelNames(newNames)
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-semibold text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none"
                  placeholder="e.g. Level 3"
                />
              </div>

              {settingsMsg && (
                <div
                  className={`rounded-xl p-3 text-xs font-bold ${
                    settingsMsg.type === 'error'
                      ? 'bg-rose-50 text-rose-700'
                      : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {settingsMsg.text}
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  {savingSettings && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Custom Level Names
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Member Timeline & Badges Modal */}
      <MemberTimelineModal
        isOpen={!!selectedMember}
        onClose={() => setSelectedMember(null)}
        member={selectedMember}
      />
    </div>
  )
}
