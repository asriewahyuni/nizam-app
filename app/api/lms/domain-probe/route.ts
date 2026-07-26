/**
 * Bukti bahwa hostname manual sudah mencapai aplikasi Nizam melalui HTTPS.
 * Token hanya dipakai untuk verifikasi dan tidak mengaktifkan domain sendiri.
 */
import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { queryPostgres } from '@/lib/db/postgres'
import { normalizeLmsHostname } from '@/modules/ecommerce/lib/lms-domain'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const requestHeaders = await headers()
  const hostname = normalizeLmsHostname(
    requestHeaders.get('x-forwarded-host') || requestHeaders.get('host') || '',
  )
  const token = String(request.nextUrl.searchParams.get('token') || '').trim()
  if (!hostname || !/^[a-f0-9]{48}$/i.test(token)) {
    return NextResponse.json({ data: null }, { status: 404 })
  }

  const { rows } = await queryPostgres<{ id: string }>(
    `SELECT id::text
       FROM public.organization_domains
      WHERE lower(hostname) = lower($1)
        AND verification_token = $2
        AND purpose = 'LMS'
        AND status <> 'DISABLED'
      LIMIT 1`,
    [hostname, token],
  )
  if (!rows[0]) {
    return NextResponse.json({ data: null }, { status: 404 })
  }
  return NextResponse.json({ data: { domainId: rows[0].id } })
}
