'use client'

/**
 * Panel monitor aktivitas user untuk platform admin.
 * Menampilkan user aktif, route yang paling sering dipakai, dan log terbaru.
 */

import { useEffect, useState } from 'react'
import {
  Activity,
  Building2,
  Clock3,
  Flame,
  LogIn,
  MapPin,
  RefreshCw,
  Router,
  Search,
  Users,
} from 'lucide-react'
import { SafeButton, SectionCard, StatusBadge } from '@/components/ui/NizamUI'
import type { UserActivityPresence, UserActivitySnapshot } from '@/lib/activity/user-activity.types'

function formatDateTime(value: string | null) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatRelativeAge(value: string | null) {
  if (!value) return '-'

  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return '-'

  const diffMs = Date.now() - timestamp
  const diffMinutes = Math.floor(diffMs / 60_000)

  if (diffMinutes <= 0) return 'Baru saja'
  if (diffMinutes < 60) return `${diffMinutes} menit lalu`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} jam lalu`

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} hari lalu`
}

function getPresenceVariant(user: UserActivityPresence) {
  const ageMs = Date.now() - new Date(user.occurredAt).getTime()
  if (ageMs <= 2 * 60_000) return 'success' as const
  if (ageMs <= 5 * 60_000) return 'warning' as const
  return 'neutral' as const
}

function buildSearchHaystack(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => String(part || '').trim().toLowerCase())
    .filter(Boolean)
    .join(' ')
}

function formatHourLabel(hour: number) {
  return `${String(hour).padStart(2, '0')}:00`
}

function getHeatmapCellClass(activityCount: number, maxActivity: number) {
  if (activityCount <= 0 || maxActivity <= 0) return 'bg-slate-100 border-slate-200 text-slate-300'

  const ratio = activityCount / maxActivity

  if (ratio < 0.2) return 'bg-sky-100 border-sky-200 text-sky-500'
  if (ratio < 0.4) return 'bg-sky-200 border-sky-300 text-sky-600'
  if (ratio < 0.6) return 'bg-sky-400 border-sky-500 text-sky-900'
  if (ratio < 0.8) return 'bg-blue-600 border-blue-700 text-white'
  return 'bg-slate-900 border-slate-950 text-white'
}

