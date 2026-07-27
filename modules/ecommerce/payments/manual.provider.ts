/**
 * Provider transfer manual. Verifikasi akhir dilakukan admin setelah bukti
 * transfer diperiksa; provider tidak pernah menandai order lunas sendiri.
 */
import type {
  CreatePaymentInput,
  PaymentProvider,
  RefundPaymentInput,
} from './payment-provider'

type ManualPaymentConfig = {
  bankName: string
  accountNumber: string
  accountHolder: string
  instructions?: string
}

export class ManualPaymentProvider implements PaymentProvider {
  readonly code = 'MANUAL'

  constructor(private readonly config: ManualPaymentConfig) {}

  async createPayment(input: CreatePaymentInput) {
    if (!this.config.accountNumber) {
      throw new Error('Rekening transfer manual toko ini belum dikonfigurasi. Atur rekening penerima di pengaturan toko.')
    }
    return {
      providerCode: this.code,
      providerReference: `MANUAL:${input.orderNumber}`,
      state: 'PENDING' as const,
      amount: input.amount,
      checkoutUrl: null,
      expiresAt: new Date(Date.now() + input.expiresInMinutes * 60_000).toISOString(),
      instructions: {
        bankName: this.config.bankName,
        accountNumber: this.config.accountNumber,
        accountHolder: this.config.accountHolder,
        notes: this.config.instructions || null,
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
      rawResponse: {},
    }
  }

  async validateWebhook() {
    return {
      valid: false,
      providerCode: this.code,
      providerEventId: 'manual-no-webhook',
      providerReference: null,
      orderNumber: null,
      state: 'PENDING' as const,
      amount: null,
      feeAmount: 0,
      rawPayload: {},
      reason: 'Transfer manual tidak menerima webhook.',
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
