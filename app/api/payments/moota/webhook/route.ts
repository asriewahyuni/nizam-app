/**
 * Callback mutasi Moota melalui relay HMAC Nizam.
 */
import { NextRequest, NextResponse } from 'next/server'
import { processPaymentWebhook } from '@/modules/ecommerce/payments/payment-orchestration.server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const result = await processPaymentWebhook({
    providerCode: 'MOOTA',
    rawBody,
    headers: request.headers,
  })
  return NextResponse.json(
    result.accepted ? { success: true } : { success: false, error: result.message },
    { status: result.status },
  )
}
