/**
 * Pembuat notifikasi terjadwal untuk sesi, tugas, subscription, dan content drip.
 */
import { queryPostgres } from '@/lib/db/postgres'
import { enqueueNotification } from './outbox.server'

type ReminderCandidate = {
  org_id: string
  user_id: string
  email: string | null
  phone: string | null
  event_type: string
  event_id: string
  offset_minutes: number
  variables: Record<string, string | number | null>
}

function localDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(value))
}

async function dispatchCandidates(candidates: ReminderCandidate[]) {
  let enqueued = 0
  for (const candidate of candidates) {
    const variables = { ...candidate.variables }
    for (const [key, value] of Object.entries(variables)) {
      if (key.endsWith('_at') && typeof value === 'string') variables[key] = localDate(value)
    }
    if (candidate.email) {
      const defaultMessage = candidate.event_type === 'CONSULTING_SESSION_REMINDER'
        ? `Pengingat Consulting 360: sesi "${variables.program_name || 'konsultasi'}" dijadwalkan pada ${variables.starts_at || '-'}.`
        : undefined
      await enqueueNotification({
        orgId: candidate.org_id,
        userId: candidate.user_id,
        eventType: candidate.event_type,
        channel: 'EMAIL',
        recipient: candidate.email,
        templateKey: candidate.event_type,
        variables,
        subject: candidate.event_type === 'CONSULTING_SESSION_REMINDER'
          ? 'Pengingat sesi Consulting 360'
          : undefined,
        body: defaultMessage,
        idempotencyKey: [
          candidate.event_type,
          candidate.event_id,
          candidate.user_id,
          candidate.offset_minutes,
          'EMAIL',
        ].join(':'),
      })
      enqueued += 1
    }
    if (candidate.phone) {
      const defaultMessage = candidate.event_type === 'CONSULTING_SESSION_REMINDER'
        ? `Pengingat Consulting 360: sesi "${variables.program_name || 'konsultasi'}" dijadwalkan pada ${variables.starts_at || '-'}.`
        : undefined
      await enqueueNotification({
        orgId: candidate.org_id,
        userId: candidate.user_id,
        eventType: candidate.event_type,
        channel: 'WHATSAPP',
        recipient: candidate.phone,
        templateKey: candidate.event_type,
        variables,
        body: defaultMessage,
        idempotencyKey: [
          candidate.event_type,
          candidate.event_id,
          candidate.user_id,
          candidate.offset_minutes,
          'WHATSAPP',
        ].join(':'),
      })
      enqueued += 1
    }
  }
  return enqueued
}

