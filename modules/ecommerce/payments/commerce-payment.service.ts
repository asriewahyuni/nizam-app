/**
 * Orkestrasi atomik pembayaran commerce ke invoice, kas/bank, jurnal, akses
 * belajar, komisi, dan notifikasi. Provider tidak boleh mengubah order langsung.
 */
import 'server-only'

import type { PoolClient } from 'pg'
import { connectPostgresClient } from '@/lib/db/postgres'
import { activateOrderSubscriptions } from './subscription.service'
import { provisionOrderEntitlements } from './entitlement.service'
import { activateConsultingOrder } from '@/modules/consulting/lib/consulting.server'
import { enqueueNotification } from '@/modules/notifications/outbox.server'

function formatRupiah(amount: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount)
}

function memberPortalUrl(orgSlug: string, path: 'kelas' | 'afiliasi' = 'kelas') {
  const base = String(process.env.NEXT_PUBLIC_APP_URL || 'https://member.coreisec.id').replace(/\/+$/, '')
  return `${base}/member/${orgSlug}/${path}`
}

type PaidOrderRow = {
  id: string
  org_id: string
  branch_id: string
  warehouse_id: string
  store_id: string
  order_number: string
  user_id: string | null
  customer_name: string
  customer_email: string | null
  customer_phone: string
  status: string
  grand_total: number
  subtotal_amount: number
  discount_amount: number
  tax_amount: number
  gateway_fee_amount: number
  attribution: Record<string, unknown>
  erp_sale_id: string | null
}

type AccountSettingsRow = {
  bank_account_id: string
  cash_account_id: string
  revenue_account_id: string
  tax_payable_account_id: string | null
  discount_account_id: string | null
  gateway_fee_account_id: string | null
  affiliate_commission_expense_account_id: string | null
  affiliate_commission_payable_account_id: string | null
}

type CourseGrantRow = {
  course_id: string
  duration_value: number | null
  duration_unit: string | null
  subscription_id: string | null
  subscription_expires_at: string | null
}

async function reservePhysicalOrderItems(
  client: PoolClient,
  order: PaidOrderRow,
  saleId: string,
) {
  const items = await client.query<{
    order_item_id: string
    product_id: string
    variant_id: string | null
    quantity: number
    product_name: string
  }>(
    `SELECT
       item.id::text AS order_item_id,
       item.inventory_product_id::text AS product_id,
       item.variant_id::text,
       item.quantity::float8,
       item.product_name
     FROM public.ecommerce_order_items item
     JOIN public.store_products store_product
       ON store_product.org_id = item.org_id
      AND store_product.store_id = item.store_id
      AND store_product.product_id = item.product_id
     WHERE item.org_id = $1::uuid
       AND item.order_id = $2::uuid
       AND store_product.product_type = 'PHYSICAL'
     ORDER BY item.id`,
    [order.org_id, order.id],
  )

  for (const item of items.rows) {
    await client.query(
      `SELECT pg_advisory_xact_lock(
         hashtextextended($1 || ':' || $2 || ':' || $3, 0)
       )`,
      [order.org_id, order.warehouse_id, item.product_id],
    )
    await client.query(
      `SELECT id
       FROM public.inventory_stocks
       WHERE org_id = $1::uuid
         AND warehouse_id = $2::uuid
         AND product_id = $3::uuid
       FOR UPDATE`,
      [order.org_id, order.warehouse_id, item.product_id],
    )
    const stockResult = await client.query<{ available: number }>(
      `SELECT
         COALESCE(SUM(stock.quantity), 0)::float8
         - COALESCE((
           SELECT SUM(reservation.quantity)
           FROM public.ecommerce_inventory_reservations reservation
           WHERE reservation.org_id = $1::uuid
             AND reservation.warehouse_id = $2::uuid
             AND reservation.product_id = $3::uuid
             AND reservation.status = 'ACTIVE'
             AND reservation.order_id <> $4::uuid
         ), 0)::float8 AS available
       FROM public.inventory_stocks stock
       WHERE stock.org_id = $1::uuid
         AND stock.warehouse_id = $2::uuid
         AND stock.product_id = $3::uuid`,
      [order.org_id, order.warehouse_id, item.product_id, order.id],
    )
    const available = Number(stockResult.rows[0]?.available || 0)
    if (available < item.quantity) {
      throw new Error(
        `Stok ${item.product_name} tidak cukup. Tersedia ${available}, dibutuhkan ${item.quantity}.`,
      )
    }

    await client.query(
      `INSERT INTO public.ecommerce_inventory_reservations (
         org_id, store_id, order_id, order_item_id, sale_id, warehouse_id,
         product_id, variant_id, quantity, status, note
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid,
         $7::uuid, $8::uuid, $9, 'ACTIVE', $10
       )
       ON CONFLICT (org_id, order_item_id) DO UPDATE
       SET
         sale_id = EXCLUDED.sale_id,
         status = CASE
           WHEN public.ecommerce_inventory_reservations.status = 'CONSUMED'
             THEN 'CONSUMED'::public.ecommerce_reservation_status
           ELSE 'ACTIVE'::public.ecommerce_reservation_status
         END,
         note = EXCLUDED.note,
         updated_at = NOW()`,
      [
        order.org_id,
        order.store_id,
        order.id,
        item.order_item_id,
        saleId,
        order.warehouse_id,
        item.product_id,
        item.variant_id,
        item.quantity,
        `Reservasi stok pembayaran ${order.order_number}`,
      ],
    )
  }
}

export type FinalizePaidOrderInput = {
  orgId: string
  orderId: string
  paymentIntentId: string
  providerCode: string
  providerReference: string
  providerEventId: string
  paidAmount: number
  gatewayFeeAmount?: number
  idempotencyKey: string
  rawProviderPayload?: Record<string, unknown>
}

export type FinalizePaidOrderResult = {
  orderId: string
  saleId: string
  paymentId: string
  journalEntryId: string
  bankTransactionId: string
  accessGrantIds: string[]
  commissionIds: string[]
  orderStatus: 'READY_TO_FULFILL' | 'COMPLETED'
  alreadyProcessed?: boolean
}

