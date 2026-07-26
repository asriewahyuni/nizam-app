/**
 * Cron pemeriksaan DNS/SSL custom domain yang sudah terdaftar di Railway.
 */
import { NextRequest, NextResponse } from 'next/server'
import { refreshProvisionedLmsDomains } from '@/modules/ecommerce/domains/lms-domain.server'

export const runtime = 'nodejs'

function isAuthorized(request: NextRequest) {
  const expected = String(process.env.COREISEC_CRON_SECRET || '').trim()
  if (!expected) return false
  const authorization = String(request.headers.get('authorization') || '')
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : String(request.headers.get('x-cron-secret') || '').trim()
  return token === expected
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 401 })
  }
  try {
    const result = await refreshProvisionedLmsDomains(
      Number(request.nextUrl.searchParams.get('limit') || 50),
    )
    return NextResponse.json({ success: true, data: result })
  } catch {
    return NextResponse.json(
      { error: 'Pemeriksaan domain gagal dijalankan.' },
      { status: 500 },
    )
  }
}
