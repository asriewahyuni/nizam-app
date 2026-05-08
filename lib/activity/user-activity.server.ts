/**
 * Helper server-side untuk merekam dan membaca aktivitas user lintas tenant.
 * Fokus utama modul ini adalah route usage agar platform admin bisa memantau
 * user aktif, halaman yang dibuka, dan tenant yang sedang dipakai.
 */

import { queryPostgres } from '@/lib/db/postgres'
import type {
  UserActivityHeatmapCell,
  UserActivityItem,
  UserActivityPresence,
  UserActivitySnapshot,
  UserActivityTopTenant,
  UserActivitySummary,
  UserActivityTopRoute,
  UserActivityWeeklyPeakDay,
  UserActivityWeeklyPeakHour,
  UserActivityWeeklyReport,
  UserActivityWeeklySummary,
} from './user-activity.types'

type ActivityEventType = 'route_view' | 'heartbeat' | 'login'

type ActivitySession = {
  sessionId: string
  user: {
    id: string
    email: string | null
    user_metadata?: Record<string, unknown>
  }
}

type RecordUserActivityInput = {
  session: ActivitySession
  eventType: ActivityEventType
  pathname: string | null
  search: string | null
  activeOrgId?: string | null
  activeBranchId?: string | null
  userAgent?: string | null
  ipAddress?: string | null
  metadata?: Record<string, unknown>
}

function normalizeText(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized || null
}

function normalizeUuid(value: unknown) {
  const normalized = normalizeText(value)?.toLowerCase() || null
  if (!normalized) return null

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)) {
    return null
  }

  return normalized
}

function normalizePathname(value: unknown) {
  const pathname = normalizeText(value)
  if (!pathname) return null
  if (!pathname.startsWith('/')) return null
  if (pathname.startsWith('/api') || pathname.startsWith('/_next')) return null
  return pathname
}

function normalizeRouteQuery(value: unknown) {
  const normalized = normalizeText(value)
  if (!normalized) return null
  if (normalized === '?') return null
  return normalized.startsWith('?') ? normalized : `?${normalized}`
}

function buildRouteFull(pathname: string | null, search: string | null) {
  if (!pathname) return null
  return `${pathname}${search || ''}`
}

function toNumber(value: unknown) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatJakartaDateLabel(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00+07:00`)
  if (Number.isNaN(date.getTime())) return dateKey

  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
  })
}

function formatJakartaDayLabel(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00+07:00`)
  if (Number.isNaN(date.getTime())) return dateKey

  return date.toLocaleDateString('id-ID', {
    weekday: 'short',
  })
}

