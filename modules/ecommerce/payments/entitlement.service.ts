/**
 * Sumber tunggal snapshot dan pemberian hak akses course dari order commerce.
 * Enrollment hanya menunjuk grant aktif terbaik dan tidak menghapus progres.
 */
import 'server-only'

import type { PoolClient } from 'pg'

type SnapshotRow = {
  course_id: string
  source_kind: 'DIRECT' | 'PACKAGE' | 'MIXED'
  package_ids: string[]
  package_versions: Record<string, number>
  access_duration_value: number | null
  access_duration_unit: string | null
  source_snapshot: Record<string, unknown>
  store_product_id: string
  batch_id: string | null
  subscription_id: string | null
  subscription_expires_at: string | null
}

type OrderIdentityRow = {
  id: string
  org_id: string
  user_id: string | null
  order_number: string
  coupon_id: string | null
}

type MembershipRow = {
  id: string
  package_id: string
  user_id: string
  expires_at: string | null
}

function normalizedDurationWeight(value: number | null, unit: string | null) {
  if (value == null) return Number.POSITIVE_INFINITY
  const normalized = String(unit || '').toUpperCase()
  if (normalized.startsWith('YEAR')) return value * 31_536_000
  if (normalized.startsWith('MONTH')) return value * 2_592_000
  if (normalized.startsWith('WEEK')) return value * 604_800
  if (normalized.startsWith('DAY')) return value * 86_400
  if (normalized.startsWith('HOUR')) return value * 3_600
  return value
}

function addDuration(start: Date, value: number | null, unit: string | null) {
  if (value == null || !unit) return null
  const next = new Date(start)
  const normalized = unit.toUpperCase()
  if (normalized.startsWith('HOUR')) next.setUTCHours(next.getUTCHours() + value)
  else if (normalized.startsWith('DAY')) next.setUTCDate(next.getUTCDate() + value)
  else if (normalized.startsWith('WEEK')) next.setUTCDate(next.getUTCDate() + (value * 7))
  else if (normalized.startsWith('MONTH')) next.setUTCMonth(next.getUTCMonth() + value)
  else if (normalized.startsWith('YEAR')) next.setUTCFullYear(next.getUTCFullYear() + value)
  else return null
  return next.toISOString()
}

