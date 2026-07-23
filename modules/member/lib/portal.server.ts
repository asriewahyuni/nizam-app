/**
 * Query portal member Coreisec yang tenant-safe dan berbasis internal auth.
 */
import 'server-only'

import { queryPostgres } from '@/lib/db/postgres'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { sanitizeLearningHtml } from '@/modules/lms/lib/content-sanitizer'

export type PortalTenant = {
  id: string
  slug: string
  name: string
  logoUrl: string | null
  portalName: string
  portalLogoUrl: string | null
  primaryHostname: string | null
}

export type PortalMemberContext = {
  userId: string
  email: string | null
  displayName: string
  role: string
  isAdmin: boolean
  isTutor: boolean
  isAffiliate: boolean
}

type TenantRow = {
  id: string
  slug: string
  name: string
  logo_url: string | null
  settings: Record<string, unknown>
  primary_hostname: string | null
}

export async function getPortalTenant(orgSlug: string): Promise<PortalTenant | null> {
  const result = await queryPostgres<TenantRow>(
    `SELECT
       organization.id::text,
       organization.slug,
       organization.name,
       organization.logo_url,
       organization.settings,
       (
         SELECT domain.hostname
         FROM public.organization_domains domain
         WHERE domain.org_id = organization.id
           AND domain.purpose = 'MEMBER_PORTAL'
           AND domain.status = 'VERIFIED'
         ORDER BY domain.is_primary DESC, domain.created_at
         LIMIT 1
       ) AS primary_hostname
     FROM public.organizations organization
     WHERE organization.slug = $1
       AND organization.is_active = TRUE
     LIMIT 1`,
    [orgSlug],
  )
  const row = result.rows[0]
  if (!row) return null

  const branding = row.settings?.lms_branding
  const brandingRecord = branding && typeof branding === 'object'
    ? branding as Record<string, unknown>
    : {}
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    logoUrl: row.logo_url,
    portalName: String(brandingRecord.name || row.name),
    portalLogoUrl: String(brandingRecord.logo_url || row.logo_url || '') || null,
    primaryHostname: row.primary_hostname,
  }
}

export async function getPortalMemberContext(
  tenant: PortalTenant,
): Promise<PortalMemberContext | null> {
  const session = await getInternalAuthSession()
  if (!session?.user) return null

  const result = await queryPostgres<{
    role: string | null
    is_tutor: boolean
    is_affiliate: boolean
  }>(
    `SELECT
       (
         SELECT member.role::text
         FROM public.org_members member
         WHERE member.org_id = $1::uuid
           AND member.user_id = $2::uuid
           AND member.is_active = TRUE
         LIMIT 1
       ) AS role,
       EXISTS (
         SELECT 1
         FROM public.learning_instructor_profiles instructor
         WHERE instructor.org_id = $1::uuid
           AND instructor.user_id = $2::uuid
           AND instructor.is_active = TRUE
       ) AS is_tutor,
       EXISTS (
         SELECT 1
         FROM public.commerce_affiliate_profiles affiliate
         WHERE affiliate.org_id = $1::uuid
           AND affiliate.user_id = $2::uuid
           AND affiliate.status = 'ACTIVE'
       ) AS is_affiliate`,
    [tenant.id, session.user.id],
  )
  const flags = result.rows[0]
  const role = flags?.role || 'member'
  const displayName = String(
    session.user.user_metadata.full_name
      || session.user.email
      || 'Member',
  )
  return {
    userId: session.user.id,
    email: session.user.email,
    displayName,
    role,
    isAdmin: ['owner', 'admin', 'manager'].includes(role),
    isTutor: Boolean(flags?.is_tutor),
    isAffiliate: Boolean(flags?.is_affiliate),
  }
}

export type PortalDashboardData = {
  activeCourseCount: number
  completedCourseCount: number
  activeSubscriptionCount: number
  certificateCount: number
  orderCount: number
  courses: Array<{
    id: string
    title: string
    slug: string
    coverImageUrl: string | null
    progressPercent: number
    completedLessons: number
    totalLessons: number
    lastActivityAt: string | null
    expiresAt: string | null
  }>
  nextSessions: Array<{
    id: string
    title: string
    courseTitle: string
    startsAt: string
    mode: string
    location: string | null
  }>
}

