/**
 * Pembuatan tagihan dan pemrosesan webhook provider secara idempoten.
 */
import 'server-only'

import { createHash } from 'node:crypto'
import { queryPostgres } from '@/lib/db/postgres'
import { getPaymentProvider } from './provider-registry.server'
import { finalizePaidCommerceOrder } from './commerce-payment.service'
import { releaseConsultingOrderHolds } from '@/modules/consulting/lib/consulting.server'

type PaymentOrderRow = {
  id: string
  org_id: string
  order_number: string
  customer_name: string
  customer_email: string | null
  customer_phone: string
  grand_total: number
  currency: string
  status: string
}

export async function createCommercePaymentIntent(input: {
  orgId: string
  orderId: string
  providerCode: string
  returnUrl: string
  callbackUrl: string
  paymentMethod?: string
  expiresInMinutes?: number
  idempotencyKey: string
}) {
  const orderResult = await queryPostgres<PaymentOrderRow>(
    `SELECT
       id::text,
       org_id::text,
       order_number,
       customer_name,
       customer_email,
       customer_phone,
       grand_total::float8,
       currency,
       status::text
     FROM public.ecommerce_orders
     WHERE id = $1::uuid AND org_id = $2::uuid
     LIMIT 1`,
    [input.orderId, input.orgId],
  )
  const order = orderResult.rows[0]
  if (!order) throw new Error('Order tidak ditemukan.')
  if (['PAID', 'COMPLETED', 'REFUNDED', 'CANCELLED'].includes(order.status)) {
    throw new Error('Order ini tidak dapat dibuatkan tagihan baru.')
  }
  if (!order.customer_email) {
    throw new Error('Email pelanggan wajib tersedia untuk membuat tagihan.')
  }
  if (order.currency !== 'IDR') {
    throw new Error('Provider saat ini hanya mendukung Rupiah.')
  }

  const providerCode = input.providerCode.trim().toUpperCase()
  const existing = await queryPostgres<{
    id: string
    provider_reference: string | null
    status: string
    checkout_url: string | null
    expires_at: string | null
    response_payload: Record<string, unknown>
  }>(
    `SELECT
       id::text,
       provider_reference,
       status,
       checkout_url,
       expires_at::text,
       response_payload
     FROM public.commerce_payment_intents
     WHERE org_id = $1::uuid AND idempotency_key = $2
     LIMIT 1`,
    [input.orgId, input.idempotencyKey],
  )
  if (existing.rows[0]?.provider_reference) {
    return { ...existing.rows[0], alreadyCreated: true }
  }

  const intentResult = await queryPostgres<{ id: string }>(
    `INSERT INTO public.commerce_payment_intents (
       org_id,
       order_id,
       provider_code,
       amount,
       currency,
       status,
       idempotency_key,
       request_payload
     )
     VALUES (
       $1::uuid, $2::uuid, $3, $4, 'IDR', 'PENDING', $5, $6::jsonb
     )
     ON CONFLICT (org_id, idempotency_key) DO UPDATE
     SET updated_at = NOW()
     RETURNING id::text`,
    [
      input.orgId,
      input.orderId,
      providerCode,
      order.grand_total,
      input.idempotencyKey,
      JSON.stringify({ paymentMethod: input.paymentMethod || null }),
    ],
  )
  const intentId = intentResult.rows[0].id
  const provider = getPaymentProvider(providerCode)

  try {
    const created = await provider.createPayment({
      orderId: order.id,
      orderNumber: order.order_number,
      amount: order.grand_total,
      currency: 'IDR',
      customerName: order.customer_name,
      customerEmail: order.customer_email,
      customerPhone: order.customer_phone,
      description: `Pembayaran order ${order.order_number}`,
      returnUrl: input.returnUrl,
      callbackUrl: input.callbackUrl,
      expiresInMinutes: input.expiresInMinutes || 60 * 24,
      paymentMethod: input.paymentMethod,
      idempotencyKey: input.idempotencyKey,
    })
    await queryPostgres(
      `UPDATE public.commerce_payment_intents
       SET
         provider_reference = $3,
         checkout_url = $4,
         expires_at = $5::timestamptz,
         response_payload = $6::jsonb,
         updated_at = NOW()
       WHERE id = $1::uuid AND org_id = $2::uuid`,
      [
        intentId,
        input.orgId,
        created.providerReference,
        created.checkoutUrl,
        created.expiresAt,
        JSON.stringify({
          instructions: created.instructions,
          provider: created.rawResponse,
        }),
      ],
    )
    return {
      id: intentId,
      provider_reference: created.providerReference,
      status: created.state,
      checkout_url: created.checkoutUrl,
      expires_at: created.expiresAt,
      response_payload: {
        instructions: created.instructions,
        provider: created.rawResponse,
      },
      alreadyCreated: false,
    }
  } catch (error) {
    await queryPostgres(
      `UPDATE public.commerce_payment_intents
       SET status = 'FAILED', response_payload = $3::jsonb, updated_at = NOW()
       WHERE id = $1::uuid AND org_id = $2::uuid`,
      [
        intentId,
        input.orgId,
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Provider gagal membuat tagihan.',
        }),
      ],
    )
    throw error
  }
}