export type FinalizeFreeOrderResult = {
  orderId: string
  saleId: string
  paymentId: string
  journalEntryId: string | null
  accessGrantIds: string[]
  orderStatus: 'READY_TO_FULFILL' | 'COMPLETED'
}

function addDuration(
  startsAt: Date,
  value: number | null,
  unit: string | null,
) {
  if (!value || value <= 0 || !unit) return null
  const result = new Date(startsAt)
  const normalized = unit.toUpperCase()
  if (normalized.startsWith('HOUR')) result.setUTCHours(result.getUTCHours() + value)
  else if (normalized.startsWith('DAY')) result.setUTCDate(result.getUTCDate() + value)
  else if (normalized.startsWith('WEEK')) result.setUTCDate(result.getUTCDate() + value * 7)
  else if (normalized.startsWith('MONTH')) result.setUTCMonth(result.getUTCMonth() + value)
  else if (normalized.startsWith('YEAR')) result.setUTCFullYear(result.getUTCFullYear() + value)
  else return null
  return result.toISOString()
}

function assertMoneyEqual(expected: number, actual: number) {
  if (!Number.isFinite(actual) || Math.abs(expected - actual) > 0.01) {
    throw new Error(`Nominal pembayaran tidak cocok. Tagihan ${expected}, diterima ${actual}.`)
  }
}

async function createOrGetCustomer(client: PoolClient, order: PaidOrderRow) {
  if (order.customer_email) {
    const existing = await client.query<{ id: string }>(
      `SELECT id::text
       FROM public.contacts
       WHERE org_id = $1::uuid
         AND lower(email) = lower($2)
       ORDER BY created_at
       LIMIT 1`,
      [order.org_id, order.customer_email],
    )
    if (existing.rows[0]) return existing.rows[0].id
  }

  const created = await client.query<{ id: string }>(
    `INSERT INTO public.contacts (
       org_id, name, type, email, phone, is_active
     )
     VALUES ($1::uuid, $2, 'CUSTOMER', $3, $4, TRUE)
     RETURNING id::text`,
    [order.org_id, order.customer_name, order.customer_email, order.customer_phone],
  )
  return created.rows[0].id
}

async function createOrGetSale(
  client: PoolClient,
  order: PaidOrderRow,
  customerId: string,
) {
  const existing = await client.query<{ id: string }>(
    `SELECT id::text
     FROM public.sales
     WHERE org_id = $1::uuid
       AND reference_type = 'ECOMMERCE_ORDER'
       AND reference_id = $2::uuid
     LIMIT 1`,
    [order.org_id, order.id],
  )
  if (existing.rows[0]) return existing.rows[0].id

  const saleResult = await client.query<{ id: string }>(
    `INSERT INTO public.sales (
       org_id,
       branch_id,
       sale_number,
       sale_date,
       customer_id,
       total_amount,
       tax_amount,
       discount_amount,
       grand_total,
       status,
       payment_status,
       due_date,
       notes,
       reference_type,
       reference_id
     )
     VALUES (
       $1::uuid, $2::uuid, '', CURRENT_DATE, $3::uuid,
       $4, $5, $6, $7, 'DRAFT', 'PAID', CURRENT_DATE,
       $8, 'ECOMMERCE_ORDER', $9::uuid
     )
     RETURNING id::text`,
    [
      order.org_id,
      order.branch_id,
      customerId,
      order.subtotal_amount,
      order.tax_amount,
      order.discount_amount,
      order.grand_total,
      `Dibuat otomatis dari order ${order.order_number}`,
      order.id,
    ],
  )
  const saleId = saleResult.rows[0].id

  await client.query(
    `INSERT INTO public.sales_items (
       org_id,
       branch_id,
       sale_id,
       product_id,
       ecommerce_order_item_id,
       description,
       quantity,
       unit_price,
       discount_amount,
       tax_amount
     )
     SELECT
       item.org_id,
       $2::uuid,
       $3::uuid,
       item.inventory_product_id,
       item.id,
       item.product_name || COALESCE(' - ' || NULLIF(item.variant_name, ''), ''),
       item.quantity,
       item.unit_price,
       GREATEST(item.line_subtotal - item.line_total, 0),
       0
     FROM public.ecommerce_order_items item
     WHERE item.org_id = $1::uuid
       AND item.order_id = $4::uuid
     ON CONFLICT (org_id, ecommerce_order_item_id)
       WHERE ecommerce_order_item_id IS NOT NULL
     DO NOTHING`,
    [order.org_id, order.branch_id, saleId, order.id],
  )

  return saleId
}