export async function snapshotOrderEntitlements(
  client: PoolClient,
  input: { orgId: string; orderId: string },
) {
  const candidates = await client.query<{
    order_item_id: string
    store_product_id: string
    course_id: string
    duration_value: number | null
    duration_unit: string | null
    source_kind: 'DIRECT' | 'PACKAGE'
    package_id: string | null
    package_version: number | null
    batch_id: string | null
  }>(
    `SELECT
       item.id::text AS order_item_id,
       store_product.id::text AS store_product_id,
       product_course.course_id::text,
       COALESCE(
         product_course.access_duration_value,
         course.access_duration_value
       ) AS duration_value,
       COALESCE(
         product_course.access_duration_unit,
         course.access_duration_unit
       ) AS duration_unit,
       'DIRECT'::text AS source_kind,
       NULL::text AS package_id,
       NULL::integer AS package_version,
       product_course.batch_id::text AS batch_id
     FROM public.ecommerce_order_items item
     JOIN public.store_products store_product
       ON store_product.org_id = item.org_id
      AND store_product.store_id = item.store_id
      AND store_product.product_id = item.product_id
     JOIN public.commerce_product_courses product_course
       ON product_course.org_id = store_product.org_id
      AND product_course.store_product_id = store_product.id
     JOIN public.learning_courses course
       ON course.org_id = product_course.org_id
      AND course.id = product_course.course_id
     WHERE item.org_id = $1::uuid
       AND item.order_id = $2::uuid

     UNION ALL

     SELECT
       item.id::text AS order_item_id,
       store_product.id::text AS store_product_id,
       package_course.course_id::text,
       COALESCE(
         package_course.access_duration_value,
         access_package.default_access_duration_value,
         course.access_duration_value
       ) AS duration_value,
       COALESCE(
         package_course.access_duration_unit,
         access_package.default_access_duration_unit,
         course.access_duration_unit
       ) AS duration_unit,
       'PACKAGE'::text AS source_kind,
       access_package.id::text AS package_id,
       access_package.version AS package_version,
       NULL::text AS batch_id
     FROM public.ecommerce_order_items item
     JOIN public.store_products store_product
       ON store_product.org_id = item.org_id
      AND store_product.store_id = item.store_id
      AND store_product.product_id = item.product_id
     JOIN public.commerce_product_access_packages product_package
       ON product_package.org_id = store_product.org_id
      AND product_package.store_product_id = store_product.id
     JOIN public.commerce_access_packages access_package
       ON access_package.org_id = product_package.org_id
      AND access_package.id = product_package.package_id
      AND access_package.is_active = TRUE
     JOIN public.commerce_access_package_courses package_course
       ON package_course.org_id = access_package.org_id
      AND package_course.package_id = access_package.id
     JOIN public.learning_courses course
       ON course.org_id = package_course.org_id
      AND course.id = package_course.course_id
     WHERE item.org_id = $1::uuid
       AND item.order_id = $2::uuid`,
    [input.orgId, input.orderId],
  )

  const byCourse = new Map<string, typeof candidates.rows>()
  for (const candidate of candidates.rows) {
    const bucket = byCourse.get(candidate.course_id) || []
    bucket.push(candidate)
    byCourse.set(candidate.course_id, bucket)
  }

  for (const [courseId, sources] of byCourse) {
    const selected = [...sources].sort((left, right) => {
      // Kandidat yang pin ke batch spesifik menang atas yang tidak (lebih spesifik),
      // baru fallback ke urutan durasi seperti sebelumnya.
      const batchWeight = Number(Boolean(right.batch_id)) - Number(Boolean(left.batch_id))
      if (batchWeight !== 0) return batchWeight
      return (
        normalizedDurationWeight(right.duration_value, right.duration_unit)
        - normalizedDurationWeight(left.duration_value, left.duration_unit)
      )
    })[0]
    const packageSources = sources.filter((source) => source.package_id)
    const hasDirect = sources.some((source) => source.source_kind === 'DIRECT')
    const hasPackage = packageSources.length > 0
    const sourceKind = hasDirect && hasPackage
      ? 'MIXED'
      : hasPackage
        ? 'PACKAGE'
        : 'DIRECT'
    const packageIds = [...new Set(
      packageSources.map((source) => source.package_id).filter((id): id is string => Boolean(id)),
    )]
    const packageVersions = Object.fromEntries(
      packageSources.map((source) => [String(source.package_id), source.package_version]),
    )

    await client.query(
      `INSERT INTO public.commerce_order_entitlements (
         org_id, order_id, order_item_id, store_product_id, course_id,
         source_kind, package_ids, package_versions,
         access_duration_value, access_duration_unit, source_snapshot, batch_id
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid,
         $6, $7::uuid[], $8::jsonb, $9, $10, $11::jsonb, $12::uuid
       )
       ON CONFLICT (org_id, order_id, course_id) DO NOTHING`,
      [
        input.orgId,
        input.orderId,
        selected.order_item_id,
        selected.store_product_id,
        courseId,
        sourceKind,
        packageIds,
        JSON.stringify(packageVersions),
        selected.duration_value,
        selected.duration_unit,
        JSON.stringify({
          sources: sources.map((source) => ({
            kind: source.source_kind,
            packageId: source.package_id,
            packageVersion: source.package_version,
            durationValue: source.duration_value,
            durationUnit: source.duration_unit,
          })),
        }),
        selected.batch_id,
      ],
    )
  }

  return byCourse.size
}