export async function getPortalDashboard(
  tenant: PortalTenant,
  member: PortalMemberContext,
): Promise<PortalDashboardData> {
  const [summaryResult, coursesResult, sessionsResult] = await Promise.all([
    queryPostgres<{
      active_course_count: number
      completed_course_count: number
      active_subscription_count: number
      certificate_count: number
      order_count: number
    }>(
      `SELECT
         (
           SELECT COUNT(DISTINCT access_grant.course_id)::int
           FROM public.learning_access_grants access_grant
           WHERE access_grant.org_id = $1::uuid
             AND access_grant.user_id = $2::uuid
             AND access_grant.status = 'ACTIVE'
             AND access_grant.starts_at <= NOW()
             AND (access_grant.expires_at IS NULL OR access_grant.expires_at > NOW())
         ) AS active_course_count,
         (
           SELECT COUNT(*)::int
           FROM public.learning_enrollments enrollment
           WHERE enrollment.org_id = $1::uuid
             AND enrollment.user_id = $2::uuid
             AND enrollment.status = 'COMPLETED'
         ) AS completed_course_count,
         (
           SELECT COUNT(*)::int
           FROM public.commerce_subscriptions subscription
           WHERE subscription.org_id = $1::uuid
             AND subscription.user_id = $2::uuid
             AND subscription.status IN ('TRIAL', 'ACTIVE', 'GRACE')
         ) AS active_subscription_count,
         (
           SELECT COUNT(*)::int
           FROM public.lms_certificates certificate
           WHERE certificate.org_id = $1::uuid
             AND certificate.user_id = $2::uuid
             AND certificate.status = 'ACTIVE'
         ) AS certificate_count,
         (
           SELECT
             (
               SELECT COUNT(*)::int
               FROM public.ecommerce_orders ecommerce_order
               WHERE ecommerce_order.org_id = $1::uuid
                 AND ecommerce_order.user_id = $2::uuid
             )
             +
             (
               SELECT COUNT(*)::int
               FROM public.commerce_historical_order_archives archive
               WHERE archive.org_id = $1::uuid
                 AND archive.user_id = $2::uuid
             )
         ) AS order_count`,
      [tenant.id, member.userId],
    ),
    queryPostgres<{
      id: string
      title: string
      slug: string
      cover_image_url: string | null
      progress_percent: number
      completed_lessons: number
      total_lessons: number
      last_activity_at: string | null
      expires_at: string | null
    }>(
      `WITH active_grants AS (
         SELECT DISTINCT ON (access_grant.course_id)
           access_grant.*
         FROM public.learning_access_grants access_grant
         WHERE access_grant.org_id = $1::uuid
           AND access_grant.user_id = $2::uuid
           AND access_grant.status = 'ACTIVE'
           AND access_grant.starts_at <= NOW()
           AND (access_grant.expires_at IS NULL OR access_grant.expires_at > NOW())
         ORDER BY
           access_grant.course_id,
           (access_grant.expires_at IS NULL) DESC,
           access_grant.expires_at DESC NULLS FIRST,
           access_grant.created_at DESC
       )
       SELECT
         course.id::text,
         course.title,
         course.slug,
         course.cover_image_url,
         COALESCE(enrollment.progress_percent, 0)::float8 AS progress_percent,
         (
           SELECT COUNT(*)::int
           FROM public.learning_lesson_progress progress
           WHERE progress.org_id = access_grant.org_id
             AND progress.enrollment_id = enrollment.id
             AND progress.status = 'COMPLETED'
         ) AS completed_lessons,
         (
           SELECT COUNT(*)::int
           FROM public.learning_lessons lesson
           WHERE lesson.org_id = course.org_id
             AND lesson.course_id = course.id
             AND lesson.deleted_at IS NULL
         ) AS total_lessons,
         enrollment.last_activity_at::text,
         access_grant.expires_at::text
       FROM active_grants access_grant
       JOIN public.learning_courses course
         ON course.id = access_grant.course_id
        AND course.org_id = access_grant.org_id
       LEFT JOIN public.learning_enrollments enrollment
         ON enrollment.org_id = access_grant.org_id
        AND enrollment.user_id = access_grant.user_id
        AND enrollment.course_id = access_grant.course_id
       ORDER BY enrollment.last_activity_at DESC NULLS LAST, access_grant.created_at DESC
       LIMIT 6`,
      [tenant.id, member.userId],
    ),
    queryPostgres<{
      id: string
      title: string
      course_title: string
      starts_at: string
      mode: string
      location: string | null
    }>(
      `SELECT DISTINCT
         session.id::text,
         session.title,
         course.title AS course_title,
         session.start_time::text AS starts_at,
         COALESCE(NULLIF(batch.delivery_mode, ''), NULLIF(batch.mode, ''), 'ONLINE') AS mode,
         COALESCE(session.location_name, session.location_url) AS location
       FROM public.learning_access_grants access_grant
       JOIN public.learning_courses course
         ON course.id = access_grant.course_id
        AND course.org_id = access_grant.org_id
       JOIN public.lms_course_batches batch
         ON batch.id = access_grant.batch_id
        AND batch.org_id = access_grant.org_id
       JOIN public.lms_batch_sessions session
         ON session.batch_id = batch.id
        AND session.org_id = access_grant.org_id
       WHERE access_grant.org_id = $1::uuid
         AND access_grant.user_id = $2::uuid
         AND access_grant.status = 'ACTIVE'
         AND session.start_time >= NOW()
       ORDER BY session.start_time
       LIMIT 5`,
      [tenant.id, member.userId],
    ),
  ])

  const summary = summaryResult.rows[0]
  return {
    activeCourseCount: Number(summary?.active_course_count || 0),
    completedCourseCount: Number(summary?.completed_course_count || 0),
    activeSubscriptionCount: Number(summary?.active_subscription_count || 0),
    certificateCount: Number(summary?.certificate_count || 0),
    orderCount: Number(summary?.order_count || 0),
    courses: coursesResult.rows.map((course) => ({
      id: course.id,
      title: course.title,
      slug: course.slug,
      coverImageUrl: course.cover_image_url,
      progressPercent: Number(course.progress_percent || 0),
      completedLessons: Number(course.completed_lessons || 0),
      totalLessons: Number(course.total_lessons || 0),
      lastActivityAt: course.last_activity_at,
      expiresAt: course.expires_at,
    })),
    nextSessions: sessionsResult.rows.map((session) => ({
      id: session.id,
      title: session.title,
      courseTitle: session.course_title,
      startsAt: session.starts_at,
      mode: session.mode,
      location: session.location,
    })),
  }
}