type PendingIntentRow = {
  id: string
  org_id: string
  order_id: string
  order_number: string
  amount: number
  provider_reference: string | null
}

async function resolvePendingIntent(input: {
  providerCode: string
  orderNumber: string | null
  providerReference: string | null
  amount: number | null
}) {
  if (input.orderNumber) {
    const result = await queryPostgres<PendingIntentRow>(
      `SELECT
         intent.id::text,
         intent.org_id::text,
         intent.order_id::text,
         order_row.order_number,
         intent.amount::float8,
         intent.provider_reference
       FROM public.commerce_payment_intents intent
       JOIN public.ecommerce_orders order_row
         ON order_row.id = intent.order_id
        AND order_row.org_id = intent.org_id
       WHERE intent.provider_code = $1
         AND order_row.order_number = $2
         AND intent.status IN ('PENDING', 'AWAITING_REVIEW')
       ORDER BY intent.created_at DESC
       LIMIT 1`,
      [input.providerCode, input.orderNumber],
    )
    return result.rows[0] || null
  }

  if (input.amount != null && input.amount > 0) {
    const result = await queryPostgres<PendingIntentRow>(
      `SELECT
         intent.id::text,
         intent.org_id::text,
         intent.order_id::text,
         order_row.order_number,
         intent.amount::float8,
         intent.provider_reference
       FROM public.commerce_payment_intents intent
       JOIN public.ecommerce_orders order_row
         ON order_row.id = intent.order_id
        AND order_row.org_id = intent.org_id
       WHERE intent.provider_code = $1
         AND intent.status IN ('PENDING', 'AWAITING_REVIEW')
         AND ABS(intent.amount - $2) <= 0.01
         AND (intent.expires_at IS NULL OR intent.expires_at > NOW())
       ORDER BY intent.created_at
       LIMIT 2`,
      [input.providerCode, input.amount],
    )
    if (result.rows.length > 1) {
      throw new Error('Mutasi cocok dengan lebih dari satu tagihan; perlu rekonsiliasi manual.')
    }
    return result.rows[0] || null
  }

  return null
}

