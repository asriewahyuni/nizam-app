/**
 * Resolver tunggal hostname LMS untuk proxy. Hanya domain VERIFIED yang
 * dikembalikan sehingga domain belum siap tidak pernah menerima trafik tenant.
 */
import { NextRequest, NextResponse } from 'next/server'
import { resolveLmsTenantDomain } from '@/modules/ecommerce/domains/lms-domain.server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const host = request.nextUrl.searchParams.get('host') || ''
    const data = await resolveLmsTenantDomain(host)
    return NextResponse.json({ data }, { status: data ? 200 : 404 })
  } catch {
    return NextResponse.json(
      { error: 'Domain LMS tidak dapat diperiksa.' },
      { status: 500 },
    )
  }
}