async function upsertOrderMemberships(
  client: PoolClient,
  order: OrderIdentityRow,
  snapshots: SnapshotRow[],
) {
  if (!order.user_id) return new Map<string, string>()
  const packages = new Map<string, {
    version: number
    subscriptionId: string | null
    expiresAt: string | null
  }>()
  const startsAt = new Date()

  for (const snapshot of snapshots) {
    for (const packageId of snapshot.package_ids || []) {
      const entitlementExpiry = snapshot.subscription_expires_at
        || addDuration(
          startsAt,
          snapshot.access_duration_value,
          snapshot.access_duration_unit,
        )
      const current = packages.get(packageId)
      const expiresAt = current
        ? current.expiresAt === null || entitlementExpiry === null
          ? null
          : current.expiresAt > entitlementExpiry
            ? current.expiresAt
            : entitlementExpiry
        : entitlementExpiry
      packages.set(packageId, {
        version: Number(snapshot.package_versions?.[packageId] || 1),
        subscriptionId: snapshot.subscription_id,
        expiresAt,
      })
    }
  }

  const membershipByPackage = new Map<string, string>()
  for (const [packageId, source] of packages) {
    const idempotencyKey = source.subscriptionId
      ? `subscription:${source.subscriptionId}:package:${packageId}`
      : `order:${order.id}:package:${packageId}`
    const result = await client.query<{ id: string }>(
      `INSERT INTO public.commerce_memberships (
         org_id, user_id, package_id, source_type, source_id, status,
         starts_at, expires_at, idempotency_key, subscription_id,
         initial_order_id, latest_order_id, package_version, source_snapshot
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4, $5::uuid, 'ACTIVE',
         NOW(), $6::timestamptz, $7, $8::uuid,
         $9::uuid, $9::uuid, $10, $11::jsonb
       )
       ON CONFLICT (org_id, idempotency_key) DO UPDATE
       SET
         status = 'ACTIVE',
         expires_at = EXCLUDED.expires_at,
         latest_order_id = EXCLUDED.latest_order_id,
         package_version = EXCLUDED.package_version,
         cancelled_at = NULL,
         updated_at = NOW()
       RETURNING id::text`,
      [
        order.org_id,
        order.user_id,
        packageId,
        source.subscriptionId ? 'SUBSCRIPTION' : 'ORDER',
        source.subscriptionId || order.id,
        source.expiresAt,
        idempotencyKey,
        source.subscriptionId,
        order.id,
        source.version,
        JSON.stringify({
          orderId: order.id,
          orderNumber: order.order_number,
          frozen: !source.subscriptionId,
        }),
      ],
    )
    const membershipId = result.rows[0].id
    membershipByPackage.set(packageId, membershipId)
    await client.query(
      `INSERT INTO public.commerce_membership_events (
         org_id, membership_id, event_type, order_id, idempotency_key, payload
       ) VALUES ($1::uuid, $2::uuid, 'ACTIVATED', $3::uuid, $4, $5::jsonb)
       ON CONFLICT (org_id, idempotency_key) DO NOTHING`,
      [
        order.org_id,
        membershipId,
        order.id,
        `membership-activated:${membershipId}:order:${order.id}`,
        JSON.stringify({ packageId, subscriptionId: source.subscriptionId }),
      ],
    )
  }
  return membershipByPackage
}

