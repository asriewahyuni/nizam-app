import { NextRequest, NextResponse } from 'next/server'
import { queryPostgres } from '@/lib/db/postgres'
import { tagihIjarah } from '@/modules/kojasmat/actions/kojasmat-ijarah.actions'
import { timingSafeTextEqual } from '@/modules/ecommerce/payments/signature'

export const runtime = 'nodejs'

// Kojasmat — worker harian tagihan ijarah platform. Tidak ada penjadwal cron
// internal di repo ini (lihat cron lain di app/api/cron/*) — pemicu harian harus
// didaftarkan dari luar (mis. Railway Cron Service) yang memanggil endpoint ini
// dengan header Authorization: Bearer $COREISEC_CRON_SECRET.
export async function POST(request: NextRequest) {
  const expected = String(process.env.COREISEC_CRON_SECRET || '').trim()
  const provided = String(request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (expected.length < 32 || !timingSafeTextEqual(provided, expected)) {
    return NextResponse.json({ error: 'Akses ditolak.' }, { status: 401 })
  }
  try {
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
    return NextResponse.json({ success: true, processed: due.length, charged, frozen, failed })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Worker ijarah gagal.' },
      { status: 500 },
    )
  }
}
