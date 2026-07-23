/**
 * Adapter Duitku sesuai API merchant v2 dan callback HMAC-SHA256.
 */
import { createHash } from 'node:crypto'
import type {
  CreatePaymentInput,
  PaymentProvider,
  PaymentState,
  RefundPaymentInput,
} from './payment-provider'
import { hmacSha256Hex, safeEqualHex } from './signature'

type DuitkuConfig = {
  merchantCode: string
  apiKey: string
  sandbox: boolean
}

type JsonRecord = Record<string, unknown>

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {}
}

function stateFromCode(value: unknown): PaymentState {
  const code = String(value || '')
  if (code === '00') return 'PAID'
  if (code === '02') return 'EXPIRED'
  if (code === '01') return 'PENDING'
  return 'FAILED'
}

export class DuitkuPaymentProvider implements PaymentProvider {
  readonly code = 'DUITKU'

  constructor(private readonly config: DuitkuConfig) {}

  private get baseUrl() {
    return this.config.sandbox
      ? 'https://sandbox.duitku.com'
      : 'https://passport.duitku.com'
  }

  async createPayment(input: CreatePaymentInput) {
    const roundedAmount = Math.round(input.amount)
    const signature = hmacSha256Hex(
      this.config.apiKey,
      `${this.config.merchantCode}${input.orderNumber}${roundedAmount}`,
    )
    const payload = {
      merchantCode: this.config.merchantCode,
      paymentAmount: roundedAmount,
      merchantOrderId: input.orderNumber,
      productDetails: input.description.slice(0, 255),
      email: input.customerEmail,
      phoneNumber: input.customerPhone || undefined,
      customerVaName: input.customerName.slice(0, 20),
      paymentMethod: input.paymentMethod,
      returnUrl: input.returnUrl,
      callbackUrl: input.callbackUrl,
      signature,
      expiryPeriod: input.expiresInMinutes,
    }
    const response = await fetch(`${this.baseUrl}/webapi/api/merchant/v2/inquiry`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    })
    const body = asRecord(await response.json().catch(() => ({})))
    if (!response.ok) {
      throw new Error(`Duitku menolak pembuatan tagihan (${response.status}).`)
    }

    const reference = String(body.reference || body.merchantOrderId || input.orderNumber)
    return {
      providerCode: this.code,
      providerReference: reference,
      state: 'PENDING' as const,
      amount: roundedAmount,
      checkoutUrl: String(body.paymentUrl || '') || null,
      expiresAt: new Date(Date.now() + input.expiresInMinutes * 60_000).toISOString(),
      instructions: {
        vaNumber: body.vaNumber || null,
        qrString: body.qrString || null,
      },
      rawResponse: body,
    }
  }

  async checkStatus(providerReference: string, orderNumber: string) {
    const signature = hmacSha256Hex(
      this.config.apiKey,
      `${this.config.merchantCode}${orderNumber}`,
    )
    const response = await fetch(`${this.baseUrl}/webapi/api/merchant/transactionStatus`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        merchantCode: this.config.merchantCode,
        merchantOrderId: orderNumber,
        signature,
      }),
      cache: 'no-store',
    })
    const body = asRecord(await response.json().catch(() => ({})))
    if (!response.ok) {
      throw new Error(`Pemeriksaan status Duitku gagal (${response.status}).`)
    }
    return {
      providerCode: this.code,
      providerReference: String(body.reference || providerReference),
      state: stateFromCode(body.statusCode),
      amount: body.amount == null ? null : Number(body.amount),
      feeAmount: Number(body.fee || 0),
      rawResponse: body,
    }
  }

  async validateWebhook(input: {
    rawBody: string
    headers: Headers
    fields?: URLSearchParams
  }) {
    const fields = input.fields || new URLSearchParams(input.rawBody)
    const merchantCode = String(fields.get('merchantCode') || '')
    const amount = String(fields.get('amount') || '')
    const orderNumber = String(fields.get('merchantOrderId') || '')
    const signature = String(fields.get('signature') || '')
    const expected = hmacSha256Hex(
      this.config.apiKey,
      `${merchantCode}${amount}${orderNumber}`,
    )
    const valid = merchantCode === this.config.merchantCode && safeEqualHex(signature, expected)
    const reference = String(fields.get('reference') || '') || null
    const eventId = String(fields.get('publisherOrderId') || reference || '')
      || createHash('sha256').update(input.rawBody).digest('hex')

    return {
      valid,
      providerCode: this.code,
      providerEventId: eventId,
      providerReference: reference,
      orderNumber: orderNumber || null,
      state: valid ? stateFromCode(fields.get('resultCode')) : 'PENDING' as const,
      amount: amount ? Number(amount) : null,
      feeAmount: 0,
      rawPayload: Object.fromEntries(fields.entries()),
      ...(!valid ? { reason: 'Signature callback Duitku tidak valid.' } : {}),
    }
  }

  async refund(input: RefundPaymentInput) {
    return {
      providerCode: this.code,
      providerReference: input.providerReference,
      refundReference: null,
      state: 'PENDING' as const,
      rawResponse: {
        action: 'DUITKU_REFUND_REQUIRES_MERCHANT_APPROVAL',
        amount: input.amount,
        reason: input.reason,
      },
    }
  }
}