export async function enqueueCoreisecReminders(limit = 250) {
  const safeLimit = Math.max(1, Math.min(limit, 1000))
  const [sessions, assignments, subscriptions, lessons, consultingSessions] = await Promise.all([
    queryPostgres<ReminderCandidate>(
      `SELECT
         session.org_id::text,
         access_grant.user_id::text,
         COALESCE(internal_user.login_email, identity_user.email) AS email,
         COALESCE(identity_user.raw_user_meta_data->>'phone',
                  identity_user.raw_user_meta_data->>'phone_number') AS phone,
         'SESSION_REMINDER' AS event_type,
         session.id::text AS event_id,
         reminder.offset_minutes,
         jsonb_build_object(
           'session_title', session.title,
           'starts_at', session.start_time::text,
           'location', COALESCE(session.location_url, session.location_name, '-')
         ) AS variables
       FROM public.lms_batch_sessions session
       CROSS JOIN LATERAL unnest(session.reminder_offsets_minutes) reminder(offset_minutes)
       JOIN public.lms_course_batches batch
         ON batch.id = session.batch_id AND batch.org_id = session.org_id
       JOIN public.learning_access_grants access_grant
         ON access_grant.org_id = batch.org_id
        AND access_grant.course_id = batch.course_id
        AND (access_grant.batch_id IS NULL OR access_grant.batch_id = batch.id)
        AND access_grant.status = 'ACTIVE'
        AND access_grant.starts_at <= NOW()
        AND (access_grant.expires_at IS NULL OR access_grant.expires_at > NOW())
       LEFT JOIN public.internal_auth_users internal_user
         ON COALESCE(internal_user.legacy_user_id, internal_user.id) = access_grant.user_id
       LEFT JOIN auth.users identity_user ON identity_user.id = access_grant.user_id
       WHERE session.start_time - make_interval(mins => reminder.offset_minutes)
         BETWEEN NOW() - INTERVAL '5 minutes' AND NOW() + INTERVAL '5 minutes'
       ORDER BY session.start_time
       LIMIT $1`,
      [safeLimit],
    ),
    queryPostgres<ReminderCandidate>(
      `SELECT
         assignment.org_id::text,
         access_grant.user_id::text,
         COALESCE(internal_user.login_email, identity_user.email) AS email,
         COALESCE(identity_user.raw_user_meta_data->>'phone',
                  identity_user.raw_user_meta_data->>'phone_number') AS phone,
         'ASSIGNMENT_DUE' AS event_type,
         assignment.id::text AS event_id,
         reminder.offset_minutes,
         jsonb_build_object(
           'assignment_title', assignment.title,
           'due_at', assignment.due_at::text
         ) AS variables
       FROM public.learning_assignments assignment
       CROSS JOIN (VALUES (4320), (1440)) reminder(offset_minutes)
       JOIN public.learning_access_grants access_grant
         ON access_grant.org_id = assignment.org_id
        AND access_grant.course_id = assignment.course_id
        AND access_grant.status = 'ACTIVE'
        AND access_grant.starts_at <= NOW()
        AND (access_grant.expires_at IS NULL OR access_grant.expires_at > NOW())
       LEFT JOIN public.internal_auth_users internal_user
         ON COALESCE(internal_user.legacy_user_id, internal_user.id) = access_grant.user_id
       LEFT JOIN auth.users identity_user ON identity_user.id = access_grant.user_id
       WHERE assignment.status = 'PUBLISHED'
         AND assignment.due_at - make_interval(mins => reminder.offset_minutes)
           BETWEEN NOW() - INTERVAL '5 minutes' AND NOW() + INTERVAL '5 minutes'
         AND NOT EXISTS (
           SELECT 1 FROM public.learning_assignment_submissions submission
           WHERE submission.assignment_id = assignment.id
             AND submission.user_id = access_grant.user_id
             AND submission.status IN ('SUBMITTED', 'UNDER_REVIEW', 'GRADED')
         )
       ORDER BY assignment.due_at
       LIMIT $1`,
      [safeLimit],
    ),
    queryPostgres<ReminderCandidate>(
      `SELECT
         subscription.org_id::text,
         subscription.user_id::text,
         COALESCE(internal_user.login_email, identity_user.email) AS email,
         COALESCE(identity_user.raw_user_meta_data->>'phone',
                  identity_user.raw_user_meta_data->>'phone_number') AS phone,
         'SUBSCRIPTION_REMINDER' AS event_type,
         subscription.id::text AS event_id,
         reminder.offset_minutes,
         jsonb_build_object(
           'plan_name', plan.name,
           'renewal_at', subscription.next_renewal_at::text
         ) AS variables
       FROM public.commerce_subscriptions subscription
       CROSS JOIN (VALUES (10080), (4320), (1440)) reminder(offset_minutes)
       JOIN public.commerce_subscription_plans plan
         ON plan.id = subscription.plan_id AND plan.org_id = subscription.org_id
       LEFT JOIN public.internal_auth_users internal_user
         ON COALESCE(internal_user.legacy_user_id, internal_user.id) = subscription.user_id
       LEFT JOIN auth.users identity_user ON identity_user.id = subscription.user_id
       WHERE subscription.status IN ('TRIAL', 'ACTIVE', 'GRACE')
         AND subscription.next_renewal_at - make_interval(mins => reminder.offset_minutes)
           BETWEEN NOW() - INTERVAL '5 minutes' AND NOW() + INTERVAL '5 minutes'
       ORDER BY subscription.next_renewal_at
       LIMIT $1`,
      [safeLimit],
    ),
    queryPostgres<ReminderCandidate>(
      `SELECT
         lesson.org_id::text,
         access_grant.user_id::text,
         COALESCE(internal_user.login_email, identity_user.email) AS email,
         COALESCE(identity_user.raw_user_meta_data->>'phone',
                  identity_user.raw_user_meta_data->>'phone_number') AS phone,
         'LESSON_AVAILABLE' AS event_type,
         lesson.id::text || ':' || access_grant.id::text AS event_id,
         0 AS offset_minutes,
         jsonb_build_object(
           'lesson_title', lesson.title,
           'course_title', course.title
         ) AS variables
       FROM public.learning_lessons lesson
       JOIN public.learning_courses course
         ON course.id = lesson.course_id AND course.org_id = lesson.org_id
       JOIN public.learning_access_grants access_grant
         ON access_grant.org_id = lesson.org_id
        AND access_grant.course_id = lesson.course_id
        AND access_grant.status = 'ACTIVE'
        AND (access_grant.expires_at IS NULL OR access_grant.expires_at > NOW())
       LEFT JOIN public.internal_auth_users internal_user
         ON COALESCE(internal_user.legacy_user_id, internal_user.id) = access_grant.user_id
       LEFT JOIN auth.users identity_user ON identity_user.id = access_grant.user_id
       CROSS JOIN LATERAL (
         SELECT access_grant.starts_at + CASE upper(COALESCE(lesson.drip_unit, 'HOUR'))
           WHEN 'HOUR' THEN make_interval(hours => COALESCE(lesson.drip_value, 0))
           WHEN 'DAY' THEN make_interval(days => COALESCE(lesson.drip_value, 0))
           WHEN 'WEEK' THEN make_interval(weeks => COALESCE(lesson.drip_value, 0))
           WHEN 'MONTH' THEN make_interval(months => COALESCE(lesson.drip_value, 0))
           WHEN 'YEAR' THEN make_interval(years => COALESCE(lesson.drip_value, 0))
           ELSE INTERVAL '0'
         END AS opens_at
       ) drip_release
       WHERE lesson.deleted_at IS NULL
         AND lesson.drip_value IS NOT NULL
         AND drip_release.opens_at BETWEEN NOW() - INTERVAL '5 minutes' AND NOW() + INTERVAL '5 minutes'
       ORDER BY drip_release.opens_at
       LIMIT $1`,
      [safeLimit],
    ),
    queryPostgres<ReminderCandidate>(
      `SELECT
         consulting_session.org_id::text,
         consulting_session.user_id::text,
         COALESCE(internal_user.login_email, ecommerce_order.customer_email) AS email,
         ecommerce_order.customer_phone AS phone,
         'CONSULTING_SESSION_REMINDER' AS event_type,
         consulting_session.id::text AS event_id,
         reminder.offset_minutes,
         jsonb_build_object(
           'program_name', store_product.public_name,
           'consultant_name', instructor.display_name,
           'starts_at', consulting_session.starts_at::text,
           'location', COALESCE(
             consulting_session.meeting_url,
             consulting_session.location_name,
             '-'
           )
         ) AS variables
       FROM public.consulting_sessions consulting_session
       CROSS JOIN LATERAL unnest(
         consulting_session.reminder_offsets_minutes
       ) reminder(offset_minutes)
       JOIN public.consulting_engagements engagement
         ON engagement.org_id = consulting_session.org_id
        AND engagement.id = consulting_session.engagement_id
       JOIN public.consulting_offerings offering
         ON offering.org_id = engagement.org_id
        AND offering.id = engagement.offering_id
       JOIN public.ecommerce_orders ecommerce_order
         ON ecommerce_order.org_id = engagement.org_id
        AND ecommerce_order.id = engagement.order_id
       JOIN public.store_products store_product
         ON store_product.org_id = offering.org_id
        AND store_product.id = offering.store_product_id
       JOIN public.learning_instructor_profiles instructor
         ON instructor.org_id = consulting_session.org_id
        AND instructor.id = consulting_session.consultant_id
       LEFT JOIN LATERAL (
         SELECT auth_user.login_email
         FROM public.internal_auth_users auth_user
         WHERE auth_user.id = consulting_session.user_id
            OR auth_user.legacy_user_id = consulting_session.user_id
         ORDER BY CASE WHEN auth_user.id = consulting_session.user_id THEN 0 ELSE 1 END
         LIMIT 1
       ) internal_user ON TRUE
       WHERE consulting_session.status = 'SCHEDULED'
         AND consulting_session.starts_at
           - make_interval(mins => reminder.offset_minutes)
           BETWEEN NOW() - INTERVAL '5 minutes' AND NOW() + INTERVAL '5 minutes'
       ORDER BY consulting_session.starts_at
       LIMIT $1`,
      [safeLimit],
    ),
  ])
  const candidates = [
    ...sessions.rows,
    ...assignments.rows,
    ...subscriptions.rows,
    ...lessons.rows,
    ...consultingSessions.rows,
  ]
  return {
    sessions: sessions.rows.length,
    assignments: assignments.rows.length,
    subscriptions: subscriptions.rows.length,
    lessons: lessons.rows.length,
    consultingSessions: consultingSessions.rows.length,
    enqueued: await dispatchCandidates(candidates),
  }
}