function formatJakartaLongDateLabel(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00+07:00`)
  if (Number.isNaN(date.getTime())) return dateKey

  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function buildPeriodLabel(periodStart: string, periodEnd: string) {
  return `${formatJakartaLongDateLabel(periodStart)} - ${formatJakartaLongDateLabel(periodEnd)}`
}

async function getHeatmapRows7d() {
  return queryPostgres<{
    date_key: string
    hour_of_day: number | string | null
    activity_count: number | string | null
    unique_users: number | string | null
  }>(
    `
      with date_series as (
        select generate_series(
          (timezone('Asia/Jakarta', now())::date - interval '6 days')::date,
          timezone('Asia/Jakarta', now())::date,
          interval '1 day'
        )::date as activity_date
      ),
      hour_series as (
        select generate_series(0, 23) as hour_of_day
      ),
      aggregated as (
        select
          (occurred_at at time zone 'Asia/Jakarta')::date as activity_date,
          extract(hour from occurred_at at time zone 'Asia/Jakarta')::int as hour_of_day,
          count(*)::int as activity_count,
          count(distinct coalesce(actor_user_id::text, email, session_id::text))::int as unique_users
        from public.user_activity_logs
        where event_type in ('route_view', 'heartbeat')
          and occurred_at >= now() - interval '7 days'
        group by 1, 2
      )
      select
        to_char(date_series.activity_date, 'YYYY-MM-DD') as date_key,
        hour_series.hour_of_day,
        coalesce(aggregated.activity_count, 0)::int as activity_count,
        coalesce(aggregated.unique_users, 0)::int as unique_users
      from date_series
      cross join hour_series
      left join aggregated
        on aggregated.activity_date = date_series.activity_date
       and aggregated.hour_of_day = hour_series.hour_of_day
      order by date_series.activity_date asc, hour_series.hour_of_day asc
    `
  )
}

function mapHeatmapRows(
  rows: Array<{
    date_key: string
    hour_of_day: number | string | null
    activity_count: number | string | null
    unique_users: number | string | null
  }>
): UserActivityHeatmapCell[] {
  return rows.map((row) => ({
    dateKey: String(row.date_key || ''),
    dayLabel: formatJakartaDayLabel(String(row.date_key || '')),
    dateLabel: formatJakartaDateLabel(String(row.date_key || '')),
    hour: toNumber(row.hour_of_day),
    activityCount: toNumber(row.activity_count),
    uniqueUsers: toNumber(row.unique_users),
  }))
}

function getPeakHourFromHeatmap(heatmap: UserActivityHeatmapCell[]): UserActivityWeeklyPeakHour | null {
  const sorted = [...heatmap]
    .filter((cell) => cell.activityCount > 0)
    .sort((left, right) => {
      if (right.activityCount !== left.activityCount) return right.activityCount - left.activityCount
      if (right.uniqueUsers !== left.uniqueUsers) return right.uniqueUsers - left.uniqueUsers
      if (left.dateKey !== right.dateKey) return left.dateKey.localeCompare(right.dateKey)
      return left.hour - right.hour
    })

  if (!sorted[0]) return null

  return {
    dateKey: sorted[0].dateKey,
    dayLabel: sorted[0].dayLabel,
    dateLabel: sorted[0].dateLabel,
    hour: sorted[0].hour,
    activityCount: sorted[0].activityCount,
    uniqueUsers: sorted[0].uniqueUsers,
  }
}

async function resolveMembershipRole(userId: string | null, orgId: string | null) {
  if (!userId || !orgId) return null

  const result = await queryPostgres<{ role: string | null }>(
    `
      select role
      from public.org_members
      where user_id = $1::uuid
        and org_id = $2::uuid
        and is_active = true
      limit 1
    `,
    [userId, orgId]
  )

  return normalizeText(result.rows[0]?.role) || null
}

export async function recordUserActivity(input: RecordUserActivityInput) {
  const eventType: ActivityEventType =
    input.eventType === 'heartbeat' ? 'heartbeat' :
    input.eventType === 'login' ? 'login' :
    'route_view'

  const pathname = normalizePathname(input.pathname)
  const search = normalizeRouteQuery(input.search)
  const routeFull = buildRouteFull(pathname, search)
  const sessionId = normalizeUuid(input.session.sessionId)

  if (eventType !== 'login' && !pathname) {
    return { skipped: true as const }
  }

  const actorUserId = normalizeUuid(input.session.user.id)
  const internalUserId = normalizeUuid(input.session.user.user_metadata?.internal_user_id)
  const activeOrgId = normalizeUuid(input.activeOrgId)
  const activeBranchId = normalizeUuid(input.activeBranchId)
  const email = normalizeText(input.session.user.email)?.toLowerCase() || null
  const displayName =
    normalizeText(input.session.user.user_metadata?.full_name) ||
    normalizeText(input.session.user.email) ||
    null
  const role = await resolveMembershipRole(actorUserId, activeOrgId)
  const userAgent = normalizeText(input.userAgent)
  const ipAddress = normalizeText(input.ipAddress)
  const dedupeSeconds = eventType === 'heartbeat' ? 50 : 10

  if (sessionId && routeFull) {
    const duplicateLookup = await queryPostgres<{ id: string }>(
      `
        select id::text as id
        from public.user_activity_logs
        where session_id = $1::uuid
          and event_type = $2::text
          and route_full = $3::text
          and occurred_at >= now() - make_interval(secs => $4::int)
        limit 1
      `,
      [sessionId, eventType, routeFull, dedupeSeconds]
    )

    if (duplicateLookup.rows[0]?.id) {
      return { skipped: true as const }
    }
  }

  await queryPostgres(
    `
      insert into public.user_activity_logs (
        event_type,
        actor_user_id,
        internal_user_id,
        session_id,
        email,
        display_name,
        org_id,
        branch_id,
        role,
        route_path,
        route_query,
        route_full,
        user_agent,
        ip_address,
        metadata
      )
      values (
        $1::text,
        $2::uuid,
        $3::uuid,
        $4::uuid,
        $5::text,
        $6::text,
        $7::uuid,
        $8::uuid,
        $9::text,
        $10::text,
        $11::text,
        $12::text,
        $13::text,
        $14::text,
        $15::jsonb
      )
    `,
    [
      eventType,
      actorUserId,
      internalUserId,
      sessionId,
      email,
      displayName,
      activeOrgId,
      activeBranchId,
      role,
      pathname,
      search,
      routeFull,
      userAgent,
      ipAddress,
      JSON.stringify(input.metadata || {}),
    ]
  )

  return { skipped: false as const }
}

export async function getUserActivitySnapshot(): Promise<UserActivitySnapshot> {
  const summaryResult = await queryPostgres<{
    active_users_10m: number | string | null
    route_visits_24h: number | string | null
    users_logged_in_24h: number | string | null
    unique_users_24h: number | string | null
  }>(
    `
      with route_summary as (
        select
          count(distinct coalesce(actor_user_id::text, email, session_id::text))
            filter (
              where occurred_at >= now() - interval '10 minutes'
                and event_type in ('route_view', 'heartbeat')
            )::int as active_users_10m,
          count(*)
            filter (
              where occurred_at >= now() - interval '24 hours'
                and event_type = 'route_view'
            )::int as route_visits_24h,
          count(distinct coalesce(actor_user_id::text, email, session_id::text))
            filter (
              where occurred_at >= now() - interval '24 hours'
                and event_type = 'route_view'
            )::int as unique_users_24h
        from public.user_activity_logs
      ),
      login_summary as (
        select
          count(*)::int as users_logged_in_24h
        from public.internal_auth_users
        where is_active = true
          and last_login_at >= now() - interval '24 hours'
      )
      select
        route_summary.active_users_10m,
        route_summary.route_visits_24h,
        route_summary.unique_users_24h,
        login_summary.users_logged_in_24h
      from route_summary
      cross join login_summary
    `
  )

  const summaryRow = summaryResult.rows[0]
  const summary: UserActivitySummary = {
    activeUsers10m: toNumber(summaryRow?.active_users_10m),
    routeVisits24h: toNumber(summaryRow?.route_visits_24h),
    usersLoggedIn24h: toNumber(summaryRow?.users_logged_in_24h),
    uniqueUsers24h: toNumber(summaryRow?.unique_users_24h),
  }

  const heatmapResult = await getHeatmapRows7d()
  const heatmap: UserActivityHeatmapCell[] = mapHeatmapRows(heatmapResult.rows)

  const topRoutesResult = await queryPostgres<{
    route_path: string | null
    visits: number | string | null
    unique_users: number | string | null
  }>(
    `
      select
        route_path,
        count(*)::int as visits,
        count(distinct coalesce(actor_user_id::text, email, session_id::text))::int as unique_users
      from public.user_activity_logs
      where event_type = 'route_view'
        and route_path is not null
        and occurred_at >= now() - interval '24 hours'
      group by route_path
      order by visits desc, route_path asc
      limit 8
    `
  )

  const topRoutes: UserActivityTopRoute[] = topRoutesResult.rows
    .filter((row) => normalizeText(row.route_path))
    .map((row) => ({
      routePath: normalizeText(row.route_path) || '/',
      visits: toNumber(row.visits),
      uniqueUsers: toNumber(row.unique_users),
    }))

  const currentUsersResult = await queryPostgres<{
    actor_user_id: string | null
    internal_user_id: string | null
    email: string | null
    display_name: string | null
    org_id: string | null
    org_name: string | null
    branch_id: string | null
    branch_name: string | null
    role: string | null
    route_path: string | null
    route_query: string | null
    route_full: string | null
    occurred_at: string
    last_login_at: string | null
  }>(
    `
      with latest_presence as (
        select distinct on (coalesce(actor_user_id::text, email, session_id::text))
          actor_user_id,
          internal_user_id,
          email,
          display_name,
          org_id,
          branch_id,
          role,
          route_path,
          route_query,
          route_full,
          occurred_at
        from public.user_activity_logs
        where event_type in ('route_view', 'heartbeat')
          and occurred_at >= now() - interval '10 minutes'
        order by
          coalesce(actor_user_id::text, email, session_id::text),
          occurred_at desc
      )
      select
        latest_presence.actor_user_id::text,
        latest_presence.internal_user_id::text,
        latest_presence.email,
        latest_presence.display_name,
        latest_presence.org_id::text,
        organizations.name as org_name,
        latest_presence.branch_id::text,
        branches.name as branch_name,
        latest_presence.role,
        latest_presence.route_path,
        latest_presence.route_query,
        latest_presence.route_full,
        latest_presence.occurred_at::text,
        internal_auth_users.last_login_at::text
      from latest_presence
      left join public.organizations
        on organizations.id = latest_presence.org_id
      left join public.branches
        on branches.id = latest_presence.branch_id
      left join public.internal_auth_users
        on internal_auth_users.id = latest_presence.internal_user_id
      order by latest_presence.occurred_at desc
      limit 24
    `
  )

  const currentUsers: UserActivityPresence[] = currentUsersResult.rows.map((row) => ({
    actorUserId: normalizeText(row.actor_user_id),
    internalUserId: normalizeText(row.internal_user_id),
    email: normalizeText(row.email),
    displayName: normalizeText(row.display_name),
    orgId: normalizeText(row.org_id),
    orgName: normalizeText(row.org_name),
    branchId: normalizeText(row.branch_id),
    branchName: normalizeText(row.branch_name),
    role: normalizeText(row.role),
    lastRoutePath: normalizeText(row.route_path),
    lastRouteQuery: normalizeText(row.route_query),
    lastRouteFull: normalizeText(row.route_full),
    occurredAt: row.occurred_at,
    lastLoginAt: normalizeText(row.last_login_at),
  }))

  const recentActivitiesResult = await queryPostgres<{
    id: string
    event_type: ActivityEventType
    email: string | null
    display_name: string | null
    org_id: string | null
    org_name: string | null
    branch_id: string | null
    branch_name: string | null
    role: string | null
    route_path: string | null
    route_query: string | null
    route_full: string | null
    occurred_at: string
    ip_address: string | null
    user_agent: string | null
  }>(
    `
      select
        user_activity_logs.id::text,
        user_activity_logs.event_type,
        user_activity_logs.email,
        user_activity_logs.display_name,
        user_activity_logs.org_id::text,
        organizations.name as org_name,
        user_activity_logs.branch_id::text,
        branches.name as branch_name,
        user_activity_logs.role,
        user_activity_logs.route_path,
        user_activity_logs.route_query,
        user_activity_logs.route_full,
        user_activity_logs.occurred_at::text,
        user_activity_logs.ip_address,
        user_activity_logs.user_agent
      from public.user_activity_logs
      left join public.organizations
        on organizations.id = user_activity_logs.org_id
      left join public.branches
        on branches.id = user_activity_logs.branch_id
      where user_activity_logs.event_type = 'route_view'
      order by user_activity_logs.occurred_at desc
      limit 120
    `
  )

  const recentActivities: UserActivityItem[] = recentActivitiesResult.rows.map((row) => ({
    id: row.id,
    eventType: row.event_type,
    email: normalizeText(row.email),
    displayName: normalizeText(row.display_name),
    orgId: normalizeText(row.org_id),
    orgName: normalizeText(row.org_name),
    branchId: normalizeText(row.branch_id),
    branchName: normalizeText(row.branch_name),
    role: normalizeText(row.role),
    routePath: normalizeText(row.route_path),
    routeQuery: normalizeText(row.route_query),
    routeFull: normalizeText(row.route_full),
    occurredAt: row.occurred_at,
    ipAddress: normalizeText(row.ip_address),
    userAgent: normalizeText(row.user_agent),
  }))

  return {
    summary,
    heatmap,
    topRoutes,
    currentUsers,
    recentActivities,
  }
}

/**
 * Ringkasan pemakaian sistem 7 hari terakhir untuk laporan email admin.
 * Fokusnya pada analytics aktivitas platform dan insight heatmap mingguan.
 */
export async function getWeeklyUserActivityReport(): Promise<UserActivityWeeklyReport> {
  const summaryResult = await queryPostgres<{
    active_users_10m: number | string | null
    route_visits_7d: number | string | null
    users_logged_in_7d: number | string | null
    unique_users_7d: number | string | null
    active_orgs_7d: number | string | null
    active_branches_7d: number | string | null
  }>(
    `
      with route_summary as (
        select
          count(distinct coalesce(actor_user_id::text, email, session_id::text))
            filter (
              where occurred_at >= now() - interval '10 minutes'
                and event_type in ('route_view', 'heartbeat')
            )::int as active_users_10m,
          count(*)
            filter (
              where occurred_at >= now() - interval '7 days'
                and event_type = 'route_view'
            )::int as route_visits_7d,
          count(distinct coalesce(actor_user_id::text, email, session_id::text))
            filter (
              where occurred_at >= now() - interval '7 days'
                and event_type = 'route_view'
            )::int as unique_users_7d,
          count(distinct org_id::text)
            filter (
              where occurred_at >= now() - interval '7 days'
                and event_type = 'route_view'
                and org_id is not null
            )::int as active_orgs_7d,
          count(distinct branch_id::text)
            filter (
              where occurred_at >= now() - interval '7 days'
                and event_type = 'route_view'
                and branch_id is not null
            )::int as active_branches_7d
        from public.user_activity_logs
      ),
      login_summary as (
        select
          count(*)::int as users_logged_in_7d
        from public.internal_auth_users
        where is_active = true
          and last_login_at >= now() - interval '7 days'
      )
      select
        route_summary.active_users_10m,
        route_summary.route_visits_7d,
        route_summary.unique_users_7d,
        route_summary.active_orgs_7d,
        route_summary.active_branches_7d,
        login_summary.users_logged_in_7d
      from route_summary
      cross join login_summary
    `
  )

  const summaryRow = summaryResult.rows[0]
  const summary: UserActivityWeeklySummary = {
    activeUsers10m: toNumber(summaryRow?.active_users_10m),
    routeVisits7d: toNumber(summaryRow?.route_visits_7d),
    usersLoggedIn7d: toNumber(summaryRow?.users_logged_in_7d),
    uniqueUsers7d: toNumber(summaryRow?.unique_users_7d),
    activeOrgs7d: toNumber(summaryRow?.active_orgs_7d),
    activeBranches7d: toNumber(summaryRow?.active_branches_7d),
  }

  const heatmapResult = await getHeatmapRows7d()
  const heatmap = mapHeatmapRows(heatmapResult.rows)

  const topRoutesResult = await queryPostgres<{
    route_path: string | null
    visits: number | string | null
    unique_users: number | string | null
  }>(
    `
      select
        route_path,
        count(*)::int as visits,
        count(distinct coalesce(actor_user_id::text, email, session_id::text))::int as unique_users
      from public.user_activity_logs
      where event_type = 'route_view'
        and route_path is not null
        and occurred_at >= now() - interval '7 days'
      group by route_path
      order by visits desc, route_path asc
      limit 10
    `
  )

  const topRoutes: UserActivityTopRoute[] = topRoutesResult.rows
    .filter((row) => normalizeText(row.route_path))
    .map((row) => ({
      routePath: normalizeText(row.route_path) || '/',
      visits: toNumber(row.visits),
      uniqueUsers: toNumber(row.unique_users),
    }))

  const topTenantsResult = await queryPostgres<{
    org_id: string | null
    org_name: string | null
    visits: number | string | null
    unique_users: number | string | null
  }>(
    `
      select
        user_activity_logs.org_id::text as org_id,
        coalesce(organizations.name, 'Tanpa Tenant') as org_name,
        count(*)::int as visits,
        count(distinct coalesce(user_activity_logs.actor_user_id::text, user_activity_logs.email, user_activity_logs.session_id::text))::int as unique_users
      from public.user_activity_logs
      left join public.organizations
        on organizations.id = user_activity_logs.org_id
      where user_activity_logs.event_type = 'route_view'
        and user_activity_logs.occurred_at >= now() - interval '7 days'
      group by user_activity_logs.org_id::text, coalesce(organizations.name, 'Tanpa Tenant')
      order by visits desc, org_name asc
      limit 10
    `
  )

  const topTenants: UserActivityTopTenant[] = topTenantsResult.rows.map((row) => ({
    orgId: normalizeText(row.org_id),
    orgName: normalizeText(row.org_name) || 'Tanpa Tenant',
    visits: toNumber(row.visits),
    uniqueUsers: toNumber(row.unique_users),
  }))

  const peakDayResult = await queryPostgres<{
    date_key: string
    activity_count: number | string | null
    unique_users: number | string | null
  }>(
    `
      select
        to_char((occurred_at at time zone 'Asia/Jakarta')::date, 'YYYY-MM-DD') as date_key,
        count(*)::int as activity_count,
        count(distinct coalesce(actor_user_id::text, email, session_id::text))::int as unique_users
      from public.user_activity_logs
      where event_type in ('route_view', 'heartbeat')
        and occurred_at >= now() - interval '7 days'
      group by (occurred_at at time zone 'Asia/Jakarta')::date
      order by activity_count desc, date_key asc
      limit 1
    `
  )

  const peakHour = getPeakHourFromHeatmap(heatmap)
  const peakDayRow = peakDayResult.rows[0]
  const peakDay: UserActivityWeeklyPeakDay | null = peakDayRow
    ? {
        dateKey: String(peakDayRow.date_key || ''),
        dayLabel: formatJakartaDayLabel(String(peakDayRow.date_key || '')),
        dateLabel: formatJakartaDateLabel(String(peakDayRow.date_key || '')),
        activityCount: toNumber(peakDayRow.activity_count),
        uniqueUsers: toNumber(peakDayRow.unique_users),
      }
    : null

  const periodStart = heatmap[0]?.dateKey || ''
  const periodEnd = heatmap[heatmap.length - 1]?.dateKey || ''

  return {
    periodStart,
    periodEnd,
    periodLabel: buildPeriodLabel(periodStart, periodEnd),
    summary,
    heatmap,
    topRoutes,
    topTenants,
    peakHour,
    peakDay,
  }
}
