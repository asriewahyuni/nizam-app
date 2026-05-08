import { NextRequest, NextResponse } from 'next/server'
import { createCheckoutOrder } from '@/modules/ecommerce/lib/ecommerce.server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()
    const source = (typeof payload === 'object' && payload) ? payload as Record<string, unknown> : {}
    const data = await createCheckoutOrder({
      ...source,
      idempotencyKey:
        String(request.headers.get('x-idempotency-key') || '').trim()
        || String(source.idempotencyKey || '').trim(),
      clientIp:
        String(request.headers.get('x-forwarded-for') || '').trim()
        || String(request.headers.get('x-real-ip') || '').trim(),
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Checkout gagal.' },
      { status: 400 }
    )
  }
}
