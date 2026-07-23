/**
 * Kontrak provider pembayaran. Provider hanya berkomunikasi dengan gateway;
 * perubahan order, akses, dan jurnal ditangani service transaksi Nizam.
 */
export type PaymentState = 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'REFUNDED'

export type CreatePaymentInput = {
  orderId: string
  orderNumber: string
  amount: number
  currency: 'IDR'
  customerName: string
  customerEmail: string
  customerPhone?: string | null
  description: string
  returnUrl: string
  callbackUrl: string
  expiresInMinutes: number
  paymentMethod?: string
  idempotencyKey: string
}

export type CreatedPayment = {
  providerCode: string
  providerReference: string
  state: PaymentState
  amount: number
  checkoutUrl: string | null
  expiresAt: string | null
  instructions: Record<string, unknown>
  rawResponse: Record<string, unknown>
}

export type PaymentStatusResult = {
  providerCode: string
  providerReference: string
  state: PaymentState
  amount: number | null
  feeAmount: number
  rawResponse: Record<string, unknown>
}

export type ValidatedPaymentWebhook = {
  valid: boolean
  providerCode: string
  providerEventId: string
  providerReference: string | null
  orderNumber: string | null
  state: PaymentState
  amount: number | null
  feeAmount: number
  rawPayload: Record<string, unknown>
  reason?: string
}

export type RefundPaymentInput = {
  providerReference: string
  orderNumber: string
  amount: number
  reason: string
  idempotencyKey: string
}

export type RefundPaymentResult = {
  providerCode: string
  providerReference: string
  refundReference: string | null
  state: 'PENDING' | 'SUCCEEDED' | 'FAILED'
  rawResponse: Record<string, unknown>
}

export interface PaymentProvider {
  readonly code: string
  createPayment(input: CreatePaymentInput): Promise<CreatedPayment>
  checkStatus(providerReference: string, orderNumber: string): Promise<PaymentStatusResult>
  validateWebhook(input: {
    rawBody: string
    headers: Headers
    fields?: URLSearchParams
  }): Promise<ValidatedPaymentWebhook>
  refund(input: RefundPaymentInput): Promise<RefundPaymentResult>
}