export function UserActivityMonitor() {
  const [snapshot, setSnapshot] = useState<UserActivitySnapshot | null>(null)
  const [searchText, setSearchText] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)

  const fetchSnapshot = async (background = false) => {
    if (!background) setLoading(true)
    if (background) setRefreshing(true)
    setError(null)

    try {
      const response = await fetch('/api/user-activity', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || `HTTP ${response.status}`)
      }

      const data = await response.json() as UserActivitySnapshot
      setSnapshot(data)
      setLastUpdatedAt(new Date().toISOString())
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : 'Gagal membaca aktivitas user.'
      setError(message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void fetchSnapshot()

    const intervalId = window.setInterval(() => {
      void fetchSnapshot(true)
    }, 30_000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  const needle = searchText.trim().toLowerCase()
  const filteredCurrentUsers = (snapshot?.currentUsers || []).filter((user) => {
    if (!needle) return true

    const haystack = buildSearchHaystack([
      user.email,
      user.displayName,
      user.orgName,
      user.branchName,
      user.role,
      user.lastRouteFull,
    ])

    return haystack.includes(needle)
  })

  const filteredActivities = (snapshot?.recentActivities || []).filter((activity) => {
    if (!needle) return true

    const haystack = buildSearchHaystack([
      activity.email,
      activity.displayName,
      activity.orgName,
      activity.branchName,
      activity.role,
      activity.routeFull,
      activity.ipAddress,
    ])

    return haystack.includes(needle)
  })

  const heatmapRows = (() => {
    const grouped = new Map<string, NonNullable<UserActivitySnapshot['heatmap']>>()

    for (const cell of snapshot?.heatmap || []) {
      const existing = grouped.get(cell.dateKey) || []
      existing.push(cell)
      grouped.set(cell.dateKey, existing)
    }

    return Array.from(grouped.entries()).map(([, cells]) =>
      [...cells].sort((left, right) => left.hour - right.hour)
    )
  })()

  const heatmapMaxActivity = Math.max(
    0,
    ...(snapshot?.heatmap || []).map((cell) => cell.activityCount)
  )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <SectionCard>
          <div className="p-5 space-y-2">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Users size={20} />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">User Aktif 10 Menit</p>
            <p className="text-3xl font-semibold tracking-tight text-slate-900">{snapshot?.summary.activeUsers10m ?? 0}</p>
          </div>
        </SectionCard>

        <SectionCard>
          <div className="p-5 space-y-2">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Router size={20} />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Kunjungan Route 24 Jam</p>
            <p className="text-3xl font-semibold tracking-tight text-slate-900">{snapshot?.summary.routeVisits24h ?? 0}</p>
          </div>
        </SectionCard>

        <SectionCard>
          <div className="p-5 space-y-2">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <LogIn size={20} />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">User Login 24 Jam</p>
            <p className="text-3xl font-semibold tracking-tight text-slate-900">{snapshot?.summary.usersLoggedIn24h ?? 0}</p>
          </div>
        </SectionCard>

        <SectionCard>
          <div className="p-5 space-y-2">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Activity size={20} />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">User Unik Route 24 Jam</p>
            <p className="text-3xl font-semibold tracking-tight text-slate-900">{snapshot?.summary.uniqueUsers24h ?? 0}</p>
          </div>
        </SectionCard>
      </div>

      <SectionCard>
        <div className="p-6 space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-slate-900">Heatmap Aktivitas 7 Hari</h3>
              <p className="mt-1 text-sm font-medium text-slate-500">
                Semakin gelap warnanya, semakin ramai aktivitas user pada jam itu. Data memakai waktu Jakarta.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">
              <Flame size={14} />
              Puncak aktivitas: {heatmapMaxActivity} event/jam
            </div>
          </div>

          {loading ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm font-bold text-slate-500">
              Memuat heatmap aktivitas...
            </div>
          ) : heatmapRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm font-bold text-slate-500">
              Belum ada data heatmap untuk ditampilkan.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <div className="min-w-[980px]">
                  <div className="grid grid-cols-[100px_repeat(24,minmax(24px,1fr))] gap-1">
                    <div />
                    {Array.from({ length: 24 }, (_, hour) => (
                      <div
                        key={`hour:${hour}`}
                        className="text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400"
                      >
                        {String(hour).padStart(2, '0')}
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 space-y-1">
                    {heatmapRows.map((row) => {
                      const firstCell = row[0]
                      const dailyTotal = row.reduce((total, cell) => total + cell.activityCount, 0)

                      return (
                        <div key={firstCell?.dateKey || 'heatmap-row'} className="grid grid-cols-[100px_repeat(24,minmax(24px,1fr))] gap-1">
                          <div className="flex items-center justify-between pr-3">
                            <div>
                              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                                {firstCell?.dayLabel || '-'}
                              </div>
                              <div className="text-[10px] font-bold text-slate-400">
                                {firstCell?.dateLabel || '-'}
                              </div>
                            </div>
                            <div className="text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                              {dailyTotal}
                            </div>
                          </div>

                          {row.map((cell) => (
                            <div
                              key={`${cell.dateKey}:${cell.hour}`}
                              title={`${firstCell?.dayLabel || ''} ${cell.dateLabel} ${formatHourLabel(cell.hour)} • ${cell.activityCount} event • ${cell.uniqueUsers} user`}
                              className={`h-7 rounded-md border transition-transform hover:scale-105 ${getHeatmapCellClass(cell.activityCount, heatmapMaxActivity)}`}
                            />
                          ))}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                <span>Sepi</span>
                {[
                  'bg-slate-100 border-slate-200',
                  'bg-sky-100 border-sky-200',
                  'bg-sky-200 border-sky-300',
                  'bg-sky-400 border-sky-500',
                  'bg-blue-600 border-blue-700',
                  'bg-slate-900 border-slate-950',
                ].map((className) => (
                  <span key={className} className={`h-3 w-6 rounded-full border ${className}`} />
                ))}
                <span>Ramai</span>
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 xl:grid-cols-[1.3fr,0.7fr] gap-6">
        <SectionCard>
          <div className="p-6 space-y-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-xl font-semibold tracking-tight text-slate-900">User Aktif Sekarang</h3>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  Dianggap aktif bila ada activity route atau heartbeat dalam 10 menit terakhir.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Update terakhir
                  <div className="mt-1 text-slate-700">{formatDateTime(lastUpdatedAt)}</div>
                </div>
                <SafeButton
                  variant="white"
                  onClick={() => fetchSnapshot(true)}
                  icon={<RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />}
                  isLoading={refreshing}
                  loadingText="Refresh..."
                >
                  Refresh
                </SafeButton>
              </div>
            </div>

            {loading ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm font-bold text-slate-500">
                Memuat ringkasan user aktif...
              </div>
            ) : filteredCurrentUsers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm font-bold text-slate-500">
                Belum ada user aktif yang cocok dengan filter.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredCurrentUsers.map((user) => (
                  <div key={`${user.actorUserId || user.email || 'unknown'}:${user.occurredAt}`} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          {user.displayName || user.email || 'User tanpa nama'}
                        </div>
                        <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-blue-600">
                          {user.email || '-'}
                        </div>
                      </div>
                      <StatusBadge label={formatRelativeAge(user.occurredAt)} variant={getPresenceVariant(user)} />
                    </div>

                    <div className="mt-4 space-y-3 text-sm">
                      <div className="rounded-xl bg-slate-50 px-4 py-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Route Terakhir</div>
                        <div className="mt-1 font-semibold text-slate-900 break-all">{user.lastRouteFull || user.lastRoutePath || '-'}</div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="rounded-xl border border-slate-200 px-4 py-3">
                          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                            <Building2 size={12} />
                            Tenant
                          </div>
                          <div className="mt-1 font-bold text-slate-800">{user.orgName || '-'}</div>
                        </div>

                        <div className="rounded-xl border border-slate-200 px-4 py-3">
                          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                            <MapPin size={12} />
                            Unit
                          </div>
                          <div className="mt-1 font-bold text-slate-800">{user.branchName || 'Semua Unit'}</div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge label={user.role || 'Tanpa Role'} variant="info" />
                        <StatusBadge label={`Login ${formatRelativeAge(user.lastLoginAt)}`} variant="neutral" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard>
          <div className="p-6 space-y-5">
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-slate-900">Route Teratas 24 Jam</h3>
              <p className="mt-1 text-sm font-medium text-slate-500">
                Diurutkan berdasarkan kunjungan route awal, bukan heartbeat.
              </p>
            </div>

            {loading ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm font-bold text-slate-500">
                Memuat statistik route...
              </div>
            ) : (snapshot?.topRoutes || []).length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm font-bold text-slate-500">
                Belum ada route yang tercatat.
              </div>
            ) : (
              <div className="space-y-3">
                {(snapshot?.topRoutes || []).map((route, index) => (
                  <div key={`${route.routePath}:${index}`} className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">#{index + 1}</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900 break-all">{route.routePath}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-lg font-semibold text-slate-900">{route.visits}</div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                          {route.uniqueUsers} user
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard>
        <div className="p-6 space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-slate-900">Log Route Terbaru</h3>
              <p className="mt-1 text-sm font-medium text-slate-500">
                Menampilkan perpindahan halaman terbaru lintas tenant.
              </p>
            </div>
            <div className="relative w-full lg:max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Cari email, tenant, role, atau route..."
                className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-12 pr-4 font-bold text-slate-700 shadow-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
              Gagal memuat monitor aktivitas: {error}
            </div>
          )}

          {loading ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm font-bold text-slate-500">
              Memuat log aktivitas...
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm font-bold text-slate-500">
              Tidak ada log route yang cocok dengan filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">Waktu</th>
                    <th className="px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">User</th>
                    <th className="px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">Tenant / Unit</th>
                    <th className="px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">Route</th>
                    <th className="px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">Akses</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredActivities.map((activity) => (
                    <tr key={activity.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-4 align-top">
                        <div className="text-sm font-semibold text-slate-900">{formatDateTime(activity.occurredAt)}</div>
                        <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                          <Clock3 size={11} />
                          {formatRelativeAge(activity.occurredAt)}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="text-sm font-semibold text-slate-900">{activity.displayName || activity.email || 'User tanpa nama'}</div>
                        <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-blue-600">{activity.email || '-'}</div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="text-sm font-bold text-slate-800">{activity.orgName || '-'}</div>
                        <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                          {activity.branchName || 'Semua Unit'}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 break-all">
                          {activity.routeFull || activity.routePath || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge label={activity.role || 'Tanpa Role'} variant="info" />
                          <StatusBadge label={activity.ipAddress || 'IP tidak ada'} variant="neutral" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  )
}
