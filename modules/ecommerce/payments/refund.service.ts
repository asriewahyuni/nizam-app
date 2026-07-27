/**
 * Refund commerce penuh. Provider dipanggil di luar transaksi; pembalikan kas,
 * jurnal, akses, subscription, komisi, dan order dilakukan atomik sesudah dana
 * refund dikonfirmasi.
 */
import 'server-only'

import { connectPostgresClient, queryPostgres } from '@/lib/db/postgres'
import { getPaymentProvider } from './provider-registry.server'
import {
  reconcileEffectiveEnrollments,
  revokeSubscriptionEntitlements,
} from './entitlement.service'
import { cancelConsultingOrderForRefund } from '@/modules/consulting/lib/consulting.server'
import { enqueueNotification } from '@/modules/notifications/outbox.server'

function formatRupiah(amount: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount)
}

export async function requestCommerceRefund(input: {
  orgId: string
  orderId: string
  reason: string
  requestedBy: string
  idempotencyKey: string
  allowStartedConsultingOverride?: boolean
  overrideReason?: string
}) {
  const orderResult = await queryPostgres<{
    order_number: string
    grand_total: number
    provider_code: string
    provider_reference: string
    payment_intent_id: string
  }>(
    `SELECT
       ecommerce_order.order_number,
       ecommerce_order.grand_total::float8,
       intent.provider_code,
       intent.provider_reference,
       intent.id::text AS payment_intent_id
     FROM public.ecommerce_orders ecommerce_order
     JOIN public.commerce_payment_intents intent
       ON intent.order_id = ecommerce_order.id
      AND intent.org_id = ecommerce_order.org_id
      AND intent.status = 'PAID'
     WHERE ecommerce_order.org_id = $1::uuid
       AND ecommerce_order.id = $2::uuid
       AND ecommerce_order.status IN ('READY_TO_FULFILL', 'FULFILLING', 'SHIPPED', 'COMPLETED')
     ORDER BY intent.updated_at DESC
     LIMIT 1`,
    [input.orgId, input.orderId],
  )
  const order = orderResult.rows[0]
  if (!order) throw new Error('Order berbayar yang dapat direfund tidak ditemukan.')

  const startedConsulting = await queryPostgres<{ total: number }>(
    `SELECT COUNT(*)::int AS total
     FROM public.consulting_sessions session
     JOIN public.consulting_engagements engagement
       ON engagement.org_id = session.org_id
      AND engagement.id = session.engagement_id
     WHERE engagement.org_id = $1::uuid
       AND engagement.order_id = $2::uuid
       AND (
         session.starts_at <= NOW()
         OR session.status IN ('COMPLETED', 'NO_SHOW')
       )`,
    [input.orgId, input.orderId],
  )
  const consultingHasStarted = Number(startedConsulting.rows[0]?.total || 0) > 0
  const overrideReason = String(input.overrideReason || '').trim().slice(0, 1000)
  if (consultingHasStarted && !input.allowStartedConsultingOverride) {
    throw new Error(
      'Sesi Consulting 360 sudah dimulai. Refund membutuhkan override owner/admin dan alasan.',
    )
  }
  if (consultingHasStarted) {
    if (!overrideReason) throw new Error('Alasan override refund wajib diisi.')
    const authorization = await queryPostgres<{ role: string }>(
      `SELECT member.role
       FROM public.org_members member
       WHERE member.org_id = $1::uuid
         AND member.is_active = TRUE
         AND (
           member.user_id = $2::uuid
           OR member.user_id = (
             SELECT legacy_user_id
             FROM public.internal_auth_users
             WHERE id = $2::uuid
             LIMIT 1
           )
         )
       LIMIT 1`,
      [input.orgId, input.requestedBy],
    )
    if (!['owner', 'admin'].includes(String(authorization.rows[0]?.role || '').toLowerCase())) {
      throw new Error('Hanya owner atau admin yang boleh mengoverride refund setelah sesi dimulai.')
    }
  }

  const refundResult = await queryPostgres<{ id: string; status: string }>(
    `INSERT INTO public.commerce_refunds (
       org_id, order_id, payment_intent_id, amount, reason, status,
       idempotency_key, requested_by, policy_override, policy_override_reason
     ) VALUES (
       $1::uuid, $2::uuid, $3::uuid, $4, $5, 'PENDING', $6, $7::uuid,
       $8, $9
     )
     ON CONFLICT (org_id, idempotency_key) DO UPDATE
     SET updated_at = NOW()
     RETURNING id::text, status`,
    [
      input.orgId,
      input.orderId,
      order.payment_intent_id,
      order.grand_total,
      input.reason,
      input.idempotencyKey,
      input.requestedBy,
      consultingHasStarted,
      consultingHasStarted ? overrideReason : null,
    ],
  )
  const refund = refundResult.rows[0]
  if (refund.status === 'SUCCEEDED') {
    return { refundId: refund.id, status: 'SUCCEEDED' as const, alreadyProcessed: true }
  }

  const provider = await getPaymentProvider(order.provider_code)
  const providerResult = await provider.refund({
    providerReference: order.provider_reference,
    orderNumber: order.order_number,
    amount: order.grand_total,
    reason: input.reason,
    idempotencyKey: input.idempotencyKey,
  })
  await queryPostgres(
    `UPDATE public.commerce_refunds
     SET
       status = $3,
       provider_reference = $4,
       updated_at = NOW()
     WHERE id = $1::uuid AND org_id = $2::uuid`,
    [
      refund.id,
      input.orgId,
      providerResult.state === 'FAILED' ? 'FAILED' : 'PROCESSING',
      providerResult.refundReference || order.provider_reference,
    ],
  )
  if (providerResult.state === 'SUCCEEDED') {
    return finalizeCommerceRefund({
      orgId: input.orgId,
      refundId: refund.id,
      actorUserId: input.requestedBy,
      idempotencyKey: `finalize-refund:${refund.id}`,
    })
  }
  return {
    refundId: refund.id,
    status: providerResult.state,
    requiresConfirmation: providerResult.state === 'PENDING',
  }
}