export type PortalOrder = {
  id: string
  orderNumber: string
  status: string
  totalAmount: number
  orderedAt: string
  source: 'NIZAM' | 'WORDPRESS_ARCHIVE'
  reconciliationStatus: string
}

export async function getPortalOrders(
  tenant: PortalTenant,
  member: PortalMemberContext,
): Promise<PortalOrder[]> {
  const result = await queryPostgres<{
    id: string
    order_number: string
    status: string
    total_amount: number
    ordered_at: string
    source: 'NIZAM' | 'WORDPRESS_ARCHIVE'
    reconciliation_status: string
  }>(
    `SELECT *
     FROM (
       SELECT
         ecommerce_order.id::text,
         ecommerce_order.order_number,
         ecommerce_order.status::text,
         ecommerce_order.grand_total::float8 AS total_amount,
         ecommerce_order.created_at::text AS ordered_at,
         'NIZAM'::text AS source,
         ecommerce_order.erp_sync_status AS reconciliation_status
       FROM public.ecommerce_orders ecommerce_order
       WHERE ecommerce_order.org_id = $1::uuid
         AND ecommerce_order.user_id = $2::uuid
       UNION ALL
       SELECT
         archive.id::text,
         COALESCE(archive.order_number, archive.external_id) AS order_number,
         archive.status,
         archive.total_amount::float8,
         COALESCE(archive.ordered_at, archive.created_at)::text AS ordered_at,
         'WORDPRESS_ARCHIVE'::text AS source,
         archive.reconciliation_status
       FROM public.commerce_historical_order_archives archive
       WHERE archive.org_id = $1::uuid
         AND archive.user_id = $2::uuid
     ) orders
     ORDER BY ordered_at DESC`,
    [tenant.id, member.userId],
  )
  return result.rows.map((order) => ({
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    totalAmount: Number(order.total_amount || 0),
    orderedAt: order.ordered_at,
    source: order.source,
    reconciliationStatus: order.reconciliation_status,
  }))
}

export type PortalSubscription = {
  id: string
  planName: string
  status: string
  nextRenewalAt: string | null
  currentPeriodEnd: string | null
  trialEndsAt: string | null
}