export async function processPaymentWebhook(input: {
  providerCode: string
  rawBody: string
  headers: Headers
  fields?: URLSearchParams
}) {
  const provider = getPaymentProvider(input.providerCode)
  const validated = await provider.validateWebhook({
    rawBody: input.rawBody,
    headers: input.headers,
    fields: input.fields,
  })
  const payloadHash = createHash('sha256').update(input.rawBody).digest('hex')

  const existing = await queryPostgres<{
    id: string
    status: string
    org_id: string | null
  }>(
    `INSERT INTO public.commerce_payment_webhook_events (
       provider_code,
       provider_event_id,
       signature_valid,
       payload_sha256,
       payload,
       status,
       error_message
     )
     VALUES ($1, $2, $3, $4, $5::jsonb, 'RECEIVED', $6)
     ON CONFLICT (provider_code, provider_event_id) DO UPDATE
     SET
       signature_valid = public.commerce_payment_webhook_events.signature_valid
         OR EXCLUDED.signature_valid
     RETURNING id::text, status, org_id::text`,
    [
      validated.providerCode,
      validated.providerEventId,
      validated.valid,
      payloadHash,
      JSON.stringify(validated.rawPayload),
      validated.reason || null,
    ],
  )
  const event = existing.rows[0]
  if (!validated.valid) {
    await queryPostgres(
      `UPDATE public.commerce_payment_webhook_events
       SET status = 'IGNORED', processed_at = NOW(), error_message = $2
       WHERE id = $1::uuid`,
      [event.id, validated.reason || 'Signature tidak valid.'],
    )
    return { accepted: false, status: 401, message: 'Signature tidak valid.' }
  }
  if (event.status === 'PROCESSED') {
    return { accepted: true, status: 200, duplicate: true }
  }
  if (validated.state === 'FAILED' || validated.state === 'EXPIRED') {
    const intent = await resolvePendingIntent({
      providerCode: validated.providerCode,
      orderNumber: validated.orderNumber,
      providerReference: validated.providerReference,
      amount: validated.amount,
    })
    if (intent) {
      await queryPostgres(
        `UPDATE public.commerce_payment_intents
         SET status = $3, updated_at = NOW()
         WHERE id = $1::uuid AND org_id = $2::uuid`,
        [intent.id, intent.org_id, validated.state],
      )
      await releaseConsultingOrderHolds({
        orgId: intent.org_id,
        orderId: intent.order_id,
        reason: `Pembayaran ${validated.state.toLowerCase()}; jadwal Consulting 360 dilepas.`,
      })
    }
    await queryPostgres(
      `UPDATE public.commerce_payment_webhook_events
       SET status = 'PROCESSED', processed_at = NOW(), error_message = $2
       WHERE id = $1::uuid`,
      [event.id, validated.reason || `Status pembayaran ${validated.state}.`],
    )
    return { accepted: true, status: 200, released: Boolean(intent) }
  }
  if (validated.state !== 'PAID') {
    await queryPostgres(
      `UPDATE public.commerce_payment_webhook_events
       SET status = 'IGNORED', processed_at = NOW(), error_message = $2
       WHERE id = $1::uuid`,
      [event.id, validated.reason || `Status ${validated.state} tidak memfinalisasi pembayaran.`],
    )
    return { accepted: true, status: 200, ignored: true }
  }

  try {
    const intent = await resolvePendingIntent({
      providerCode: validated.providerCode,
      orderNumber: validated.orderNumber,
      providerReference: validated.providerReference,
      amount: validated.amount,
    })
    if (!intent) throw new Error('Tagihan yang cocok tidak ditemukan.')

    let paidAmount = validated.amount
    let feeAmount = validated.feeAmount
    let providerReference = validated.providerReference || intent.provider_reference || ''
    let rawPayload = validated.rawPayload

    if (validated.providerCode === 'DUITKU') {
      const checked = await provider.checkStatus(
        providerReference,
        intent.order_number,
      )
      if (checked.state !== 'PAID') {
        throw new Error('Status transaksi Duitku belum terverifikasi sebagai berhasil.')
      }
      paidAmount = checked.amount
      feeAmount = checked.feeAmount
      providerReference = checked.providerReference
      rawPayload = {
        callback: validated.rawPayload,
        statusCheck: checked.rawResponse,
      }
    }
    if (paidAmount == null) throw new Error('Nominal pembayaran tidak tersedia.')

    await queryPostgres(
      `UPDATE public.commerce_payment_webhook_events
       SET org_id = $2::uuid, status = 'PROCESSING', error_message = NULL
       WHERE id = $1::uuid`,
      [event.id, intent.org_id],
    )
    const result = await finalizePaidCommerceOrder({
      orgId: intent.org_id,
      orderId: intent.order_id,
      paymentIntentId: intent.id,
      providerCode: validated.providerCode,
      providerReference,
      providerEventId: validated.providerEventId,
      paidAmount,
      gatewayFeeAmount: feeAmount,
      idempotencyKey: `webhook:${validated.providerCode}:${validated.providerEventId}`,
      rawProviderPayload: rawPayload,
    })
    await queryPostgres(
      `UPDATE public.commerce_payment_webhook_events
       SET status = 'PROCESSED', processed_at = NOW(), error_message = NULL
       WHERE id = $1::uuid`,
      [event.id],
    )
    return { accepted: true, status: 200, result }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook gagal diproses.'
    await queryPostgres(
      `UPDATE public.commerce_payment_webhook_events
       SET status = 'FAILED', error_message = $2
       WHERE id = $1::uuid`,
      [event.id, message],
    )
    return { accepted: false, status: 500, message }
  }
}
