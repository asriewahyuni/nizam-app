/**
 * Validasi kode diskon untuk pratinjau checkout publik.
 * Harga akhir tetap dihitung ulang saat order benar-benar dibuat.
 */
import { NextRequest, NextResponse } from 'next/server'
import { validatePublicCheckoutCoupon } from '@/modules/ecommerce/lib/ecommerce.server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()
    const source = (
      typeof payload === 'object' && payload && !Array.isArray(payload)
        ? payload
        : {}
    ) as Record<string, unknown>
    const data = await validatePublicCheckoutCoupon({
      ...source,
      clientIp:
        String(request.headers.get('x-forwarded-for') || '').trim()
        || String(request.headers.get('x-real-ip') || '').trim(),
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Kode diskon tidak dapat diperiksa.' },
      { status: 400 },
    )
  }
}
