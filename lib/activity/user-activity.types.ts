/**
 * Tipe data untuk fitur monitor aktivitas user lintas tenant.
 * Dipakai oleh API server dan panel admin Bob agar bentuk datanya konsisten.
 */

export type UserActivitySummary = {
  activeUsers10m: number
  routeVisits24h: number
  usersLoggedIn24h: number
  uniqueUsers24h: number
}

export type UserActivityTopRoute = {
  routePath: string
  visits: number
  uniqueUsers: number
}

export type UserActivityHeatmapCell = {
  dateKey: string
  dayLabel: string
  dateLabel: string
  hour: number
  activityCount: number
  uniqueUsers: number
}

export type UserActivityPresence = {
  actorUserId: string | null
  internalUserId: string | null
  email: string | null
  displayName: string | null
  orgId: string | null
  orgName: string | null
  branchId: string | null
  branchName: string | null
  role: string | null
  lastRoutePath: string | null
  lastRouteQuery: string | null
  lastRouteFull: string | null
  occurredAt: string
  lastLoginAt: string | null
}

export type UserActivityItem = {
  id: string
  eventType: 'route_view' | 'heartbeat' | 'login'
  email: string | null
  displayName: string | null
  orgId: string | null
  orgName: string | null
  branchId: string | null
  branchName: string | null
  role: string | null
  routePath: string | null
  routeQuery: string | null
  routeFull: string | null
  occurredAt: string
  ipAddress: string | null
  userAgent: string | null
}

export type UserActivitySnapshot = {
  summary: UserActivitySummary
  heatmap: UserActivityHeatmapCell[]
  topRoutes: UserActivityTopRoute[]
  currentUsers: UserActivityPresence[]
  recentActivities: UserActivityItem[]
}
