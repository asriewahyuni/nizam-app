/**
 * Siklus subscription: aktivasi setelah pembayaran, pembuatan renewal,
 * grace period, reminder, dan pencabutan akses saat benar-benar kedaluwarsa.
 */
import 'server-only'

import type { PoolClient } from 'pg'
import { connectPostgresClient, queryPostgres } from '@/lib/db/postgres'
import { createCommercePaymentIntent } from './payment-orchestration.server'
import {
  revokeSubscriptionEntitlements,
  snapshotOrderEntitlements,
} from './entitlement.service'

type SubscriptionOrder = {
  id: string
  org_id: string
  user_id: string | null
}

function addInterval(date: Date, interval: string, count: number) {
  const next = new Date(date)
  if (interval === 'DAY') next.setUTCDate(next.getUTCDate() + count)
  else if (interval === 'WEEK') next.setUTCDate(next.getUTCDate() + count * 7)
  else if (interval === 'YEAR') next.setUTCFullYear(next.getUTCFullYear() + count)
  else next.setUTCMonth(next.getUTCMonth() + count)
  return next
}

export async function activateOrderSubscriptions(
  client: PoolClient,
  order: SubscriptionOrder,
) {
  if (!order.user_id) return [] as string[]
  const plans = await client.query<{
    id: string
    billing_interval: string
    billing_interval_count: number
    trial_days: number
    grace_period_days: number
    max_cycles: number | null
  }>(
    `SELECT DISTINCT
       plan.id::text,
       plan.billing_interval,
       plan.billing_interval_count,
       plan.trial_days,
       plan.grace_period_days,
       plan.max_cycles
     FROM public.ecommerce_order_items item
     JOIN public.store_products store_product
       ON store_product.org_id = item.org_id
      AND store_product.store_id = item.store_id
      AND store_product.product_id = item.product_id
     JOIN public.commerce_subscription_plans plan
       ON plan.org_id = store_product.org_id
      AND plan.store_product_id = store_product.id
      AND plan.is_active = TRUE
     WHERE item.org_id = $1::uuid AND item.order_id = $2::uuid`,
    [order.org_id, order.id],
  )
  const subscriptionIds: string[] = []
  for (const plan of plans.rows) {
    const existing = await client.query<{
      id: string
      current_period_end: string | null
      cycles_completed: number
      initial_order_id: string | null
    }>(
      `SELECT
         id::text, current_period_end::text, cycles_completed,
         initial_order_id::text
       FROM public.commerce_subscriptions
       WHERE org_id = $1::uuid
         AND user_id = $2::uuid
         AND plan_id = $3::uuid
         AND status NOT IN ('CANCELLED', 'EXPIRED')
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [order.org_id, order.user_id, plan.id],
    )
    const now = new Date()
    const current = existing.rows[0]
    const periodStart = current?.current_period_end
      && new Date(current.current_period_end) > now
      ? new Date(current.current_period_end)
      : now
    const isInitialTrial = !current && plan.trial_days > 0
    const periodEnd = isInitialTrial
      ? addInterval(periodStart, 'DAY', plan.trial_days)
      : addInterval(periodStart, plan.billing_interval, plan.billing_interval_count)
    const nextStatus = isInitialTrial ? 'TRIAL' : 'ACTIVE'
    let subscriptionId: string
    if (current) {
      await client.query(
        `UPDATE public.commerce_subscriptions
         SET
           latest_order_id = $3::uuid,
           status = $4,
           current_period_start = $5::timestamptz,
           current_period_end = $6::timestamptz,
           grace_ends_at = NULL,
           next_renewal_at = $6::timestamptz,
           cycles_completed = cycles_completed + 1,
           last_payment_at = NOW(),
           updated_at = NOW()
         WHERE id = $1::uuid AND org_id = $2::uuid`,
        [
          current.id,
          order.org_id,
          order.id,
          nextStatus,
          periodStart.toISOString(),
          periodEnd.toISOString(),
        ],
      )
      subscriptionId = current.id
    } else {
      const idempotencyKey = `subscription-order:${order.id}:plan:${plan.id}`
      const result = await client.query<{ id: string }>(
        `INSERT INTO public.commerce_subscriptions (
         org_id, user_id, plan_id, initial_order_id, latest_order_id, status,
         current_period_start, current_period_end, trial_ends_at,
         next_renewal_at, idempotency_key, cycles_completed, last_payment_at
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4::uuid, $4::uuid, $5,
         $6::timestamptz, $7::timestamptz, $8::timestamptz,
         $7::timestamptz, $9, 1, NOW()
       )
         ON CONFLICT (org_id, idempotency_key) DO UPDATE SET
         latest_order_id = EXCLUDED.latest_order_id,
         status = EXCLUDED.status,
         current_period_start = EXCLUDED.current_period_start,
         current_period_end = EXCLUDED.current_period_end,
         trial_ends_at = COALESCE(public.commerce_subscriptions.trial_ends_at, EXCLUDED.trial_ends_at),
         grace_ends_at = NULL,
         next_renewal_at = EXCLUDED.next_renewal_at,
         cycles_completed = public.commerce_subscriptions.cycles_completed + 1,
         last_payment_at = NOW(),
         updated_at = NOW()
         RETURNING id::text`,
        [
          order.org_id,
          order.user_id,
          plan.id,
          order.id,
          nextStatus,
          periodStart.toISOString(),
          periodEnd.toISOString(),
          isInitialTrial ? periodEnd.toISOString() : null,
          idempotencyKey,
        ],
      )
      subscriptionId = result.rows[0].id
    }
    subscriptionIds.push(subscriptionId)
    await client.query(
      `INSERT INTO public.commerce_subscription_events (
         org_id, subscription_id, event_type, order_id, idempotency_key, payload
       ) VALUES (
         $1::uuid, $2::uuid, 'PAYMENT_ACTIVATED', $3::uuid, $4, $5::jsonb
       )
       ON CONFLICT (org_id, idempotency_key) DO NOTHING`,
      [
        order.org_id,
        subscriptionId,
        order.id,
        `subscription-payment:${order.id}:${plan.id}`,
        JSON.stringify({ periodStart, periodEnd, status: nextStatus }),
      ],
    )
  }
  return subscriptionIds
}

export async function processSubscriptionLifecycle(input?: {
  limit?: number
  baseUrl?: string
}) {
  const limit = Math.max(1, Math.min(input?.limit || 25, 100))
  const due = await queryPostgres<{
    id: string
    org_id: string
    user_id: string
    plan_id: string
    plan_name: string
    store_product_id: string
    price: number
    grace_period_days: number
    max_cycles: number | null
    cycles_completed: number
    latest_order_id: string | null
    provider_code: string | null
  }>(
    `SELECT
       subscription.id::text,
       subscription.org_id::text,
       subscription.user_id::text,
       subscription.plan_id::text,
       plan.name AS plan_name,
       plan.store_product_id::text,
       plan.price::float8,
       plan.grace_period_days,
       plan.max_cycles,
       subscription.cycles_completed,
       COALESCE(subscription.latest_order_id, subscription.initial_order_id)::text AS latest_order_id,
       intent.provider_code
     FROM public.commerce_subscriptions subscription
     JOIN public.commerce_subscription_plans plan
       ON plan.id = subscription.plan_id
      AND plan.org_id = subscription.org_id
     LEFT JOIN public.commerce_payment_intents intent
       ON intent.order_id = COALESCE(subscription.latest_order_id, subscription.initial_order_id)
      AND intent.org_id = subscription.org_id
     WHERE subscription.status IN ('TRIAL', 'ACTIVE', 'PAST_DUE', 'GRACE')
       AND subscription.next_renewal_at <= NOW()
     ORDER BY subscription.next_renewal_at
     LIMIT $1`,
    [limit],
  )
  const result = { due: due.rows.length, renewalOrders: 0, expired: 0, conflicts: 0 }
  for (const subscription of due.rows) {
    if (
      subscription.max_cycles != null
      && subscription.cycles_completed >= subscription.max_cycles
    ) {
      await expireSubscription(subscription.org_id, subscription.id, 'MAX_CYCLES_REACHED')
      result.expired += 1
      continue
    }
    if (subscription.price <= 0 || !subscription.provider_code) {
      await expireSubscription(subscription.org_id, subscription.id, 'RENEWAL_CONFIGURATION_MISSING')
      result.conflicts += 1
      continue
    }
    try {
      const renewal = await createRenewalOrder(subscription)
      const baseUrl = (input?.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://member.coreisec.id')
        .replace(/\/+$/, '')
      await createCommercePaymentIntent({
        orgId: subscription.org_id,
        orderId: renewal.orderId,
        providerCode: subscription.provider_code,
        returnUrl: `${baseUrl}/member`,
        callbackUrl: `${baseUrl}/api/payments/duitku/webhook`,
        idempotencyKey: `renewal-intent:${subscription.id}:${renewal.periodKey}`,
      })
      result.renewalOrders += 1
    } catch {
      result.conflicts += 1
    }
  }

  const expired = await queryPostgres<{ id: string; org_id: string }>(
    `SELECT id::text, org_id::text
     FROM public.commerce_subscriptions
     WHERE status IN ('PAST_DUE', 'GRACE')
       AND grace_ends_at IS NOT NULL
       AND grace_ends_at <= NOW()
     LIMIT $1`,
    [limit],
  )
  for (const subscription of expired.rows) {
    await expireSubscription(subscription.org_id, subscription.id, 'GRACE_PERIOD_ENDED')
    result.expired += 1
  }
  return result
}

async function createRenewalOrder(subscription: {
  id: string
  org_id: string
  user_id: string
  plan_id: string
  store_product_id: string
  price: number
  grace_period_days: number
  latest_order_id: string | null
}) {
  const client = await connectPostgresClient()
  try {
    await client.query('BEGIN')
    await client.query(
      `SELECT id FROM public.commerce_subscriptions
       WHERE id = $1::uuid AND org_id = $2::uuid FOR UPDATE`,
      [subscription.id, subscription.org_id],
    )
    const periodKey = new Date().toISOString().slice(0, 10)
    const idempotencyKey = `renewal:${subscription.id}:${periodKey}`
    const existing = await client.query<{ id: string }>(
      `SELECT id::text FROM public.ecommerce_orders
       WHERE org_id = $1::uuid AND idempotency_key = $2 LIMIT 1`,
      [subscription.org_id, idempotencyKey],
    )
    if (existing.rows[0]) {
      await client.query('COMMIT')
      return { orderId: existing.rows[0].id, periodKey }
    }
    const source = await client.query<{
      store_id: string
      branch_id: string
      warehouse_id: string
      product_id: string
      public_name: string
      public_slug: string
      customer_name: string
      customer_email: string | null
      customer_phone: string
    }>(
      `SELECT
         store_product.store_id::text,
         store.branch_id::text,
         store.warehouse_id::text,
         store_product.product_id::text,
         store_product.public_name,
         store_product.public_slug,
         ecommerce_order.customer_name,
         ecommerce_order.customer_email,
         ecommerce_order.customer_phone
       FROM public.store_products store_product
       JOIN public.stores store ON store.id = store_product.store_id
       JOIN public.ecommerce_orders ecommerce_order
         ON ecommerce_order.id = $3::uuid
        AND ecommerce_order.org_id = store_product.org_id
       WHERE store_product.id = $1::uuid
         AND store_product.org_id = $2::uuid`,
      [subscription.store_product_id, subscription.org_id, subscription.latest_order_id],
    )
    const item = source.rows[0]
    if (!item) throw new Error('Sumber order renewal tidak ditemukan.')
    const order = await client.query<{ id: string }>(
      `INSERT INTO public.ecommerce_orders (
         org_id, store_id, branch_id, warehouse_id, user_id,
         customer_name, customer_email, customer_phone, order_number,
         status, payment_status, subtotal_amount, grand_total,
         idempotency_key, checkout_idempotency_key, source_snapshot
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid,
         $6, $7, $8, '', 'AWAITING_PAYMENT', 'PENDING_UPLOAD', $9, $9,
         $10, $10, $11::jsonb
       ) RETURNING id::text`,
      [
        subscription.org_id,
        item.store_id,
        item.branch_id,
        item.warehouse_id,
        subscription.user_id,
        item.customer_name,
        item.customer_email,
        item.customer_phone,
        subscription.price,
        idempotencyKey,
        JSON.stringify({ renewalSubscriptionId: subscription.id }),
      ],
    )
    await client.query(
      `INSERT INTO public.ecommerce_order_items (
         org_id, order_id, store_id, product_id, inventory_product_id,
         product_name, slug, quantity, unit_price, compare_price,
         line_subtotal, line_total
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4::uuid, $4::uuid,
         $5, $6, 1, $7, $7, $7, $7
       )`,
      [
        subscription.org_id,
        order.rows[0].id,
        item.store_id,
        item.product_id,
        item.public_name,
        item.public_slug,
        subscription.price,
      ],
    )
    await snapshotOrderEntitlements(client, {
      orgId: subscription.org_id,
      orderId: order.rows[0].id,
    })
    await client.query(
      `UPDATE public.commerce_subscriptions
       SET status = 'GRACE',
           latest_order_id = $3::uuid,
           grace_ends_at = NOW() + make_interval(days => $4),
           updated_at = NOW()
       WHERE id = $1::uuid AND org_id = $2::uuid`,
      [
        subscription.id,
        subscription.org_id,
        order.rows[0].id,
        subscription.grace_period_days,
      ],
    )
    await client.query('COMMIT')
    return { orderId: order.rows[0].id, periodKey }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function expireSubscription(orgId: string, subscriptionId: string, reason: string) {
  const client = await connectPostgresClient()
  try {
    await client.query('BEGIN')
    await client.query(
      `UPDATE public.commerce_subscriptions
       SET status = 'EXPIRED', cancellation_reason = $3, updated_at = NOW()
       WHERE id = $1::uuid AND org_id = $2::uuid
         AND status <> 'EXPIRED'`,
      [subscriptionId, orgId, reason],
    )
    await revokeSubscriptionEntitlements(client, {
      orgId,
      subscriptionId,
      reason,
      membershipStatus: 'EXPIRED',
    })
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