export async function getPortalSubscriptions(
  tenant: PortalTenant,
  member: PortalMemberContext,
): Promise<PortalSubscription[]> {
  const result = await queryPostgres<{
    id: string
    plan_name: string
    status: string
    next_renewal_at: string | null
    current_period_end: string | null
    trial_ends_at: string | null
  }>(
    `SELECT
       subscription.id::text,
       plan.name AS plan_name,
       subscription.status,
       subscription.next_renewal_at::text,
       subscription.current_period_end::text,
       subscription.trial_ends_at::text
     FROM public.commerce_subscriptions subscription
     JOIN public.commerce_subscription_plans plan
       ON plan.id = subscription.plan_id
      AND plan.org_id = subscription.org_id
     WHERE subscription.org_id = $1::uuid
       AND subscription.user_id = $2::uuid
     ORDER BY subscription.created_at DESC`,
    [tenant.id, member.userId],
  )
  return result.rows.map((subscription) => ({
    id: subscription.id,
    planName: subscription.plan_name,
    status: subscription.status,
    nextRenewalAt: subscription.next_renewal_at,
    currentPeriodEnd: subscription.current_period_end,
    trialEndsAt: subscription.trial_ends_at,
  }))
}

export type PortalCertificate = {
  id: string
  certificateNumber: string
  courseTitle: string
  issueDate: string
  expiresAt: string | null
  status: string
  verificationToken: string | null
  canDownload: boolean
}

export async function getPortalCertificates(
  tenant: PortalTenant,
  member: PortalMemberContext,
): Promise<PortalCertificate[]> {
  const result = await queryPostgres<{
    id: string
    certificate_number: string
    course_title: string | null
    issue_date: string
    expires_at: string | null
    status: string
    verification_token: string | null
    storage_key: string | null
    file_url: string | null
  }>(
    `SELECT
       certificate.id::text,
       certificate.certificate_number,
       course.title AS course_title,
       certificate.issue_date::text,
       certificate.expires_at::text,
       certificate.status,
       certificate.verification_token,
       certificate.storage_key,
       certificate.file_url
     FROM public.lms_certificates certificate
     LEFT JOIN public.learning_courses course
       ON course.id = certificate.course_id
      AND course.org_id = certificate.org_id
     WHERE certificate.org_id = $1::uuid
       AND certificate.user_id = $2::uuid
     ORDER BY certificate.issue_date DESC, certificate.created_at DESC`,
    [tenant.id, member.userId],
  )
  return result.rows.map((certificate) => ({
    id: certificate.id,
    certificateNumber: certificate.certificate_number,
    courseTitle: certificate.course_title || 'Program pembelajaran',
    issueDate: certificate.issue_date,
    expiresAt: certificate.expires_at,
    status: certificate.status,
    verificationToken: certificate.verification_token,
    canDownload: Boolean(certificate.storage_key || certificate.file_url),
  }))
}

export type PortalAffiliateDashboard = {
  referralCode: string
  pendingAmount: number
  payableAmount: number
  paidAmount: number
  conversionCount: number
  commissions: Array<{
    id: string
    orderNumber: string | null
    amount: number
    status: string
    createdAt: string
  }>
}

export async function getPortalAffiliateDashboard(
  tenant: PortalTenant,
  member: PortalMemberContext,
): Promise<PortalAffiliateDashboard | null> {
  const profileResult = await queryPostgres<{ id: string; referral_code: string }>(
    `SELECT id::text, referral_code
     FROM public.commerce_affiliate_profiles
     WHERE org_id = $1::uuid
       AND user_id = $2::uuid
       AND status = 'ACTIVE'
     LIMIT 1`,
    [tenant.id, member.userId],
  )
  const profile = profileResult.rows[0]
  if (!profile) return null

  const result = await queryPostgres<{
    id: string
    order_number: string | null
    amount: number
    status: string
    created_at: string
  }>(
    `SELECT
       commission.id::text,
       ecommerce_order.order_number,
       commission.commission_amount::float8 AS amount,
       commission.status,
       commission.created_at::text
     FROM public.commerce_affiliate_commissions commission
     LEFT JOIN public.ecommerce_orders ecommerce_order
       ON ecommerce_order.id = commission.order_id
      AND ecommerce_order.org_id = commission.org_id
     WHERE commission.org_id = $1::uuid
       AND commission.affiliate_profile_id = $2::uuid
     ORDER BY commission.created_at DESC
     LIMIT 100`,
    [tenant.id, profile.id],
  )
  const totalByStatus = (statuses: string[]) => result.rows
    .filter((commission) => statuses.includes(commission.status))
    .reduce((total, commission) => total + Number(commission.amount || 0), 0)
  return {
    referralCode: profile.referral_code,
    pendingAmount: totalByStatus(['PENDING', 'APPROVED']),
    payableAmount: totalByStatus(['PAYABLE']),
    paidAmount: totalByStatus(['PAID']),
    conversionCount: result.rows.filter((commission) => commission.status !== 'CANCELLED').length,
    commissions: result.rows.map((commission) => ({
      id: commission.id,
      orderNumber: commission.order_number,
      amount: Number(commission.amount || 0),
      status: commission.status,
      createdAt: commission.created_at,
    })),
  }
}