async function createCommerceJournal(
  client: PoolClient,
  order: PaidOrderRow,
  settings: AccountSettingsRow,
  feeAmount: number,
) {
  const existing = await client.query<{ id: string }>(
    `SELECT id::text
     FROM public.journal_entries
     WHERE org_id = $1::uuid
       AND reference_type = 'COMMERCE_PAYMENT'
       AND reference_id = $2::uuid
     LIMIT 1`,
    [order.org_id, order.id],
  )
  if (existing.rows[0]) return existing.rows[0].id

  const netCash = order.grand_total - feeAmount
  if (netCash < 0) throw new Error('Nilai kas bersih pembayaran tidak valid.')
  if (order.discount_amount > 0 && !settings.discount_account_id) {
    throw new Error('Akun diskon Cabang belum dikonfigurasi.')
  }
  if (feeAmount > 0 && !settings.gateway_fee_account_id) {
    throw new Error('Akun biaya gateway Cabang belum dikonfigurasi.')
  }
  if (order.tax_amount > 0 && !settings.tax_payable_account_id) {
    throw new Error('Akun pajak keluaran Cabang belum dikonfigurasi.')
  }

  const revenueAmount = order.grand_total + order.discount_amount - order.tax_amount
  if (revenueAmount < 0) throw new Error('Nilai pendapatan order tidak valid.')

  const numberResult = await client.query<{ entry_number: string }>(
    `SELECT public.generate_entry_number($1::uuid) AS entry_number`,
    [order.org_id],
  )
  const journalResult = await client.query<{ id: string }>(
    `INSERT INTO public.journal_entries (
       org_id,
       branch_id,
       entry_number,
       entry_date,
       description,
       reference_type,
       reference_id,
       status,
       is_auto
     )
     VALUES (
       $1::uuid, $2::uuid, $3, CURRENT_DATE, $4,
       'COMMERCE_PAYMENT', $5::uuid, 'DRAFT', TRUE
     )
     RETURNING id::text`,
    [
      order.org_id,
      order.branch_id,
      numberResult.rows[0].entry_number,
      `Pembayaran order ${order.order_number}`,
      order.id,
    ],
  )
  const journalId = journalResult.rows[0].id

  if (netCash > 0) {
    await client.query(
      `INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
       VALUES ($1::uuid, $2::uuid, $3, 0, $4)`,
      [journalId, settings.cash_account_id, netCash, `Kas bersih ${order.order_number}`],
    )
  }
  if (feeAmount > 0) {
    await client.query(
      `INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
       VALUES ($1::uuid, $2::uuid, $3, 0, $4)`,
      [journalId, settings.gateway_fee_account_id, feeAmount, `Biaya gateway ${order.order_number}`],
    )
  }
  if (order.discount_amount > 0) {
    await client.query(
      `INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
       VALUES ($1::uuid, $2::uuid, $3, 0, $4)`,
      [
        journalId,
        settings.discount_account_id,
        order.discount_amount,
        `Diskon order ${order.order_number}`,
      ],
    )
  }
  if (revenueAmount > 0) {
    await client.query(
      `INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
       VALUES ($1::uuid, $2::uuid, 0, $3, $4)`,
      [journalId, settings.revenue_account_id, revenueAmount, `Pendapatan ${order.order_number}`],
    )
  }
  if (order.tax_amount > 0) {
    await client.query(
      `INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
       VALUES ($1::uuid, $2::uuid, 0, $3, $4)`,
      [
        journalId,
        settings.tax_payable_account_id,
        order.tax_amount,
        `Pajak order ${order.order_number}`,
      ],
    )
  }

  await client.query(
    `UPDATE public.journal_entries
     SET status = 'POSTED', updated_at = NOW()
     WHERE id = $1::uuid`,
    [journalId],
  )
  return journalId
}

async function grantPurchasedCourses(
  client: PoolClient,
  order: PaidOrderRow,
) {
  if (!order.user_id) {
    const courseCount = await client.query<{ count: number }>(
      `SELECT COUNT(DISTINCT course_id)::int AS count
       FROM (
         SELECT product_course.course_id
         FROM public.ecommerce_order_items item
         JOIN public.store_products store_product
           ON store_product.org_id = item.org_id
          AND store_product.store_id = item.store_id
          AND store_product.product_id = item.product_id
         JOIN public.commerce_product_courses product_course
           ON product_course.org_id = store_product.org_id
          AND product_course.store_product_id = store_product.id
         WHERE item.org_id = $1::uuid AND item.order_id = $2::uuid
         UNION
         SELECT package_course.course_id
         FROM public.ecommerce_order_items item
         JOIN public.store_products store_product
           ON store_product.org_id = item.org_id
          AND store_product.store_id = item.store_id
          AND store_product.product_id = item.product_id
         JOIN public.commerce_product_access_packages product_package
           ON product_package.store_product_id = store_product.id
         JOIN public.commerce_access_package_courses package_course
           ON package_course.package_id = product_package.package_id
         WHERE item.org_id = $1::uuid AND item.order_id = $2::uuid
       ) courses`,
      [order.org_id, order.id],
    )
    if (Number(courseCount.rows[0]?.count || 0) > 0) {
      throw new Error('Order digital belum terhubung ke akun member.')
    }
    return [] as string[]
  }

  const courseResult = await client.query<CourseGrantRow>(
    `SELECT DISTINCT ON (course_id)
       course_id::text,
       duration_value,
       duration_unit,
       subscription_id::text,
       subscription_expires_at::text
     FROM (
       SELECT
         product_course.course_id,
         COALESCE(product_course.access_duration_value, course.access_duration_value) AS duration_value,
         COALESCE(product_course.access_duration_unit, course.access_duration_unit) AS duration_unit,
         subscription.id AS subscription_id,
         subscription.current_period_end AS subscription_expires_at
       FROM public.ecommerce_order_items item
       JOIN public.store_products store_product
         ON store_product.org_id = item.org_id
        AND store_product.store_id = item.store_id
        AND store_product.product_id = item.product_id
       JOIN public.commerce_product_courses product_course
         ON product_course.org_id = store_product.org_id
        AND product_course.store_product_id = store_product.id
       JOIN public.learning_courses course ON course.id = product_course.course_id
       LEFT JOIN public.commerce_subscription_plans plan
         ON plan.org_id = store_product.org_id
        AND plan.store_product_id = store_product.id
        AND plan.is_active = TRUE
       LEFT JOIN public.commerce_subscriptions subscription
         ON subscription.org_id = plan.org_id
        AND subscription.plan_id = plan.id
        AND subscription.latest_order_id = $2::uuid
       WHERE item.org_id = $1::uuid AND item.order_id = $2::uuid
       UNION ALL
       SELECT
         package_course.course_id,
         course.access_duration_value AS duration_value,
         course.access_duration_unit AS duration_unit,
         subscription.id AS subscription_id,
         subscription.current_period_end AS subscription_expires_at
       FROM public.ecommerce_order_items item
       JOIN public.store_products store_product
         ON store_product.org_id = item.org_id
        AND store_product.store_id = item.store_id
        AND store_product.product_id = item.product_id
       JOIN public.commerce_product_access_packages product_package
         ON product_package.store_product_id = store_product.id
       JOIN public.commerce_access_package_courses package_course
         ON package_course.package_id = product_package.package_id
       JOIN public.learning_courses course ON course.id = package_course.course_id
       LEFT JOIN public.commerce_subscription_plans plan
         ON plan.org_id = store_product.org_id
        AND plan.store_product_id = store_product.id
        AND plan.is_active = TRUE
       LEFT JOIN public.commerce_subscriptions subscription
         ON subscription.org_id = plan.org_id
        AND subscription.plan_id = plan.id
        AND subscription.latest_order_id = $2::uuid
       WHERE item.org_id = $1::uuid AND item.order_id = $2::uuid
     ) entitlements
     ORDER BY
       course_id,
       (subscription_id IS NOT NULL) DESC,
       duration_value DESC NULLS FIRST`,
    [order.org_id, order.id],
  )

  const grantIds: string[] = []
  const startsAt = new Date()
  for (const course of courseResult.rows) {
    const sourceType = course.subscription_id ? 'SUBSCRIPTION' : 'ORDER'
    const sourceId = course.subscription_id || order.id
    const idempotencyKey = course.subscription_id
      ? `subscription:${course.subscription_id}:course:${course.course_id}`
      : `order:${order.id}:course:${course.course_id}`
    const expiresAt = course.subscription_expires_at
      || addDuration(startsAt, course.duration_value, course.duration_unit)
    const grantResult = await client.query<{ id: string }>(
      `INSERT INTO public.learning_access_grants (
         org_id,
         user_id,
         course_id,
         source_type,
         source_id,
         source_reference,
         status,
         starts_at,
         expires_at,
         idempotency_key
       )
       VALUES (
         $1::uuid, $2::uuid, $3::uuid, $9, $4::uuid,
         $5, 'ACTIVE', $6::timestamptz, $7::timestamptz, $8
       )
       ON CONFLICT (org_id, idempotency_key) DO UPDATE
       SET
         status = 'ACTIVE',
         starts_at = LEAST(public.learning_access_grants.starts_at, EXCLUDED.starts_at),
         expires_at = CASE
           WHEN public.learning_access_grants.expires_at IS NULL OR EXCLUDED.expires_at IS NULL THEN NULL
           ELSE GREATEST(public.learning_access_grants.expires_at, EXCLUDED.expires_at)
         END,
         revoked_at = NULL,
         revoked_reason = NULL,
         updated_at = NOW()
       RETURNING id::text`,
      [
        order.org_id,
        order.user_id,
        course.course_id,
        sourceId,
        order.order_number,
        startsAt.toISOString(),
        expiresAt,
        idempotencyKey,
        sourceType,
      ],
    )
    const grantId = grantResult.rows[0].id
    grantIds.push(grantId)

    await client.query(
      `INSERT INTO public.learning_enrollments (
         org_id, user_id, course_id, access_grant_id, status, started_at
       )
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'IN_PROGRESS', NOW())
       ON CONFLICT (org_id, user_id, course_id) DO UPDATE
       SET
         access_grant_id = EXCLUDED.access_grant_id,
         status = CASE
           WHEN public.learning_enrollments.status = 'COMPLETED' THEN 'COMPLETED'
           ELSE 'IN_PROGRESS'
         END,
         updated_at = NOW()`,
      [order.org_id, order.user_id, course.course_id, grantId],
    )
  }
  return grantIds
}

