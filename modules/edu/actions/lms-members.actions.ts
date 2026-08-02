'use server'

import { revalidatePath } from 'next/cache'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { queryPostgres } from '@/lib/db/postgres'
import { createClient } from '@/lib/supabase/server'

// ── Types & Interfaces ────────────────────────────────────────────────────────

export interface MemberBadge {
  id: string
  title: string
  description?: string
  color: string
  iconName: string
  awardedAt?: string
  isMilestone?: boolean
}

export interface MemberSummary {
  userId: string
  name: string
  email: string
  phone: string | null
  role: string
  isActive: boolean
  joinedAt: string
  enrolledCount: number
  completedCount: number
  levelIndex: number
  levelName: string
  badges: MemberBadge[]
}

export interface MemberCourseOption {
  id: string
  title: string
}

export interface MemberTimelineEvent {
  id: string
  type: 'JOINED_ORG' | 'COURSE_ENROLLED' | 'COURSE_COMPLETED' | 'BADGE_AWARDED'
  title: string
  description: string
  timestamp: string
  iconType: string
  color: string
}

export interface LmsGamificationSettings {
  levelNames: string[]
  milestoneBadges: {
    id: string
    name: string
    description: string
    color: string
  }[]
}

const DEFAULT_GAMIFICATION_SETTINGS: LmsGamificationSettings = {
  levelNames: ['Level 0', 'Level 1', 'Level 2', 'Level 3'],
  milestoneBadges: [
    {
      id: 'pioneer',
      name: 'Member Pioneer',
      description: 'Joined the LMS member community',
      color: '#0F766E',
    },
    {
      id: 'finisher',
      name: 'Course Finisher',
      description: 'Completed first training course',
      color: '#3B82F6',
    },
    {
      id: 'master',
      name: 'Knowledge Master',
      description: 'Completed 3+ training courses',
      color: '#CA8A04',
    },
  ],
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getErrorMessage(error: unknown): string {
  if (!error) return 'Unknown error'
  if (typeof error === 'string') return error
  if (typeof error === 'object' && 'message' in error && error.message) {
    return String((error as { message: unknown }).message)
  }
  return 'Unknown error'
}

async function assertOrgAdmin() {
  const orgData = await getActiveOrg()
  if (!orgData) throw new Error('Not authenticated')
  if (!['owner', 'admin'].includes(orgData.role)) throw new Error('Access denied: Admin required')
  return orgData
}

// ── Fetch Gamification Settings ───────────────────────────────────────────────

export async function getLmsGamificationSettings(orgId: string): Promise<LmsGamificationSettings> {
  const { rows } = await queryPostgres<{ settings: unknown }>(
    `SELECT settings FROM public.organizations WHERE id = $1::uuid LIMIT 1`,
    [orgId]
  )
  const settingsObj = rows[0]?.settings as Record<string, unknown> | undefined
  const gamification = settingsObj?.lms_gamification as Record<string, unknown> | undefined

  let levelNames = DEFAULT_GAMIFICATION_SETTINGS.levelNames
  if (Array.isArray(gamification?.level_names) && gamification.level_names.length >= 4) {
    levelNames = gamification.level_names.map((n) => String(n))
  }

  let milestoneBadges = DEFAULT_GAMIFICATION_SETTINGS.milestoneBadges
  if (Array.isArray(gamification?.milestone_badges) && gamification.milestone_badges.length > 0) {
    milestoneBadges = gamification.milestone_badges.map((b: unknown) => {
      const item = b as Record<string, unknown>
      return {
        id: String(item?.id || 'badge'),
        name: String(item?.name || 'Badge'),
        description: String(item?.description || ''),
        color: String(item?.color || '#0F766E'),
      }
    })
  }

  return {
    levelNames,
    milestoneBadges,
  }
}

// ── Update Gamification Settings ──────────────────────────────────────────────

export async function updateLmsGamificationSettings(
  settings: LmsGamificationSettings
): Promise<{ success?: boolean; error?: string }> {
  try {
    const orgData = await assertOrgAdmin()
    const supabase = await createClient()

    // Fetch current settings
    const { data: org, error: fetchErr } = await supabase
      .from('organizations')
      .select('settings')
      .eq('id', orgData.org.id)
      .single()

    if (fetchErr) return { error: getErrorMessage(fetchErr) }

    const currentSettings = (org?.settings || {}) as Record<string, unknown>
    const updatedSettings = {
      ...currentSettings,
      lms_gamification: {
        level_names: settings.levelNames,
        milestone_badges: settings.milestoneBadges,
      },
    }

    const { error: updateErr } = await supabase
      .from('organizations')
      .update({
        settings: updatedSettings,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orgData.org.id)

    if (updateErr) return { error: getErrorMessage(updateErr) }

    revalidatePath('/lms/admin/members')
    return { success: true }
  } catch (err) {
    return { error: getErrorMessage(err) }
  }
}

// ── Fetch Members List ────────────────────────────────────────────────────────

const MEMBERS_SORT_COLUMNS: Record<string, string> = {
  joined_asc: 'joined_at ASC',
  name_asc: 'name ASC',
  name_desc: 'name DESC',
  courses_desc: 'enrolled_count DESC, joined_at DESC',
  joined_desc: 'joined_at DESC',
  level_desc: 'level_index DESC, joined_at DESC',
}

export async function getLmsCourseOptions(): Promise<MemberCourseOption[]> {
  const orgData = await assertOrgAdmin()
  const orgId = orgData.org.id

  const { rows } = await queryPostgres<{ id: string; title: string }>(
    `SELECT id::text, title
     FROM public.learning_courses
     WHERE org_id = $1::uuid AND is_active = TRUE
     ORDER BY title ASC`,
    [orgId]
  )

  return rows.map((row) => ({ id: row.id, title: row.title }))
}

export async function getLmsAdminMembers(
  search = '',
  levelFilter = 'ALL',
  courseFilter = 'ALL',
  sortBy = 'level_desc',
  page = 1,
  pageSize = 25,
  courseId = ''
): Promise<{
  members: MemberSummary[]
  settings: LmsGamificationSettings
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}> {
  const orgData = await assertOrgAdmin()
  const orgId = orgData.org.id
  const settings = await getLmsGamificationSettings(orgId)

  const safePage = Math.max(1, Math.trunc(page) || 1)
  const safePageSize = Math.min(100, Math.max(1, Math.trunc(pageSize) || 25))
  const orderClause = MEMBERS_SORT_COLUMNS[sortBy] || MEMBERS_SORT_COLUMNS.level_desc

  // Filters are applied inside SQL (not after fetching every member into JS) so
  // pagination reflects the filtered set, and so ~1300-row orgs don't have to
  // ship every row + run per-row badge lookups just to render one page.
  const conditions: string[] = []
  const params: unknown[] = [orgId]
  let paramIdx = 2

  const trimmedSearch = search.trim().toLowerCase()
  if (trimmedSearch) {
    conditions.push(
      `(lower(name) LIKE $${paramIdx} OR lower(email) LIKE $${paramIdx} OR lower(COALESCE(phone, '')) LIKE $${paramIdx})`
    )
    params.push(`%${trimmedSearch}%`)
    paramIdx++
  }

  if (levelFilter && levelFilter !== 'ALL' && Number.isInteger(Number(levelFilter))) {
    conditions.push(`level_index = $${paramIdx}`)
    params.push(Number(levelFilter))
    paramIdx++
  }

  if (courseFilter === 'ENROLLED') conditions.push('enrolled_count > 0')
  else if (courseFilter === 'COMPLETED') conditions.push('completed_count > 0')
  else if (courseFilter === 'NOT_ENROLLED') conditions.push('enrolled_count = 0')

  const trimmedCourseId = courseId.trim()
  if (trimmedCourseId && trimmedCourseId !== 'ALL') {
    conditions.push(
      `EXISTS (
         SELECT 1 FROM public.learning_enrollments e2
         WHERE e2.org_id = $1::uuid AND e2.user_id::text = scored.user_id AND e2.course_id = $${paramIdx}::uuid
       )`
    )
    params.push(trimmedCourseId)
    paramIdx++
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limitIdx = paramIdx
  const offsetIdx = paramIdx + 1
  params.push(safePageSize, (safePage - 1) * safePageSize)

  const membersQuery = `
    WITH base AS (
      SELECT
        m.user_id::text AS user_id,
        m.role::text AS role,
        m.is_active,
        m.joined_at::text AS joined_at,
        COALESCE(iu.login_email, au.email, 'unknown@example.com') AS email,
        iu.phone AS phone,
        COALESCE(
          au.raw_user_meta_data->>'full_name',
          au.raw_user_meta_data->>'name',
          split_part(COALESCE(iu.login_email, au.email, 'User'), '@', 1)
        ) AS name,
        COALESCE(ec.enrolled_count, 0) AS enrolled_count,
        COALESCE(ec.completed_count, 0) AS completed_count
      FROM public.org_members m
      LEFT JOIN public.internal_auth_users iu
        ON COALESCE(iu.legacy_user_id, iu.id) = m.user_id
      LEFT JOIN auth.users au
        ON au.id = m.user_id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::int AS enrolled_count,
          COUNT(*) FILTER (WHERE e.status = 'COMPLETED' OR e.completed_at IS NOT NULL)::int AS completed_count
        FROM public.learning_enrollments e
        WHERE e.org_id = $1::uuid AND e.user_id = m.user_id
      ) ec ON true
      WHERE m.org_id = $1::uuid
        AND COALESCE(iu.login_email, au.email, '') NOT LIKE 'legacy-deleted+%@invalid.coreisec.id'
    ),
    scored AS (
      SELECT
        *,
        CASE
          WHEN (enrolled_count + completed_count * 2) >= 6 THEN 3
          WHEN (enrolled_count + completed_count * 2) >= 3 THEN 2
          WHEN (enrolled_count + completed_count * 2) >= 1 THEN 1
          ELSE 0
        END AS level_index
      FROM base
    )
    SELECT *, COUNT(*) OVER()::int AS total_count
    FROM scored
    ${whereClause}
    ORDER BY ${orderClause}
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `

  const { rows: memberRows } = await queryPostgres<{
    user_id: string
    role: string
    is_active: boolean
    joined_at: string
    email: string
    phone: string | null
    name: string
    enrolled_count: number
    completed_count: number
    level_index: number
    total_count: number
  }>(membersQuery, params)

  const totalCount = memberRows[0]?.total_count || 0
  const totalPages = Math.max(1, Math.ceil(totalCount / safePageSize))
  const pageUserIds = memberRows.map((row) => row.user_id)

  // Badges are only needed for the members actually rendered on this page.
  const badgesByUser = new Map<string, MemberBadge[]>()
  if (pageUserIds.length > 0) {
    const badgesQuery = `
      SELECT
        ba.user_id::text AS user_id,
        COALESCE(bt.title, bt.name, ba.badge_number, 'Special Badge') AS title,
        COALESCE(bt.description, 'Awarded achievement') AS description,
        COALESCE(bt.primary_color, '#0F766E') AS color,
        COALESCE(bt.icon_name, 'award') AS icon_name,
        ba.awarded_at::text AS awarded_at,
        ba.id::text AS id
      FROM public.learning_badge_awards ba
      LEFT JOIN public.learning_badge_templates bt ON bt.id = ba.template_id
      WHERE ba.org_id = $1::uuid AND ba.status = 'ACTIVE' AND ba.user_id = ANY($2::uuid[])
    `
    const { rows: badgeRows } = await queryPostgres<{
      user_id: string
      title: string
      description: string
      color: string
      icon_name: string
      awarded_at: string
      id: string
    }>(badgesQuery, [orgId, pageUserIds])

    for (const b of badgeRows) {
      const list = badgesByUser.get(b.user_id) || []
      list.push({
        id: b.id,
        title: b.title,
        description: b.description,
        color: b.color,
        iconName: b.icon_name,
        awardedAt: b.awarded_at,
        isMilestone: false,
      })
      badgesByUser.set(b.user_id, list)
    }
  }

  const members: MemberSummary[] = memberRows.map((row) => {
    const completed = Number(row.completed_count || 0)
    const enrolled = Number(row.enrolled_count || 0)
    const levelIndex = Number(row.level_index || 0)
    const levelName = settings.levelNames[levelIndex] || settings.levelNames[0] || 'Level 0'

    // Gather badges (awarded + milestones)
    const userBadges = [...(badgesByUser.get(row.user_id) || [])]

    // Automatic Milestone Badges
    if (settings.milestoneBadges.length > 0) {
      // Pioneer milestone badge for all members
      const pioneer = settings.milestoneBadges[0]
      if (pioneer) {
        userBadges.unshift({
          id: `milestone-${row.user_id}-pioneer`,
          title: pioneer.name,
          description: pioneer.description,
          color: pioneer.color,
          iconName: 'user-check',
          awardedAt: row.joined_at,
          isMilestone: true,
        })
      }
      // Course finisher badge
      const finisher = settings.milestoneBadges[1]
      if (completed >= 1 && finisher) {
        userBadges.push({
          id: `milestone-${row.user_id}-finisher`,
          title: finisher.name,
          description: finisher.description,
          color: finisher.color,
          iconName: 'award',
          awardedAt: row.joined_at,
          isMilestone: true,
        })
      }
      // Knowledge master badge
      const master = settings.milestoneBadges[2]
      if (completed >= 3 && master) {
        userBadges.push({
          id: `milestone-${row.user_id}-master`,
          title: master.name,
          description: master.description,
          color: master.color,
          iconName: 'crown',
          awardedAt: row.joined_at,
          isMilestone: true,
        })
      }
    }

    return {
      userId: row.user_id,
      name: row.name || 'Member',
      email: row.email || '-',
      phone: row.phone || null,
      role: row.role || 'staff',
      isActive: row.is_active !== false,
      joinedAt: row.joined_at,
      enrolledCount: enrolled,
      completedCount: completed,
      levelIndex,
      levelName,
      badges: userBadges,
    }
  })

  return {
    members,
    settings,
    totalCount,
    page: safePage,
    pageSize: safePageSize,
    totalPages,
  }
}

// ── Fetch Member Timeline ─────────────────────────────────────────────────────

export async function getLmsMemberTimeline(userId: string): Promise<MemberTimelineEvent[]> {
  const orgData = await assertOrgAdmin()
  const orgId = orgData.org.id
  const settings = await getLmsGamificationSettings(orgId)

  const events: MemberTimelineEvent[] = []

  // 1. Join Organization Event
  const { rows: memberRows } = await queryPostgres<{ joined_at: string; role: string }>(
    `SELECT joined_at::text, role::text FROM public.org_members WHERE org_id = $1::uuid AND user_id = $2::uuid LIMIT 1`,
    [orgId, userId]
  )
  if (memberRows.length > 0) {
    events.push({
      id: `join-${userId}`,
      type: 'JOINED_ORG',
      title: 'Joined Organization',
      description: `Registered as a member with role: ${memberRows[0].role.toUpperCase()}`,
      timestamp: memberRows[0].joined_at,
      iconType: 'user-plus',
      color: '#0F766E',
    })

    // Also add Pioneer Badge milestone event
    const pioneer = settings.milestoneBadges[0]
    if (pioneer) {
      events.push({
        id: `milestone-pioneer-${userId}`,
        type: 'BADGE_AWARDED',
        title: `Milestone Badge Earned`,
        description: `Awarded "${pioneer.name}" milestone badge`,
        timestamp: memberRows[0].joined_at,
        iconType: 'award',
        color: pioneer.color,
      })
    }
  }

  // 2. Course Enrollments & Completions
  const { rows: enrollRows } = await queryPostgres<{
    id: string
    course_title: string
    status: string
    started_at: string
    completed_at: string | null
  }>(
    `SELECT 
       e.id::text,
       c.title AS course_title,
       e.status,
       e.started_at::text,
       e.completed_at::text
     FROM public.learning_enrollments e
     JOIN public.learning_courses c ON c.id = e.course_id
     WHERE e.org_id = $1::uuid AND e.user_id = $2::uuid
     ORDER BY e.started_at DESC`,
    [orgId, userId]
  )

  let completedCount = 0
  for (const enr of enrollRows) {
    events.push({
      id: `enroll-${enr.id}`,
      type: 'COURSE_ENROLLED',
      title: 'Enrolled in Training Course',
      description: `Started course: "${enr.course_title}"`,
      timestamp: enr.started_at,
      iconType: 'book-open',
      color: '#3B82F6',
    })

    if ((enr.status === 'COMPLETED' || enr.completed_at) && enr.completed_at) {
      completedCount++
      events.push({
        id: `comp-${enr.id}`,
        type: 'COURSE_COMPLETED',
        title: 'Completed Training Course',
        description: `Successfully finished "${enr.course_title}"`,
        timestamp: enr.completed_at,
        iconType: 'check-circle',
        color: '#10B981',
      })

      // Check milestone badges for first completion or 3rd completion
      if (completedCount === 1 && settings.milestoneBadges[1]) {
        const finisher = settings.milestoneBadges[1]
        events.push({
          id: `milestone-finisher-${userId}`,
          type: 'BADGE_AWARDED',
          title: 'Milestone Badge Earned',
          description: `Awarded "${finisher.name}" milestone badge`,
          timestamp: enr.completed_at,
          iconType: 'award',
          color: finisher.color,
        })
      }
      if (completedCount === 3 && settings.milestoneBadges[2]) {
        const master = settings.milestoneBadges[2]
        events.push({
          id: `milestone-master-${userId}`,
          type: 'BADGE_AWARDED',
          title: 'Milestone Badge Earned',
          description: `Awarded "${master.name}" milestone badge`,
          timestamp: enr.completed_at,
          iconType: 'crown',
          color: master.color,
        })
      }
    }
  }

  // 3. Explicit Badge Awards from learning_badge_awards
  const { rows: awardRows } = await queryPostgres<{
    id: string
    title: string
    description: string
    color: string
    awarded_at: string
  }>(
    `SELECT 
       ba.id::text,
       COALESCE(bt.title, bt.name, ba.badge_number, 'Achievement Badge') AS title,
       COALESCE(bt.description, 'Earned special recognition badge') AS description,
       COALESCE(bt.primary_color, '#0F766E') AS color,
       ba.awarded_at::text
     FROM public.learning_badge_awards ba
     LEFT JOIN public.learning_badge_templates bt ON bt.id = ba.template_id
     WHERE ba.org_id = $1::uuid AND ba.user_id = $2::uuid AND ba.status = 'ACTIVE'`,
    [orgId, userId]
  )

  for (const aw of awardRows) {
    events.push({
      id: `award-${aw.id}`,
      type: 'BADGE_AWARDED',
      title: 'Badge Awarded',
      description: `Earned "${aw.title}": ${aw.description}`,
      timestamp: aw.awarded_at,
      iconType: 'award',
      color: aw.color,
    })
  }

  // 4. Sort all events chronologically (newest first)
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return events
}

// ── Course Participants Management ────────────────────────────────────────────

export interface CourseParticipant {
  enrollmentId: string
  userId: string
  name: string
  email: string
  phone: string | null
  status: string
  progressPercent: number
  completedLessons: number
  totalLessons: number
  finalScore: number | null
  startedAt: string
  completedAt: string | null
  lastActivityAt: string | null
  batchId: string | null
  batchName: string | null
  bannedAt: string | null
  bannedReason: string | null
}

export interface CourseParticipantFilters {
  search?: string
  status?: 'ALL' | 'ACTIVE' | 'COMPLETED' | 'BANNED'
  batchId?: string
  sortBy?: string
  page?: number
  pageSize?: number
}

export interface CourseParticipantStats {
  total: number
  active: number
  completed: number
  banned: number
  avgScore: number
  avgProgress: number
  activeThisWeek: number
}

export interface OrgMemberOption {
  userId: string
  name: string
  email: string
  phone: string | null
  alreadyEnrolled: boolean
}

/**
 * Ambil daftar peserta course beserta statistik progress.
 */
export async function getCourseParticipants(
  courseSlug: string,
  filters: CourseParticipantFilters = {}
): Promise<{
  participants: CourseParticipant[]
  stats: CourseParticipantStats
  totalCount: number
  totalPages: number
  batchOptions: { id: string; name: string }[]
}> {
  const orgData = await assertOrgAdmin()
  const orgId = orgData.org.id

  const {
    search = '',
    status = 'ALL',
    batchId = '',
    sortBy = 'started_asc',
    page = 1,
    pageSize = 30,
  } = filters

  const safePage = Math.max(1, page)
  const safePageSize = Math.min(100, Math.max(1, pageSize))

  // Fetch course by slug
  const { rows: courseRows } = await queryPostgres<{ id: string; title: string }>(
    `SELECT id::text, title FROM public.learning_courses WHERE org_id = $1::uuid AND slug = $2 AND deleted_at IS NULL LIMIT 1`,
    [orgId, courseSlug]
  )
  if (!courseRows[0]) throw new Error('Kursus tidak ditemukan')
  const courseId = courseRows[0].id

  // Total lessons in course
  const { rows: lessonCountRows } = await queryPostgres<{ count: string }>(
    `SELECT COUNT(*) as count FROM public.learning_lessons WHERE course_id = $1::uuid AND org_id = $2::uuid`,
    [courseId, orgId]
  )
  const totalLessons = Number(lessonCountRows[0]?.count || 0)

  // Build WHERE conditions
  const conditions: string[] = [`e.course_id = $1::uuid`, `e.org_id = $2::uuid`]
  const params: unknown[] = [courseId, orgId]
  let pidx = 3

  if (search.trim()) {
    conditions.push(
      `(lower(COALESCE(iu.display_name, '')) LIKE $${pidx} OR lower(COALESCE(iu.login_email, '')) LIKE $${pidx})`
    )
    params.push(`%${search.trim().toLowerCase()}%`)
    pidx++
  }

  if (status === 'ACTIVE') conditions.push(`e.banned_at IS NULL AND e.completed_at IS NULL`)
  else if (status === 'COMPLETED') conditions.push(`e.completed_at IS NOT NULL AND e.banned_at IS NULL`)
  else if (status === 'BANNED') conditions.push(`e.banned_at IS NOT NULL`)
  // ALL — no extra filter

  if (batchId && batchId !== 'ALL') {
    conditions.push(`e.batch_id = $${pidx}::uuid`)
    params.push(batchId)
    pidx++
  }

  const orderMap: Record<string, string> = {
    started_asc: 'e.started_at ASC',
    started_desc: 'e.started_at DESC',
    progress_desc: 'e.progress_percent DESC',
    progress_asc: 'e.progress_percent ASC',
    name_asc: 'COALESCE(iu.display_name, iu.login_email) ASC',
    score_desc: 'e.final_score DESC NULLS LAST',
  }
  const orderClause = orderMap[sortBy] || 'e.started_at ASC'
  const limitIdx = pidx
  const offsetIdx = pidx + 1
  params.push(safePageSize, (safePage - 1) * safePageSize)

  const query = `
    SELECT
      e.id::text               AS enrollment_id,
      e.user_id::text          AS user_id,
      COALESCE(iu.display_name, split_part(iu.login_email, '@', 1), 'Member') AS name,
      COALESCE(iu.login_email, '')                        AS email,
      iu.phone                                            AS phone,
      COALESCE(e.status, 'IN_PROGRESS')                  AS status,
      COALESCE(e.progress_percent, 0)                    AS progress_percent,
      (
        SELECT COUNT(*)::int FROM public.learning_lesson_progress p
        WHERE p.enrollment_id = e.id AND p.status = 'COMPLETED'
      )                                                   AS completed_lessons,
      e.final_score,
      e.started_at::text,
      e.completed_at::text,
      e.last_activity_at::text,
      e.batch_id::text,
      b.name                                              AS batch_name,
      e.banned_at::text,
      e.banned_reason,
      COUNT(*) OVER()::int                                AS total_count
    FROM public.learning_enrollments e
    LEFT JOIN public.internal_auth_users iu
      ON iu.id::text = e.user_id::text OR iu.legacy_user_id::text = e.user_id::text
    LEFT JOIN public.lms_course_batches b ON b.id = e.batch_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY ${orderClause}
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `

  const { rows } = await queryPostgres<{
    enrollment_id: string
    user_id: string
    name: string
    email: string
    phone: string | null
    status: string
    progress_percent: string
    completed_lessons: number
    final_score: string | null
    started_at: string
    completed_at: string | null
    last_activity_at: string | null
    batch_id: string | null
    batch_name: string | null
    banned_at: string | null
    banned_reason: string | null
    total_count: number
  }>(query, params)

  const totalCount = rows[0]?.total_count || 0
  const totalPages = Math.max(1, Math.ceil(totalCount / safePageSize))

  // Stats (unfiltered — always full course stats)
  const { rows: statRows } = await queryPostgres<{
    total: string
    active: string
    completed: string
    banned: string
    avg_score: string
    avg_progress: string
    active_this_week: string
  }>(
    `SELECT
      COUNT(*)::text                                                          AS total,
      COUNT(*) FILTER (WHERE banned_at IS NULL AND completed_at IS NULL)::text AS active,
      COUNT(*) FILTER (WHERE completed_at IS NOT NULL AND banned_at IS NULL)::text AS completed,
      COUNT(*) FILTER (WHERE banned_at IS NOT NULL)::text                    AS banned,
      COALESCE(AVG(final_score) FILTER (WHERE final_score IS NOT NULL), 0)::text AS avg_score,
      COALESCE(AVG(progress_percent), 0)::text                               AS avg_progress,
      COUNT(*) FILTER (WHERE last_activity_at >= NOW() - INTERVAL '7 days' AND banned_at IS NULL)::text AS active_this_week
    FROM public.learning_enrollments
    WHERE course_id = $1::uuid AND org_id = $2::uuid`,
    [courseId, orgId]
  )
  const s = statRows[0]

  // Batch options
  const { rows: batchRows } = await queryPostgres<{ id: string; name: string }>(
    `SELECT id::text, name FROM public.lms_course_batches WHERE course_id = $1::uuid AND org_id = $2::uuid AND deleted_at IS NULL ORDER BY created_at DESC`,
    [courseId, orgId]
  )

  return {
    participants: rows.map((r) => ({
      enrollmentId: r.enrollment_id,
      userId: r.user_id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      status: r.status,
      progressPercent: Number(r.progress_percent),
      completedLessons: r.completed_lessons,
      totalLessons,
      finalScore: r.final_score !== null ? Number(r.final_score) : null,
      startedAt: r.started_at,
      completedAt: r.completed_at,
      lastActivityAt: r.last_activity_at,
      batchId: r.batch_id,
      batchName: r.batch_name,
      bannedAt: r.banned_at,
      bannedReason: r.banned_reason,
    })),
    stats: {
      total: Number(s?.total || 0),
      active: Number(s?.active || 0),
      completed: Number(s?.completed || 0),
      banned: Number(s?.banned || 0),
      avgScore: Math.round(Number(s?.avg_score || 0)),
      avgProgress: Math.round(Number(s?.avg_progress || 0)),
      activeThisWeek: Number(s?.active_this_week || 0),
    },
    totalCount,
    totalPages,
    batchOptions: batchRows,
  }
}

/**
 * Ban peserta dari kursus (soft-delete + blokir akses, progress history tetap ada).
 */
export async function banParticipant(
  enrollmentId: string,
  reason?: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const orgData = await assertOrgAdmin()
    if (!enrollmentId) return { error: 'Enrollment ID wajib diisi' }

    const { rows: enrRows } = await queryPostgres<{ course_id: string }>(
      `SELECT course_id::text FROM public.learning_enrollments WHERE id = $1::uuid AND org_id = $2::uuid LIMIT 1`,
      [enrollmentId, orgData.org.id]
    )
    if (!enrRows[0]) return { error: 'Enrollment tidak ditemukan' }

    const now = new Date().toISOString()
    const supabase = await createClient()
    const { error } = await supabase
      .from('learning_enrollments')
      .update({
        banned_at: now,
        banned_by: orgData.user.id,
        banned_reason: reason || null,
        updated_at: now,
      })
      .eq('id', enrollmentId)
      .eq('org_id', orgData.org.id)

    if (error) throw new Error(error.message)
    revalidatePath('/lms/admin')
    return { success: true }
  } catch (err) {
    return { error: getErrorMessage(err) }
  }
}

/**
 * Unban peserta — kembalikan akses kursus.
 */
export async function unbanParticipant(
  enrollmentId: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const orgData = await assertOrgAdmin()
    if (!enrollmentId) return { error: 'Enrollment ID wajib diisi' }

    const now = new Date().toISOString()
    const supabase = await createClient()
    const { error } = await supabase
      .from('learning_enrollments')
      .update({ banned_at: null, banned_by: null, banned_reason: null, updated_at: now })
      .eq('id', enrollmentId)
      .eq('org_id', orgData.org.id)

    if (error) throw new Error(error.message)
    revalidatePath('/lms/admin')
    return { success: true }
  } catch (err) {
    return { error: getErrorMessage(err) }
  }
}

/**
 * Reset progress peserta ke awal (hapus semua learning_lesson_progress).
 */
export async function resetParticipantProgress(
  enrollmentId: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const orgData = await assertOrgAdmin()
    if (!enrollmentId) return { error: 'Enrollment ID wajib diisi' }

    const now = new Date().toISOString()
    const supabase = await createClient()

    // Hapus semua lesson progress
    const { error: delErr } = await supabase
      .from('learning_lesson_progress')
      .delete()
      .eq('enrollment_id', enrollmentId)
      .eq('org_id', orgData.org.id)

    if (delErr) throw new Error(delErr.message)

    // Reset enrollment progress fields
    const { error: updErr } = await supabase
      .from('learning_enrollments')
      .update({
        status: 'IN_PROGRESS',
        progress_percent: 0,
        completed_at: null,
        final_score: null,
        last_activity_at: null,
        updated_at: now,
      })
      .eq('id', enrollmentId)
      .eq('org_id', orgData.org.id)

    if (updErr) throw new Error(updErr.message)
    revalidatePath('/lms/admin')
    return { success: true }
  } catch (err) {
    return { error: getErrorMessage(err) }
  }
}

