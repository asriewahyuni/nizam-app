/**
 * Callback pembayaran Duitku. Redirect browser tidak pernah dipakai untuk
 * mengubah status order.
 */
import { NextRequest, NextResponse } from 'next/server'
import { processPaymentWebhook } from '@/modules/ecommerce/payments/payment-orchestration.server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const fields = new URLSearchParams(rawBody)
  const result = await processPaymentWebhook({
    providerCode: 'DUITKU',
    rawBody,
    headers: request.headers,
    fields,
  })
  return NextResponse.json(
    result.accepted ? { success: true } : { success: false, error: result.message },
    { status: result.status },
  )
}