async function createAffiliateCommissions(client: PoolClient, order: PaidOrderRow) {
  const profileId = String(order.attribution?.affiliateProfileId || '').trim()
  if (!profileId || !order.user_id) return [] as string[]

  const profileResult = await client.query<{
    id: string
    user_id: string
    default_commission_type: 'FIXED' | 'PERCENT'
    default_commission_value: number
  }>(
    `SELECT
       id::text,
       user_id::text,
       default_commission_type,
       default_commission_value::float8
     FROM public.commerce_affiliate_profiles
     WHERE id = $1::uuid
       AND org_id = $2::uuid
       AND status = 'ACTIVE'
     LIMIT 1`,
    [profileId, order.org_id],
  )
  const profile = profileResult.rows[0]
  if (!profile || profile.user_id === order.user_id) return []

  const commissionResult = await client.query<{
    store_product_id: string
    base_amount: number
    commission_type: 'FIXED' | 'PERCENT'
    commission_value: number
  }>(
    `SELECT
       store_product.id::text AS store_product_id,
       SUM(item.line_total)::float8 AS base_amount,
       COALESCE(rule.commission_type, $3)::text AS commission_type,
       COALESCE(rule.initial_value, $4)::float8 AS commission_value
     FROM public.ecommerce_order_items item
     JOIN public.store_products store_product
       ON store_product.org_id = item.org_id
      AND store_product.store_id = item.store_id
      AND store_product.product_id = item.product_id
     LEFT JOIN LATERAL (
       SELECT affiliate_rule.commission_type, affiliate_rule.initial_value
       FROM public.commerce_affiliate_rules affiliate_rule
       WHERE affiliate_rule.org_id = item.org_id
         AND affiliate_rule.is_active = TRUE
         AND (
           affiliate_rule.affiliate_profile_id IS NULL
           OR affiliate_rule.affiliate_profile_id = $5::uuid
         )
         AND (
           affiliate_rule.store_product_id IS NULL
           OR affiliate_rule.store_product_id = store_product.id
         )
       ORDER BY
         (affiliate_rule.affiliate_profile_id IS NOT NULL) DESC,
         (affiliate_rule.store_product_id IS NOT NULL) DESC,
         affiliate_rule.tier DESC
       LIMIT 1
     ) rule ON TRUE
     WHERE item.org_id = $1::uuid
       AND item.order_id = $2::uuid
     GROUP BY
       store_product.id,
       rule.commission_type,
       rule.initial_value`,
    [
      order.org_id,
      order.id,
      profile.default_commission_type,
      profile.default_commission_value,
      profile.id,
    ],
  )

  const commissionIds: string[] = []
  for (const row of commissionResult.rows) {
    const amount = row.commission_type === 'PERCENT'
      ? row.base_amount * row.commission_value / 100
      : row.commission_value
    if (amount <= 0) continue
    const result = await client.query<{ id: string }>(
      `INSERT INTO public.commerce_affiliate_commissions (
         org_id,
         affiliate_profile_id,
         order_id,
         commission_type,
         base_amount,
         commission_amount,
         status,
         payable_at,
         idempotency_key
       )
       VALUES (
         $1::uuid, $2::uuid, $3::uuid, 'INITIAL',
         $4, $5, 'PENDING', NOW() + INTERVAL '14 days', $6
       )
       ON CONFLICT (org_id, idempotency_key) DO UPDATE
       SET updated_at = NOW()
       RETURNING id::text`,
      [
        order.org_id,
        profile.id,
        order.id,
        row.base_amount,
        Math.round(amount),
        `order:${order.id}:affiliate:${profile.id}:product:${row.store_product_id}`,
      ],
    )
    commissionIds.push(result.rows[0].id)
  }

  if (commissionIds.length > 0) {
    const totalAmount = commissionResult.rows.reduce((sum, row) => {
      const amount = row.commission_type === 'PERCENT'
        ? row.base_amount * row.commission_value / 100
        : row.commission_value
      return sum + Math.round(Math.max(0, amount))
    }, 0)
    const affiliateContact = await client.query<{
      user_id: string
      name: string | null
      email: string | null
      phone: string | null
      org_slug: string | null
    }>(
      `SELECT
         auth_user.id::text AS user_id,
         auth_user.display_name AS name,
         auth_user.login_email AS email,
         auth_user.phone AS phone,
         org.slug AS org_slug
       FROM public.internal_auth_users auth_user
       LEFT JOIN public.organizations org ON org.id = $2::uuid
       WHERE auth_user.legacy_user_id = $1::uuid OR auth_user.id = $1::uuid
       ORDER BY CASE WHEN auth_user.id = $1::uuid THEN 0 ELSE 1 END
       LIMIT 1`,
      [profile.user_id, order.org_id],
    )
    const contact = affiliateContact.rows[0]
    const variables: Record<string, string | number | null> = {
      affiliate_name: contact?.name || 'Mitra Afiliasi',
      buyer_name: order.customer_name || 'Member',
      order_number: order.order_number,
      commission_amount: formatRupiah(totalAmount),
      portal_url: contact?.org_slug ? memberPortalUrl(contact.org_slug, 'afiliasi') : '',
    }
    const recipients: Array<{ channel: 'EMAIL' | 'WHATSAPP'; value: string }> = []
    if (contact?.email) recipients.push({ channel: 'EMAIL', value: contact.email })
    if (contact?.phone) recipients.push({ channel: 'WHATSAPP', value: contact.phone })
    for (const recipient of recipients) {
      await enqueueNotification({
        orgId: order.org_id,
        userId: profile.user_id,
        eventType: 'AFFILIATE_COMMISSION_EARNED',
        channel: recipient.channel,
        recipient: recipient.value,
        templateKey: 'AFFILIATE_COMMISSION_EARNED',
        variables,
        idempotencyKey: `affiliate-commission-earned:${order.id}:${profile.id}:${recipient.channel}`,
        payload: { orderId: order.id, orderNumber: order.order_number, commissionIds },
      }, client)
    }
  }

  return commissionIds
}