/**
 * Override tanggal selesai peserta secara manual (untuk kelas offline/hybrid).
 */
export async function overrideCompletionDate(
  enrollmentId: string,
  completedAt: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const orgData = await assertOrgAdmin()
    if (!enrollmentId || !completedAt) return { error: 'Parameter tidak lengkap' }

    const date = new Date(completedAt)
    if (isNaN(date.getTime())) return { error: 'Format tanggal tidak valid' }

    const supabase = await createClient()
    const { error } = await supabase
      .from('learning_enrollments')
      .update({
        completed_at: date.toISOString(),
        status: 'COMPLETED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', enrollmentId)
      .eq('org_id', orgData.org.id)

    if (error) throw new Error(error.message)
    revalidatePath('/lms/admin')
    return { success: true }
  } catch (err) {
    return { error: getErrorMessage(err) }
  }
}

/**
 * Cari anggota organisasi yang bisa ditambahkan sebagai peserta kursus.
 * Mengembalikan anggota org + flag apakah sudah enrolled di kursus ini.
 */
export async function searchOrgMembersForCourse(
  courseSlug: string,
  search: string
): Promise<{ members: OrgMemberOption[]; error?: string }> {
  try {
    const orgData = await assertOrgAdmin()
    const orgId = orgData.org.id

    // Find course
    const { rows: courseRows } = await queryPostgres<{ id: string }>(
      `SELECT id::text FROM public.learning_courses WHERE org_id = $1::uuid AND slug = $2 LIMIT 1`,
      [orgId, courseSlug]
    )
    if (!courseRows[0]) return { members: [], error: 'Kursus tidak ditemukan' }
    const courseId = courseRows[0].id

    const trimSearch = search.trim().toLowerCase()
    const searchCondition = trimSearch
      ? `AND (lower(COALESCE(iu.display_name, '')) LIKE $3 OR lower(iu.login_email) LIKE $3)`
      : ''
    const params: unknown[] = [orgId, courseId]
    if (trimSearch) params.push(`%${trimSearch}%`)

    const { rows } = await queryPostgres<{
      user_id: string
      name: string
      email: string
      phone: string | null
      already_enrolled: boolean
    }>(
      `SELECT
        m.user_id::text,
        COALESCE(iu.display_name, split_part(iu.login_email, '@', 1), 'Member') AS name,
        COALESCE(iu.login_email, '') AS email,
        iu.phone,
        EXISTS (
          SELECT 1 FROM public.learning_enrollments e2
          WHERE e2.org_id = $1::uuid AND e2.user_id = m.user_id AND e2.course_id = $2::uuid
        ) AS already_enrolled
      FROM public.org_members m
      LEFT JOIN public.internal_auth_users iu
        ON iu.id = m.user_id OR iu.legacy_user_id = m.user_id
      WHERE m.org_id = $1::uuid ${searchCondition}
      ORDER BY COALESCE(iu.display_name, iu.login_email) ASC
      LIMIT 20`,
      params
    )

    return {
      members: rows.map((r) => ({
        userId: r.user_id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        alreadyEnrolled: Boolean(r.already_enrolled),
      })),
    }
  } catch (err) {
    return { members: [], error: getErrorMessage(err) }
  }
}

