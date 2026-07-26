'use server'

/**
 * Checkout digital portal member. Order, kupon, atribusi, item, dan akses gratis
 * disimpan dalam satu transaksi; pembayaran berbayar diteruskan ke provider.
 */
import { createHash, randomBytes } from 'node:crypto'
import { headers } from 'next/headers'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { connectPostgresClient, queryPostgres } from '@/lib/db/postgres'
import { createCommercePaymentIntent } from '@/modules/ecommerce/payments/payment-orchestration.server'
import { finalizeFreeCommerceOrder } from '@/modules/ecommerce/payments/commerce-payment.service'
import {
  enqueueCheckoutAccountClaim,
  ensureCheckoutIdentity,
  normalizeCheckoutEmail,
  normalizeCheckoutPhone,
} from '@/modules/ecommerce/lib/checkout-identity.server'
import {
  snapshotOrderEntitlements,
} from '@/modules/ecommerce/payments/entitlement.service'
import type { PoolClient } from 'pg'

export type MemberCheckoutCourseBenefit = {
  courseId: string
  slug: string
  title: string
  durationLabel: string
  sourceKind: 'DIRECT' | 'PACKAGE' | 'MIXED'
}

export type MemberCheckoutOffering = {
  storeProductId: string
  storeSlug: string
  productName: string
  productDescription: string | null
  price: number
  comparePrice: number | null
  productType: string
  courseTitles: string[]
  courseBenefits: MemberCheckoutCourseBenefit[]
  courseCount: number
  billingLabel: string | null
  allowGuestCheckout: boolean
}

export type MemberCheckoutState = {
  error?: string
  success?: boolean
  orderId?: string
  orderNumber?: string
  orderAccessUrl?: string
  paymentUrl?: string | null
  paymentInstructions?: Record<string, unknown>
  accountClaimRequired?: boolean
}

