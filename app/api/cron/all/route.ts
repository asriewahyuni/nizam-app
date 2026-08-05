import { NextRequest, NextResponse } from 'next/server'
import { queryPostgres } from '@/lib/db/postgres'
import { dispatchNotificationOutbox } from '@/modules/notifications/outbox.server'
import { enqueueCoreisecReminders } from '@/modules/notifications/coreisec-reminders.server'
import { timingSafeTextEqual } from '@/modules/ecommerce/payments/signature'
import { expireConsultingHoldsAndOrders } from '@/modules/consulting/lib/consulting.server'
import { processSubscriptionLifecycle } from '@/modules/ecommerce/payments/subscription.service'
import { refreshProvisionedLmsDomains } from '@/modules/ecommerce/domains/lms-domain.server'
import { tagihIjarah } from '@/modules/kojasmat/actions/kojasmat-ijarah.actions'

export const runtime = 'nodejs'

// Satu titik masuk cron untuk seluruh sistem Nizam — memanggil semua worker
// berkala secara langsung (bukan HTTP self-call ke /api/cron/* lain), supaya
// pemicu eksternal (Railway Cron Service dkk.) cukup hit SATU URL. Setiap job
// dibungkus try/catch sendiri — satu job gagal tidak menghentikan job lainnya.
export async function POST(request: NextRequest) {
  const expected = String(process.env.COREISEC_CRON_SECRET || '').trim()
  const provided = String(request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (expected.length < 32 || !timingSafeTextEqual(provided, expected)) {
    return NextResponse.json({ error: 'Akses ditolak.' }, { status: 401 })
  }

  const results: Record<string, unknown> = {}

  async function run(name: string, job: () => Promise<unknown>) {
    try {
      results[name] = { success: true, data: await job() }
    } catch (error) {
      results[name] = { success: false, error: error instanceof Error ? error.message : 'Gagal' }
    }
  }

  await run('consultingExpiry', () => expireConsultingHoldsAndOrders())
  await run('reminders', () => enqueueCoreisecReminders(250))
  await run('notificationDispatch', () => dispatchNotificationOutbox(50))
  await run('subscriptions', () => processSubscriptionLifecycle({
    baseUrl: String(process.env.NEXT_PUBLIC_APP_URL || '').trim() || undefined,
  }))
  await run('lmsDomains', () => refreshProvisionedLmsDomains(50))
  await run('kojasmatIjarah', async () => {
    const { rows: due } = await queryPostgres<{ id: string }>(
      `SELECT id FROM kojasmat_akad_ijarah
       WHERE status IN ('AKTIF','DIBEKUKAN') AND tagihan_berikutnya <= CURRENT_DATE
       ORDER BY tagihan_berikutnya ASC LIMIT 500`
    )
    let charged = 0, frozen = 0, failed = 0
    for (const row of due) {
      const res = await tagihIjarah(row.id)
      if ('error' in res) failed++
      else if (res.charged) charged++
      else frozen++
    }
    return { processed: due.length, charged, frozen, failed }
  })

  return NextResponse.json({ success: true, results })
}