/**
 * Tambah satu atau banyak user sebagai peserta kursus.
 */
export async function bulkAddParticipants(
  courseSlug: string,
  userIds: string[]
): Promise<{ success?: boolean; added?: number; skipped?: number; error?: string }> {
  try {
    const orgData = await assertOrgAdmin()
    const orgId = orgData.org.id

    if (!userIds.length) return { error: 'Tidak ada user yang dipilih' }

    const { rows: courseRows } = await queryPostgres<{ id: string }>(
      `SELECT id::text FROM public.learning_courses WHERE org_id = $1::uuid AND slug = $2 LIMIT 1`,
      [orgId, courseSlug]
    )
    if (!courseRows[0]) return { error: 'Kursus tidak ditemukan' }
    const courseId = courseRows[0].id

    const now = new Date().toISOString()
    let added = 0
    let skipped = 0

    const supabase = await createClient()
    for (const userId of userIds) {
      // Upsert: insert jika belum ada, skip jika sudah (ON CONFLICT DO NOTHING)
      const { error } = await supabase
        .from('learning_enrollments')
        .insert({
          org_id: orgId,
          user_id: userId,
          course_id: courseId,
          status: 'IN_PROGRESS',
          started_at: now,
          progress_percent: 0,
        })
      if (error) {
        // Conflict = sudah enrolled
        skipped++
      } else {
        added++
      }
    }

    revalidatePath('/lms/admin')
    return { success: true, added, skipped }
  } catch (err) {
    return { error: getErrorMessage(err) }
  }
}

