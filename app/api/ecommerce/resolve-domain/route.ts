import { NextRequest, NextResponse } from 'next/server'
import { resolveStoreDomainHost } from '@/modules/ecommerce/lib/ecommerce.server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const host = request.nextUrl.searchParams.get('host') || ''
    const data = await resolveStoreDomainHost(host)
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal membaca domain store.' },
      { status: 400 }
    )
  }
}