export type PortalTutorDashboard = {
  courses: Array<{
    id: string
    title: string
    activeStudents: number
    pendingSubmissions: number
  }>
  sessions: Array<{
    id: string
    title: string
    courseTitle: string
    batchName: string
    startsAt: string
    endsAt: string
    mode: string
    location: string | null
    attendanceCount: number
    tokenActiveUntil: string | null
  }>
  pendingAssignments: Array<{
    submissionId: string
    assignmentTitle: string
    courseTitle: string
    participantName: string
    submittedAt: string
    attemptNumber: number
    answerText: string | null
    attachments: Array<{
      uploadId: string
      fileName: string
      mimeType: string
      size: number
    }>
    maxScore: number
    rubric: Array<{
      key: string
      title: string
      maxScore: number
    }>
  }>
  pendingQuizEssays: Array<{
    attemptId: string
    quizTitle: string
    courseTitle: string
    participantName: string
    submittedAt: string
    answers: Array<{
      questionId: string
      promptHtml: string
      answerText: string
      points: number
    }>
  }>
}

export async function getPortalTutorDashboard(
  tenant: PortalTenant,
  member: PortalMemberContext,
): Promise<PortalTutorDashboard> {
  const [
    coursesResult,
    sessionsResult,
    pendingAssignmentsResult,
    pendingQuizEssaysResult,
  ] = await Promise.all([
    queryPostgres<{
      id: string
      title: string
      active_students: number
      pending_submissions: number
    }>(
      `SELECT
         course.id::text,
         course.title,
         (
           SELECT COUNT(*)::int
           FROM public.learning_enrollments enrollment
           WHERE enrollment.org_id = course.org_id
             AND enrollment.course_id = course.id
             AND enrollment.status = 'IN_PROGRESS'
         ) AS active_students,
         (
           SELECT COUNT(*)::int
           FROM public.learning_assignment_submissions submission
           JOIN public.learning_assignments assignment
             ON assignment.id = submission.assignment_id
            AND assignment.org_id = submission.org_id
           WHERE submission.org_id = course.org_id
             AND assignment.course_id = course.id
             AND submission.status IN ('SUBMITTED', 'UNDER_REVIEW')
         ) AS pending_submissions
       FROM public.learning_courses course
       WHERE course.org_id = $1::uuid
         AND course.deleted_at IS NULL
         AND (
           $3::boolean
           OR EXISTS (
             SELECT 1
             FROM public.learning_instructor_profiles instructor
             JOIN public.learning_course_instructors course_instructor
               ON course_instructor.instructor_id = instructor.id
              AND course_instructor.org_id = instructor.org_id
             WHERE instructor.org_id = course.org_id
               AND instructor.user_id = $2::uuid
               AND instructor.is_active = TRUE
               AND course_instructor.course_id = course.id
           )
         )
       ORDER BY course.title`,
      [tenant.id, member.userId, member.isAdmin],
    ),
    queryPostgres<{
      id: string
      title: string
      course_title: string
      batch_name: string
      starts_at: string
      ends_at: string
      mode: string
      location: string | null
      attendance_count: number
      token_active_until: string | null
    }>(
      `SELECT
         class_session.id::text,
         class_session.title,
         course.title AS course_title,
         batch.name AS batch_name,
         class_session.start_time::text AS starts_at,
         class_session.end_time::text AS ends_at,
         COALESCE(NULLIF(batch.delivery_mode, ''), NULLIF(batch.mode, ''), 'ONLINE') AS mode,
         COALESCE(class_session.location_name, class_session.location_url) AS location,
         (
           SELECT COUNT(*)::int
           FROM public.lms_session_attendances attendance
           WHERE attendance.org_id = class_session.org_id
             AND attendance.session_id = class_session.id
             AND attendance.status IN ('PRESENT', 'LATE')
         ) AS attendance_count,
         CASE
           WHEN class_session.attendance_token_expires_at > NOW()
           THEN class_session.attendance_token_expires_at::text
           ELSE NULL
         END AS token_active_until
       FROM public.lms_batch_sessions class_session
       JOIN public.lms_course_batches batch
         ON batch.id = class_session.batch_id
        AND batch.org_id = class_session.org_id
       JOIN public.learning_courses course
         ON course.id = batch.course_id
        AND course.org_id = batch.org_id
       WHERE class_session.org_id = $1::uuid
         AND class_session.end_time >= NOW() - INTERVAL '1 day'
         AND (
           $3::boolean
           OR EXISTS (
             SELECT 1
             FROM public.learning_instructor_profiles instructor
             JOIN public.learning_course_instructors course_instructor
               ON course_instructor.instructor_id = instructor.id
              AND course_instructor.org_id = instructor.org_id
             WHERE instructor.org_id = course.org_id
               AND instructor.user_id = $2::uuid
               AND instructor.is_active = TRUE
               AND course_instructor.course_id = course.id
           )
         )
       ORDER BY class_session.start_time
       LIMIT 30`,
      [tenant.id, member.userId, member.isAdmin],
    ),
    queryPostgres<{
      submission_id: string
      assignment_title: string
      course_title: string
      participant_name: string
      submitted_at: string
      attempt_number: number
      answer_text: string | null
      attachments: unknown
      max_score: number
      rubric: unknown
    }>(
      `SELECT
         submission.id::text AS submission_id,
         assignment.title AS assignment_title,
         course.title AS course_title,
         COALESCE(auth_user.display_name, auth_user.login_email, submission.user_id::text)
           AS participant_name,
         submission.submitted_at::text,
         submission.attempt_number,
         submission.submission_text AS answer_text,
         submission.attachments,
         assignment.max_score::float8,
         assignment.rubric
       FROM public.learning_assignment_submissions submission
       JOIN public.learning_assignments assignment
         ON assignment.id = submission.assignment_id
        AND assignment.org_id = submission.org_id
       JOIN public.learning_courses course
         ON course.id = assignment.course_id
        AND course.org_id = assignment.org_id
       LEFT JOIN public.internal_auth_users auth_user
         ON auth_user.id = submission.user_id
       WHERE submission.org_id = $1::uuid
         AND submission.status IN ('SUBMITTED', 'UNDER_REVIEW')
         AND (
           $3::boolean
           OR EXISTS (
             SELECT 1
             FROM public.learning_instructor_profiles instructor
             JOIN public.learning_course_instructors course_instructor
               ON course_instructor.instructor_id = instructor.id
              AND course_instructor.org_id = instructor.org_id
             WHERE instructor.org_id = submission.org_id
               AND instructor.user_id = $2::uuid
               AND instructor.is_active = TRUE
               AND course_instructor.course_id = assignment.course_id
           )
         )
       ORDER BY submission.submitted_at
       LIMIT 50`,
      [tenant.id, member.userId, member.isAdmin],
    ),
    queryPostgres<{
      attempt_id: string
      quiz_title: string
      course_title: string
      participant_name: string
      submitted_at: string
      answers: unknown
    }>(
      `SELECT
         attempt.id::text AS attempt_id,
         quiz.title AS quiz_title,
         course.title AS course_title,
         COALESCE(auth_user.display_name, auth_user.login_email, attempt.user_id::text)
           AS participant_name,
         attempt.submitted_at::text,
         COALESCE((
           SELECT jsonb_agg(
             jsonb_build_object(
               'questionId', question.id::text,
               'promptHtml', question.prompt_html,
               'answerText', COALESCE(answer.answer_text, ''),
               'points', question.points::float8
             )
             ORDER BY question.sort_order, question.created_at
           )
           FROM public.learning_questions question
           LEFT JOIN public.learning_quiz_answers answer
             ON answer.org_id = question.org_id
            AND answer.attempt_id = attempt.id
            AND answer.question_id = question.id
           WHERE question.org_id = quiz.org_id
             AND question.quiz_id = quiz.id
             AND question.question_type = 'ESSAY'
             AND question.is_active = TRUE
         ), '[]'::jsonb) AS answers
       FROM public.learning_quiz_attempts attempt
       JOIN public.learning_quizzes quiz
         ON quiz.id = attempt.quiz_id
        AND quiz.org_id = attempt.org_id
       JOIN public.learning_courses course
         ON course.id = quiz.course_id
        AND course.org_id = quiz.org_id
       LEFT JOIN public.internal_auth_users auth_user
         ON auth_user.id = attempt.user_id
       WHERE attempt.org_id = $1::uuid
         AND attempt.status = 'SUBMITTED'
         AND EXISTS (
           SELECT 1
           FROM public.learning_questions essay
           WHERE essay.org_id = quiz.org_id
             AND essay.quiz_id = quiz.id
             AND essay.question_type = 'ESSAY'
             AND essay.is_active = TRUE
         )
         AND (
           $3::boolean
           OR EXISTS (
             SELECT 1
             FROM public.learning_instructor_profiles instructor
             JOIN public.learning_course_instructors course_instructor
               ON course_instructor.instructor_id = instructor.id
              AND course_instructor.org_id = instructor.org_id
             WHERE instructor.org_id = attempt.org_id
               AND instructor.user_id = $2::uuid
               AND instructor.is_active = TRUE
               AND course_instructor.course_id = quiz.course_id
           )
         )
       ORDER BY attempt.submitted_at
       LIMIT 50`,
      [tenant.id, member.userId, member.isAdmin],
    ),
  ])
  return {
    courses: coursesResult.rows.map((course) => ({
      id: course.id,
      title: course.title,
      activeStudents: Number(course.active_students || 0),
      pendingSubmissions: Number(course.pending_submissions || 0),
    })),
    sessions: sessionsResult.rows.map((classSession) => ({
      id: classSession.id,
      title: classSession.title,
      courseTitle: classSession.course_title,
      batchName: classSession.batch_name,
      startsAt: classSession.starts_at,
      endsAt: classSession.ends_at,
      mode: classSession.mode,
      location: classSession.location,
      attendanceCount: Number(classSession.attendance_count || 0),
      tokenActiveUntil: classSession.token_active_until,
    })),
    pendingAssignments: pendingAssignmentsResult.rows.map((submission) => {
      const rawAttachments = Array.isArray(submission.attachments)
        ? submission.attachments
        : []
      const attachments = rawAttachments
        .filter((item): item is Record<string, unknown> => (
          Boolean(item) && typeof item === 'object'
        ))
        .map((item) => ({
          uploadId: String(item.uploadId || ''),
          fileName: String(item.fileName || 'Lampiran'),
          mimeType: String(item.mimeType || 'application/octet-stream'),
          size: Number(item.size || 0),
        }))
        .filter((item) => item.uploadId)
      const rawRubric = Array.isArray(submission.rubric) ? submission.rubric : []
      const rubric = rawRubric
        .filter((item): item is Record<string, unknown> => (
          Boolean(item) && typeof item === 'object'
        ))
        .map((item, index) => ({
          key: String(item.key || item.id || `rubric-${index + 1}`),
          title: String(item.title || item.name || item.criterion || `Kriteria ${index + 1}`),
          maxScore: Number(item.maxScore || item.max_points || item.points || 0),
        }))
        .filter((item) => item.maxScore > 0)
      return {
        submissionId: submission.submission_id,
        assignmentTitle: submission.assignment_title,
        courseTitle: submission.course_title,
        participantName: submission.participant_name,
        submittedAt: submission.submitted_at,
        attemptNumber: Number(submission.attempt_number),
        answerText: submission.answer_text,
        attachments,
        maxScore: Number(submission.max_score),
        rubric,
      }
    }),
    pendingQuizEssays: pendingQuizEssaysResult.rows.map((attempt) => {
      const rawAnswers = Array.isArray(attempt.answers) ? attempt.answers : []
      const answers = rawAnswers
        .filter((item): item is Record<string, unknown> => (
          Boolean(item) && typeof item === 'object'
        ))
        .map((item) => ({
          questionId: String(item.questionId || ''),
          promptHtml: sanitizeLearningHtml(item.promptHtml),
          answerText: String(item.answerText || ''),
          points: Number(item.points || 0),
        }))
        .filter((item) => item.questionId)
      return {
        attemptId: attempt.attempt_id,
        quizTitle: attempt.quiz_title,
        courseTitle: attempt.course_title,
        participantName: attempt.participant_name,
        submittedAt: attempt.submitted_at,
        answers,
      }
    }),
  }
}
