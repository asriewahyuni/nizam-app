/**
 * Adapter Moota untuk pencocokan mutasi. Webhook wajib melewati HMAC milik
 * Nizam/relay agar pola lama yang menerima nominal tanpa autentikasi tidak terulang.
 */
import { createHash } from 'node:crypto'
import type {
  CreatePaymentInput,
  PaymentProvider,
  RefundPaymentInput,
  ValidatedPaymentWebhook,
} from './payment-provider'
import { verifyHmacSha256 } from './signature'

type MootaConfig = {
  bankName: string
  accountNumber: string
  accountHolder: string
  webhookSecret: string
}

type MootaMutation = {
  id?: string | number
  mutation_id?: string | number
  type?: string
  amount?: string | number
  description?: string
  note?: string
}

export class MootaPaymentProvider implements PaymentProvider {
  readonly code = 'MOOTA'

  constructor(private readonly config: MootaConfig) {}

  async createPayment(input: CreatePaymentInput) {
    return {
      providerCode: this.code,
      providerReference: `MOOTA:${input.orderNumber}`,
      state: 'PENDING' as const,
      amount: input.amount,
      checkoutUrl: null,
      expiresAt: new Date(Date.now() + input.expiresInMinutes * 60_000).toISOString(),
      instructions: {
        bankName: this.config.bankName,
        accountNumber: this.config.accountNumber,
        accountHolder: this.config.accountHolder,
        exactAmount: input.amount,
      },
      rawResponse: {},
    }
  }

  async checkStatus(providerReference: string) {
    return {
      providerCode: this.code,
      providerReference,
      state: 'PENDING' as const,
      amount: null,
      feeAmount: 0,
      rawResponse: {
        note: 'Status Moota ditentukan dari webhook mutasi, bukan polling berulang.',
      },
    }
  }

  async validateWebhook(input: {
    rawBody: string
    headers: Headers
  }): Promise<ValidatedPaymentWebhook> {
    const signature = input.headers.get('x-nizam-signature')
      || input.headers.get('x-moota-signature')
      || ''
    if (!verifyHmacSha256(this.config.webhookSecret, input.rawBody, signature)) {
      return {
        valid: false,
        providerCode: this.code,
        providerEventId: createHash('sha256').update(input.rawBody).digest('hex'),
        providerReference: null,
        orderNumber: null,
        state: 'PENDING',
        amount: null,
        feeAmount: 0,
        rawPayload: {},
        reason: 'Signature webhook Moota tidak valid.',
      }
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(input.rawBody)
      if (typeof parsed === 'string') parsed = JSON.parse(parsed)
    } catch {
      parsed = null
    }
    const mutations = Array.isArray(parsed) ? parsed as MootaMutation[] : []
    const credit = mutations.find((mutation) => (
      String(mutation.type || '').toUpperCase() === 'CR'
      && Number(mutation.amount || 0) > 0
    ))
    if (!credit) {
      return {
        valid: true,
        providerCode: this.code,
        providerEventId: createHash('sha256').update(input.rawBody).digest('hex'),
        providerReference: null,
        orderNumber: null,
        state: 'PENDING',
        amount: null,
        feeAmount: 0,
        rawPayload: { mutations },
        reason: 'Tidak ada mutasi kredit yang dapat dicocokkan.',
      }
    }

    const eventId = String(credit.id || credit.mutation_id || '')
      || createHash('sha256').update(input.rawBody).digest('hex')
    return {
      valid: true,
      providerCode: this.code,
      providerEventId: eventId,
      providerReference: null,
      orderNumber: null,
      state: 'PAID',
      amount: Number(credit.amount),
      feeAmount: 0,
      rawPayload: {
        mutation: credit,
      },
    }
  }

  async refund(input: RefundPaymentInput) {
    return {
      providerCode: this.code,
      providerReference: input.providerReference,
      refundReference: null,
      state: 'PENDING' as const,
      rawResponse: {
        action: 'MANUAL_BANK_REFUND_REQUIRED',
        amount: input.amount,
      },
    }
  }
}
