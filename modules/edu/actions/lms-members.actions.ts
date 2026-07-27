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
  role: string
  isActive: boolean
  joinedAt: string
  enrolledCount: number
  completedCount: number
  levelIndex: number
  levelName: string
  badges: MemberBadge[]
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
  levelNames: ['Novice', 'Explorer', 'Practitioner', 'Specialist'],
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

export async function getLmsAdminMembers(
  search = '',
  levelFilter = 'ALL',
  courseFilter = 'ALL',
  sortBy = 'joined_desc'
): Promise<{ members: MemberSummary[]; settings: LmsGamificationSettings; totalCount: number }> {
  const orgData = await assertOrgAdmin()
  const orgId = orgData.org.id
  const settings = await getLmsGamificationSettings(orgId)

  // 1. Query all org members with user metadata and course progress
  const membersQuery = `
    SELECT 
      m.user_id::text AS user_id,
      m.role::text AS role,
      m.is_active,
      m.joined_at::text AS joined_at,
      COALESCE(iu.login_email, au.email, 'unknown@example.com') AS email,
      COALESCE(
        au.raw_user_meta_data->>'full_name',
        au.raw_user_meta_data->>'name',
        split_part(COALESCE(iu.login_email, au.email, 'User'), '@', 1)
      ) AS name,
      (
        SELECT COUNT(*)::int
        FROM public.learning_enrollments e
        WHERE e.org_id = $1::uuid AND e.user_id = m.user_id
      ) AS enrolled_count,
      (
        SELECT COUNT(*)::int
        FROM public.learning_enrollments e
        WHERE e.org_id = $1::uuid AND e.user_id = m.user_id
          AND (e.status = 'COMPLETED' OR e.completed_at IS NOT NULL)
      ) AS completed_count
    FROM public.org_members m
    LEFT JOIN public.internal_auth_users iu
      ON COALESCE(iu.legacy_user_id, iu.id) = m.user_id
    LEFT JOIN auth.users au
      ON au.id = m.user_id
    WHERE m.org_id = $1::uuid
  `

  const { rows: memberRows } = await queryPostgres<{
    user_id: string
    role: string
    is_active: boolean
    joined_at: string
    email: string
    name: string
    enrolled_count: number
    completed_count: number
  }>(membersQuery, [orgId])

  // 2. Query all awarded badges for this org
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
    WHERE ba.org_id = $1::uuid AND ba.status = 'ACTIVE'
  `
  const { rows: badgeRows } = await queryPostgres<{
    user_id: string
    title: string
    description: string
    color: string
    icon_name: string
    awarded_at: string
    id: string
  }>(badgesQuery, [orgId])

  // Group badges by user_id
  const badgesByUser = new Map<string, MemberBadge[]>()
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

  // 3. Process members, calculate level and milestone badges
  let members: MemberSummary[] = memberRows.map((row) => {
    const completed = Number(row.completed_count || 0)
    const enrolled = Number(row.enrolled_count || 0)

    // Calculate level index
    let levelIndex = 0
    if (completed >= 6) levelIndex = 3
    else if (completed >= 3) levelIndex = 2
    else if (completed >= 1) levelIndex = 1

    const levelName = settings.levelNames[levelIndex] || settings.levelNames[0] || 'Novice'

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

  // 4. Apply filters
  if (search.trim()) {
    const q = search.trim().toLowerCase()
    members = members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
    )
  }

  if (levelFilter && levelFilter !== 'ALL') {
    const targetLevel = Number(levelFilter)
    members = members.filter((m) => m.levelIndex === targetLevel)
  }

  if (courseFilter && courseFilter !== 'ALL') {
    if (courseFilter === 'ENROLLED') {
      members = members.filter((m) => m.enrolledCount > 0)
    } else if (courseFilter === 'COMPLETED') {
      members = members.filter((m) => m.completedCount > 0)
    } else if (courseFilter === 'NOT_ENROLLED') {
      members = members.filter((m) => m.enrolledCount === 0)
    }
  }

  // 5. Apply sorting
  members.sort((a, b) => {
    switch (sortBy) {
      case 'joined_asc':
        return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
      case 'name_asc':
        return a.name.localeCompare(b.name)
      case 'name_desc':
        return b.name.localeCompare(a.name)
      case 'courses_desc':
        return b.enrolledCount - a.enrolledCount
      case 'level_desc':
        return b.levelIndex - a.levelIndex
      case 'joined_desc':
      default:
        return new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime()
    }
  })

  return {
    members,
    settings,
    totalCount: members.length,
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
