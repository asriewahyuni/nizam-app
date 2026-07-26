/**
 * Endpoint publik untuk membaca slot Consulting 360 yang masih tersedia.
 */
import { NextRequest, NextResponse } from 'next/server'
import {
  enforceConsultingPublicRateLimit,
  getPublicConsultingAvailability,
} from '@/modules/consulting/lib/consulting.server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams
    const orgSlug = String(search.get('orgSlug') || '').trim()
    const storeSlug = String(search.get('storeSlug') || '').trim()
    const storeProductId = String(search.get('storeProductId') || '').trim()
    const consultantId = String(search.get('consultantId') || '').trim()
    const clientIp = String(
      request.headers.get('x-forwarded-for')
      || request.headers.get('x-real-ip')
      || '',
    ).trim()
    await enforceConsultingPublicRateLimit({
      orgSlug,
      storeSlug,
      actionType: 'CONSULTING_AVAILABILITY',
      scopeKey: `${storeProductId}:${consultantId}`,
      ipAddress: clientIp,
      limit: 120,
    })
    const data = await getPublicConsultingAvailability({
      orgSlug,
      storeSlug,
      storeProductId,
      consultantId,
      fromDate: search.get('fromDate') || undefined,
      toDate: search.get('toDate') || undefined,
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Jadwal tidak dapat dimuat.' },
      { status: 400 },
    )
  }
}