export async function finalizeCommerceRefund(input: {
  orgId: string
  refundId: string
  actorUserId: string
  idempotencyKey: string
}) {
  const client = await connectPostgresClient()
  try {
    await client.query('BEGIN')
    await client.query(
      `INSERT INTO public.commerce_transaction_operations (
         org_id, operation_type, aggregate_type, aggregate_id,
         idempotency_key, status, started_at
       ) VALUES (
         $1::uuid, 'FINALIZE_REFUND', 'REFUND', $2::uuid, $3, 'PENDING', NOW()
       )
       ON CONFLICT (org_id, idempotency_key) DO NOTHING`,
      [input.orgId, input.refundId, input.idempotencyKey],
    )
    const operationResult = await client.query<{
      id: string
      status: string
      result: Record<string, unknown>
    }>(
      `SELECT id::text, status, result
       FROM public.commerce_transaction_operations
       WHERE org_id = $1::uuid AND idempotency_key = $2
       FOR UPDATE`,
      [input.orgId, input.idempotencyKey],
    )
    const operation = operationResult.rows[0]
    if (!operation) throw new Error('Operasi refund tidak dapat dikunci.')
    if (operation.status === 'SUCCEEDED') {
      await client.query('COMMIT')
      return { ...operation.result, alreadyProcessed: true }
    }

    const refundResult = await client.query<{
      id: string
      order_id: string
      payment_intent_id: string
      amount: number
      order_number: string
      grand_total: number
      gateway_fee_amount: number
      branch_id: string
      status: string
      order_status: string
      bank_account_id: string
      user_id: string | null
      reason: string
      customer_name: string
      customer_email: string | null
      customer_phone: string
    }>(
      `SELECT
         refund.id::text,
         refund.order_id::text,
         refund.payment_intent_id::text,
         refund.amount::float8,
         ecommerce_order.order_number,
         ecommerce_order.grand_total::float8,
         ecommerce_order.gateway_fee_amount::float8,
         ecommerce_order.branch_id::text,
         refund.status,
         ecommerce_order.status::text AS order_status,
         settings.bank_account_id::text,
         ecommerce_order.user_id::text,
         refund.reason,
         ecommerce_order.customer_name,
         ecommerce_order.customer_email,
         ecommerce_order.customer_phone
       FROM public.commerce_refunds refund
       JOIN public.ecommerce_orders ecommerce_order
         ON ecommerce_order.id = refund.order_id
        AND ecommerce_order.org_id = refund.org_id
       JOIN public.commerce_branch_account_settings settings
         ON settings.org_id = ecommerce_order.org_id
        AND settings.branch_id = ecommerce_order.branch_id
       WHERE refund.id = $1::uuid
         AND refund.org_id = $2::uuid
       FOR UPDATE OF refund, ecommerce_order`,
      [input.refundId, input.orgId],
    )
    const refund = refundResult.rows[0]
    if (!refund) throw new Error('Refund tidak ditemukan atau akun Cabang belum lengkap.')
    if (refund.order_status === 'REFUNDED' && refund.status === 'SUCCEEDED') {
      await client.query('COMMIT')
      return { refundId: refund.id, alreadyProcessed: true }
    }
    if (Math.abs(refund.amount - refund.grand_total) > 0.01) {
      throw new Error('Otomasi saat ini hanya menerima refund penuh.')
    }
    if (refund.gateway_fee_amount > 0.01) {
      throw new Error(
        'Refund dengan biaya gateway harus direkonsiliasi dahulu sebelum pembalikan otomatis.',
      )
    }
    const consumed = await client.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM public.ecommerce_inventory_reservations
       WHERE org_id = $1::uuid
         AND order_id = $2::uuid
         AND status = 'CONSUMED'`,
      [input.orgId, refund.order_id],
    )
    if (Number(consumed.rows[0]?.count || 0) > 0) {
      throw new Error('Barang sudah dipenuhi. Proses retur stok sebelum menyelesaikan refund.')
    }
    const paidCommission = await client.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM public.commerce_affiliate_commissions
       WHERE org_id = $1::uuid
         AND order_id = $2::uuid
         AND status = 'PAID'`,
      [input.orgId, refund.order_id],
    )
    if (Number(paidCommission.rows[0]?.count || 0) > 0) {
      throw new Error('Komisi sudah dibayar. Buat recovery komisi sebelum refund.')
    }

    const originalJournal = await client.query<{ id: string }>(
      `SELECT id::text
       FROM public.journal_entries
       WHERE org_id = $1::uuid
         AND reference_type = 'COMMERCE_PAYMENT'
         AND reference_id = $2::uuid
         AND status = 'POSTED'
       LIMIT 1`,
      [input.orgId, refund.order_id],
    )
    if (!originalJournal.rows[0]) throw new Error('Jurnal pembayaran asli tidak ditemukan.')
    const numberResult = await client.query<{ entry_number: string }>(
      `SELECT public.generate_entry_number($1::uuid) AS entry_number`,
      [input.orgId],
    )
    const reversalResult = await client.query<{ id: string }>(
      `INSERT INTO public.journal_entries (
         org_id, branch_id, entry_number, entry_date, description,
         reference_type, reference_id, status, is_auto
       ) VALUES (
         $1::uuid, $2::uuid, $3, CURRENT_DATE, $4,
         'COMMERCE_REFUND', $5::uuid, 'DRAFT', TRUE
       )
       RETURNING id::text`,
      [
        input.orgId,
        refund.branch_id,
        numberResult.rows[0].entry_number,
        `Refund ${refund.order_number}`,
        refund.id,
      ],
    )
    const reversalJournalId = reversalResult.rows[0].id
    await client.query(
      `INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
       SELECT $1::uuid, account_id, credit, debit, $2
       FROM public.journal_lines
       WHERE entry_id = $3::uuid`,
      [
        reversalJournalId,
        `Pembalikan pembayaran ${refund.order_number}`,
        originalJournal.rows[0].id,
      ],
    )
    await client.query(
      `UPDATE public.journal_entries SET status = 'POSTED', updated_at = NOW()
       WHERE id = $1::uuid`,
      [reversalJournalId],
    )
    const bankResult = await client.query<{ id: string }>(
      `INSERT INTO public.bank_transactions (
         org_id, branch_id, bank_account_id, transaction_date, description,
         amount, type, reference_number, category_id, journal_entry_id, status,
         reference_type, reference_id, idempotency_key
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, CURRENT_DATE, $4,
         $5, 'OUT', $6, NULL, $7::uuid, 'POSTED',
         'COMMERCE_REFUND', $8::uuid, $9
       )
       ON CONFLICT (org_id, idempotency_key) DO UPDATE
       SET journal_entry_id = EXCLUDED.journal_entry_id
       RETURNING id::text`,
      [
        input.orgId,
        refund.branch_id,
        refund.bank_account_id,
        `Refund ${refund.order_number}`,
        refund.amount,
        `REF-${refund.order_number}`,
        reversalJournalId,
        refund.id,
        `commerce-refund-bank:${refund.id}`,
      ],
    )

    const directlyAffected = await client.query<{ course_id: string }>(
      `SELECT DISTINCT course_id::text
       FROM public.learning_access_grants
       WHERE org_id = $1::uuid
         AND source_type = 'ORDER'
         AND source_id = $2::uuid`,
      [input.orgId, refund.order_id],
    )
    const linkedSubscriptions = await client.query<{ id: string }>(
      `SELECT id::text
       FROM public.commerce_subscriptions
       WHERE org_id = $1::uuid
         AND (initial_order_id = $2::uuid OR latest_order_id = $2::uuid)
       FOR UPDATE`,
      [input.orgId, refund.order_id],
    )
    await client.query(
      `UPDATE public.learning_access_grants
       SET status = 'REVOKED', revoked_at = NOW(),
           revoked_reason = 'ORDER_REFUNDED', updated_at = NOW()
       WHERE org_id = $1::uuid
         AND source_type = 'ORDER'
         AND source_id = $2::uuid
         AND status <> 'REVOKED'`,
      [input.orgId, refund.order_id],
    )
    await client.query(
      `UPDATE public.commerce_memberships
       SET status = 'CANCELLED', cancelled_at = NOW(), updated_at = NOW()
       WHERE org_id = $1::uuid
         AND source_type = 'ORDER'
         AND source_id = $2::uuid
         AND status NOT IN ('CANCELLED', 'EXPIRED')`,
      [input.orgId, refund.order_id],
    )
    for (const subscription of linkedSubscriptions.rows) {
      await revokeSubscriptionEntitlements(client, {
        orgId: input.orgId,
        subscriptionId: subscription.id,
        reason: 'ORDER_REFUNDED',
        membershipStatus: 'CANCELLED',
      })
    }
    await client.query(
      `UPDATE public.commerce_subscriptions
       SET status = 'CANCELLED', cancelled_at = NOW(),
           cancellation_reason = 'ORDER_REFUNDED', updated_at = NOW()
       WHERE org_id = $1::uuid
         AND (initial_order_id = $2::uuid OR latest_order_id = $2::uuid)
         AND status NOT IN ('CANCELLED', 'EXPIRED')`,
      [input.orgId, refund.order_id],
    )
    if (refund.user_id && directlyAffected.rows.length > 0) {
      await reconcileEffectiveEnrollments(client, {
        orgId: input.orgId,
        userId: refund.user_id,
        courseIds: directlyAffected.rows.map((row) => row.course_id),
      })
    }
    await client.query(
      `UPDATE public.commerce_affiliate_commissions
       SET status = 'CANCELLED', cancelled_at = NOW(),
           cancellation_reason = 'ORDER_REFUNDED', updated_at = NOW()
       WHERE org_id = $1::uuid
         AND order_id = $2::uuid
         AND status <> 'PAID'`,
      [input.orgId, refund.order_id],
    )
    await client.query(
      `UPDATE public.ecommerce_inventory_reservations
       SET status = 'RELEASED', released_at = NOW(), updated_at = NOW()
       WHERE org_id = $1::uuid
         AND order_id = $2::uuid
         AND status = 'ACTIVE'`,
      [input.orgId, refund.order_id],
    )
    await cancelConsultingOrderForRefund(client, {
      orgId: input.orgId,
      orderId: refund.order_id,
      actorUserId: input.actorUserId,
      reason: refund.reason,
    })
    await client.query(
      `UPDATE public.commerce_payment_intents
       SET status = 'REFUNDED', updated_at = NOW()
       WHERE id = $1::uuid AND org_id = $2::uuid`,
      [refund.payment_intent_id, input.orgId],
    )
    await client.query(
      `UPDATE public.ecommerce_orders
       SET status = 'REFUNDED', updated_at = NOW()
       WHERE id = $1::uuid AND org_id = $2::uuid`,
      [refund.order_id, input.orgId],
    )
    await client.query(
      `UPDATE public.sales
       SET status = 'VOIDED', payment_status = 'UNPAID', updated_at = NOW()
       WHERE org_id = $1::uuid
         AND reference_type = 'ECOMMERCE_ORDER'
         AND reference_id = $2::uuid`,
      [input.orgId, refund.order_id],
    )
    await client.query(
      `UPDATE public.commerce_refunds
       SET status = 'SUCCEEDED', reversal_journal_entry_id = $3::uuid,
           reversal_bank_transaction_id = $4::uuid, completed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1::uuid AND org_id = $2::uuid`,
      [refund.id, input.orgId, reversalJournalId, bankResult.rows[0].id],
    )
    await client.query(
      `INSERT INTO public.ecommerce_order_events (
         org_id, order_id, actor_user_id, actor_label, event_type, message, payload
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, 'INTERNAL', 'ORDER_REFUNDED',
         'Refund selesai; jurnal, kas, akses, subscription, dan komisi dibalik.',
         $4::jsonb
       )`,
      [
        input.orgId,
        refund.order_id,
        input.actorUserId,
        JSON.stringify({ refundId: refund.id, reversalJournalId }),
      ],
    )
    const refundVariables: Record<string, string | number | null> = {
      name: refund.customer_name || 'Member',
      order_number: refund.order_number,
      amount: formatRupiah(refund.amount),
    }
    const refundRecipients: Array<{ channel: 'EMAIL' | 'WHATSAPP'; value: string }> = []
    if (refund.customer_email) refundRecipients.push({ channel: 'EMAIL', value: refund.customer_email })
    if (refund.customer_phone) refundRecipients.push({ channel: 'WHATSAPP', value: refund.customer_phone })
    for (const recipient of refundRecipients) {
      await enqueueNotification({
        orgId: input.orgId,
        userId: refund.user_id,
        eventType: 'ORDER_REFUNDED',
        channel: recipient.channel,
        recipient: recipient.value,
        templateKey: 'ORDER_REFUNDED',
        variables: refundVariables,
        idempotencyKey: `order-refunded:${refund.id}:${recipient.channel}`,
        payload: { refundId: refund.id, orderId: refund.order_id },
      }, client)
    }

    const result = {
      refundId: refund.id,
      orderId: refund.order_id,
      reversalJournalId,
      bankTransactionId: bankResult.rows[0].id,
    }
    await client.query(
      `UPDATE public.commerce_transaction_operations
       SET status = 'SUCCEEDED', result = $2::jsonb,
           completed_at = NOW(), updated_at = NOW()
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
