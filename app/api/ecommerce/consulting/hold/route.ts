/**
 * Endpoint publik untuk menahan satu paket jadwal Consulting 360 selama 15 menit.
 */
import { NextRequest, NextResponse } from 'next/server'
import {
  createConsultingSlotHold,
  enforceConsultingPublicRateLimit,
} from '@/modules/consulting/lib/consulting.server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json() as Record<string, unknown>
    const orgSlug = String(payload.orgSlug || '').trim()
    const storeSlug = String(payload.storeSlug || '').trim()
    const storeProductId = String(payload.storeProductId || '').trim()
    const consultantId = String(payload.consultantId || '').trim()
    const clientIp = String(
      request.headers.get('x-forwarded-for')
      || request.headers.get('x-real-ip')
      || '',
    ).trim()
    await enforceConsultingPublicRateLimit({
      orgSlug,
      storeSlug,
      actionType: 'CONSULTING_HOLD',
      scopeKey: `${storeProductId}:${clientIp || 'anon'}`,
      ipAddress: clientIp,
      limit: 20,
    })
    const data = await createConsultingSlotHold({
      orgSlug,
      storeSlug,
      storeProductId,
      consultantId,
      startsAt: Array.isArray(payload.startsAt)
        ? payload.startsAt.map((value) => String(value || ''))
        : [],
      goals: String(payload.goals || '').trim().slice(0, 5000) || null,
      intakeAnswers: (
        payload.intakeAnswers
        && typeof payload.intakeAnswers === 'object'
        && !Array.isArray(payload.intakeAnswers)
      )
        ? payload.intakeAnswers as Record<string, unknown>
        : {},
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Jadwal gagal ditahan.' },
      { status: 400 },
    )
  }
}