export async function reconcileEffectiveEnrollments(
  client: PoolClient,
  input: { orgId: string; userId: string; courseIds: string[] },
) {
  const courseIds = [...new Set(input.courseIds.filter(Boolean))]
  if (courseIds.length === 0) return
  await client.query(
    `UPDATE public.learning_enrollments enrollment
     SET
       access_grant_id = (
         SELECT access_grant.id
         FROM public.learning_access_grants access_grant
         WHERE access_grant.org_id = enrollment.org_id
           AND access_grant.user_id = enrollment.user_id
           AND access_grant.course_id = enrollment.course_id
           AND access_grant.status = 'ACTIVE'
           AND access_grant.starts_at <= NOW()
           AND (access_grant.expires_at IS NULL OR access_grant.expires_at > NOW())
         ORDER BY
           (access_grant.expires_at IS NULL) DESC,
           access_grant.expires_at DESC NULLS FIRST,
           access_grant.created_at DESC
         LIMIT 1
       ),
       updated_at = NOW()
     WHERE enrollment.org_id = $1::uuid
       AND enrollment.user_id = $2::uuid
       AND enrollment.course_id = ANY($3::uuid[])`,
    [input.orgId, input.userId, courseIds],
  )
}

export async function provisionOrderEntitlements(
  client: PoolClient,
  input: { orgId: string; orderId: string },
) {
  await snapshotOrderEntitlements(client, input)
  const orderResult = await client.query<OrderIdentityRow>(
    `SELECT
       id::text,
       org_id::text,
       user_id::text,
       order_number,
       coupon_id::text
     FROM public.ecommerce_orders
     WHERE org_id = $1::uuid AND id = $2::uuid
     LIMIT 1
     FOR UPDATE`,
    [input.orgId, input.orderId],
  )
  const order = orderResult.rows[0]
  if (!order) throw new Error('Order hak akses tidak ditemukan.')

  const snapshots = await client.query<SnapshotRow>(
    `SELECT
       entitlement.course_id::text,
       entitlement.source_kind,
       entitlement.package_ids::text[],
       entitlement.package_versions,
       entitlement.access_duration_value,
       entitlement.access_duration_unit,
       entitlement.source_snapshot,
       entitlement.store_product_id::text,
       entitlement.batch_id::text,
       subscription.id::text AS subscription_id,
       subscription.current_period_end::text AS subscription_expires_at
     FROM public.commerce_order_entitlements entitlement
     LEFT JOIN public.commerce_subscription_plans plan
       ON plan.org_id = entitlement.org_id
      AND plan.store_product_id = entitlement.store_product_id
      AND plan.is_active = TRUE
     LEFT JOIN public.commerce_subscriptions subscription
       ON subscription.org_id = plan.org_id
      AND subscription.plan_id = plan.id
      AND subscription.latest_order_id = entitlement.order_id
      AND subscription.status IN ('TRIAL', 'ACTIVE', 'GRACE')
     WHERE entitlement.org_id = $1::uuid
       AND entitlement.order_id = $2::uuid
     ORDER BY entitlement.course_id`,
    [input.orgId, input.orderId],
  )

  if (snapshots.rows.length > 0 && !order.user_id) {
    throw new Error('Order digital belum terhubung ke akun member.')
  }
  if (!order.user_id) return [] as string[]

  const membershipByPackage = await upsertOrderMemberships(client, order, snapshots.rows)
  const grantIds: string[] = []
  const startsAt = new Date()

  for (const entitlement of snapshots.rows) {
    const packageMembershipId = entitlement.source_kind === 'PACKAGE'
      ? membershipByPackage.get(entitlement.package_ids[0] || '') || null
      : null
    const sourceType = entitlement.subscription_id
      ? packageMembershipId
        ? 'MEMBERSHIP'
        : 'SUBSCRIPTION'
      : 'ORDER'
    const sourceId = entitlement.subscription_id
      ? packageMembershipId || entitlement.subscription_id
      : order.id
    const idempotencyKey = sourceType === 'MEMBERSHIP'
      ? `membership:${sourceId}:course:${entitlement.course_id}`
      : sourceType === 'SUBSCRIPTION'
        ? `subscription:${sourceId}:course:${entitlement.course_id}`
        : `order:${order.id}:course:${entitlement.course_id}`
    const expiresAt = entitlement.subscription_expires_at
      || addDuration(
        startsAt,
        entitlement.access_duration_value,
        entitlement.access_duration_unit,
      )

    // Jaring pengaman kuota untuk race manual transfer: tidak pernah blokir
    // pembeli yang sudah bayar, cukup tandai overbooked untuk ditindaklanjuti admin.
    let isOverbooked = false
    if (entitlement.batch_id) {
      const batchResult = await client.query<{ quota: number | null }>(
        `SELECT quota FROM public.lms_course_batches WHERE id = $1::uuid AND org_id = $2::uuid LIMIT 1`,
        [entitlement.batch_id, order.org_id],
      )
      const quota = Number(batchResult.rows[0]?.quota || 0)
      if (quota > 0) {
        const activeCount = await client.query<{ count: number }>(
          `SELECT COUNT(*)::int AS count
           FROM public.learning_access_grants
           WHERE org_id = $1::uuid AND batch_id = $2::uuid AND status = 'ACTIVE'
             AND user_id != $3::uuid`,
          [order.org_id, entitlement.batch_id, order.user_id],
        )
        isOverbooked = Number(activeCount.rows[0]?.count || 0) >= quota
      }
    }

    const grant = await client.query<{ id: string }>(
      `INSERT INTO public.learning_access_grants (
         org_id, user_id, course_id, source_type, source_id,
         source_reference, status, starts_at, expires_at,
         idempotency_key, metadata, batch_id, is_overbooked
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4, $5::uuid,
         $6, 'ACTIVE', $7::timestamptz, $8::timestamptz,
         $9, $10::jsonb, $11::uuid, $12
       )
       ON CONFLICT (org_id, idempotency_key) DO UPDATE
       SET
         status = 'ACTIVE',
         starts_at = LEAST(public.learning_access_grants.starts_at, EXCLUDED.starts_at),
         expires_at = CASE
           WHEN public.learning_access_grants.expires_at IS NULL
             OR EXCLUDED.expires_at IS NULL THEN NULL
           ELSE GREATEST(public.learning_access_grants.expires_at, EXCLUDED.expires_at)
         END,
         revoked_at = NULL,
         revoked_reason = NULL,
         metadata = public.learning_access_grants.metadata || EXCLUDED.metadata,
         batch_id = COALESCE(EXCLUDED.batch_id, public.learning_access_grants.batch_id),
         is_overbooked = public.learning_access_grants.is_overbooked OR EXCLUDED.is_overbooked,
         updated_at = NOW()
       RETURNING id::text`,
      [
        order.org_id,
        order.user_id,
        entitlement.course_id,
        sourceType,
        sourceId,
        order.order_number,
        startsAt.toISOString(),
        expiresAt,
        idempotencyKey,
        JSON.stringify({
          orderId: order.id,
          couponId: order.coupon_id,
          sourceKind: entitlement.source_kind,
          packageIds: entitlement.package_ids,
          entitlementSnapshot: entitlement.source_snapshot,
        }),
        entitlement.batch_id,
        isOverbooked,
      ],
    )
    const grantId = grant.rows[0].id
    grantIds.push(grantId)
    await client.query(
      `INSERT INTO public.learning_enrollments (
         org_id, user_id, course_id, access_grant_id, status, started_at, batch_id
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4::uuid, 'IN_PROGRESS', NOW(), $5::uuid
       )
       ON CONFLICT (org_id, user_id, course_id) DO UPDATE
       SET
         access_grant_id = EXCLUDED.access_grant_id,
         status = CASE
           WHEN public.learning_enrollments.status = 'COMPLETED' THEN 'COMPLETED'
           ELSE 'IN_PROGRESS'
         END,
         batch_id = COALESCE(EXCLUDED.batch_id, public.learning_enrollments.batch_id),
         updated_at = NOW()`,
      [order.org_id, order.user_id, entitlement.course_id, grantId, entitlement.batch_id],
    )
  }

  await reconcileEffectiveEnrollments(client, {
    orgId: order.org_id,
    userId: order.user_id,
    courseIds: snapshots.rows.map((row) => row.course_id),
  })
  return grantIds
}

