import { NextRequest, NextResponse } from 'next/server'
import { processSubscriptionLifecycle } from '@/modules/ecommerce/payments/subscription.service'
import { timingSafeTextEqual } from '@/modules/ecommerce/payments/signature'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const expected = String(process.env.COREISEC_CRON_SECRET || '').trim()
  const provided = String(request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (expected.length < 32 || !timingSafeTextEqual(provided, expected)) {
    return NextResponse.json({ error: 'Akses ditolak.' }, { status: 401 })
  }
  try {
    const result = await processSubscriptionLifecycle({
      baseUrl: String(process.env.NEXT_PUBLIC_APP_URL || '').trim() || undefined,
    })
    return NextResponse.json({ success: true, result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Siklus subscription gagal.' },
      { status: 500 },
    )
  }
}