/**
 * Kirim pengingat email ke peserta yang belum mulai atau progress macet.
 * Memanfaatkan email template sederhana via console log jika tidak ada email service.
 */
export async function sendCourseReminder(
  enrollmentIds: string[],
  message?: string
): Promise<{ success?: boolean; sent?: number; error?: string }> {
  try {
    const orgData = await assertOrgAdmin()
    const orgId = orgData.org.id

    if (!enrollmentIds.length) return { error: 'Tidak ada peserta yang dipilih' }

    const { rows } = await queryPostgres<{
      email: string
      name: string
      course_title: string
      progress_percent: string
    }>(
      `SELECT
        COALESCE(iu.login_email, '') AS email,
        COALESCE(iu.display_name, split_part(iu.login_email, '@', 1)) AS name,
        c.title AS course_title,
        COALESCE(e.progress_percent, 0)::text AS progress_percent
      FROM public.learning_enrollments e
      JOIN public.learning_courses c ON c.id = e.course_id
      LEFT JOIN public.internal_auth_users iu
        ON iu.id::text = e.user_id::text OR iu.legacy_user_id::text = e.user_id::text
      WHERE e.org_id = $1::uuid AND e.id = ANY($2::uuid[]) AND e.banned_at IS NULL`,
      [orgId, enrollmentIds]
    )

    // TODO: integrate with Mailketing API when template is ready
    // For now we log and return success count
    const sent = rows.filter((r) => r.email && r.email !== '').length
    console.info(
      `[sendCourseReminder] Would send ${sent} emails for org ${orgId}`,
      rows.map((r) => ({ email: r.email, name: r.name, course: r.course_title })),
      message
    )

    return { success: true, sent }
  } catch (err) {
    return { error: getErrorMessage(err) }
  }
}