export async function syncActivePackageMemberships(
  client: PoolClient,
  input: { orgId: string; packageId: string; actorUserId?: string | null },
) {
  const packageCourses = await client.query<{
    course_id: string
    version: number
  }>(
    `SELECT package_course.course_id::text, access_package.version
     FROM public.commerce_access_packages access_package
     JOIN public.commerce_access_package_courses package_course
       ON package_course.org_id = access_package.org_id
      AND package_course.package_id = access_package.id
     WHERE access_package.org_id = $1::uuid
       AND access_package.id = $2::uuid
       AND access_package.is_active = TRUE`,
    [input.orgId, input.packageId],
  )
  const memberships = await client.query<MembershipRow>(
    `SELECT id::text, package_id::text, user_id::text, expires_at::text
     FROM public.commerce_memberships
     WHERE org_id = $1::uuid
       AND package_id = $2::uuid
       AND subscription_id IS NOT NULL
       AND status = 'ACTIVE'
       AND (expires_at IS NULL OR expires_at > NOW())
     FOR UPDATE`,
    [input.orgId, input.packageId],
  )
  const desiredCourseIds = packageCourses.rows.map((row) => row.course_id)

  for (const membership of memberships.rows) {
    const existing = await client.query<{ course_id: string }>(
      `SELECT course_id::text
       FROM public.learning_access_grants
       WHERE org_id = $1::uuid
         AND source_type = 'MEMBERSHIP'
         AND source_id = $2::uuid
         AND status = 'ACTIVE'`,
      [input.orgId, membership.id],
    )
    const existingIds = new Set(existing.rows.map((row) => row.course_id))
    const removedIds = [...existingIds].filter((courseId) => !desiredCourseIds.includes(courseId))

    for (const courseId of desiredCourseIds) {
      await client.query(
        `INSERT INTO public.learning_access_grants (
           org_id, user_id, course_id, source_type, source_id,
           source_reference, status, starts_at, expires_at,
           idempotency_key, metadata
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, 'MEMBERSHIP', $4::uuid,
           $5, 'ACTIVE', NOW(), $6::timestamptz, $7, $8::jsonb
         )
         ON CONFLICT (org_id, idempotency_key) DO UPDATE
         SET
           status = 'ACTIVE',
           expires_at = EXCLUDED.expires_at,
           revoked_at = NULL,
           revoked_reason = NULL,
           updated_at = NOW()`,
        [
          input.orgId,
          membership.user_id,
          courseId,
          membership.id,
          `package:${membership.package_id}`,
          membership.expires_at,
          `membership:${membership.id}:course:${courseId}`,
          JSON.stringify({ packageId: membership.package_id, synchronized: true }),
        ],
      )
      await client.query(
        `INSERT INTO public.learning_enrollments (
           org_id, user_id, course_id, access_grant_id, status, started_at
         )
         SELECT $1::uuid, $2::uuid, $3::uuid, access_grant.id, 'IN_PROGRESS', NOW()
         FROM public.learning_access_grants access_grant
         WHERE access_grant.org_id = $1::uuid
           AND access_grant.idempotency_key = $4
         ON CONFLICT (org_id, user_id, course_id) DO UPDATE
         SET updated_at = NOW()`,
        [
          input.orgId,
          membership.user_id,
          courseId,
          `membership:${membership.id}:course:${courseId}`,
        ],
      )
    }

    if (removedIds.length > 0) {
      await client.query(
        `UPDATE public.learning_access_grants
         SET status = 'REVOKED', revoked_at = NOW(),
             revoked_reason = 'PACKAGE_COURSE_REMOVED', updated_at = NOW()
         WHERE org_id = $1::uuid
           AND source_type = 'MEMBERSHIP'
           AND source_id = $2::uuid
           AND course_id = ANY($3::uuid[])
           AND status = 'ACTIVE'`,
        [input.orgId, membership.id, removedIds],
      )
    }

    await client.query(
      `UPDATE public.commerce_memberships
       SET package_version = $3, updated_at = NOW()
       WHERE org_id = $1::uuid AND id = $2::uuid`,
      [input.orgId, membership.id, packageCourses.rows[0]?.version || 1],
    )
    await client.query(
      `INSERT INTO public.commerce_membership_events (
         org_id, membership_id, event_type, idempotency_key, payload
       ) VALUES ($1::uuid, $2::uuid, 'PACKAGE_SYNCHRONIZED', $3, $4::jsonb)
       ON CONFLICT (org_id, idempotency_key) DO NOTHING`,
      [
        input.orgId,
        membership.id,
        `membership-sync:${membership.id}:version:${packageCourses.rows[0]?.version || 1}`,
        JSON.stringify({
          addedCourseIds: desiredCourseIds.filter((courseId) => !existingIds.has(courseId)),
          removedCourseIds: removedIds,
          actorUserId: input.actorUserId || null,
        }),
      ],
    )
    await reconcileEffectiveEnrollments(client, {
      orgId: input.orgId,
      userId: membership.user_id,
      courseIds: [...new Set([...desiredCourseIds, ...removedIds])],
    })
  }
  return memberships.rows.length
}