export async function enqueueCourseCompletionNotifications(enrollmentId: string) {
  const result = await queryPostgres<ReminderCandidate>(
    `SELECT
       enrollment.org_id::text,
       enrollment.user_id::text,
       COALESCE(internal_user.login_email, identity_user.email) AS email,
       COALESCE(identity_user.raw_user_meta_data->>'phone',
                identity_user.raw_user_meta_data->>'phone_number') AS phone,
       'COURSE_COMPLETED' AS event_type,
       enrollment.id::text AS event_id,
       0 AS offset_minutes,
       jsonb_build_object(
         'name', COALESCE(internal_user.display_name, internal_user.login_email, 'Peserta'),
         'course_title', course.title
       ) AS variables
     FROM public.learning_enrollments enrollment
     JOIN public.learning_courses course
       ON course.id = enrollment.course_id AND course.org_id = enrollment.org_id
     LEFT JOIN public.internal_auth_users internal_user
       ON COALESCE(internal_user.legacy_user_id, internal_user.id) = enrollment.user_id
     LEFT JOIN auth.users identity_user ON identity_user.id = enrollment.user_id
     WHERE enrollment.id = $1::uuid AND enrollment.status = 'COMPLETED'
     LIMIT 1`,
    [enrollmentId],
  )
  return dispatchCandidates(result.rows)
}
