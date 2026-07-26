import { NextRequest, NextResponse } from 'next/server'
import { dispatchNotificationOutbox } from '@/modules/notifications/outbox.server'
import { enqueueCoreisecReminders } from '@/modules/notifications/coreisec-reminders.server'
import { timingSafeTextEqual } from '@/modules/ecommerce/payments/signature'
import { expireConsultingHoldsAndOrders } from '@/modules/consulting/lib/consulting.server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const expected = String(process.env.COREISEC_CRON_SECRET || '').trim()
  const provided = String(request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (expected.length < 32 || !timingSafeTextEqual(provided, expected)) {
    return NextResponse.json({ error: 'Akses ditolak.' }, { status: 401 })
  }
  try {
    const consultingExpiry = await expireConsultingHoldsAndOrders()
    const reminders = await enqueueCoreisecReminders(250)
    const dispatch = await dispatchNotificationOutbox(50)
    return NextResponse.json({ success: true, consultingExpiry, reminders, dispatch })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Worker notifikasi gagal.' },
      { status: 500 },
    )
  }
}