function cleanText(value: FormDataEntryValue | null, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function appBaseUrl() {
  const configured = String(process.env.NEXT_PUBLIC_APP_URL || '').trim()
  return configured ? configured.replace(/\/+$/, '') : 'https://member.coreisec.id'
}

function durationLabel(value: number | null, unit: string | null) {
  if (value == null || !unit) return 'Akses permanen'
  const labels: Record<string, string> = {
    HOUR: 'jam',
    DAY: 'hari',
    WEEK: 'minggu',
    MONTH: 'bulan',
    YEAR: 'tahun',
  }
  return `${value} ${labels[unit.toUpperCase().replace(/S$/, '')] || unit.toLowerCase()}`
}

async function enforceGuestCheckoutRateLimit(
  client: PoolClient,
  input: {
    orgId: string
    storeId: string
    email: string
    ipAddress: string
    requestKey: string
  },
) {
  const scopeKey = createHash('sha256')
    .update(`${input.email}:${input.ipAddress}`)
    .digest('hex')
  const count = await client.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count
     FROM public.ecommerce_public_request_logs
     WHERE action_type = 'MEMBER_GUEST_CHECKOUT'
       AND scope_key = $1
       AND created_at >= NOW() - INTERVAL '10 minutes'`,
    [scopeKey],
  )
  if (Number(count.rows[0]?.count || 0) >= 12) {
    throw new Error('Terlalu banyak percobaan checkout. Coba lagi beberapa menit.')
  }
  await client.query(
    `INSERT INTO public.ecommerce_public_request_logs (
       org_id, store_id, action_type, scope_key, ip_address, request_key
     ) VALUES ($1::uuid, $2::uuid, 'MEMBER_GUEST_CHECKOUT', $3, $4, $5)`,
    [
      input.orgId,
      input.storeId,
      scopeKey,
      input.ipAddress || null,
      input.requestKey,
    ],
  )
}

export async function getMemberCheckoutOfferings(
  orgSlug: string,
  filters: { courseSlug?: string; storeProductId?: string },
): Promise<MemberCheckoutOffering[]> {
  const result = await queryPostgres<{
    store_product_id: string
    store_slug: string
    product_name: string
    product_description: string | null
    price: number
    compare_price: number | null
    product_type: string
    billing_label: string | null
    allow_guest_checkout: boolean
    course_benefits: Array<{
      courseId: string
      slug: string
      title: string
      durationValue: number | null
      durationUnit: string | null
      sourceKind: 'DIRECT' | 'PACKAGE' | 'MIXED'
    }>
  }>(
    `WITH benefit_candidates AS (
       SELECT
         product_course.org_id,
         product_course.store_product_id,
         course.id AS course_id,
         course.slug,
         course.title,
         COALESCE(
           product_course.access_duration_value,
           course.access_duration_value
         ) AS duration_value,
         COALESCE(
           product_course.access_duration_unit,
           course.access_duration_unit
         ) AS duration_unit,
         'DIRECT'::text AS source_kind
       FROM public.commerce_product_courses product_course
       JOIN public.learning_courses course
         ON course.org_id = product_course.org_id
        AND course.id = product_course.course_id

       UNION ALL

       SELECT
         product_package.org_id,
         product_package.store_product_id,
         course.id AS course_id,
         course.slug,
         course.title,
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
         'PACKAGE'::text AS source_kind
       FROM public.commerce_product_access_packages product_package
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
     ),
     resolved_benefits AS (
       SELECT
         candidate.org_id,
         candidate.store_product_id,
         candidate.course_id,
         MIN(candidate.slug) AS slug,
         MIN(candidate.title) AS title,
         (
           ARRAY_AGG(
             candidate.duration_value
             ORDER BY
               (candidate.duration_value IS NULL) DESC,
               candidate.duration_value DESC NULLS FIRST
           )
         )[1] AS duration_value,
         (
           ARRAY_AGG(
             candidate.duration_unit
             ORDER BY
               (candidate.duration_value IS NULL) DESC,
               candidate.duration_value DESC NULLS FIRST
           )
         )[1] AS duration_unit,
         CASE
           WHEN BOOL_OR(candidate.source_kind = 'DIRECT')
             AND BOOL_OR(candidate.source_kind = 'PACKAGE') THEN 'MIXED'
           WHEN BOOL_OR(candidate.source_kind = 'PACKAGE') THEN 'PACKAGE'
           ELSE 'DIRECT'
         END AS source_kind
       FROM benefit_candidates candidate
       GROUP BY candidate.org_id, candidate.store_product_id, candidate.course_id
     )
     SELECT
       store_product.id::text AS store_product_id,
       store.slug AS store_slug,
       store_product.public_name AS product_name,
       store_product.public_description AS product_description,
       COALESCE(
         CASE
           WHEN subscription_plan.id IS NOT NULL
             THEN subscription_plan.signup_fee
               + CASE WHEN subscription_plan.trial_days > 0 THEN 0 ELSE subscription_plan.price END
           ELSE NULL
         END,
         store_product.price_override,
         product.selling_price
       )::float8 AS price,
       store_product.compare_price::float8,
       store_product.product_type,
       CASE
         WHEN subscription_plan.id IS NULL THEN NULL
         ELSE subscription_plan.billing_interval_count::text || ' '
           || subscription_plan.billing_interval
       END AS billing_label,
       COALESCE(store_setting.allow_member_guest_checkout, FALSE) AS allow_guest_checkout,
       COALESCE(benefit_list.course_benefits, '[]'::jsonb) AS course_benefits
     FROM public.organizations organization
     JOIN public.stores store
       ON store.org_id = organization.id
      AND store.is_active = TRUE
      AND store.is_published = TRUE
     JOIN public.store_products store_product
       ON store_product.org_id = organization.id
      AND store_product.store_id = store.id
      AND store_product.is_published = TRUE
     JOIN public.products product
       ON product.id = store_product.product_id
      AND product.org_id = organization.id
      AND product.is_active = TRUE
     LEFT JOIN public.store_settings store_setting
       ON store_setting.org_id = store.org_id
      AND store_setting.store_id = store.id
     LEFT JOIN LATERAL (
       SELECT plan.*
       FROM public.commerce_subscription_plans plan
       WHERE plan.org_id = store_product.org_id
         AND plan.store_product_id = store_product.id
         AND plan.is_active = TRUE
       ORDER BY plan.created_at
       LIMIT 1
     ) subscription_plan ON TRUE
     LEFT JOIN LATERAL (
       SELECT JSONB_AGG(
         JSONB_BUILD_OBJECT(
           'courseId', benefit.course_id,
           'slug', benefit.slug,
           'title', benefit.title,
           'durationValue', benefit.duration_value,
           'durationUnit', benefit.duration_unit,
           'sourceKind', benefit.source_kind
         )
         ORDER BY benefit.title
       ) AS course_benefits
       FROM resolved_benefits benefit
       WHERE benefit.org_id = store_product.org_id
         AND benefit.store_product_id = store_product.id
     ) benefit_list ON TRUE
     WHERE organization.slug = $1
       AND organization.is_active = TRUE
       AND (
         $2::text IS NULL
         OR EXISTS (
           SELECT 1
           FROM resolved_benefits filter_benefit
           WHERE filter_benefit.org_id = store_product.org_id
             AND filter_benefit.store_product_id = store_product.id
             AND filter_benefit.slug = $2
         )
       )
       AND ($3::uuid IS NULL OR store_product.id = $3::uuid)
       AND (store_product.sale_starts_at IS NULL OR store_product.sale_starts_at <= NOW())
       AND (store_product.sale_ends_at IS NULL OR store_product.sale_ends_at > NOW())
     ORDER BY store_product.is_featured DESC, price, store_product.created_at`,
    [
      orgSlug,
      filters.courseSlug || null,
      filters.storeProductId || null,
    ],
  )
  return result.rows.map((row) => {
    const courseBenefits = (row.course_benefits || []).map((benefit) => ({
      courseId: benefit.courseId,
      slug: benefit.slug,
      title: benefit.title,
      durationLabel: durationLabel(benefit.durationValue, benefit.durationUnit),
      sourceKind: benefit.sourceKind,
    }))
    return {
      storeProductId: row.store_product_id,
      storeSlug: row.store_slug,
      productName: row.product_name,
      productDescription: row.product_description,
      price: Number(row.price || 0),
      comparePrice: row.compare_price == null ? null : Number(row.compare_price),
      productType: row.product_type,
      courseTitles: courseBenefits.map((benefit) => benefit.title),
      courseBenefits,
      courseCount: courseBenefits.length,
      billingLabel: row.billing_label,
      allowGuestCheckout: row.allow_guest_checkout,
    }
  })
}

export async function createMemberCheckout(
  _previousState: MemberCheckoutState,
  formData: FormData,
): Promise<MemberCheckoutState> {
  const session = await getInternalAuthSession()
  const orgSlug = cleanText(formData.get('orgSlug'), 120)
  const storeProductId = cleanText(formData.get('storeProductId'), 60)
  const providerCode = cleanText(formData.get('providerCode'), 20).toUpperCase()
  const couponCode = cleanText(formData.get('couponCode'), 80).toUpperCase()
  const referralCode = cleanText(formData.get('referralCode'), 80)
  const idempotencyKey = cleanText(formData.get('idempotencyKey'), 120)
  const guestName = cleanText(formData.get('fullName'), 160)
  const guestEmail = normalizeCheckoutEmail(cleanText(formData.get('email'), 200))
  const guestPhone = normalizeCheckoutPhone(cleanText(formData.get('phone'), 40))
  if (!orgSlug || !storeProductId || !idempotencyKey) {
    return { error: 'Data checkout belum lengkap.' }
  }
  if (!['MANUAL', 'MOOTA', 'DUITKU'].includes(providerCode)) {
    return { error: 'Metode pembayaran tidak didukung.' }
  }
  if (!session?.user && (!guestName || !guestEmail || guestPhone.length < 8)) {
    return { error: 'Nama, email yang valid, dan nomor WhatsApp wajib diisi.' }
  }
  const requestHeaders = await headers()
  const requestIp = String(
    requestHeaders.get('x-forwarded-for')
      || requestHeaders.get('x-real-ip')
      || '',
  ).split(',')[0]?.trim().slice(0, 120) || ''

  const client = await connectPostgresClient()
  let createdOrder: {
    id: string
    orgId: string
    orderNumber: string
    storeSlug: string
    total: number
    accessToken: string
    accountClaimRequired: boolean
  } | null = null

  try {
    await client.query('BEGIN')
    const checkoutConfig = await client.query<{
      org_id: string
      store_id: string
      allow_guest_checkout: boolean
    }>(
      `SELECT
         organization.id::text AS org_id,
         store_product.store_id::text,
         COALESCE(store_setting.allow_member_guest_checkout, FALSE) AS allow_guest_checkout
       FROM public.organizations organization
       JOIN public.store_products store_product
         ON store_product.org_id = organization.id
        AND store_product.id = $2::uuid
       JOIN public.stores store
         ON store.id = store_product.store_id
        AND store.org_id = organization.id
        AND store.is_active = TRUE
        AND store.is_published = TRUE
       LEFT JOIN public.store_settings store_setting
         ON store_setting.org_id = store.org_id
        AND store_setting.store_id = store.id
       WHERE organization.slug = $1
         AND organization.is_active = TRUE
       LIMIT 1`,
      [orgSlug, storeProductId],
    )
    const config = checkoutConfig.rows[0]
    if (!config) throw new Error('Paket checkout tidak ditemukan.')

    const checkoutUser = session?.user
      ? {
          userId: session.user.id,
          internalUserId: String(session.user.user_metadata.internal_user_id || ''),
          email: session.user.email || '',
          name: String(
            session.user.user_metadata.full_name
              || session.user.email
              || 'Member',
          ),
          phone: String(session.user.user_metadata.phone || '-'),
          created: false,
        }
      : await (async () => {
          if (!config.allow_guest_checkout) {
            throw new Error('Checkout tamu belum dibuka. Silakan masuk terlebih dahulu.')
          }
          await enforceGuestCheckoutRateLimit(client, {
            orgId: config.org_id,
            storeId: config.store_id,
            email: guestEmail,
            ipAddress: requestIp,
            requestKey: idempotencyKey,
          })
          return ensureCheckoutIdentity(client, {
            orgId: config.org_id,
            fullName: guestName,
            email: guestEmail,
            phone: guestPhone,
          })
        })()

    const existing = await client.query<{
      id: string
      org_id: string
      order_number: string
      store_slug: string
      grand_total: number
      public_access_token: string
    }>(
      `SELECT
         ecommerce_order.id::text,
         ecommerce_order.org_id::text,
         ecommerce_order.order_number,
         store.slug AS store_slug,
         ecommerce_order.grand_total::float8,
         ecommerce_order.public_access_token
       FROM public.ecommerce_orders ecommerce_order
       JOIN public.stores store ON store.id = ecommerce_order.store_id
       JOIN public.organizations organization ON organization.id = ecommerce_order.org_id
       WHERE organization.slug = $1
         AND ecommerce_order.user_id = $2::uuid
         AND ecommerce_order.idempotency_key = $3
       LIMIT 1
       FOR UPDATE OF ecommerce_order`,
      [orgSlug, checkoutUser.userId, idempotencyKey],
    )
    if (existing.rows[0]) {
      const row = existing.rows[0]
      createdOrder = {
        id: row.id,
        orgId: row.org_id,
        orderNumber: row.order_number,
        storeSlug: row.store_slug,
        total: Number(row.grand_total),
        accessToken: row.public_access_token,
        accountClaimRequired: checkoutUser.created,
      }
      await client.query('COMMIT')
    } else {
      const offeringResult = await client.query<{
        org_id: string
        store_id: string
        store_slug: string
        branch_id: string
        warehouse_id: string
        product_id: string
        public_name: string
        public_slug: string
        product_type: string
        quantity_enabled: boolean
        purchase_limit_per_user: number | null
        unit_price: number
        compare_price: number
        sku: string | null
      }>(
        `SELECT
           organization.id::text AS org_id,
           store.id::text AS store_id,
           store.slug AS store_slug,
           store.branch_id::text,
           store.warehouse_id::text,
           product.id::text AS product_id,
           store_product.public_name,
           store_product.public_slug,
           store_product.product_type,
           store_product.quantity_enabled,
           store_product.purchase_limit_per_user,
           COALESCE(
             CASE
               WHEN subscription_plan.id IS NOT NULL
                 THEN subscription_plan.signup_fee
                   + CASE WHEN subscription_plan.trial_days > 0 THEN 0 ELSE subscription_plan.price END
               ELSE NULL
             END,
             store_product.price_override,
             product.selling_price
           )::float8 AS unit_price,
           COALESCE(store_product.compare_price, store_product.price_override, product.selling_price)::float8 AS compare_price,
           product.sku
         FROM public.organizations organization
         JOIN public.stores store
           ON store.org_id = organization.id
          AND store.is_active = TRUE
          AND store.is_published = TRUE
         JOIN public.store_products store_product
           ON store_product.store_id = store.id
          AND store_product.org_id = organization.id
         JOIN public.products product
           ON product.id = store_product.product_id
           AND product.org_id = organization.id
         LEFT JOIN LATERAL (
           SELECT plan.*
           FROM public.commerce_subscription_plans plan
           WHERE plan.org_id = store_product.org_id
             AND plan.store_product_id = store_product.id
             AND plan.is_active = TRUE
           ORDER BY plan.created_at
           LIMIT 1
         ) subscription_plan ON TRUE
         WHERE organization.slug = $1
           AND organization.is_active = TRUE
           AND store_product.id = $2::uuid
           AND store_product.is_published = TRUE
           AND product.is_active = TRUE
           AND (store_product.sale_starts_at IS NULL OR store_product.sale_starts_at <= NOW())
           AND (store_product.sale_ends_at IS NULL OR store_product.sale_ends_at > NOW())
         LIMIT 1
         FOR UPDATE OF store_product`,
        [orgSlug, storeProductId],
      )
      const offering = offeringResult.rows[0]
      if (!offering) throw new Error('Paket tidak ditemukan atau masa penjualannya sudah berakhir.')

      if (offering.purchase_limit_per_user && offering.purchase_limit_per_user > 0) {
        const purchaseCount = await client.query<{ count: number }>(
          `SELECT COUNT(*)::int AS count
           FROM public.ecommerce_order_items item
           JOIN public.ecommerce_orders ecommerce_order
             ON ecommerce_order.id = item.order_id
            AND ecommerce_order.org_id = item.org_id
           WHERE item.org_id = $1::uuid
             AND ecommerce_order.user_id = $2::uuid
             AND item.product_id = $3::uuid
             AND ecommerce_order.status NOT IN ('CANCELLED', 'REFUNDED')`,
          [offering.org_id, checkoutUser.userId, offering.product_id],
        )
        if (Number(purchaseCount.rows[0]?.count || 0) >= offering.purchase_limit_per_user) {
          throw new Error('Batas pembelian paket ini sudah tercapai.')
        }
      }

      let discountAmount = 0
      let couponId: string | null = null
      if (couponCode) {
        const couponResult = await client.query<{
          id: string
          discount_type: string
          discount_value: number
          minimum_amount: number
          usage_limit: number | null
          per_user_limit: number
          allowed: boolean
          total_usage: number
          user_usage: number
        }>(
          `SELECT
             coupon.id::text,
             coupon.discount_type,
             coupon.discount_value::float8,
             coupon.minimum_amount::float8,
             coupon.usage_limit,
             coupon.per_user_limit,
             (
               CARDINALITY(coupon.allowed_store_product_ids) = 0
               OR $3::uuid = ANY(coupon.allowed_store_product_ids)
             ) AS allowed,
             (
               SELECT COUNT(*)::int
               FROM public.commerce_coupon_redemptions redemption
               WHERE redemption.coupon_id = coupon.id
             ) AS total_usage,
             (
               SELECT COUNT(*)::int
               FROM public.commerce_coupon_redemptions redemption
               WHERE redemption.coupon_id = coupon.id
                 AND (
                   redemption.user_id = $2::uuid
                   OR (
                     $4::text IS NOT NULL
                     AND redemption.email_normalized = lower($4)
                   )
                 )
             ) AS user_usage
           FROM public.commerce_coupons coupon
           WHERE coupon.org_id = $1::uuid
             AND upper(coupon.code) = $5
             AND coupon.is_active = TRUE
             AND (coupon.starts_at IS NULL OR coupon.starts_at <= NOW())
             AND (coupon.expires_at IS NULL OR coupon.expires_at > NOW())
           LIMIT 1
           FOR UPDATE`,
          [
            offering.org_id,
            checkoutUser.userId,
            storeProductId,
            checkoutUser.email,
            couponCode,
          ],
        )
        const coupon = couponResult.rows[0]
        if (!coupon) throw new Error('Kupon tidak ditemukan atau sudah tidak berlaku.')
        if (!coupon.allowed) throw new Error('Kupon tidak berlaku untuk paket ini.')
        if (offering.unit_price < Number(coupon.minimum_amount)) {
          throw new Error('Nilai belanja belum memenuhi minimum kupon.')
        }
        if (coupon.usage_limit != null && coupon.total_usage >= coupon.usage_limit) {
          throw new Error('Kuota kupon sudah habis.')
        }
        if (coupon.user_usage >= coupon.per_user_limit) {
          throw new Error('Batas penggunaan kupon untuk akun ini sudah tercapai.')
        }
        couponId = coupon.id
        discountAmount = coupon.discount_type === 'PERCENT'
          ? Math.min(offering.unit_price, offering.unit_price * Number(coupon.discount_value) / 100)
          : Math.min(offering.unit_price, Number(coupon.discount_value))
      }

      let affiliateProfileId: string | null = null
      if (referralCode) {
        const affiliate = await client.query<{ id: string; user_id: string }>(
          `SELECT id::text, user_id::text
           FROM public.commerce_affiliate_profiles
           WHERE org_id = $1::uuid
             AND lower(referral_code) = lower($2)
             AND status = 'ACTIVE'
           LIMIT 1`,
          [offering.org_id, referralCode],
        )
        if (affiliate.rows[0]?.user_id === checkoutUser.userId) {
          throw new Error('Kode afiliasi sendiri tidak dapat digunakan.')
        }
        affiliateProfileId = affiliate.rows[0]?.id || null
      }

      const total = Math.max(0, offering.unit_price - discountAmount)
      const accessToken = randomBytes(32).toString('base64url')
      const order = await client.query<{ id: string; order_number: string }>(
        `INSERT INTO public.ecommerce_orders (
           org_id, store_id, branch_id, warehouse_id, user_id,
           customer_name, customer_email, customer_phone, order_number,
           currency, status, payment_status, subtotal_amount, discount_amount,
           shipping_amount, tax_amount, gateway_fee_amount, grand_total,
           coupon_id, attribution, cart_snapshot, pricing_snapshot,
           payment_due_at, public_access_token, public_access_token_expires_at,
           checkout_idempotency_key, idempotency_key
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6, $7, $8, '',
           'IDR', $9::public.ecommerce_order_status,
           $10::public.ecommerce_payment_status, $11, $12, 0, 0, 0, $13,
           $14::uuid, $15::jsonb, $16::jsonb, $17::jsonb,
           NOW() + INTERVAL '24 hours', $18, NOW() + INTERVAL '30 days',
           $19, $19
         )
         RETURNING id::text, order_number`,
        [
          offering.org_id,
          offering.store_id,
          offering.branch_id,
          offering.warehouse_id,
          checkoutUser.userId,
          checkoutUser.name,
          checkoutUser.email,
          checkoutUser.phone,
          total === 0 ? 'COMPLETED' : 'AWAITING_PAYMENT',
          total === 0 ? 'VALIDATED' : 'PENDING_UPLOAD',
          offering.unit_price,
          discountAmount,
          total,
          couponId,
          JSON.stringify({
            referralCode: referralCode || null,
            affiliateProfileId,
            source: 'MEMBER_PORTAL',
          }),
          JSON.stringify({ itemCount: 1, storeProductId }),
          JSON.stringify({
            subtotal: offering.unit_price,
            discount: discountAmount,
            total,
            couponCode: couponCode || null,
          }),
          accessToken,
          idempotencyKey,
        ],
      )
      const orderId = order.rows[0].id
      await client.query(
        `INSERT INTO public.ecommerce_order_items (
           org_id, order_id, store_id, product_id, inventory_product_id,
           product_name, sku, slug, quantity, unit_price, compare_price,
           line_subtotal, line_total, attributes
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, $4::uuid, $4::uuid,
           $5, $6, $7, 1, $8, $9, $8, $10, '[]'::jsonb
         )`,
        [
          offering.org_id,
          orderId,
          offering.store_id,
          offering.product_id,
          offering.public_name,
          offering.sku,
          offering.public_slug,
          offering.unit_price,
          offering.compare_price,
          total,
        ],
      )
      await snapshotOrderEntitlements(client, {
        orgId: offering.org_id,
        orderId,
      })
      if (couponId) {
        await client.query(
          `INSERT INTO public.commerce_coupon_redemptions (
             org_id, coupon_id, order_id, user_id, email_normalized,
             discount_amount, idempotency_key
           ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, lower($5), $6, $7)`,
          [
            offering.org_id,
            couponId,
            orderId,
            checkoutUser.userId,
            checkoutUser.email,
            discountAmount,
            `coupon:${orderId}`,
          ],
        )
      }
      if (total === 0) {
        await finalizeFreeCommerceOrder(client, {
          orgId: offering.org_id,
          orderId,
        })
      } else {
        await client.query(
          `INSERT INTO public.ecommerce_order_payments (
             org_id, order_id, status, method, provider_code, idempotency_key
           ) VALUES (
             $1::uuid, $2::uuid, 'PENDING_UPLOAD', $3, $3, $4
           )`,
          [offering.org_id, orderId, providerCode, `payment-shell:${orderId}`],
        )
      }
      await enqueueCheckoutAccountClaim(client, {
        orgId: offering.org_id,
        orgSlug,
        orderId,
        orderNumber: order.rows[0].order_number,
        identity: checkoutUser,
      })
      await client.query(
        `INSERT INTO public.ecommerce_order_events (
           org_id, order_id, actor_user_id, actor_label, event_type, message, payload
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, 'MEMBER_PORTAL', 'ORDER_CREATED',
           'Order dibuat dari portal member.', $4::jsonb
         )`,
        [
          offering.org_id,
          orderId,
          checkoutUser.userId,
          JSON.stringify({ providerCode, couponCode: couponCode || null }),
        ],
      )
      await client.query('COMMIT')
      createdOrder = {
        id: orderId,
        orgId: offering.org_id,
        orderNumber: order.rows[0].order_number,
        storeSlug: offering.store_slug,
        total,
        accessToken,
        accountClaimRequired: checkoutUser.created,
      }
    }

    if (!createdOrder) throw new Error('Order tidak dapat dibuat.')
    const orderAccessUrl = `/toko/${orgSlug}/${createdOrder.storeSlug}/pesanan/${createdOrder.orderNumber}?token=${encodeURIComponent(createdOrder.accessToken)}`
    if (createdOrder.total === 0) {
      return {
        success: true,
        orderId: createdOrder.id,
        orderNumber: createdOrder.orderNumber,
        orderAccessUrl,
        accountClaimRequired: createdOrder.accountClaimRequired,
      }
    }

    const baseUrl = appBaseUrl()
    const intent = await createCommercePaymentIntent({
      orgId: createdOrder.orgId,
      orderId: createdOrder.id,
      providerCode,
      returnUrl: `${baseUrl}${orderAccessUrl}`,
      callbackUrl: `${baseUrl}/api/payments/duitku/webhook`,
      idempotencyKey: `checkout:${createdOrder.id}:${providerCode}`,
    })
    const responsePayload = intent.response_payload
      && typeof intent.response_payload === 'object'
      ? intent.response_payload as Record<string, unknown>
      : {}
    return {
      success: true,
      orderId: createdOrder.id,
      orderNumber: createdOrder.orderNumber,
      orderAccessUrl,
      paymentUrl: intent.checkout_url,
      accountClaimRequired: createdOrder.accountClaimRequired,
      paymentInstructions: (
        responsePayload.instructions
        && typeof responsePayload.instructions === 'object'
      )
        ? responsePayload.instructions as Record<string, unknown>
        : {},
    }
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {
      // Transaksi mungkin sudah selesai.
    }
    return {
      error: error instanceof Error ? error.message : 'Checkout gagal diproses.',
    }
  } finally {
    client.release()
  }
}