export async function revokeSubscriptionEntitlements(
  client: PoolClient,
  input: {
    orgId: string
    subscriptionId: string
    reason: string
    membershipStatus?: 'CANCELLED' | 'EXPIRED'
  },
) {
  const memberships = await client.query<{ id: string; user_id: string }>(
    `SELECT id::text, user_id::text
     FROM public.commerce_memberships
     WHERE org_id = $1::uuid AND subscription_id = $2::uuid
     FOR UPDATE`,
    [input.orgId, input.subscriptionId],
  )
  const membershipIds = memberships.rows.map((row) => row.id)
  const affected = await client.query<{ user_id: string; course_id: string }>(
    `SELECT DISTINCT user_id::text, course_id::text
     FROM public.learning_access_grants
     WHERE org_id = $1::uuid
       AND (
         (source_type = 'SUBSCRIPTION' AND source_id = $2::uuid)
         OR (
           source_type = 'MEMBERSHIP'
           AND source_id = ANY($3::uuid[])
         )
       )`,
    [input.orgId, input.subscriptionId, membershipIds],
  )
  await client.query(
    `UPDATE public.learning_access_grants
     SET status = 'REVOKED', revoked_at = NOW(),
         revoked_reason = $4, updated_at = NOW()
     WHERE org_id = $1::uuid
       AND (
         (source_type = 'SUBSCRIPTION' AND source_id = $2::uuid)
         OR (
           source_type = 'MEMBERSHIP'
           AND source_id = ANY($3::uuid[])
         )
       )
       AND status <> 'REVOKED'`,
    [input.orgId, input.subscriptionId, membershipIds, input.reason],
  )
  await client.query(
    `UPDATE public.commerce_memberships
     SET
       status = $3,
       cancelled_at = CASE WHEN $3 = 'CANCELLED' THEN NOW() ELSE cancelled_at END,
       updated_at = NOW()
     WHERE org_id = $1::uuid
       AND subscription_id = $2::uuid
       AND status NOT IN ('CANCELLED', 'EXPIRED')`,
    [
      input.orgId,
      input.subscriptionId,
      input.membershipStatus || 'EXPIRED',
    ],
  )
  const byUser = new Map<string, string[]>()
  for (const row of affected.rows) {
    const bucket = byUser.get(row.user_id) || []
    bucket.push(row.course_id)
    byUser.set(row.user_id, bucket)
  }
  for (const [userId, courseIds] of byUser) {
    await reconcileEffectiveEnrollments(client, {
      orgId: input.orgId,
      userId,
      courseIds,
    })
  }
}