async function enqueuePaidNotifications(
  client: PoolClient,
  order: PaidOrderRow,
  grantCount: number,
) {
  const eventType = grantCount > 0 ? 'ENROLLMENT_CREATED' : 'ORDER_PAID'
  const variables: Record<string, string | number | null> = {
    name: order.customer_name || 'Member',
    order_number: order.order_number,
    amount: formatRupiah(order.grand_total),
  }

  if (grantCount > 0) {
    const context = await client.query<{ org_slug: string; course_titles: string | null }>(
      `SELECT
         org.slug AS org_slug,
         string_agg(DISTINCT course.title, ', ') AS course_titles
       FROM public.organizations org
       LEFT JOIN public.learning_access_grants grant_row
         ON grant_row.org_id = org.id
        AND grant_row.source_type = 'ORDER'
        AND grant_row.source_id = $2::uuid
       LEFT JOIN public.learning_courses course
         ON course.id = grant_row.course_id AND course.org_id = org.id
       WHERE org.id = $1::uuid
       GROUP BY org.slug`,
      [order.org_id, order.id],
    )
    const row = context.rows[0]
    variables.course_title = row?.course_titles || 'kelas Anda'
    variables.portal_url = row?.org_slug ? memberPortalUrl(row.org_slug) : ''
  }

  const recipients: Array<{ channel: 'EMAIL' | 'WHATSAPP'; value: string }> = []
  if (order.customer_email) recipients.push({ channel: 'EMAIL', value: order.customer_email })
  if (order.customer_phone) recipients.push({ channel: 'WHATSAPP', value: order.customer_phone })

  for (const recipient of recipients) {
    await enqueueNotification({
      orgId: order.org_id,
      userId: order.user_id,
      eventType,
      channel: recipient.channel,
      recipient: recipient.value,
      templateKey: eventType,
      variables,
      idempotencyKey: `${eventType.toLowerCase()}:${order.id}:${recipient.channel}`,
      payload: { orderId: order.id, orderNumber: order.order_number, grantCount },
    }, client)
  }
}

/**
 * Menuntaskan order bernilai nol di transaksi checkout yang sama. Kupon 100%
 * tetap membuat sale, pembayaran nol, jurnal diskon, subscription, dan akses.
 */
export async function finalizeFreeCommerceOrder(
  client: PoolClient,
  input: { orgId: string; orderId: string },
): Promise<FinalizeFreeOrderResult> {
  const orderResult = await client.query<PaidOrderRow>(
    `SELECT
       id::text,
       org_id::text,
       branch_id::text,
       warehouse_id::text,
       store_id::text,
       order_number,
       user_id::text,
       customer_name,
       customer_email,
       customer_phone,
       status::text,
       grand_total::float8,
       subtotal_amount::float8,
       discount_amount::float8,
       tax_amount::float8,
       gateway_fee_amount::float8,
       attribution,
       erp_sale_id::text
     FROM public.ecommerce_orders
     WHERE id = $1::uuid AND org_id = $2::uuid
     LIMIT 1
     FOR UPDATE`,
    [input.orderId, input.orgId],
  )
  const order = orderResult.rows[0]
  if (!order) throw new Error('Order gratis tidak ditemukan.')
  if (Math.abs(order.grand_total) > 0.01) {
    throw new Error('Finalisasi gratis hanya berlaku untuk order bernilai nol.')
  }
  if (order.erp_sale_id) {
    const existing = await client.query<{
      payment_id: string
      journal_entry_id: string | null
      access_grant_ids: string[]
    }>(
      `SELECT
         (
           SELECT payment.id::text
           FROM public.sales_payments payment
           WHERE payment.org_id = $1::uuid
             AND payment.ecommerce_order_id = $2::uuid
           ORDER BY payment.created_at
           LIMIT 1
         ) AS payment_id,
         (
           SELECT journal.id::text
           FROM public.journal_entries journal
           WHERE journal.org_id = $1::uuid
             AND journal.reference_type = 'COMMERCE_PAYMENT'
             AND journal.reference_id = $2::uuid
           LIMIT 1
         ) AS journal_entry_id,
         ARRAY(
           SELECT access_grant.id::text
           FROM public.learning_access_grants access_grant
           WHERE access_grant.org_id = $1::uuid
             AND access_grant.metadata ->> 'orderId' = $2::text
           ORDER BY access_grant.created_at
         ) AS access_grant_ids`,
      [order.org_id, order.id],
    )
    const row = existing.rows[0]
    if (!row?.payment_id) {
      throw new Error('Finalisasi order gratis sebelumnya belum lengkap.')
    }
    return {
      orderId: order.id,
      saleId: order.erp_sale_id,
      paymentId: row.payment_id,
      journalEntryId: row.journal_entry_id,
      accessGrantIds: row.access_grant_ids || [],
      orderStatus: order.status === 'READY_TO_FULFILL'
        ? 'READY_TO_FULFILL'
        : 'COMPLETED',
    }
  }

  const settingsResult = await client.query<AccountSettingsRow>(
    `SELECT
       setting.bank_account_id::text,
       COALESCE(setting.cash_account_id, bank.account_id)::text AS cash_account_id,
       setting.revenue_account_id::text,
       setting.tax_payable_account_id::text,
       setting.discount_account_id::text,
       setting.gateway_fee_account_id::text,
       setting.affiliate_commission_expense_account_id::text,
       setting.affiliate_commission_payable_account_id::text
     FROM public.commerce_branch_account_settings setting
     LEFT JOIN public.bank_accounts bank
       ON bank.id = setting.bank_account_id
      AND bank.org_id = setting.org_id
     WHERE setting.org_id = $1::uuid
       AND setting.branch_id = $2::uuid
     LIMIT 1`,
    [order.org_id, order.branch_id],
  )
  const settings = settingsResult.rows[0]
  if (!settings?.bank_account_id || !settings.cash_account_id || !settings.revenue_account_id) {
    throw new Error('Pemetaan akun commerce untuk Cabang ini belum lengkap.')
  }

  const customerId = await createOrGetCustomer(client, order)
  const saleId = await createOrGetSale(client, order, customerId)
  const hasAccountingValue = (
    Math.abs(order.subtotal_amount) > 0.01
    || Math.abs(order.discount_amount) > 0.01
    || Math.abs(order.tax_amount) > 0.01
  )
  const journalEntryId = hasAccountingValue
    ? await createCommerceJournal(client, order, settings, 0)
    : null

  const paymentResult = await client.query<{ id: string }>(
    `INSERT INTO public.sales_payments (
       org_id, branch_id, sale_id, account_id, payment_date,
       amount, discount_amount, payment_number, notes,
       ecommerce_order_id, idempotency_key
     ) VALUES (
       $1::uuid, $2::uuid, $3::uuid, $4::uuid, NOW(),
       0, $5, $6, $7, $8::uuid, $9
     )
     ON CONFLICT (org_id, idempotency_key)
       WHERE idempotency_key IS NOT NULL
     DO UPDATE
     SET notes = EXCLUDED.notes
     RETURNING id::text`,
    [
      order.org_id,
      order.branch_id,
      saleId,
      settings.cash_account_id,
      order.discount_amount,
      `FREE-${order.order_number}`,
      `Order gratis/kupon penuh ${order.order_number}`,
      order.id,
      `commerce-free-payment:${order.id}`,
    ],
  )
  const paymentId = paymentResult.rows[0].id

  await client.query(
    `INSERT INTO public.ecommerce_order_payments (
       org_id, order_id, status, method, paid_amount, paid_at,
       reviewed_at, erp_payment_id, provider_code,
       provider_reference, idempotency_key, response_payload
     ) VALUES (
       $1::uuid, $2::uuid, 'VALIDATED', 'FREE', 0, NOW(),
       NOW(), $3::uuid, 'FREE', $4, $5, $6::jsonb
     )
     ON CONFLICT (org_id, idempotency_key)
       WHERE idempotency_key IS NOT NULL
     DO UPDATE
     SET
       status = 'VALIDATED',
       paid_at = COALESCE(public.ecommerce_order_payments.paid_at, EXCLUDED.paid_at),
       erp_payment_id = EXCLUDED.erp_payment_id,
       updated_at = NOW()`,
    [
      order.org_id,
      order.id,
      paymentId,
      `FREE-${order.order_number}`,
      `commerce-free-order-payment:${order.id}`,
      JSON.stringify({ source: 'MEMBER_CHECKOUT', zeroAmount: true }),
    ],
  )

  await activateOrderSubscriptions(client, order)
  const accessGrantIds = await provisionOrderEntitlements(client, {
    orgId: order.org_id,
    orderId: order.id,
  })
  await activateConsultingOrder(client, {
    orgId: order.org_id,
    orderId: order.id,
  })
  await reservePhysicalOrderItems(client, order, saleId)
  const physicalResult = await client.query<{ has_physical: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM public.ecommerce_order_items item
       JOIN public.store_products store_product
         ON store_product.org_id = item.org_id
        AND store_product.store_id = item.store_id
        AND store_product.product_id = item.product_id
       WHERE item.org_id = $1::uuid
         AND item.order_id = $2::uuid
         AND store_product.product_type = 'PHYSICAL'
     ) AS has_physical`,
    [order.org_id, order.id],
  )
  const orderStatus = physicalResult.rows[0]?.has_physical
    ? 'READY_TO_FULFILL' as const
    : 'COMPLETED' as const
  if (!physicalResult.rows[0]?.has_physical) {
    await client.query(
      `UPDATE public.sales
       SET status = 'FINISHED', updated_at = NOW()
       WHERE id = $1::uuid AND org_id = $2::uuid`,
      [saleId, order.org_id],
    )
  }

  await client.query(
    `UPDATE public.ecommerce_orders
     SET
       status = $3::public.ecommerce_order_status,
       payment_status = 'VALIDATED',
       paid_at = COALESCE(paid_at, NOW()),
       erp_sale_id = $4::uuid,
       erp_sync_status = 'SYNCED',
       erp_sync_error = NULL,
       updated_at = NOW()
     WHERE id = $1::uuid AND org_id = $2::uuid`,
    [order.id, order.org_id, orderStatus, saleId],
  )
  await client.query(
    `INSERT INTO public.ecommerce_order_events (
       org_id, order_id, event_type, message, payload
     ) VALUES (
       $1::uuid, $2::uuid, 'PAYMENT_VALIDATED',
       'Order gratis tervalidasi dan ERP tersinkron.', $3::jsonb
     )`,
    [
      order.org_id,
      order.id,
      JSON.stringify({
        providerCode: 'FREE',
        saleId,
        paymentId,
        journalEntryId,
        accessGrantIds,
      }),
    ],
  )
  await enqueuePaidNotifications(client, order, accessGrantIds.length)

  return {
    orderId: order.id,
    saleId,
    paymentId,
    journalEntryId,
    accessGrantIds,
    orderStatus,
  }
}

export async function finalizePaidCommerceOrder(
  input: FinalizePaidOrderInput,
): Promise<FinalizePaidOrderResult> {
  const client = await connectPostgresClient()
  try {
    await client.query('BEGIN')

    await client.query(
      `INSERT INTO public.commerce_transaction_operations (
         org_id,
         operation_type,
         aggregate_type,
         aggregate_id,
         idempotency_key,
         status,
         started_at
       )
       VALUES (
         $1::uuid, 'FINALIZE_PAYMENT', 'ORDER', $2::uuid, $3, 'PENDING', NOW()
       )
       ON CONFLICT (org_id, idempotency_key) DO NOTHING`,
      [input.orgId, input.orderId, input.idempotencyKey],
    )
    const operationResult = await client.query<{
      id: string
      status: string
      result: FinalizePaidOrderResult | null
    }>(
      `SELECT id::text, status, result
       FROM public.commerce_transaction_operations
       WHERE org_id = $1::uuid AND idempotency_key = $2
       LIMIT 1
       FOR UPDATE`,
      [input.orgId, input.idempotencyKey],
    )
    const operation = operationResult.rows[0]
    if (!operation) throw new Error('Operasi pembayaran tidak dapat dikunci.')
    if (operation.status === 'SUCCEEDED' && operation.result) {
      await client.query('COMMIT')
      return { ...operation.result, alreadyProcessed: true }
    }

    await client.query(
      `UPDATE public.commerce_transaction_operations
       SET status = 'PROCESSING', started_at = COALESCE(started_at, NOW()), updated_at = NOW()
       WHERE id = $1::uuid`,
      [operation.id],
    )

    const orderResult = await client.query<PaidOrderRow>(
      `SELECT
         id::text,
         org_id::text,
         branch_id::text,
         warehouse_id::text,
         store_id::text,
         order_number,
         user_id::text,
         customer_name,
         customer_email,
         customer_phone,
         status::text,
         grand_total::float8,
         subtotal_amount::float8,
         discount_amount::float8,
         tax_amount::float8,
         gateway_fee_amount::float8,
         attribution,
         erp_sale_id::text
       FROM public.ecommerce_orders
       WHERE id = $1::uuid AND org_id = $2::uuid
       LIMIT 1
       FOR UPDATE`,
      [input.orderId, input.orgId],
    )
    const order = orderResult.rows[0]
    if (!order) throw new Error('Order tidak ditemukan.')
    if (order.status === 'REFUNDED' || order.status === 'CANCELLED') {
      throw new Error('Order yang dibatalkan atau direfund tidak dapat dibayar.')
    }
    assertMoneyEqual(order.grand_total, input.paidAmount)
    const feeAmount = Math.max(0, input.gatewayFeeAmount || 0)

    const intentResult = await client.query<{ id: string; status: string }>(
      `SELECT id::text, status
       FROM public.commerce_payment_intents
       WHERE id = $1::uuid
         AND org_id = $2::uuid
         AND order_id = $3::uuid
       LIMIT 1
       FOR UPDATE`,
      [input.paymentIntentId, input.orgId, input.orderId],
    )
    if (!intentResult.rows[0]) throw new Error('Tagihan pembayaran tidak ditemukan.')

    const settingsResult = await client.query<AccountSettingsRow>(
      `SELECT
         setting.bank_account_id::text,
         COALESCE(setting.cash_account_id, bank.account_id)::text AS cash_account_id,
         setting.revenue_account_id::text,
         setting.tax_payable_account_id::text,
         setting.discount_account_id::text,
         setting.gateway_fee_account_id::text,
         setting.affiliate_commission_expense_account_id::text,
         setting.affiliate_commission_payable_account_id::text
       FROM public.commerce_branch_account_settings setting
       LEFT JOIN public.bank_accounts bank
         ON bank.id = setting.bank_account_id
        AND bank.org_id = setting.org_id
       WHERE setting.org_id = $1::uuid
         AND setting.branch_id = $2::uuid
       LIMIT 1`,
      [order.org_id, order.branch_id],
    )
    const settings = settingsResult.rows[0]
    if (!settings?.bank_account_id || !settings.cash_account_id || !settings.revenue_account_id) {
      throw new Error('Pemetaan akun commerce untuk Cabang ini belum lengkap.')
    }

    const customerId = await createOrGetCustomer(client, order)
    const saleId = await createOrGetSale(client, order, customerId)
    const journalEntryId = await createCommerceJournal(client, order, settings, feeAmount)

    const paymentResult = await client.query<{ id: string }>(
      `INSERT INTO public.sales_payments (
         org_id,
         branch_id,
         sale_id,
         account_id,
         payment_date,
         amount,
         discount_amount,
         payment_number,
         notes,
         ecommerce_order_id,
         payment_intent_id,
         idempotency_key
       )
       VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4::uuid, NOW(),
         $5, 0, $6, $7, $8::uuid, $9::uuid, $10
       )
       ON CONFLICT (org_id, idempotency_key)
         WHERE idempotency_key IS NOT NULL
       DO UPDATE
       SET notes = EXCLUDED.notes
       RETURNING id::text`,
      [
        order.org_id,
        order.branch_id,
        saleId,
        settings.cash_account_id,
        order.grand_total,
        `PAY-${order.order_number}`,
        `Provider ${input.providerCode}; referensi ${input.providerReference}`,
        order.id,
        input.paymentIntentId,
        `commerce-payment:${order.id}`,
      ],
    )
    const paymentId = paymentResult.rows[0].id

    const bankResult = await client.query<{ id: string }>(
      `INSERT INTO public.bank_transactions (
         org_id,
         branch_id,
         bank_account_id,
         transaction_date,
         description,
         amount,
         type,
         reference_number,
         category_id,
         journal_entry_id,
         status,
         reference_type,
         reference_id,
         idempotency_key
       )
       VALUES (
         $1::uuid, $2::uuid, $3::uuid, CURRENT_DATE, $4,
         $5, 'IN', $6, NULL, $7::uuid, 'POSTED',
         'COMMERCE_PAYMENT', $8::uuid, $9
       )
       ON CONFLICT (org_id, idempotency_key)
         WHERE idempotency_key IS NOT NULL
       DO UPDATE
       SET journal_entry_id = EXCLUDED.journal_entry_id
       RETURNING id::text`,
      [
        order.org_id,
        order.branch_id,
        settings.bank_account_id,
        `Penerimaan ${order.order_number}`,
        order.grand_total - feeAmount,
        input.providerReference,
        journalEntryId,
        order.id,
        `commerce-bank-in:${order.id}`,
      ],
    )
    const bankTransactionId = bankResult.rows[0].id

    await client.query(
      `INSERT INTO public.ecommerce_order_payments (
         org_id,
         order_id,
         status,
         method,
         paid_amount,
         paid_at,
         reviewed_at,
         erp_payment_id,
         payment_intent_id,
         provider_code,
         provider_reference,
         idempotency_key,
         response_payload
       )
       VALUES (
         $1::uuid, $2::uuid, 'VALIDATED', $3, $4, NOW(), NOW(),
         $5::uuid, $6::uuid, $3, $7, $8, $9::jsonb
       )
       ON CONFLICT (org_id, idempotency_key)
         WHERE idempotency_key IS NOT NULL
       DO UPDATE
       SET
         status = 'VALIDATED',
         paid_amount = EXCLUDED.paid_amount,
         paid_at = COALESCE(public.ecommerce_order_payments.paid_at, EXCLUDED.paid_at),
         erp_payment_id = EXCLUDED.erp_payment_id,
         response_payload = EXCLUDED.response_payload,
         updated_at = NOW()`,
      [
        order.org_id,
        order.id,
        input.providerCode,
        order.grand_total,
        paymentId,
        input.paymentIntentId,
        input.providerReference,
        `commerce-order-payment:${order.id}:${input.paymentIntentId}`,
        JSON.stringify(input.rawProviderPayload || {}),
      ],
    )

    await activateOrderSubscriptions(client, order)
    const accessGrantIds = await provisionOrderEntitlements(client, {
      orgId: order.org_id,
      orderId: order.id,
    })
    await activateConsultingOrder(client, {
      orgId: order.org_id,
      orderId: order.id,
    })
    const commissionIds = await createAffiliateCommissions(client, order)
    await reservePhysicalOrderItems(client, order, saleId)
    const physicalResult = await client.query<{ has_physical: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM public.ecommerce_order_items item
         JOIN public.store_products store_product
           ON store_product.org_id = item.org_id
          AND store_product.store_id = item.store_id
          AND store_product.product_id = item.product_id
         WHERE item.org_id = $1::uuid
           AND item.order_id = $2::uuid
           AND store_product.product_type = 'PHYSICAL'
       ) AS has_physical`,
      [order.org_id, order.id],
    )
    const orderStatus = physicalResult.rows[0]?.has_physical
      ? 'READY_TO_FULFILL' as const
      : 'COMPLETED' as const

    if (!physicalResult.rows[0]?.has_physical) {
      await client.query(
        `UPDATE public.sales
         SET status = 'FINISHED', updated_at = NOW()
         WHERE id = $1::uuid AND org_id = $2::uuid`,
        [saleId, order.org_id],
      )
    }

    await client.query(
      `UPDATE public.commerce_payment_intents
       SET
         status = 'PAID',
         provider_reference = COALESCE(provider_reference, $3),
         response_payload = response_payload || $4::jsonb,
         updated_at = NOW()
       WHERE id = $1::uuid AND org_id = $2::uuid`,
      [
        input.paymentIntentId,
        order.org_id,
        input.providerReference,
        JSON.stringify(input.rawProviderPayload || {}),
      ],
    )
    await client.query(
      `UPDATE public.ecommerce_orders
       SET
         status = $3::public.ecommerce_order_status,
         payment_status = 'VALIDATED',
         paid_at = COALESCE(paid_at, NOW()),
         gateway_fee_amount = $4,
         erp_sale_id = $5::uuid,
         erp_sync_status = 'SYNCED',
         erp_sync_error = NULL,
         updated_at = NOW()
       WHERE id = $1::uuid AND org_id = $2::uuid`,
      [order.id, order.org_id, orderStatus, feeAmount, saleId],
    )
    await client.query(
      `INSERT INTO public.ecommerce_order_events (
         org_id, order_id, event_type, message, payload
       )
       VALUES (
         $1::uuid, $2::uuid, 'PAYMENT_VALIDATED', $3, $4::jsonb
       )`,
      [
        order.org_id,
        order.id,
        `Pembayaran ${input.providerCode} tervalidasi dan ERP tersinkron.`,
        JSON.stringify({
          providerEventId: input.providerEventId,
          providerReference: input.providerReference,
          saleId,
          journalEntryId,
          bankTransactionId,
          accessGrantIds,
          commissionIds,
        }),
      ],
    )
    await enqueuePaidNotifications(client, order, accessGrantIds.length)

    const result: FinalizePaidOrderResult = {
      orderId: order.id,
      saleId,
      paymentId,
      journalEntryId,
      bankTransactionId,
      accessGrantIds,
      commissionIds,
      orderStatus,
    }
    await client.query(
      `UPDATE public.commerce_transaction_operations
       SET
         status = 'SUCCEEDED',
         result = $2::jsonb,
         completed_at = NOW(),
         error_message = NULL,
         updated_at = NOW()
       WHERE id = $1::uuid`,
      [operation.id, JSON.stringify(result)],
    )

    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
